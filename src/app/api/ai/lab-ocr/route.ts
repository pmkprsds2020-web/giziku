export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructuredFromImage, AIUnavailableError } from "@/lib/ai/validator/validate";
import { LabOcrExtractionSchema } from "@/lib/ai/schemas/lab-ocr";
import { LAB_OCR_SYSTEM_PROMPT, buildLabOcrUserPrompt } from "@/lib/ai/prompts/lab-ocr";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import { resolvePatientId } from "@/lib/supabase/data-layer";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  // Data URLs (data:image/png;base64,... or data:image/jpeg;base64,...).
  // The client is responsible for rendering PDF pages to images first —
  // this endpoint only ever receives images.
  images: z.array(z.string().startsWith("data:image/")).min(1).max(6),
});

// ---------------------------------------------------------------------
// POST /api/ai/lab-ocr
// Reads photo(s)/scanned-page(s) of a lab report and returns structured
// candidate results. NOTHING is written to laboratory_results here — the
// client always shows an editable confirmation table first, and saves
// via the existing useAddLabResult mutation per confirmed row (source:
// "OCR"). This route is read-only with respect to patient data.
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Vision calls are more expensive than text — slightly stricter limit.
  const rl = checkRateLimit(clientKeyFromRequest(req, "lab-ocr"), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    // Defense in depth: reject an obviously malformed/truncated data URL
    // here with a clear message, instead of forwarding it to OpenAI and
    // getting back an opaque "Invalid base64 image_url". Client already
    // validates + downsizes before sending (see lab-ocr-dialog.tsx).
    const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;
    const badImage = input.images.find((img) => !IMAGE_DATA_URL_RE.test(img) || img.length < 200);
    if (badImage) {
      return err("Data gambar dari salah satu halaman tidak valid atau rusak. Coba unggah ulang dokumennya.", 422);
    }

    const resolvedPatientId = await resolvePatientId(input.patientId);

    const result = await generateStructuredFromImage({
      model: AI_MODELS.vision,
      system: LAB_OCR_SYSTEM_PROMPT,
      user: buildLabOcrUserPrompt(input.images.length),
      images: input.images,
      schema: LabOcrExtractionSchema,
      temperature: 0.1, // low temperature — this is a reading task, not creative
      maxOutputTokens: 4000,
    });

    await logAIUsage({
      feature: "lab-ocr",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: resolvedPatientId,
    });

    return ok({ ...result.data, aiModel: result.model });
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      await logAIUsage({
        feature: "lab-ocr",
        model: AI_MODELS.vision,
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
