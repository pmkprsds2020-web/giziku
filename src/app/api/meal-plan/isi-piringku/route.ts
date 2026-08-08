import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, handleZod, ageFromBirth } from "@/lib/api-helpers";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import {
  generateMealPlan,
  generateAIReasoning,
} from "@/lib/ai/meal-generator";
import {
  supabaseListMealPlans,
  supabaseGetPatient,
  getServerClient,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

// ---------------------------------------------------------------------
// POST /api/meal-plan/isi-piringku
// Generates an Isi Piringku compliant meal plan PREVIEW (does not persist).
// ALL data comes from Supabase — NO Prisma (except fallback).
//
// Body: { patientId, presetId?, rotationHistory?, currentDay? }
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const {
      patientId,
      presetId,
      rotationHistory,
      currentDay,
    } = body as {
      patientId?: string;
      presetId?: string;
      rotationHistory?: { day: number; items: { foodId: string; foodName: string }[] }[];
      currentDay?: number;
    };

    if (!patientId) return err("patientId wajib diisi", 422);

    // 1. Auth session
    console.log("[isi-piringku] Step 1: checking auth session...");
    const { client, session } = await getServerClient();
    if (!session) {
      console.warn("[isi-piringku] No authenticated session — RLS will block patient data");
      return err("Authentication required. Silakan login ulang.", 401);
    }
    console.log("[isi-piringku] Auth OK, user:", session.user?.email, "patientId:", patientId);

    // 2. Resolve Prisma cuid → Supabase UUID if needed
    console.log("[isi-piringku] Step 2: resolving patientId...");
    const resolvedPatientId = await resolvePatientId(patientId);
    console.log("[isi-piringku] resolvedPatientId:", resolvedPatientId);

    // 3. Fetch patient — Supabase first, fall back to Prisma
    console.log("[isi-piringku] Step 3: fetching patient...");
    let patient: any = await supabaseGetPatient(resolvedPatientId);
    if (!patient) {
      console.warn("[isi-piringku] Supabase patient not found, falling back to Prisma with raw patientId");
      patient = await db.patient.findUnique({
        where: { id: patientId },
        include: {
          diagnoses: { where: { active: true } },
          assessments: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      });
    }
    if (!patient) return err("Pasien tidak ditemukan. Pastikan pasien sudah dibuat dan Anda login dengan akun yang benar.", 404);
    if (!patient.height || !patient.weight)
      return err("Tinggi & berat badan pasien harus diisi", 422);

    // 4. Filter active diagnoses — MUST be declared before first use
    const activeDiagnoses = (patient.diagnoses || []).filter((d: any) => d.active);

    console.log(
      "[isi-piringku] Patient loaded:",
      patient.name,
      "height:", patient.height,
      "weight:", patient.weight,
      "diagnoses:", activeDiagnoses.length
    );

    const ageYears = ageFromBirth(patient.birthDate);
    const latestAssessment = patient.assessments?.[0];

    // 5. Derive activity & stress from assessment
    console.log("[isi-piringku] Step 5: deriving activity/stress from assessment...");
    let activity = "LIGHT" as string;
    let stress = "NONE" as string;
    if (latestAssessment) {
      if (latestAssessment.activity) {
        activity = latestAssessment.activity;
      } else if (latestAssessment.ecog) {
        const ecogNum = Number(latestAssessment.ecog);
        if (ecogNum >= 3) activity = "BED_REST";
        else if (ecogNum === 2) activity = "VERY_LIGHT";
        else if (ecogNum === 1) activity = "LIGHT";
        else activity = "MODERATE";
      } else if (latestAssessment.barthel != null) {
        if (latestAssessment.barthel < 40) activity = "BED_REST";
        else if (latestAssessment.barthel < 60) activity = "VERY_LIGHT";
        else activity = "LIGHT";
      }
      if (latestAssessment.stress) stress = latestAssessment.stress;
    }
    console.log("[isi-piringku] activity:", activity, "stress:", stress);

    // 6. Compute calorie target
    console.log("[isi-piringku] Step 6: computing calorie target...");
    const calResult = computeCalorieTarget({
      gender: patient.gender,
      ageYears,
      heightCm: patient.height,
      weightKg: patient.weight,
      activity: activity as any,
      stress: stress as any,
      diagnoses: activeDiagnoses.map((d: any) => d.type),
      isPregnant: patient.isPregnant,
      pregnancyTrimester: patient.pregnancyTrimester,
      isLactating: patient.isLactating,
    });
    console.log("[isi-piringku] targetCalorie:", calResult.targetCalorie);

    // 7. Preset override — fetch from Supabase (reuse existing `client`, no duplicate getServerClient() call)
    let preset: any = null;
    let targets = {
      targetCal: calResult.targetCalorie,
      targetProtein: calResult.macros.proteinG,
      targetFat: calResult.macros.fatG,
      targetCarb: calResult.macros.carbG,
      targetFiber: calResult.fiberTarget,
      targetSodium: calResult.sodiumMax,
    };
    if (presetId) {
      console.log("[isi-piringku] Step 7: fetching preset", presetId, "...");
      const { data: presetData, error: presetError } = await client
        .from("nutrition_presets")
        .select("*")
        .eq("id", presetId)
        .is("deleted_at", null)
        .single();

      if (presetError) {
        console.warn("[isi-piringku] Preset fetch error:", presetError.message);
      }

      if (presetData) {
        preset = {
          id: presetData.id,
          name: presetData.name,
          totalCal: presetData.total_cal,
          proteinG: presetData.protein_g,
          fatG: presetData.fat_g,
          carbG: presetData.carb_g,
          fiberG: presetData.fiber_g,
          sodiumMg: presetData.sodium_mg,
          proteinPct: presetData.protein_pct,
          fatPct: presetData.fat_pct,
          carbPct: presetData.carb_pct,
        };
        targets = {
          targetCal: preset.totalCal,
          targetProtein: preset.proteinG,
          targetFat: preset.fatG,
          targetCarb: preset.carbG,
          targetFiber: preset.fiberG,
          targetSodium: preset.sodiumMg,
        };
        (calResult as any).targetCalorie = preset.totalCal;
        (calResult as any).macros = {
          proteinG: preset.proteinG,
          fatG: preset.fatG,
          carbG: preset.carbG,
          proteinKcal: preset.proteinG * 4,
          fatKcal: preset.fatG * 9,
          carbKcal: preset.carbG * 4,
          proteinPct: preset.proteinPct,
          fatPct: preset.fatPct,
          carbPct: preset.carbPct,
        };
        (calResult as any).fiberTarget = preset.fiberG;
        (calResult as any).sodiumMax = preset.sodiumMg;
        console.log("[isi-piringku] Preset applied:", preset.name);
      } else {
        console.warn("[isi-piringku] Preset not found for id:", presetId);
      }
    }

    // 8. Build rotation history from patient's last 14 meal plans (from Supabase)
    // IMPORTANT: use resolvedPatientId, not the raw (possibly Prisma cuid) patientId,
    // otherwise history lookup silently returns nothing when Supabase stores UUIDs.
    let rotation = rotationHistory;
    if (!rotation) {
      console.log("[isi-piringku] Step 8: fetching rotation history for resolvedPatientId:", resolvedPatientId);
      const recentPlans = await supabaseListMealPlans(resolvedPatientId);
      rotation = recentPlans.slice(0, 14).map((p: any, idx: number) => ({
        day: idx,
        items: (p.items || []).map((i: any) => ({ foodId: i.foodId, foodName: i.food?.name || "" })),
      }));
      console.log("[isi-piringku] rotation history days found:", rotation.length);
    }

    // 9. Latest confirmed + AI-analyzed nutrigenomic findings (optional,
    // independent layer — see lib/clinical/genomic-food-rules.ts).
    let genomicFindings: { geneSymbol: string; genotype?: string | null; callTag?: string | null }[] = [];
    try {
      const { data: latestReport } = await client
        .from("genomic_reports")
        .select("id")
        .eq("patient_id", resolvedPatientId)
        .eq("status", "ANALYZED")
        .is("deleted_at", null)
        .order("exam_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestReport) {
        const { data: findingRows } = await client
          .from("genomic_findings")
          .select("gene_symbol, genotype, clinical_meaning")
          .eq("report_id", latestReport.id);
        genomicFindings = (findingRows || []).map((f: any) => ({
          geneSymbol: f.gene_symbol,
          genotype: f.genotype,
          callTag: f.clinical_meaning,
        }));
      }
    } catch (e) {
      console.error("[isi-piringku] genomic findings fetch failed (non-fatal):", e);
    }

    // 10. Generate meal plan
    console.log("[isi-piringku] Step 9: generating meal plan...");
    const plan = await generateMealPlan(
      calResult,
      activeDiagnoses.map((d: any) => d.type),
      { rotationHistory: rotation, currentDay: currentDay ?? (rotation?.length ?? 0), genomicFindings },
    );
    console.log("[isi-piringku] Meal plan generated, items:", plan.items?.length);

    // 10. AI reasoning with timeout and fallback
    console.log("[isi-piringku] Step 10: generating AI reasoning...");
    let reasoning = `Rencana makan disusun mengikuti Pedoman "Isi Piringku" Kemenkes RI dengan compliance ${plan.overallCompliance}% (${plan.overallTierLabel}). Setiap makan utama mengandung makanan pokok, lauk pauk, sayuran, dan buah.`;

    try {
      const reasoningPromise = generateAIReasoning(
        calResult,
        plan,
        activeDiagnoses.map((d: any) => d.type),
        patient.name,
      );
      const timeoutPromise = new Promise<{ text: string; model: string }>((_, reject) =>
        setTimeout(() => reject(new Error("AI reasoning timeout")), 15000)
      );
      // generateAIReasoning resolves to { text, model } — NOT a plain string.
      // Extract `.text` here so `reasoning` (and thus `aiReasoning` in the
      // response payload) is always a string. Sending the raw object through
      // caused the frontend to render an object as a React child (Minified
      // React error #31 / white screen) whenever AI reasoning succeeded.
      const reasoningResult = await Promise.race([reasoningPromise, timeoutPromise]);
      reasoning = reasoningResult.text;
      console.log("[isi-piringku] AI reasoning generated successfully, model:", reasoningResult.model);
    } catch (e) {
      console.warn("[isi-piringku] AI reasoning failed, using fallback:", e);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[isi-piringku] DONE in ${elapsed}ms — items: ${plan.items?.length}, cal: ${plan.totals?.cal}, compliance: ${plan.overallCompliance}%`);

    return ok({
      plan,
      calorieResult: calResult,
      preset,
      aiReasoning: reasoning,
      patient: {
        id: patient.id,
        name: patient.name,
        mrn: patient.mrn,
        diagnoses: activeDiagnoses.map((d: any) => d.type),
      },
      targets,
      isPreview: true,
    });
  } catch (e: any) {
    console.error("[isi-piringku] FATAL ERROR:", e.message, e.stack);
    return handleZod(e);
  }
}
