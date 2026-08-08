export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, err, handleZod, ageFromBirth } from "@/lib/api-helpers";
import { generateStructured, AIUnavailableError } from "@/lib/ai/validator/validate";
import { NutrigenomicInterpretationSchema } from "@/lib/ai/schemas/nutrigenomic";
import {
  NUTRIGENOMIC_INTERPRETATION_SYSTEM_PROMPT,
  buildNutrigenomicInterpretationUserPrompt,
} from "@/lib/ai/prompts/nutrigenomic";
import { AI_MODELS } from "@/lib/ai/models";
import { logAIUsage } from "@/lib/ai/logging";
import { sanitizeObject, sanitizeErrorForClient } from "@/lib/ai/sanitize";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/ai/rate-limit";
import { buildGeneReferenceContext } from "@/lib/clinical/gene-reference";
import { resolvePatientId, supabaseGetPatient, supabaseListLabResults, getServerClient } from "@/lib/supabase/data-layer";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  reportId: z.string().min(1),
});

// ---------------------------------------------------------------------
// POST /api/ai/nutrigenomic-interpret
// Given a report that already has CONFIRMED genomic_findings (saved via
// direct Supabase write from the review table, same pattern as
// laboratory_results), builds full patient clinical context server-side
// and asks the AI to produce the complete precision-nutrition
// interpretation. Persists the result to genomic_interpretations and
// flips genomic_reports.status to ANALYZED (or NEEDS_REVIEW on partial
// failure) so the dashboard reflects real state.
// ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "nutrigenomic-interpret"), { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return err("Terlalu banyak permintaan. Coba lagi sebentar.", 429);

  try {
    const body = sanitizeObject(await req.json());
    const input = RequestSchema.parse(body);
    const resolvedPatientId = await resolvePatientId(input.patientId);

    const { client } = await getServerClient();

    // 1. Load confirmed findings for this report.
    const { data: findingRows, error: findingsErr } = await client
      .from("genomic_findings")
      .select("*")
      .eq("report_id", input.reportId)
      .eq("patient_id", resolvedPatientId);

    if (findingsErr) return err(`Gagal memuat temuan genetik: ${findingsErr.message}`, 500);
    if (!findingRows || findingRows.length === 0) {
      return err("Tidak ada temuan genetik terkonfirmasi pada laporan ini. Konfirmasi hasil ekstraksi terlebih dahulu.", 422);
    }

    // 2. Load patient clinical context.
    const patient = await supabaseGetPatient(resolvedPatientId);
    if (!patient) return err("Pasien tidak ditemukan.", 404);

    const labs = await supabaseListLabResults(resolvedPatientId);
    const labSummary = labs
      .slice(0, 15)
      .map((l: any) => `${l.testName}: ${l.value} ${l.unit || ""} (${l.status})`.trim())
      .join("; ");

    const diagnoses: string[] = (patient.diagnoses || [])
      .filter((d: any) => d.active !== false)
      .map((d: any) => d.type);

    const ageYears = patient.birthDate ? ageFromBirth(patient.birthDate) : 0;
    const bmi =
      patient.height && patient.weight
        ? Number((patient.weight / Math.pow(patient.height / 100, 2)).toFixed(1))
        : null;

    const findingsText = findingRows
      .map(
        (f: any) =>
          `- ${f.gene_symbol}${f.rs_id ? ` (${f.rs_id})` : ""}: genotipe ${f.genotype || "(tidak tercatat)"}${
            f.clinical_meaning ? `, catatan hasil laporan: ${f.clinical_meaning}` : ""
          }`,
      )
      .join("\n");

    const geneReferenceContext = buildGeneReferenceContext(findingRows.map((f: any) => f.gene_symbol));

    const user = buildNutrigenomicInterpretationUserPrompt({
      patientName: patient.name,
      ageYears,
      gender: patient.gender,
      bmi,
      diagnoses,
      labSummary,
      findingsText,
      geneReferenceContext,
    });

    // 3. AI reasoning call.
    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: NUTRIGENOMIC_INTERPRETATION_SYSTEM_PROMPT,
      user,
      schema: NutrigenomicInterpretationSchema,
      maxOutputTokens: 6500,
      timeoutMs: 55_000, // heavier reasoning payload than most JSON features
    });

    await logAIUsage({
      feature: "nutrigenomic-interpret",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: resolvedPatientId,
    });

    // 4. Persist interpretation (upsert — regenerating replaces prior result).
    const { data: savedInterp, error: saveErr } = await client
      .from("genomic_interpretations")
      .upsert(
        {
          report_id: input.reportId,
          patient_id: resolvedPatientId,
          summary: result.data.summary,
          risk_summary: result.data.riskSummary,
          clinical_implications: result.data.clinicalImplications,
          nutrition_implications: result.data.nutritionImplications,
          recommended_foods: result.data.recommendedFoods,
          restricted_foods: result.data.restrictedFoods,
          intervention_priorities: result.data.interventionPriorities,
          supplementation: result.data.supplementation,
          exercise_recommendations: result.data.exerciseRecommendations,
          monitoring_plan: result.data.monitoringPlan,
          ai_model: result.model,
        },
        { onConflict: "report_id" },
      )
      .select()
      .single();

    if (saveErr) {
      console.error("[nutrigenomic-interpret] persist failed:", saveErr);
      return err(`Interpretasi berhasil dibuat tetapi gagal disimpan: ${saveErr.message}`, 500);
    }

    // 5. Update per-gene clinical_meaning/nutrition_impact/risk fields on
    // genomic_findings from the AI's gene-by-gene interpretation, and
    // flip the report status to ANALYZED.
    for (const g of result.data.genes) {
      await client
        .from("genomic_findings")
        .update({
          clinical_meaning: g.clinicalMeaning,
          nutrition_impact: g.nutritionImpact,
          risk_level: g.riskLevel,
          evidence_level: g.evidenceLevel,
          reference_summary: g.referenceSummary,
        })
        .eq("report_id", input.reportId)
        .eq("gene_symbol", g.geneSymbol);
    }

    await client
      .from("genomic_reports")
      .update({ status: "ANALYZED", ai_model: result.model })
      .eq("id", input.reportId);

    return ok({ interpretation: savedInterp, aiModel: result.model });
  } catch (e) {
    if (e instanceof AIUnavailableError) return err(e.message, 503, { causeHint: e.cause_hint });
    if (e instanceof z.ZodError) return handleZod(e);
    return err(sanitizeErrorForClient(e), 500);
  }
}
