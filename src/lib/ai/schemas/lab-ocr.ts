import { z } from "zod";

// ---------------------------------------------------------------------
// Laboratorium — OCR Extraction
// The model reads a photographed/scanned lab report and returns a list
// of candidate results. Nothing here is saved automatically — the UI
// always shows this as an editable review/confirmation table first
// (per the "OCR → Parsing → Konfirmasi → Simpan" flow in the spec).
// ---------------------------------------------------------------------

export const LabOcrCategorySchema = z.enum([
  "GLUKOSA",
  "HEMATOLOGI",
  "FUNGSI_GINJAL",
  "ELEKTROLIT",
  "PROFIL_LIPID",
  "FUNGSI_HATI",
  "NUTRISI",
  "LAINNYA",
]);

export const LabOcrResultItemSchema = z.object({
  // Exactly as printed on the report where possible (e.g. "HbA1c", "GDP").
  testName: z.string().min(1),
  category: LabOcrCategorySchema.default("LAINNYA"),
  value: z.number(),
  unit: z.string().default(""),
  referenceMin: z.number().nullable().default(null),
  referenceMax: z.number().nullable().default(null),
  // Model's own read of the report's normal/abnormal flag if printed
  // (e.g. "H"/"High"/"Tinggi" marks on the report) — advisory only, the
  // app recomputes the authoritative status from referenceMin/Max once
  // the clinician confirms the row (see computeLabStatus in lab-catalog.ts).
  flaggedAbnormal: z.boolean().default(false),
  // Confidence the model has in this specific row's reading — used to
  // visually flag rows the clinician should double-check before saving.
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const LabOcrExtractionSchema = z.object({
  // Best-effort read of the report-wide fields — used to pre-fill the
  // confirmation form, never saved without clinician confirmation.
  labDate: z.string().nullable().default(null), // ISO date if readable
  laboratoryName: z.string().nullable().default(null),
  results: z.array(LabOcrResultItemSchema).default([]),
  // Free-text note when the model couldn't confidently read the whole
  // document (blurry photo, unfamiliar layout, non-lab document, etc.)
  extractionNotes: z.string().default(""),
});

export type LabOcrExtraction = z.infer<typeof LabOcrExtractionSchema>;
export type LabOcrResultItem = z.infer<typeof LabOcrResultItemSchema>;
