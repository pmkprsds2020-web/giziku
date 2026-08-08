export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { PatientSummaryOutputSchema } from "@/lib/ai/schemas/features";
import { PATIENT_SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  clinicalSummary: z.string().min(1).max(6000),
});

// POST /api/ai/patient-summary
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "patient-summary"), { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: PATIENT_SUMMARY_SYSTEM_PROMPT,
      user: `Pasien: ${input.patientName}\n\nData klinis lengkap:\n${input.clinicalSummary}\n\nBuat ringkasan sesuai schema JSON.`,
      schema: PatientSummaryOutputSchema,
    });

    await logAIUsage({
      feature: "patient-summary",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: input.patientId,
    });

    return ok(result.data);
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503);
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
