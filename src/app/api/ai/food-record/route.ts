export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { FoodRecordAnalysisOutputSchema } from "@/lib/ai/schemas/features";
import { FOOD_RECORD_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import { getServerClient } from "@/lib/supabase/data-layer";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  date: z.string().optional(),
  targets: z.object({
    cal: z.number(), protein: z.number(), fat: z.number(), carb: z.number(), fiber: z.number(), sodium: z.number(),
  }),
  actual: z.object({
    cal: z.number(), protein: z.number(), fat: z.number(), carb: z.number(), fiber: z.number(), sodium: z.number(),
  }),
  recordedItems: z.array(z.string()).default([]), // e.g. ["Nasi putih 150g", "Ayam goreng 80g"]
});

// POST /api/ai/food-record
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "food-record"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const pct = (a: number, t: number) => (t > 0 ? Math.round((a / t) * 100) : 0);
    const user = `Pasien: ${input.patientName}
Target vs Aktual:
- Kalori: ${input.actual.cal}/${input.targets.cal} kcal (${pct(input.actual.cal, input.targets.cal)}%)
- Protein: ${input.actual.protein}/${input.targets.protein}g (${pct(input.actual.protein, input.targets.protein)}%)
- Lemak: ${input.actual.fat}/${input.targets.fat}g (${pct(input.actual.fat, input.targets.fat)}%)
- Karbohidrat: ${input.actual.carb}/${input.targets.carb}g (${pct(input.actual.carb, input.targets.carb)}%)
- Serat: ${input.actual.fiber}/${input.targets.fiber}g (${pct(input.actual.fiber, input.targets.fiber)}%)
- Natrium: ${input.actual.sodium}/${input.targets.sodium}mg (${pct(input.actual.sodium, input.targets.sodium)}%)

Makanan yang tercatat: ${input.recordedItems.join(", ") || "(tidak ada rincian)"}

Analisis kepatuhan asupan sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: FOOD_RECORD_ANALYSIS_SYSTEM_PROMPT,
      user,
      schema: FoodRecordAnalysisOutputSchema,
    });

    await logAIUsage({
      feature: "food-record",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    try {
      const { client } = await getServerClient();
      await client.from("food_record_analysis").insert({
        patient_id: input.patientId,
        date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
        adherence_summary: result.data.adherence_summary,
        deviations: result.data.deviations,
        positive_patterns: result.data.positive_patterns,
        suggestions: result.data.suggestions,
        ai_model: result.model,
      });
    } catch (e) {
      console.error("[food-record] persist failed (non-fatal):", e);
    }

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
