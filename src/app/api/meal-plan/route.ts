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
  supabaseCreateMealPlan,
  supabaseGetActiveMealPlan,
  getServerClient,
  supabaseGetPatient,
  supabaseListLabResults,
  resolvePatientId,
} from "@/lib/supabase/data-layer";
import { LAB_CATEGORY_LABELS, type LabCategory } from "@/lib/clinical/lab-catalog";
import { computeProteinAdjustment, computeAlbuminFlag } from "@/lib/clinical/assessment-adjustments";

// ---------------------------------------------------------------------
// GET /api/meal-plan?patientId=...            -> list (most recent 20)
// GET /api/meal-plan?patientId=...&active=true -> single active plan
//   ("Meal Plan Aktif" — the single source of truth for Editor,
//   Shopping Planner, Isi Piringku visualization, and nutrition
//   validation). Reads from Supabase only.
// ---------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const activeOnly = searchParams.get("active") === "true";

    if (activeOnly) {
      if (!patientId) return err("patientId wajib diisi", 422);
      const plan = await supabaseGetActiveMealPlan(patientId);
      return ok(plan);
    }

    const plans = await supabaseListMealPlans(patientId || undefined);
    return ok(plans);
  } catch (e) {
    return handleZod(e);
  }
}

// ---------------------------------------------------------------------
// POST /api/meal-plan
// Generate Isi Piringku compliant meal plan AND persist to Supabase.
// ALL data comes from Supabase — NO Prisma.
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { patientId, presetId, plan: previewPlan, calorieResult: previewCalorieResult, aiReasoning: previewReasoning, preset: previewPreset } = body as {
      patientId?: string;
      presetId?: string;
      // Optional: an already-generated preview from POST /api/meal-plan/isi-piringku
      // ("Generate" button, in-memory / not yet persisted). When present, this
      // endpoint persists it VERBATIM instead of running the generator again —
      // otherwise "Simpan ke Database" would silently save a brand-new random
      // plan that never matches what the clinician reviewed as "Daftar Menu
      // Lengkap" on screen (rotation/randomization means every generator run
      // can pick different foods, even for the same patient/targets).
      plan?: any;
      calorieResult?: any;
      aiReasoning?: string;
      preset?: any;
    };
    if (!patientId) return err("patientId wajib diisi", 422);

    // Resolve Prisma cuid → Supabase UUID if needed
    const resolvedPatientId = await resolvePatientId(patientId);

    // -------------------------------------------------------------------
    // FAST PATH: persist an already-generated preview verbatim (no
    // regeneration). This is what "Simpan ke Database" on the AI Meal
    // Plan page uses after "Generate" has produced a previewData the
    // user has reviewed.
    // -------------------------------------------------------------------
    if (previewPlan && Array.isArray(previewPlan.items) && previewCalorieResult) {
      let patientForPreview: any = await supabaseGetPatient(resolvedPatientId);
      if (!patientForPreview) {
        patientForPreview = await db.patient.findUnique({
          where: { id: patientId },
          include: { diagnoses: { where: { active: true } } },
        });
      }
      if (!patientForPreview) return err("Pasien tidak ditemukan", 404);

      const activeDx = (patientForPreview.diagnoses || []).filter((d: any) => d.active);

      const planData = {
        patientId,
        presetId: presetId || null,
        date: new Date().toISOString(),
        targetCal: previewCalorieResult.targetCalorie,
        targetProtein: previewCalorieResult.macros.proteinG,
        targetFat: previewCalorieResult.macros.fatG,
        targetCarb: previewCalorieResult.macros.carbG,
        targetFiber: previewCalorieResult.fiberTarget,
        targetSodium: previewCalorieResult.sodiumMax,
        totalCal: previewPlan.totals.cal,
        totalProtein: previewPlan.totals.protein,
        totalFat: previewPlan.totals.fat,
        totalCarb: previewPlan.totals.carb,
        totalFiber: previewPlan.totals.fiber,
        totalSodium: previewPlan.totals.sodium,
        compliance: previewPlan.overallCompliance,
        status: "FINAL",
        aiModel: previewPreset
          ? `carelivia-isi-piringku-v2 + z-ai-llm (preset: ${previewPreset.name})`
          : "carelivia-isi-piringku-v2 + z-ai-llm",
        aiReasoning: previewReasoning || null,
      };

      const itemsData = previewPlan.items.map((i: any) => ({
        slot: i.slot,
        foodId: i.foodId,
        amount: i.amount,
        cal: i.cal,
        protein: i.protein,
        fat: i.fat,
        carb: i.carb,
        fiber: i.fiber,
        sodium: i.sodium,
      }));

      const { data: mealPlan, error: saveError } = await supabaseCreateMealPlan(planData, itemsData);
      if (saveError || !mealPlan) return err(saveError || "Gagal menyimpan meal plan", 500);

      return ok({
        plan: previewPlan,
        mealPlan,
        calorieResult: previewCalorieResult,
        preset: previewPreset || null,
        aiReasoning: previewReasoning || null,
        compliance: previewPlan.overallCompliance,
        patient: {
          id: patientForPreview.id,
          name: patientForPreview.name,
          mrn: patientForPreview.mrn,
          diagnoses: activeDx.map((d: any) => d.type),
        },
        targets: {
          targetCal: previewCalorieResult.targetCalorie,
          targetProtein: previewCalorieResult.macros.proteinG,
          targetFat: previewCalorieResult.macros.fatG,
          targetCarb: previewCalorieResult.macros.carbG,
          targetFiber: previewCalorieResult.fiberTarget,
          targetSodium: previewCalorieResult.sodiumMax,
        },
        savedTo: "Supabase PostgreSQL",
      });
    }

    // -------------------------------------------------------------------
    // SLOW PATH (no preview supplied): generate AND persist in one call.
    // -------------------------------------------------------------------
    // Try Supabase first, fall back to Prisma for patient data
    let patient: any = await supabaseGetPatient(resolvedPatientId);
    if (!patient) {
      patient = await db.patient.findUnique({
        where: { id: patientId },
        include: {
          diagnoses: { where: { active: true } },
          assessments: { orderBy: { recordedAt: "desc" }, take: 1 },
        },
      });
    }
    if (!patient) return err("Pasien tidak ditemukan", 404);
    if (!patient.height || !patient.weight)
      return err("Tinggi & berat badan pasien harus diisi", 422);

    const ageYears = ageFromBirth(patient.birthDate);
    const latestAssessment = patient.assessments?.[0];

    // Filter active diagnoses
    const activeDiagnoses = (patient.diagnoses || []).filter((d: any) => d.active);

    // Derive activity & stress from assessment
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

    // -------------------------------------------------------------------
    // AUTO-SYNC: Asesmen Gizi & Fungsional → Meal Plan (tanpa input ulang)
    // Malnutrisi (MNA/SGA/MUST), probable sarcopenia (SARC-F/SARC-CalF),
    // atau frailty (FRAIL/CFS) yang tercatat pada asesmen terbaru otomatis
    // menaikkan target protein (ESPEN/PROT-AGE/EWGSOP2). Kalori total
    // target TIDAK berubah — kenaikan gram protein ditukar 1:1 kkal dari
    // karbohidrat agar target energi tetap konsisten dengan hasil
    // computeCalorieTarget di atas. Tidak dijalankan jika presetId dipakai
    // (preset = override manual klinisi, harus dihormati) atau jika pasien
    // punya diagnosis dengan pembatasan protein (CKD/LIVER) — pada kondisi
    // itu hanya flag advisory yang ditampilkan, bukan perubahan angka.
    // -------------------------------------------------------------------
    const clinicalFlags: string[] = [];
    if (latestAssessment && !presetId) {
      const proteinAdj = computeProteinAdjustment(
        latestAssessment,
        activeDiagnoses.map((d: any) => d.type),
      );
      if (proteinAdj.perKgRange && !proteinAdj.restrictedByDiagnosis) {
        const [low, high] = proteinAdj.perKgRange;
        const targetProteinPerKg = (low + high) / 2;
        const boostedProteinG = Math.round(patient.weight * targetProteinPerKg);
        if (boostedProteinG > calResult.macros.proteinG) {
          const deltaG = boostedProteinG - calResult.macros.proteinG;
          const newCarbG = Math.max(0, Math.round(calResult.macros.carbG - deltaG));
          calResult.macros.proteinG = boostedProteinG;
          calResult.macros.proteinKcal = boostedProteinG * 4;
          calResult.macros.carbG = newCarbG;
          calResult.macros.carbKcal = newCarbG * 4;
        }
      }
      clinicalFlags.push(...proteinAdj.flags);
    }

    // Preset override — fetch from Supabase
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
      const { client } = await getServerClient();
      const { data: presetData } = await client
        .from("nutrition_presets")
        .select("*")
        .eq("id", presetId)
        .is("deleted_at", null)
        .single();
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
      } else {
        // Prisma fallback for preset
        preset = await db.nutritionPreset.findUnique({ where: { id: presetId } });
      }
      if (preset && !(preset as any).deletedAt) {
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
      }
    }

    // Build rotation history from patient's last 14 meal plans (from Supabase)
    const recentPlans = await supabaseListMealPlans(patientId);
    const rotationHistory = recentPlans.slice(0, 14).map((p: any, idx: number) => ({
      day: idx,
      items: (p.items || []).map((i: any) => ({ foodId: i.foodId, foodName: i.food?.name || "" })),
    }));

    // Latest lab results — feeds BOTH the deterministic food-selection
    // engine (excludes/prefers specific foods per abnormal value, e.g.
    // LDL tinggi → excludes high-saturated-fat proteins) and the AI
    // reasoning narrative below. See src/lib/clinical/lab-food-rules.ts
    // for the exact rule set and evidence basis.
    const labResults = await supabaseListLabResults(patientId);

    // Latest confirmed + AI-analyzed nutrigenomic findings (Nutrigenomic
    // AI module) — same "independent optional layer" contract as labs.
    // A patient with no genomic report simply gets an empty array here,
    // reproducing the exact pre-nutrigenomic behavior.
    let genomicFindings: { geneSymbol: string; genotype?: string | null; callTag?: string | null }[] = [];
    try {
      const { client } = await getServerClient();
      const { data: latestReport } = await client
        .from("genomic_reports")
        .select("id")
        .eq("patient_id", patientId)
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
      console.error("[meal-plan] genomic findings fetch failed (non-fatal):", e);
    }

    // Auto-tarik lab (albumin) — advisory flag only, tidak mengubah angka.
    if (labResults.length > 0) {
      const latestByTest = new Map<string, any>();
      for (const r of labResults) {
        if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
      }
      const albuminFlag = computeAlbuminFlag(
        Array.from(latestByTest.values()).map((r: any) => ({ testName: r.testName, value: Number(r.value) })),
      );
      if (albuminFlag) clinicalFlags.push(albuminFlag);
    }

    const plan = await generateMealPlan(
      calResult,
      activeDiagnoses.map((d: any) => d.type),
      { rotationHistory, currentDay: rotationHistory.length, labResults, genomicFindings },
    );

    // AI reasoning with timeout and fallback
    let reasoning = `Rencana makan disusun mengikuti Pedoman "Isi Piringku" Kemenkes RI dengan compliance ${plan.overallCompliance}% (${plan.overallTierLabel}). Setiap makan utama mengandung makanan pokok, lauk pauk, sayuran, dan buah. Komposisi disesuaikan untuk diagnosis: ${calResult.primaryDiagnosis?.label || "Umum"}.`;

    try {
      const labSummary = [...plan.labFoodAdjustments, ...plan.genomicFoodAdjustments].join(" ");

      const reasoningPromise = generateAIReasoning(
        calResult,
        plan,
        activeDiagnoses.map((d: any) => d.type),
        patient.name,
        patientId,
        labSummary || undefined,
      );
      const timeoutPromise = new Promise<{ text: string; model: string }>((_, reject) =>
        setTimeout(() => reject(new Error("AI reasoning timeout")), 15000)
      );
      const result = await Promise.race([reasoningPromise, timeoutPromise]);
      reasoning = result.text;
    } catch (e) {
      console.warn("[meal-plan] AI reasoning failed, using fallback:", e);
    }

    // Prepend deterministic clinical auto-sync flags — guaranteed to show
    // even if the AI reasoning call above failed or timed out.
    if (clinicalFlags.length > 0) {
      reasoning = `Catatan Klinis Otomatis (Asesmen Gizi & Fungsional): ${clinicalFlags.join(" ")}\n\n${reasoning}`;
    }

    // Persist to Supabase PostgreSQL
    const planData = {
      patientId,
      presetId: presetId || null,
      date: new Date().toISOString(),
      targetCal: targets.targetCal,
      targetProtein: targets.targetProtein,
      targetFat: targets.targetFat,
      targetCarb: targets.targetCarb,
      targetFiber: targets.targetFiber,
      targetSodium: targets.targetSodium,
      totalCal: plan.totals.cal,
      totalProtein: plan.totals.protein,
      totalFat: plan.totals.fat,
      totalCarb: plan.totals.carb,
      totalFiber: plan.totals.fiber,
      totalSodium: plan.totals.sodium,
      compliance: plan.overallCompliance,
      status: "FINAL",
      aiModel: preset
        ? `carelivia-isi-piringku-v2 + z-ai-llm (preset: ${preset.name})`
        : "carelivia-isi-piringku-v2 + z-ai-llm",
      aiReasoning: reasoning,
    };

    const itemsData = plan.items.map((i) => ({
      slot: i.slot,
      foodId: i.foodId,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
    }));

    const { data: mealPlan, error: saveError } = await supabaseCreateMealPlan(planData, itemsData);

    if (saveError) {
      // Prisma fallback — saves to local SQLite when Supabase isn't accessible
      console.warn("[meal-plan] Supabase save failed, falling back to Prisma:", saveError);
      try {
        const prismaMealPlan = await db.mealPlan.create({
          data: {
            patientId,
            presetId: presetId || null,
            date: new Date(),
            targetCal: targets.targetCal,
            targetProtein: targets.targetProtein,
            targetFat: targets.targetFat,
            targetCarb: targets.targetCarb,
            targetFiber: targets.targetFiber,
            targetSodium: targets.targetSodium,
            totalCal: plan.totals.cal,
            totalProtein: plan.totals.protein,
            totalFat: plan.totals.fat,
            totalCarb: plan.totals.carb,
            totalFiber: plan.totals.fiber,
            totalSodium: plan.totals.sodium,
            compliance: plan.overallCompliance,
            status: "FINAL",
            aiModel: preset
              ? `carelivia-isi-piringku-v2 + z-ai-llm (preset: ${preset.name})`
              : "carelivia-isi-piringku-v2 + z-ai-llm",
            aiReasoning: reasoning,
            items: {
              create: plan.items.map((i) => ({
                slot: i.slot,
                foodId: i.foodId,
                amount: i.amount,
                cal: i.cal,
                protein: i.protein,
                fat: i.fat,
                carb: i.carb,
                fiber: i.fiber,
                sodium: i.sodium,
              })),
            },
          },
          include: { items: true },
        });
        return ok({
          plan,
          mealPlan: prismaMealPlan,
          calorieResult: calResult,
          preset,
          aiReasoning: reasoning,
          compliance: plan.overallCompliance,
          patient: { id: patient.id, name: patient.name, mrn: patient.mrn, diagnoses: activeDiagnoses.map((d: any) => d.type) },
          targets,
          savedTo: "Local cache (login required for Supabase)",
        });
      } catch (prismaErr: any) {
        return err(`Gagal menyimpan meal plan: ${saveError}`, 500);
      }
    }

    return ok({
      plan,
      mealPlan,
      calorieResult: calResult,
      preset,
      aiReasoning: reasoning,
      compliance: plan.overallCompliance,
      patient: {
        id: patient.id,
        name: patient.name,
        mrn: patient.mrn,
        diagnoses: activeDiagnoses.map((d: any) => d.type),
      },
      targets,
      savedTo: "Supabase PostgreSQL",
    });
  } catch (e) {
    return handleZod(e);
  }
}
