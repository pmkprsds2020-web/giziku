export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructuredFromImage, AIUnavailableError } from "@/lib/ai/validator/validate";
import { NutrigenomicExtractionSchema } from "@/lib/ai/schemas/nutrigenomic";
import {
  NUTRIGENOMIC_EXTRACTION_SYSTEM_PROMPT,
  buildNutrigenomicExtractionUserPrompt,
} from "@/lib/ai/prompts/nutrigenomic";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import { resolvePatientId } from "@/lib/supabase/data-layer";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  // Data URLs (data:image/png;base64,... or data:image/jpeg;base64,...).
  // The client renders PDF pages to images first (same pattern as the
  // Laboratorium OCR upload) — this endpoint only ever receives images.
  images: z.array(z.string().startsWith("data:image/")).min(1).max(10),
});

// ---------------------------------------------------------------------
// POST /api/ai/nutrigenomic-extract
// Reads image(s) of an uploaded nutrigenomic lab report (PDF pages
// rendered client-side) and returns structured candidate gene/SNP
// findings. NOTHING is written to genomic_reports/genomic_findings here
// — the client always shows an editable confirmation table first, then
// calls the direct-Supabase save (see hooks/use-nutrigenomic.ts). This
// route is read-only with respect to patient data.
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  // Vision calls over multi-page genomic reports are the heaviest OCR
  // workload in the app — stricter limit than the single-page lab-ocr.
  const rl = checkRateLimit(clientKeyFromRequest(req, "nutrigenomic-extract"), { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    // Defense in depth: reject an obviously malformed/truncated data URL
    // here with a clear message, instead of forwarding it to OpenAI and
    // getting back an opaque "Invalid base64 image_url" a few seconds
    // later. Client already validates before sending (see
    // nutrigenomic-upload-dialog.tsx) — this just guards against any
    // other caller.
    const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;
    const badImage = input.images.find((img) => !IMAGE_DATA_URL_RE.test(img) || img.length < 200);
    if (badImage) {
      return err("Data gambar dari salah satu halaman tidak valid atau rusak. Coba unggah ulang dokumennya.", 422);
    }

    const resolvedPatientId = await resolvePatientId(input.patientId);

    const result = await generateStructuredFromImage({
      model: AI_MODELS.vision,
      system: NUTRIGENOMIC_EXTRACTION_SYSTEM_PROMPT,
      user: buildNutrigenomicExtractionUserPrompt(input.images.length),
      images: input.images,
      schema: NutrigenomicExtractionSchema,
      temperature: 0.1, // reading task, not creative
      maxOutputTokens: 4000,
    });

    await logAIUsage({
      feature: "nutrigenomic-extract",
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
        feature: "nutrigenomic-extract",
        model: AI_MODELS.vision,
        promptTokens: 0,
        completionTokens: 0,
        responseTimeMs: 0,
        success: false,
        errorMessage: e.message,
      });
      return err(e.message, 503, { causeHint: e.cause_hint });
    }
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
