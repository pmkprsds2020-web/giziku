export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { NutritionAnalysisOutputSchema } from "@/lib/ai/schemas/features";
import { NUTRITION_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { buildCacheKey, getCached, setCached } from "@/lib/ai/cache";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  ageYears: z.number().int().nonnegative(),
  gender: z.string(),
  bmi: z.number(),
  diagnoses: z.array(z.string()).default([]),
  anthropometryHistory: z.string().max(3000).default(""),
  intakeSummary: z.string().max(3000).default(""),
});

// POST /api/ai/nutrition-analysis
// Reference implementation for JSON-mode AI features: rate limit -> zod
// parse -> sanitize -> cache lookup -> generateStructured (schema+retry)
// -> persist to Supabase (nutrition_analysis) -> log usage -> respond.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "nutrition-analysis"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const cacheKey = buildCacheKey("nutrition-analysis", input);
    const cached = await getCached<z.infer<typeof NutritionAnalysisOutputSchema>>(cacheKey);
    if (cached) {
      await logAIUsage({
        feature: "nutrition-analysis",
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
Riwayat antropometri: ${input.anthropometryHistory || "(tidak ada data)"}
Ringkasan asupan: ${input.intakeSummary || "(tidak ada data)"}

Analisis status gizi sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: NUTRITION_ANALYSIS_SYSTEM_PROMPT,
      user,
      schema: NutritionAnalysisOutputSchema,
    });

    await setCached(cacheKey, "nutrition-analysis", result.data);

    await logAIUsage({
      feature: "nutrition-analysis",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    // Persist to Supabase for history (table created in migration 019)
    try {
      const { getServerClient } = await import("@/lib/supabase/data-layer");
      const { client } = await getServerClient();
      await client.from("nutrition_analysis").insert({
        patient_id: input.patientId,
        summary: result.data.summary,
        strengths: result.data.strengths,
        concerns: result.data.concerns,
        recommendations: result.data.recommendations,
        risk_level: result.data.risk_level,
        ai_model: result.model,
      });
    } catch (e) {
      console.error("[nutrition-analysis] persist failed (non-fatal):", e);
    }

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
