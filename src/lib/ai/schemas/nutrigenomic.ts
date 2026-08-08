import { z } from "zod";

// =====================================================================
// Nutrigenomic AI — Extraction schema
// Pairs with lib/ai/prompts/nutrigenomic.ts (EXTRACTION prompt). The
// model reads image(s) of a nutrigenomic lab report (PDF pages rendered
// to images on the client, same as the Laboratorium OCR flow) and
// returns ONLY genes/SNPs it actually found — nothing is saved
// automatically, the clinician always reviews/confirms first.
// =====================================================================

export const NutrigenomicFindingExtractionSchema = z.object({
  geneSymbol: z.string().min(1), // e.g. "FTO", exactly as printed / standard HGNC symbol
  rsId: z.string().nullable().default(null), // e.g. "rs9939609"
  genotype: z.string().nullable().default(null), // e.g. "AA", "C/T", "Non-persisten"
  // Model's own read of the report's risk/phenotype call if printed on
  // the document (e.g. "Risiko Tinggi", "Normal", "Carrier") — advisory
  // only, kept as free text since providers use inconsistent vocabulary.
  reportedCall: z.string().nullable().default(null),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const NutrigenomicExtractionSchema = z.object({
  laboratoryName: z.string().nullable().default(null),
  examDate: z.string().nullable().default(null), // ISO date if readable
  examType: z.string().nullable().default(null), // e.g. "Nutrigenomic Panel", "Whole Genome Health Report"
  findings: z.array(NutrigenomicFindingExtractionSchema).default([]),
  // Free-text note when the model couldn't confidently read the whole
  // document (blurry scan, unfamiliar layout/provider format, non-genomic
  // document, partially unreadable table) — surfaced to the clinician
  // instead of silently guessing.
  extractionNotes: z.string().default(""),
});
export type NutrigenomicExtraction = z.infer<typeof NutrigenomicExtractionSchema>;
export type NutrigenomicFindingExtraction = z.infer<typeof NutrigenomicFindingExtractionSchema>;

// =====================================================================
// Nutrigenomic AI — Clinical Interpretation schema
// Pairs with lib/ai/prompts/nutrigenomic.ts (INTERPRETATION prompt). The
// model reasons over the CONFIRMED findings (post clinician review) +
// the patient's clinical context (diagnoses, labs, anthropometry) and
// produces the full precision-nutrition clinical report described in
// the module spec — always with explainability per recommendation.
// =====================================================================

export const GeneInterpretationSchema = z.object({
  geneSymbol: z.string().min(1),
  rsId: z.string().nullable().default(null),
  genotype: z.string().nullable().default(null),
  clinicalMeaning: z.string().min(1), // "Makna Klinis"
  nutritionImpact: z.string().default(""), // "Dampak Nutrisi"
  riskLevel: z.enum(["LOW", "MODERATE", "HIGH"]).default("MODERATE"),
  evidenceLevel: z.enum(["STRONG", "MODERATE", "LIMITED", "ASSOCIATIVE"]).default("ASSOCIATIVE"),
  referenceSummary: z.string().default(""), // short evidence-source note, not a fabricated citation
});

export const RiskSummarySchema = z.object({
  obesity: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  diabetes: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  dyslipidemia: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  hypertension: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  inflammation: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  vitaminDeficiency: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  intolerance: z.enum(["LOW", "MODERATE", "HIGH"]).nullable().default(null),
  exercisePerformance: z.string().nullable().default(null), // free text, e.g. "Lebih responsif terhadap latihan power"
});

export const ClinicalImplicationSchema = z.object({
  relatedDiagnosis: z.string().min(1), // e.g. "Diabetes Melitus Tipe 2"
  relatedGene: z.string().min(1),
  implication: z.string().min(1),
});

export const SupplementationSuggestionSchema = z.object({
  supplement: z.string().min(1),
  reasoning: z.string().min(1), // WHY — required explainability
  evidenceLevel: z.enum(["STRONG", "MODERATE", "LIMITED", "ASSOCIATIVE"]).default("ASSOCIATIVE"),
});

export const ExerciseGenomicRecommendationSchema = z.object({
  relatedGene: z.string().min(1),
  recommendation: z.string().min(1),
  reasoning: z.string().min(1),
});

export const MonitoringItemSchema = z.object({
  parameter: z.string().min(1), // e.g. "HbA1c", "Homosistein", "Berat Badan"
  intervalMonths: z.number().positive().nullable().default(null),
  reasoning: z.string().default(""),
});

export const NutrigenomicInterpretationSchema = z.object({
  summary: z.string().min(10), // "Ringkasan Nutrigenomik" — plain-language overview
  genes: z.array(GeneInterpretationSchema).min(1),
  riskSummary: RiskSummarySchema,
  clinicalImplications: z.array(ClinicalImplicationSchema).default([]),
  nutritionImplications: z.object({
    macronutrients: z.string().default(""),
    micronutrients: z.string().default(""),
    antioxidants: z.string().default(""),
    phytonutrients: z.string().default(""),
    fiber: z.string().default(""),
  }),
  // Minimum 30 items per the module spec — enforced as a soft floor via
  // prompt instruction; schema keeps it flexible (min 1) so a partially
  // readable report can still validate instead of hard-failing.
  recommendedFoods: z.array(z.string()).min(1),
  restrictedFoods: z.array(z.string()).min(1),
  interventionPriorities: z.array(z.string()).default([]), // ordered, highest priority first
  supplementation: z.array(SupplementationSuggestionSchema).default([]),
  exerciseRecommendations: z.array(ExerciseGenomicRecommendationSchema).default([]),
  monitoringPlan: z.array(MonitoringItemSchema).default([]),
  // Explicit "what we couldn't confidently interpret" list — keeps the
  // model honest per the module's validation rules (no fabrication).
  interpretationCaveats: z.array(z.string()).default([]),
});
export type NutrigenomicInterpretation = z.infer<typeof NutrigenomicInterpretationSchema>;
export type GeneInterpretation = z.infer<typeof GeneInterpretationSchema>;
