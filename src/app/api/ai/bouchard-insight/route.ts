export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { BouchardInsightOutputSchema } from "@/lib/ai/schemas/features";
import { BOUCHARD_INSIGHT_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { buildCacheKey, getCached, setCached } from "@/lib/ai/cache";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const RequestSchema = z.object({
  assessmentId: z.string().min(1),
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  ageYears: z.number().int().nonnegative().default(0),
  gender: z.string().default(""),
  diagnoses: z.array(z.string()).default([]),
  weightKg: z.number().positive(),
  avgEnergyExpenditure: z.number(),
  avgMet: z.number(),
  avgPal: z.number(),
  palCategory: z.string(),
  minutesByBucket: z.record(z.string(), z.number()),
  whoMinutesPerWeek: z.number().default(0),
});

// POST /api/ai/bouchard-insight
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "bouchard-insight"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const cacheKey = buildCacheKey("bouchard-insight", input);
    const cached = await getCached<z.infer<typeof BouchardInsightOutputSchema>>(cacheKey);
    if (cached) {
      await logAIUsage({
        feature: "bouchard-insight",
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

    const user = `Pasien: ${input.patientName}, ${input.ageYears} tahun, ${input.gender}, BB ${input.weightKg} kg
Diagnosis: ${input.diagnoses.join(", ") || "Tidak ada diagnosis aktif"}

Hasil Bouchard Activity Record (rerata 3 hari — 2 hari kerja + 1 hari libur):
- Energy Expenditure: ${input.avgEnergyExpenditure} kkal/hari
- MET: ${input.avgMet}
- PAL: ${input.avgPal} (kategori: ${input.palCategory})
- Estimasi aktivitas aerobik moderat-berat: ±${input.whoMinutesPerWeek} menit/minggu
- Distribusi menit/hari per kategori intensitas: ${JSON.stringify(input.minutesByBucket)}

Susun insight klinis sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: BOUCHARD_INSIGHT_SYSTEM_PROMPT,
      user,
      schema: BouchardInsightOutputSchema,
    });

    await setCached(cacheKey, "bouchard-insight", result.data);

    await logAIUsage({
      feature: "bouchard-insight",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    // Persist onto the assessment row for history & later reads.
    try {
      const { supabaseUpdateBouchardAssessmentAI } = await import("@/lib/supabase/data-layer");
      await supabaseUpdateBouchardAssessmentAI(input.assessmentId, {
        aiSummary: result.data.summary,
        aiFindings: result.data.findings,
        aiRecommendations: result.data.recommendations,
        aiRiskLevel: result.data.risk_level,
        aiModel: result.model,
      });
    } catch (e) {
      console.error("[bouchard-insight] persist failed (non-fatal):", e);
    }

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
