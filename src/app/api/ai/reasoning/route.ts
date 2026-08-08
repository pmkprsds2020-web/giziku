export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { SoapNoteOutputSchema } from "@/lib/ai/schemas/features";
import { CLINICAL_REASONING_SOAP_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const RequestSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(1),
  clinicalData: z.string().min(1).max(4000),
});

// POST /api/ai/reasoning
// Generates a clinical SOAP note via OpenAI from provided clinical data.
// Server-side only — API key never touches the client.
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "reasoning"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: CLINICAL_REASONING_SOAP_SYSTEM_PROMPT,
      user: `Pasien: ${input.patientName}\n\nData klinis:\n${input.clinicalData}\n\nSusun SOAP note sesuai schema JSON.`,
      schema: SoapNoteOutputSchema,
    });

    await logAIUsage({
      feature: "reasoning",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId ?? null,
    });

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      await logAIUsage({
        feature: "reasoning",
        model: AI_MODELS.reasoning,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        success: false,
        errorMessage: e.message,
      });
      return err(e.message, 503);
    }
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
