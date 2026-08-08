export const runtime = "nodejs";
// AI generation can take up to 3 attempts × 30s (see AI_DEFAULTS in models.ts).
// Without this, Vercel's platform-level function timeout (10-60s depending
// on plan) can kill the request before our own retry logic finishes,
// returning its own 504 unrelated to the app-level 503 handled below.
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { ExercisePlanOutputSchema } from "@/lib/ai/schemas/features";
import { EXERCISE_PLAN_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { buildCacheKey, getCached, setCached } from "@/lib/ai/cache";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import {
  getServerClient,
  supabaseFindExercisePrograms,
  supabaseGetPatient,
  supabaseGetLatestBouchardAssessment,
  resolvePatientId,
} from "@/lib/supabase/data-layer";
import { buildExerciseGroundingBlock, extractProgramIds, type ExerciseProgramRow } from "@/lib/exercise/grounding";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";
import {
  computeExerciseTarget,
  EXERCISE_TARGET_CONFIG,
  type ExerciseTargetInput,
} from "@/lib/clinical/exercise-target";

// Mirrors diagnosis_type_enum in supabase/migrations/001_enums.sql — used to
// safely filter free-text `diagnoses` input before querying the exercise
// program library (which expects valid enum values for the array-overlap
// lookup).
const DIAGNOSIS_TYPE_VALUES = new Set([
  "DM", "HT", "CHF", "CKD", "CKD_ND", "CKD_HD", "CKD_PD", "LIVER", "CANCER",
  "DYSLIPIDEMIA", "GOUT", "GERD", "PUD", "IBD", "OBESITY", "MALNUTRITION",
  "SARCOPENIA", "POST_OP", "PREGNANCY", "LACTATION", "PEDIATRIC", "GERIATRIC",
  "STROKE", "COPD", "OTHER",
]);

// AI schema (schemas/features.ts ExerciseItemSchema) uses a different
// vocabulary than the DB enums (exercise_type_enum / exercise_intensity_enum
// in supabase/migrations/001_enums.sql). Map before persisting so inserts
// don't silently fail on an invalid enum value.
const AI_TO_DB_TYPE: Record<string, string> = {
  CARDIO: "AEROBIC",
  STRENGTH: "RESISTANCE",
  FLEXIBILITY: "FLEXIBILITY",
  BALANCE: "BALANCE",
  OTHER: "FUNCTIONAL",
};
const AI_TO_DB_INTENSITY: Record<string, string> = {
  LIGHT: "LOW",
  MODERATE: "MODERATE",
  VIGOROUS: "HIGH",
};

const RequestSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  ageYears: z.number().int().nonnegative(),
  gender: z.string(),
  bmi: z.number(),
  diagnoses: z.array(z.string()).default([]),
  activityLevel: z.string().default("LIGHT"),
  mobilityNotes: z.string().max(1000).default(""),
  targetCaloriesBurned: z.number().nonnegative().default(0),
});

// POST /api/ai/exercise-plan
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "exercise-plan"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    // Ground the generation in CareLivia's evidence-based exercise program
    // library (supabase/migrations/021/022_exercise_plan_library*.sql).
    // Non-fatal: if the table isn't migrated yet or the lookup fails, we
    // silently fall back to the original ungrounded prompt.
    const validDiagnosisTypes = input.diagnoses.filter((d) => DIAGNOSIS_TYPE_VALUES.has(d));
    let matchedPrograms: ExerciseProgramRow[] = [];
    try {
      matchedPrograms = await supabaseFindExercisePrograms(validDiagnosisTypes);
    } catch (e) {
      console.warn("[exercise-plan] program library lookup failed (non-fatal):", e);
    }
    const groundingBlock = buildExerciseGroundingBlock(matchedPrograms);
    const sourceProgramIds = extractProgramIds(matchedPrograms);

    // -----------------------------------------------------------------
    // Compute the AUTHORITATIVE exercise target using the same Exercise
    // Target Engine as the rule-based /api/exercise route (Single Source
    // of Truth — see src/lib/clinical/exercise-target.ts). Previously
    // this route trusted `input.targetCaloriesBurned` from the client,
    // which the frontend never actually populated (always 0/undefined),
    // so the AI had no real target to aim for.
    // -----------------------------------------------------------------
    let resolvedPatientId = input.patientId;
    let patient: any = null;
    try {
      resolvedPatientId = await resolvePatientId(input.patientId);
      patient = await supabaseGetPatient(resolvedPatientId);
    } catch (e) {
      console.warn("[exercise-plan] patient lookup failed (non-fatal, using client-supplied data):", e);
    }

    let bouchard: any = null;
    try {
      bouchard = await supabaseGetLatestBouchardAssessment(resolvedPatientId);
    } catch (e) {
      console.warn("[exercise-plan] Bouchard lookup failed (non-fatal):", e);
    }

    const assessment = (patient?.assessments || [])[0];
    const weightKg: number = patient?.weight ?? 0;
    const heightCm: number = patient?.height ?? 0;
    const ageYears: number = patient?.birthDate ? ageFromBirth(patient.birthDate) : input.ageYears;
    const bmi: number = weightKg && heightCm ? weightKg / Math.pow(heightCm / 100, 2) : input.bmi;
    const diagnosesForTarget = (patient?.diagnoses || [])
      .filter((d: any) => d.active !== false)
      .map((d: any) => d.type) as string[];
    const diagnoses = diagnosesForTarget.length > 0 ? diagnosesForTarget : input.diagnoses;

    let targetBurned = 0;
    let targetResult: ReturnType<typeof computeExerciseTarget> | null = null;
    if (weightKg > 0) {
      let activity = input.activityLevel;
      let stress = "NONE" as string;
      if (assessment) {
        if (assessment.activity) activity = assessment.activity;
        if (assessment.stress) stress = assessment.stress;
      }
      let dailyCalorieTarget = 0;
      try {
        const calResult = computeCalorieTarget({
          gender: patient?.gender ?? input.gender,
          ageYears,
          heightCm: heightCm || 160,
          weightKg,
          activity: activity as any,
          stress: stress as any,
          diagnoses: diagnoses as any,
          isPregnant: patient?.isPregnant,
          pregnancyTrimester: patient?.pregnancyTrimester,
          isLactating: patient?.isLactating,
          bouchardPalCategory: bouchard?.palCategory ?? undefined,
        });
        dailyCalorieTarget = calResult.targetCalorie;
      } catch (e) {
        console.warn("[exercise-plan] calorie target computation failed (non-fatal):", e);
      }

      const targetInput: ExerciseTargetInput = {
        weightKg,
        ageYears,
        bmi,
        dailyCalorieTarget,
        pal: bouchard?.avgPal ?? null,
        palCategory: bouchard?.palCategory ?? null,
        activityLevel: activity,
        ecog: assessment?.ecog ?? null,
        barthel: assessment?.barthel ?? null,
        karnofsky: assessment?.karnofsky ?? null,
        pps: assessment?.pps ?? null,
        frailty: assessment?.frailty ?? null,
        cfs: assessment?.cfs ?? null,
        fallRisk: assessment?.fallRisk ?? null,
        diagnoses,
      };
      targetResult = computeExerciseTarget(targetInput);
      targetBurned = targetResult.targetBurned;
    } else {
      // No weight on file — fall back to whatever the client sent so the
      // route still degrades gracefully instead of producing 0 silently.
      targetBurned = input.targetCaloriesBurned;
    }

    const bouchardBlock = bouchard
      ? `\n\nData Bouchard Activity Record terbaru pasien:\n- PAL: ${bouchard.avgPal} (${bouchard.palCategory})\n- Energy Expenditure: ${bouchard.avgEnergyExpenditure} kcal/hari\n- Status WHO: ${bouchard.whoStatus?.message ?? "-"}\nGunakan data ini sebagai prioritas utama saat menentukan volume & intensitas latihan tambahan — JANGAN otomatis memberikan volume latihan tinggi hanya karena PAL tinggi (pasien sudah aktif secara harian); prioritaskan maintenance/recovery/progression sesuai kategori PAL.`
      : "";
    const targetRationaleBlock = targetResult
      ? `\n\nTarget latihan tambahan yang SUDAH DIHITUNG secara klinis (gunakan angka ini, jangan mengarang target baru): ${targetResult.targetBurned} kcal/hari (${Math.round(targetResult.targetPercentage * 100)}% kebutuhan energi harian, kategori aktivitas: ${targetResult.activityCategory}).\nDasar perhitungan: ${targetResult.rationale.join(" ")}${targetResult.forceProhibited ? "\nPERHATIAN: pasien TIDAK boleh dipaksakan mencapai target ini — prioritaskan keselamatan, intensitas LOW, dan actual boleh di bawah target." : ""}`
      : "";

    const cacheKey = buildCacheKey("exercise-plan", { ...input, targetBurned, sourceProgramIds, bouchardPal: bouchard?.avgPal ?? null });
    const cached = await getCached<z.infer<typeof ExercisePlanOutputSchema>>(cacheKey);
    if (cached) {
      await logAIUsage({
        feature: "exercise-plan",
        model: AI_MODELS.reasoning,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        success: true,
        cacheHit: true,
        patientId: input.patientId,
      });
      return ok(cached);
    }

    const user = `Pasien: ${input.patientName}, ${ageYears} tahun, ${input.gender}, BMI ${Math.round(bmi * 10) / 10}
Diagnosis: ${diagnoses.join(", ") || "Umum"}
Tingkat aktivitas saat ini: ${input.activityLevel}
Catatan mobilitas/kontraindikasi: ${input.mobilityNotes || "(tidak ada)"}
Target kalori terbakar/hari: ${targetBurned || "(sesuaikan dengan kondisi)"}${bouchardBlock}${targetRationaleBlock}

Susun rencana latihan aman sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: EXERCISE_PLAN_SYSTEM_PROMPT + groundingBlock,
      user,
      schema: ExercisePlanOutputSchema,
    });

    await setCached(cacheKey, "exercise-plan", result.data);
    await logAIUsage({
      feature: "exercise-plan",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    // Persist to Supabase (exercise_plans + exercise_items)
    try {
      const { client } = await getServerClient();
      const actualBurned = result.data.total_calories_burned ?? 0;
      const achievementPercentage = targetBurned > 0 ? Math.round((actualBurned / targetBurned) * 1000) / 10 : 0;
      const achievementStatus =
        targetResult?.forceProhibited && achievementPercentage < EXERCISE_TARGET_CONFIG.ACHIEVED_THRESHOLD_PCT
          ? "SAFETY_LIMIT"
          : achievementPercentage >= EXERCISE_TARGET_CONFIG.ACHIEVED_THRESHOLD_PCT
            ? "ACHIEVED"
            : achievementPercentage >= EXERCISE_TARGET_CONFIG.PARTIAL_THRESHOLD_PCT
              ? "PARTIALLY_ACHIEVED"
              : "BELOW_TARGET";

      const { data: planRow } = await client
        .from("exercise_plans")
        .insert({
          patient_id: resolvedPatientId,
          date: new Date().toISOString(),
          total_burned: actualBurned,
          target_burned: targetBurned,
          notes: result.data.reasoning,
          source_program_ids: sourceProgramIds,
          plan_details: {
            warmup: result.data.warmup,
            cooldown: result.data.cooldown,
            red_flags: result.data.red_flags,
            monitoring_targets: result.data.monitoring_targets,
            patient_education: result.data.patient_education,
            weekly_progression: result.data.weekly_progression,
            contraindications: result.data.contraindications,
            // Audit trail — mirrors buildExerciseAuditTrail() shape used by
            // the rule-based /api/exercise route, so the frontend can read
            // both plan types with the same UI code.
            target_calorie: targetResult ? (targetBurned / Math.max(targetResult.targetPercentage, 0.0001)) : null,
            target_percentage: targetResult ? Math.round(targetResult.targetPercentage * 100) : null,
            target_basis: targetResult?.targetBasis ?? null,
            activity_category: targetResult?.activityCategory ?? null,
            bouchard_pal: bouchard?.avgPal ?? null,
            bouchard_category: bouchard?.palCategory ?? null,
            bouchard_energy_expenditure: bouchard?.avgEnergyExpenditure ?? null,
            bouchard_assessment_date: bouchard?.assessmentDate ?? null,
            who_moderate_minutes: bouchard?.whoStatus?.moderateVigorousMinutesPerWeek ?? null,
            clinical_adjustment: targetResult?.clinicalAdjustment ?? null,
            clinical_adjustments: targetResult?.rationale ?? [],
            target_rationale: targetResult?.rationale.join(" ") ?? null,
            warnings: targetResult?.warnings ?? [],
            actual_burned: actualBurned,
            achievement_percentage: achievementPercentage,
            achievement_status: achievementStatus,
            safety_adjusted: targetResult?.safetyAdjusted ?? false,
            force_prohibited: targetResult?.forceProhibited ?? false,
          },
        })
        .select()
        .single();

      if (planRow) {
        const items = result.data.items.map((it) => ({
          exercise_plan_id: planRow.id,
          name: it.name,
          type: AI_TO_DB_TYPE[it.type] ?? "FUNCTIONAL",
          intensity: AI_TO_DB_INTENSITY[it.intensity] ?? "MODERATE",
          duration: Math.round(it.duration_minutes),
          calories_burned: it.estimated_calories_burned,
          notes: it.precautions,
          instructions: it.instructions,
          sets_reps: it.sets_reps,
        }));
        if (items.length) await client.from("exercise_items").insert(items);
      }
    } catch (e) {
      console.error("[exercise-plan] persist failed (non-fatal):", e);
    }

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}

function ageFromBirth(birth: string | Date): number {
  const birthDate = typeof birth === "string" ? new Date(birth) : birth;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}
