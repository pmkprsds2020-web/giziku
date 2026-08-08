export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { AlternativeFoodOutputSchema } from "@/lib/ai/schemas/features";
import { ALTERNATIVE_FOOD_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { buildCacheKey, getCached, setCached } from "@/lib/ai/cache";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const RequestSchema = z.object({
  originalFood: z.string().min(1),
  originalAmount: z.number().positive(),
  diagnoses: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]), // pantangan
  preferences: z.array(z.string()).default([]),
  count: z.number().int().min(1).max(5).default(3),
});

// POST /api/ai/alternative-food
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "alternative-food"), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const cacheKey = buildCacheKey("alternative-food", input);
    const cached = await getCached<z.infer<typeof AlternativeFoodOutputSchema>>(cacheKey);
    if (cached) {
      await logAIUsage({
        feature: "alternative-food",
        model: AI_MODELS.fast,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        success: true,
        cacheHit: true,
      });
      return ok(cached);
    }

    const user = `Bahan makanan asal: ${input.originalFood} (${input.originalAmount}g)
Diagnosis pasien: ${input.diagnoses.join(", ") || "Umum"}
Pantangan: ${input.restrictions.join(", ") || "(tidak ada)"}
Preferensi: ${input.preferences.join(", ") || "(tidak ada)"}

Berikan ${input.count} alternatif bahan makanan dengan profil gizi setara, sesuai schema JSON.`;

    const result = await generateStructured({
      model: AI_MODELS.fast,
      system: ALTERNATIVE_FOOD_SYSTEM_PROMPT,
      user,
      schema: AlternativeFoodOutputSchema,
    });

    await setCached(cacheKey, "alternative-food", result.data);
    await logAIUsage({
      feature: "alternative-food",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
    });

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
