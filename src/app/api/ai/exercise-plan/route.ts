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
import { getServerClient, supabaseFindExercisePrograms } from "@/lib/supabase/data-layer";
import { buildExerciseGroundingBlock, extractProgramIds, type ExerciseProgramRow } from "@/lib/exercise/grounding";

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

    const cacheKey = buildCacheKey("exercise-plan", { ...input, sourceProgramIds });
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

    const user = `Pasien: ${input.patientName}, ${input.ageYears} tahun, ${input.gender}, BMI ${input.bmi}
Diagnosis: ${input.diagnoses.join(", ") || "Umum"}
Tingkat aktivitas saat ini: ${input.activityLevel}
Catatan mobilitas/kontraindikasi: ${input.mobilityNotes || "(tidak ada)"}
Target kalori terbakar/hari: ${input.targetCaloriesBurned || "(sesuaikan dengan kondisi)"}

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
      const { data: planRow } = await client
        .from("exercise_plans")
        .insert({
          patient_id: input.patientId,
          date: new Date().toISOString(),
          total_burned: result.data.total_calories_burned,
          target_burned: input.targetCaloriesBurned,
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
