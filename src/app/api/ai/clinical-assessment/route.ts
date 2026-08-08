export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { ClinicalAssessmentOutputSchema } from "@/lib/ai/schemas/features";
import { CLINICAL_ASSESSMENT_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import {
  getServerClient,
  supabaseGetPatient,
  supabaseListWeightRecords,
  supabaseGetActiveMealPlan,
  supabaseListFoodRecords,
  supabaseListExercisePlans,
  supabaseListLabResults,
  resolvePatientId,
} from "@/lib/supabase/data-layer";
import { LAB_CATEGORY_LABELS, type LabCategory } from "@/lib/clinical/lab-catalog";
import {
  classifyBMI,
  idealBodyWeight,
  DIAGNOSIS_ADJUSTMENTS,
} from "@/lib/clinical/constants";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import { buildFallbackClinicalAssessment, type FallbackAssessmentContext } from "@/lib/ai/fallback-clinical-assessment";

const RequestSchema = z.object({
  patientId: z.string().min(1),
});

function calcAge(birthDate: string | Date): number {
  const d = new Date(birthDate);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 86400000));
}

const GENDER_LABEL: Record<string, string> = { MALE: "Laki-laki", FEMALE: "Perempuan" };
const ACTIVITY_LABEL: Record<string, string> = {
  BED_REST: "Bedrest",
  VERY_LIGHT: "Sangat Ringan",
  LIGHT: "Ringan",
  MODERATE: "Sedang",
  HEAVY: "Berat",
};

// -----------------------------------------------------------------------
// Aggregates every CareLivia module for one patient into a single,
// richly-labelled Indonesian-language clinical narrative the model can
// reason over — so the clinician never has to re-enter data that already
// exists elsewhere in the app.
// -----------------------------------------------------------------------
async function buildPatientDataBlock(
  patientId: string,
): Promise<{ text: string; patientName: string; fallbackContext: FallbackAssessmentContext }> {
  const [patient, weightRecords, activeMealPlan, foodRecords, exercisePlans, labResults] = await Promise.all([
    supabaseGetPatient(patientId),
    supabaseListWeightRecords(patientId),
    supabaseGetActiveMealPlan(patientId),
    supabaseListFoodRecords(patientId),
    supabaseListExercisePlans(patientId),
    supabaseListLabResults(patientId),
  ]);

  if (!patient) throw new Error("Pasien tidak ditemukan");

  const age = calcAge(patient.birthDate);
  const height = patient.height ?? null;
  const latestWeightRecord = weightRecords[weightRecords.length - 1];
  const weight = latestWeightRecord?.weight ?? patient.weight ?? null;
  const bmi = height && weight ? weight / Math.pow(height / 100, 2) : null;
  const bmiInfo = bmi ? classifyBMI(bmi) : null;
  const ibw = height ? idealBodyWeight(height, patient.gender) : null;

  const activeDx0 = (patient.diagnoses || []).filter((d: any) => d.active);
  const latestAssessment0 = (patient.assessments || [])[0];

  let calorieResult: ReturnType<typeof computeCalorieTarget> | null = null;
  if (height && weight && age) {
    try {
      calorieResult = computeCalorieTarget({
        gender: patient.gender,
        ageYears: age,
        heightCm: height,
        weightKg: weight,
        activity: latestAssessment0?.activity || "LIGHT",
        stress: latestAssessment0?.stress || "MODERATE",
        diagnoses: activeDx0.map((d: any) => d.type),
        isPregnant: patient.isPregnant,
        pregnancyTrimester: patient.pregnancyTrimester,
        isLactating: patient.isLactating,
      });
    } catch (e) {
      console.error("[clinical-assessment] computeCalorieTarget failed:", e);
    }
  }

  const lines: string[] = [];

  lines.push("=== DEMOGRAFI ===");
  lines.push(
    `Nama: ${patient.name} | Usia: ${age} tahun | Jenis kelamin: ${GENDER_LABEL[patient.gender] || patient.gender}`,
  );
  lines.push(
    `Tinggi: ${height ?? "-"} cm | Berat: ${weight ?? "-"} kg | BMI: ${bmi ? bmi.toFixed(1) : "-"} (${bmiInfo?.label ?? "-"}) | Berat ideal (BBI): ${ibw ? ibw.toFixed(1) : "-"} kg`,
  );
  if (patient.isPregnant) lines.push(`Hamil, trimester ${patient.pregnancyTrimester}`);
  if (patient.isLactating) lines.push(`Menyusui, bulan ke-${patient.lactationMonth}`);
  if (patient.allergy) lines.push(`Alergi/pantangan: ${patient.allergy}`);

  // ---- Anthropometry reasoning (computed by CareLivia's own engine) -----
  lines.push("\n=== ANALISIS ANTROPOMETRI (dihitung otomatis) ===");
  if (calorieResult) {
    const weightStep = calorieResult.steps.find((s) => s.step === 3);
    lines.push(
      `BMI: ${calorieResult.bmi} (${calorieResult.bmiLabel}) | BBI: ${calorieResult.ibw} kg | Berat yang dipakai untuk perhitungan kebutuhan gizi: ${calorieResult.adjustedWeight} kg`,
    );
    lines.push(`Metode & alasan (dihitung sistem, JANGAN dihitung ulang berbeda): ${weightStep?.description || "-"}`);
    if (calorieResult.warnings.length) lines.push(`Peringatan sistem: ${calorieResult.warnings.join("; ")}`);
    lines.push(
      `Target kebutuhan gizi hasil perhitungan: ${calorieResult.targetCalorie} kkal, protein ${calorieResult.macros.proteinG}g, lemak ${calorieResult.macros.fatG}g, karbo ${calorieResult.macros.carbG}g, serat ${calorieResult.fiberTarget}g, natrium maks ${calorieResult.sodiumMax}mg${calorieResult.potassiumMax ? `, kalium maks ${calorieResult.potassiumMax}mg` : ""}${calorieResult.phosphorusMax ? `, fosfor maks ${calorieResult.phosphorusMax}mg` : ""}, cairan ${calorieResult.waterMl}ml`,
    );
  } else {
    lines.push("Data tinggi/berat/usia tidak lengkap — perhitungan kebutuhan gizi otomatis tidak dapat dilakukan.");
  }

  // ---- Diagnoses + internal guideline snapshot -------------------------
  const activeDx = (patient.diagnoses || []).filter((d: any) => d.active);
  lines.push("\n=== DIAGNOSIS AKTIF ===");
  if (activeDx.length === 0) {
    lines.push("Tidak ada diagnosis aktif tercatat.");
  } else {
    for (const d of activeDx) {
      const adj = DIAGNOSIS_ADJUSTMENTS[d.type as keyof typeof DIAGNOSIS_ADJUSTMENTS];
      const meta: string[] = [];
      if (d.classification) meta.push(d.classification);
      if (d.status) meta.push(`status ${d.status}`);
      if (d.priority) meta.push(`prioritas ${d.priority}`);
      lines.push(
        `- ${adj?.label || d.type}${meta.length ? ` [${meta.join(", ")}]` : ""}${d.severity ? ` (${d.severity})` : ""}${d.notes ? ` — ${d.notes}` : ""}`,
      );
      if (d.target) lines.push(`  Target terapi klinisi: ${d.target}`);
      if (adj) {
        lines.push(
          `  GUIDELINE INTERNAL CARELIVIA: protein ${adj.proteinPerKg[0]}-${adj.proteinPerKg[1]} g/kgBB, lemak ${adj.fatPct[0]}-${adj.fatPct[1]}%, karbo ${adj.carbPct[0]}-${adj.carbPct[1]}%, serat ${adj.fiberTarget}g, natrium maks ${adj.sodiumMax}mg${adj.potassiumMax ? `, kalium maks ${adj.potassiumMax}mg` : ""}${adj.phosphorusMax ? `, fosfor maks ${adj.phosphorusMax}mg` : ""}. ${adj.notes}`,
        );
      }
    }
  }

  // ---- Weight trend ------------------------------------------------------
  lines.push("\n=== TREN BERAT BADAN ===");
  if (weightRecords.length === 0) {
    lines.push("Belum ada riwayat pengukuran berat badan berkala.");
  } else {
    const recent = weightRecords.slice(-5);
    for (const w of recent) {
      lines.push(
        `- ${new Date(w.date).toLocaleDateString("id-ID")}: ${w.weight}kg (BMI ${w.bmi ?? "-"}, ${w.bmiCategory ?? "-"})${w.note ? ` — ${w.note}` : ""}`,
      );
    }
  }

  // ---- Nutrition screening (MUST/SGA/NRS2002/MNA/frailty/etc) ----------
  const latestAssessment = (patient.assessments || [])[0];
  lines.push("\n=== SKRINING GIZI & GERIATRI TERKINI ===");
  if (!latestAssessment) {
    lines.push("Belum ada data skrining gizi (MUST/SGA/NRS2002/MNA) tercatat.");
  } else {
    const a = latestAssessment;
    const parts: string[] = [];
    if (a.must) parts.push(`MUST: ${a.must} (skor ${a.mustScore ?? "-"})`);
    if (a.sga) parts.push(`SGA: ${a.sga}`);
    if (a.nrs2002) parts.push(`NRS-2002: ${a.nrs2002} (skor ${a.nrsScore ?? "-"})`);
    if (a.mna) parts.push(`MNA: ${a.mna} (skor ${a.mnaScore ?? "-"})`);
    if (a.ecog) parts.push(`ECOG: ${a.ecog}`);
    if (a.barthel != null) parts.push(`Barthel Index: ${a.barthel}`);
    if (a.frailty) parts.push(`Frailty: ${a.frailty} (skor ${a.frailtyScore ?? "-"})`);
    if (a.fallRisk) parts.push(`Risiko jatuh: ${a.fallRisk}`);
    if (a.handGrip != null) parts.push(`Hand grip: ${a.handGrip}kg`);
    if (a.calfCirc != null) parts.push(`Lingkar betis: ${a.calfCirc}cm`);
    parts.push(`Tingkat aktivitas: ${ACTIVITY_LABEL[a.activity] || a.activity}`);
    parts.push(`Tingkat stres metabolik: ${a.stress}`);
    lines.push(parts.join(" | "));
    if (a.notes) lines.push(`Catatan: ${a.notes}`);
  }

  // ---- Active meal plan: target vs realisasi -----------------------------
  lines.push("\n=== MEAL PLAN AKTIF (TARGET vs REALISASI) ===");
  if (!activeMealPlan) {
    lines.push("Belum ada meal plan aktif tersusun untuk pasien ini.");
  } else {
    lines.push(
      `Target: ${activeMealPlan.targetCal} kkal, protein ${activeMealPlan.targetProtein}g, lemak ${activeMealPlan.targetFat}g, karbo ${activeMealPlan.targetCarb}g, serat ${activeMealPlan.targetFiber}g, natrium ${activeMealPlan.targetSodium}mg`,
    );
    lines.push(
      `Realisasi tersusun: ${activeMealPlan.totalCal} kkal (${activeMealPlan.targetCal ? Math.round((activeMealPlan.totalCal / activeMealPlan.targetCal) * 100) : 0}%), protein ${activeMealPlan.totalProtein}g, lemak ${activeMealPlan.totalFat}g, karbo ${activeMealPlan.totalCarb}g, serat ${activeMealPlan.totalFiber}g, natrium ${activeMealPlan.totalSodium}mg`,
    );
    lines.push(`Kepatuhan tersusun: ${activeMealPlan.compliance ?? "-"}% | Status: ${activeMealPlan.status}`);
    if (activeMealPlan.aiReasoning) {
      lines.push(`Catatan reasoning penyusunan sebelumnya: ${String(activeMealPlan.aiReasoning).slice(0, 500)}`);
    }
    const items = activeMealPlan.items || [];
    if (items.length > 0) {
      lines.push("\nITEM MEAL PLAN AKTIF YANG DIPILIH AI (gunakan PERSIS nama-nama ini, jangan mengarang item lain):");
      const bySlot = new Map<string, any[]>();
      for (const it of items) {
        if (!bySlot.has(it.slot)) bySlot.set(it.slot, []);
        bySlot.get(it.slot)!.push(it);
      }
      for (const [slot, slotItems] of bySlot) {
        const desc = slotItems
          .map((it: any) => `${it.food?.name || "?"} (${it.amount}g, ${Math.round(it.cal)} kkal)`)
          .join(", ");
        lines.push(`- ${slot}: ${desc}`);
      }
    } else {
      lines.push("Belum ada item makanan tersusun pada meal plan aktif.");
    }
  }

  // ---- Food record adherence sample (last entries) -----------------------
  lines.push("\n=== CATATAN ASUPAN (FOOD RECORD) TERBARU ===");
  if (!foodRecords || foodRecords.length === 0) {
    lines.push("Belum ada catatan asupan aktual tercatat.");
  } else {
    const byDate = new Map<string, any[]>();
    for (const fr of foodRecords.slice(0, 30)) {
      const key = new Date(fr.date).toLocaleDateString("id-ID");
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(fr);
    }
    let count = 0;
    for (const [date, records] of byDate) {
      if (count >= 5) break;
      const totalCal = records.reduce((s, r) => s + (r.cal || 0) * ((r.consumed ?? 100) / 100), 0);
      const totalProtein = records.reduce((s, r) => s + (r.protein || 0) * ((r.consumed ?? 100) / 100), 0);
      const totalSodium = records.reduce((s, r) => s + (r.sodium || 0) * ((r.consumed ?? 100) / 100), 0);
      lines.push(
        `- ${date}: ${records.length} entri, ~${Math.round(totalCal)} kkal, protein ~${Math.round(totalProtein)}g, natrium ~${Math.round(totalSodium)}mg`,
      );
      count++;
    }
  }

  // ---- Exercise plan ------------------------------------------------------
  const latestExercisePlan = exercisePlans[0];
  lines.push("\n=== RENCANA LATIHAN TERKINI ===");
  if (!latestExercisePlan) {
    lines.push("Belum ada rencana latihan tersusun untuk pasien ini.");
  } else {
    lines.push(
      `Target bakar kalori: ${latestExercisePlan.targetBurned} kkal | Realisasi tersusun: ${latestExercisePlan.totalBurned} kkal`,
    );
    for (const item of (latestExercisePlan.items || []).slice(0, 8)) {
      lines.push(`- ${item.name} (${item.type}, intensitas ${item.intensity}, ${item.duration} menit, ~${Math.round(item.caloriesBurned)} kkal)`);
    }
    if (latestExercisePlan.notes) lines.push(`Catatan: ${latestExercisePlan.notes}`);
  }

  // ---- Laboratory results — latest per test, grouped by category --------
  lines.push("\n=== HASIL LABORATORIUM ===");
  if (!labResults || labResults.length === 0) {
    lines.push(
      "Belum ada hasil laboratorium tercatat untuk pasien ini. Dasarkan penilaian pada data yang tersedia dan nyatakan keterbatasan ini secara eksplisit bila relevan (mis. status glikemik/fungsi ginjal/profil lipid tidak dapat dikonfirmasi tanpa data lab).",
    );
  } else {
    const latestByTest = new Map<string, any>();
    for (const r of labResults) {
      if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
    }
    const byCategory = new Map<string, any[]>();
    for (const r of latestByTest.values()) {
      if (!byCategory.has(r.category)) byCategory.set(r.category, []);
      byCategory.get(r.category)!.push(r);
    }
    for (const [category, tests] of byCategory) {
      const label = LAB_CATEGORY_LABELS[category as LabCategory] || category;
      const desc = tests
        .map((t: any) => `${t.testName} ${t.value}${t.unit || ""} (${t.status}${t.referenceMin != null || t.referenceMax != null ? `, normal ${t.referenceMin ?? "-"}-${t.referenceMax ?? "-"}` : ""})`)
        .join("; ");
      lines.push(`- ${label}: ${desc}`);
    }
    lines.push(
      "Gunakan hasil laboratorium di atas sebagai dasar utama analisis diagnosis, penyesuaian target gizi, dan prioritas intervensi — status TINGGI/RENDAH/BORDERLINE sudah dihitung sistem terhadap nilai rujukan, jangan menghitung ulang berbeda.",
    );
  }
  lines.push(
    "\nCatatan keterbatasan sistem: belum ada modul input tanda vital berkala (tekanan darah, nadi, suhu, saturasi oksigen) pada CareLivia saat ini.",
  );

  const fallbackContext: FallbackAssessmentContext = {
    patient: { name: patient.name, gender: patient.gender },
    age,
    height,
    weight,
    bmi,
    ibw,
    activeDx,
    latestAssessment: latestAssessment || null,
    activeMealPlan: activeMealPlan || null,
    foodRecords: foodRecords || [],
    exercisePlans: exercisePlans || [],
    labResults: labResults || [],
    calorieResult,
  };

  return { text: lines.join("\n"), patientName: patient.name, fallbackContext };
}

// POST /api/ai/clinical-assessment
// Comprehensive Clinical Decision Support System evaluation ("AI Evaluation").
// Aggregates every module for the patient server-side, then produces a
// structured, prioritized, evidence-grounded assessment (10-card dashboard).
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "clinical-assessment"), { limit: 8, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);
    const resolvedPatientId = await resolvePatientId(input.patientId);

    const { text: dataBlock, patientName, fallbackContext } = await buildPatientDataBlock(resolvedPatientId);

    const user = `DATA PASIEN LENGKAP (dikumpulkan otomatis dari seluruh modul CareLivia):\n\n${dataBlock}\n\nSusun Clinical Nutrition Assessment lengkap sesuai schema JSON yang diminta, konsisten dengan seluruh data di atas.`;

    let data: z.infer<typeof ClinicalAssessmentOutputSchema>;
    let aiModel: string;
    let isFallback = false;
    let fallbackReason: string | undefined;
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      // Heavier / longer-running than most AI features here (aggregates every
      // module + returns a large structured payload) — give it more headroom
      // than the 30s app-wide default so a slow-but-working provider doesn't
      // get misclassified as "unavailable".
      const result = await generateStructured({
        model: AI_MODELS.reasoning,
        system: CLINICAL_ASSESSMENT_SYSTEM_PROMPT,
        user,
        schema: ClinicalAssessmentOutputSchema,
        temperature: 0.3,
        maxOutputTokens: 6000,
        timeoutMs: 60_000,
      });

      data = result.data;
      aiModel = result.model;
      promptTokens = result.promptTokens;
      completionTokens = result.completionTokens;

      await logAIUsage({
        feature: "clinical-assessment",
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        responseTimeMs: result.responseTimeMs,
        success: true,
        patientId: resolvedPatientId,
      });
    } catch (e) {
      // AI Engine unreachable / repeatedly invalid: NEVER return an empty
      // page or a bare 503 to the clinician — fall back to CareLivia's own
      // rule-based clinical engine so a full (though less narrative)
      // evaluation is still produced from the same patient data.
      if (!(e instanceof AIUnavailableError)) throw e;

      fallbackReason = e.message;
      await logAIUsage({
        feature: "clinical-assessment",
        model: AI_MODELS.reasoning,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        success: false,
        errorMessage: e.message,
        patientId: resolvedPatientId,
      });

      data = buildFallbackClinicalAssessment(fallbackContext);
      aiModel = "rule-based-fallback";
      isFallback = true;
    }

    // Persist for history / instant display on next report load — even the
    // fallback result, so the clinician isn't stuck with nothing on GET.
    try {
      const { client } = await getServerClient();
      await client.from("clinical_assessments").insert({
        patient_id: resolvedPatientId,
        overall_risk_level: data.overall_risk_level,
        summary: data.kesimpulan_ai,
        payload: { ...data, isFallback, fallbackReason },
        ai_model: aiModel,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
      });
    } catch (e) {
      console.error("[clinical-assessment] persist failed (non-fatal):", e);
    }

    return ok({
      ...data,
      patientName,
      aiModel,
      generatedAt: new Date().toISOString(),
      isFallback,
      fallbackReason,
    });
  } catch (e) {
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}

// GET /api/ai/clinical-assessment?patientId=...
// Returns the most recently generated & persisted assessment, if any, so
// the report view can show results instantly without re-running the AI.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    if (!patientId) return err("patientId wajib diisi", 400);

    const resolvedPatientId = await resolvePatientId(patientId);
    const { client } = await getServerClient();
    const { data, error } = await client
      .from("clinical_assessments")
      .select("*")
      .eq("patient_id", resolvedPatientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[clinical-assessment GET] error:", error);
      return ok(null);
    }
    if (!data) return ok(null);

    return ok({
      ...(data.payload as object),
      aiModel: data.ai_model,
      generatedAt: data.created_at,
    });
  } catch (e) {
    return err(sanitizeErrorForClient(e), 500);
  }
}
