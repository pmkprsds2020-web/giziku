export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { AssessmentSummaryOutputSchema } from "@/lib/ai/schemas/features";
import { ASSESSMENT_SUMMARY_SYSTEM_PROMPT } from "@/lib/ai/prompts/features";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import {
  getServerClient,
  supabaseGetAssessmentById,
  resolvePatientId,
} from "@/lib/supabase/data-layer";

const RequestSchema = z.object({
  assessmentId: z.string().min(1),
});

// -----------------------------------------------------------------------
// Formats a single nutrition_assessments row into a compact, labelled
// Indonesian-language block covering every click-only instrument in the
// "Asesmen Gizi & Fungsional Komprehensif" module — only the instruments
// actually filled in are included, so the AI never has to guess about
// missing ones.
// -----------------------------------------------------------------------
function buildAssessmentBlock(a: any): string {
  const lines: string[] = [];
  lines.push(`Tanggal asesmen: ${a.recordedAt ? new Date(a.recordedAt).toLocaleDateString("id-ID") : "-"}`);

  if (a.must) lines.push(`MUST (Malnutrition Universal Screening Tool): ${a.must} (skor ${a.mustScore ?? "-"})`);
  if (a.nrs2002) lines.push(`NRS-2002: ${a.nrs2002} (skor ${a.nrsScore ?? "-"})`);
  if (a.sga) lines.push(`SGA (Subjective Global Assessment): ${a.sga}`);
  if (a.mna) lines.push(`MNA Short Form: ${a.mna} (skor ${a.mnaScore ?? "-"}/14)`);
  if (a.ecog) lines.push(`ECOG Performance Status: ${a.ecog}`);
  if (a.karnofsky != null) lines.push(`Karnofsky Performance Scale: ${a.karnofsky}`);
  if (a.barthel != null) lines.push(`Barthel Index (ADL): ${a.barthel}/100`);
  if (a.pps) lines.push(`Palliative Performance Scale: ${a.pps}%`);
  if (a.frailty) lines.push(`FRAIL Scale: ${a.frailty} (skor ${a.frailtyScore ?? "-"}/5)`);
  if (a.cfs != null) lines.push(`Clinical Frailty Scale: ${a.cfs}/9`);
  if (a.fallRisk) {
    lines.push(
      `Morse Fall Scale: ${a.fallRisk}${a.morseScore != null ? ` (skor ${a.morseScore})` : ""}`,
    );
  }
  if (a.tugCategory) lines.push(`Timed Up and Go (TUG): ${a.tugCategory} detik`);
  if (a.sarcfScore != null) {
    lines.push(`SARC-F: skor ${a.sarcfScore}/10 (${a.sarcfPositive ? "positif — probable sarcopenia" : "negatif"})`);
  }
  if (a.calfCategory) {
    lines.push(
      `Lingkar betis: ${a.calfCategory}${a.sarcCalfScore != null ? ` | SARC-CalF skor ${a.sarcCalfScore}/20 (${a.sarcCalfPositive ? "positif" : "negatif"})` : ""}`,
    );
  }
  if (a.handGrip != null) lines.push(`Hand Grip Strength: ${a.handGrip} kg`);
  if (a.activity) lines.push(`Level aktivitas (CareLivia engine): ${a.activity}`);
  if (a.stress) lines.push(`Stress metabolik (CareLivia engine): ${a.stress}`);
  if (a.notes) lines.push(`Catatan klinisi: ${a.notes}`);

  return lines.join("\n");
}

// POST /api/ai/assessment-summary
// Generates & persists a focused AI interpretation for one saved
// assessment (auto-triggered right after AssessmentPanel saves a new
// assessment; can also be re-run on demand for older assessments).
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "assessment-summary"), { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);

    const assessment = await supabaseGetAssessmentById(input.assessmentId);
    if (!assessment) return err("Asesmen tidak ditemukan", 404);

    const resolvedPatientId = await resolvePatientId(assessment.patientId);
    const dataBlock = buildAssessmentBlock(assessment);

    const user = `HASIL ASESMEN GIZI & FUNGSIONAL (satu kunjungan):\n\n${dataBlock}\n\nInterpretasikan sesuai schema JSON yang diminta.`;

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: ASSESSMENT_SUMMARY_SYSTEM_PROMPT,
      user,
      schema: AssessmentSummaryOutputSchema,
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    await logAIUsage({
      feature: "assessment-summary",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: resolvedPatientId,
    });

    try {
      const { client } = await getServerClient();
      await client.from("assessment_ai_summaries").insert({
        assessment_id: input.assessmentId,
        patient_id: resolvedPatientId,
        kesimpulan_nutrisi: result.data.kesimpulan_nutrisi,
        payload: result.data,
        ai_model: result.model,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
      });
    } catch (e) {
      console.error("[assessment-summary] persist failed (non-fatal):", e);
    }

    return ok({ ...result.data, aiModel: result.model, generatedAt: new Date().toISOString() });
  } catch (e) {
    if (e instanceof AIUnavailableError) {
      await logAIUsage({
        feature: "assessment-summary",
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

// GET /api/ai/assessment-summary?assessmentId=...
// Returns the most recently generated & persisted summary for that
// assessment, if any, so the history view can show it instantly.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get("assessmentId");
    if (!assessmentId) return err("assessmentId wajib diisi", 400);

    const { client } = await getServerClient();
    const { data, error } = await client
      .from("assessment_ai_summaries")
      .select("*")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[assessment-summary GET] error:", error);
      return ok(null);
    }
    if (!data) return ok(null);

    return ok({
      ...(data.payload as object),
      aiModel: data.ai_model,
      generatedAt: data.created_at,
    });
  } catch (e) {
    return err(sanitizeErrorForClient(e), 500);
  }
}
