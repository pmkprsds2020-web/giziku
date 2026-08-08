import { z } from "zod";

// ---------------------------------------------------------------------
// Nutrition Analysis
// ---------------------------------------------------------------------
export const NutritionAnalysisOutputSchema = z.object({
  summary: z.string().min(10),
  strengths: z.array(z.string()).default([]),
  concerns: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  risk_level: z.enum(["LOW", "MODERATE", "HIGH"]).default("LOW"),
});
export type NutritionAnalysisOutput = z.infer<typeof NutritionAnalysisOutputSchema>;

// ---------------------------------------------------------------------
// Exercise Plan
// ---------------------------------------------------------------------
export const ExerciseItemSchema = z.object({
  name: z.string(),
  type: z.enum(["CARDIO", "STRENGTH", "FLEXIBILITY", "BALANCE", "OTHER"]),
  intensity: z.enum(["LIGHT", "MODERATE", "VIGOROUS"]),
  duration_minutes: z.number().positive(),
  estimated_calories_burned: z.number().nonnegative(),
  instructions: z.string().default(""),
  // e.g. "2 set x 10 repetisi, istirahat 60 detik" — kosongkan untuk latihan aerobik/fleksibilitas
  sets_reps: z.string().default(""),
  precautions: z.string().default(""),
});
export const ExercisePlanOutputSchema = z.object({
  warmup: z.string().default(""),
  items: z.array(ExerciseItemSchema).min(1),
  cooldown: z.string().default(""),
  total_calories_burned: z.number().nonnegative(),
  reasoning: z.string(),
  contraindications: z.array(z.string()).default([]),
  red_flags: z.array(z.string()).default([]),
  monitoring_targets: z.array(z.string()).default([]),
  patient_education: z.string().default(""),
  weekly_progression: z.string().default(""),
});
export type ExercisePlanOutput = z.infer<typeof ExercisePlanOutputSchema>;

// ---------------------------------------------------------------------
// Shopping Planner
// ---------------------------------------------------------------------
export const ShoppingItemSchema = z.object({
  food_name: z.string(),
  amount: z.number().positive(),
  unit: z.string().default("g"),
  estimated_price_idr: z.number().nonnegative(),
  category: z.string().default(""),
});
export const ShoppingPlannerOutputSchema = z.object({
  items: z.array(ShoppingItemSchema).min(1),
  total_estimate_idr: z.number().nonnegative(),
  budget_notes: z.string().default(""),
  savings_tips: z.array(z.string()).default([]),
});
export type ShoppingPlannerOutput = z.infer<typeof ShoppingPlannerOutputSchema>;

// ---------------------------------------------------------------------
// Alternative Food
// ---------------------------------------------------------------------
export const AlternativeFoodOutputSchema = z.object({
  alternatives: z
    .array(
      z.object({
        food_name: z.string(),
        amount: z.number().positive(),
        similarity_reason: z.string(),
        nutrient_delta_note: z.string().default(""),
      }),
    )
    .min(1),
});
export type AlternativeFoodOutput = z.infer<typeof AlternativeFoodOutputSchema>;

// ---------------------------------------------------------------------
// Food Record Analysis
// ---------------------------------------------------------------------
export const FoodRecordAnalysisOutputSchema = z.object({
  adherence_summary: z.string(),
  deviations: z.array(z.string()).default([]),
  positive_patterns: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});
export type FoodRecordAnalysisOutput = z.infer<typeof FoodRecordAnalysisOutputSchema>;

// ---------------------------------------------------------------------
// Clinical Recommendation / SOAP Note
// ---------------------------------------------------------------------
export const SoapNoteOutputSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});
export type SoapNoteOutput = z.infer<typeof SoapNoteOutputSchema>;

// ---------------------------------------------------------------------
// Patient Summary
// ---------------------------------------------------------------------
export const PatientSummaryOutputSchema = z.object({
  overview: z.string(),
  nutritional_status: z.string(),
  key_risks: z.array(z.string()).default([]),
  progress_notes: z.string().default(""),
  next_steps: z.array(z.string()).default([]),
});
export type PatientSummaryOutput = z.infer<typeof PatientSummaryOutputSchema>;

// ---------------------------------------------------------------------
// Clinical Assessment (AI Evaluation / CDSS) — CareLivia Master Prompt V3.0
// Comprehensive clinical nutrition decision-support output covering all
// 10 dashboard cards: ringkasan klinis, temuan penting, prioritas
// intervensi, rekomendasi nutrisi, rekomendasi aktivitas fisik, target
// terapi, monitoring, edukasi pasien, risiko komplikasi, kesimpulan AI.
// ---------------------------------------------------------------------
export const ClinicalIndicatorSchema = z.object({
  parameter: z.string(),
  nilai: z.string().default(""),
  status: z.enum(["BAIK", "PERHATIAN", "RISIKO_SEDANG", "RISIKO_TINGGI"]),
});

export const ClinicalPriorityItemSchema = z.object({
  rank: z.number().int().positive(),
  masalah: z.string(),
  urgensi: z.enum(["RENDAH", "SEDANG", "TINGGI"]),
  alasan_klinis: z.string(),
});

export const ClinicalNutritionRecommendationSchema = z.object({
  area: z.string(), // e.g. "Karbohidrat", "Natrium", "Serat", "Protein"
  rekomendasi: z.string(),
  alasan_klinis: z.string(),
  guideline_based: z.boolean().default(true),
});

export const ClinicalTherapyTargetSchema = z.object({
  parameter: z.string(),
  nilai_saat_ini: z.string().default(""),
  target: z.string(),
  keterangan: z.string().default(""),
});

export const ClinicalComplicationRiskSchema = z.object({
  nama: z.string(),
  level: z.enum(["RENDAH", "SEDANG", "TINGGI"]),
  alasan: z.string(),
});

export const ClinicalDiagnosisImpactSchema = z.object({
  diagnosis: z.string(),
  dampak_intervensi: z.string(),
});

export const ClinicalMenuReasonSchema = z.object({
  kelompok: z.string(), // e.g. "Makanan Pokok", "Lauk Pauk", "Sayuran", "Buah"
  item: z.string(),
  alasan: z.string(),
});

export const ClinicalFoodGuidanceSchema = z.object({
  item: z.string(),
  alasan: z.string(),
});

export const ClinicalAssessmentOutputSchema = z.object({
  ringkasan_klinis: z.object({
    diagnosis_utama: z.string(),
    diagnosis_penyerta: z.array(z.string()).default([]),
    status_gizi: z.string(),
    target_kalori_kcal: z.number().nonnegative().default(0),
    target_protein_g: z.number().nonnegative().default(0),
  }),
  analisis_antropometri: z.object({
    metode_berat_badan: z.string(), // "Berat Aktual" | "Berat Badan Ideal (BBI)" | "Adjusted Body Weight (ABW)"
    alasan: z.string(),
  }),
  analisis_diagnosis: z.array(ClinicalDiagnosisImpactSchema).default([]),
  temuan_penting: z.array(z.string()).min(3).max(10),
  prioritas_intervensi: z.array(ClinicalPriorityItemSchema).default([]),
  rekomendasi_nutrisi: z.array(ClinicalNutritionRecommendationSchema).default([]),
  alasan_pemilihan_menu: z.array(ClinicalMenuReasonSchema).default([]),
  makanan_dianjurkan: z.array(ClinicalFoodGuidanceSchema).default([]),
  makanan_dibatasi: z.array(ClinicalFoodGuidanceSchema).default([]),
  rekomendasi_aktivitas_fisik: z.object({
    frekuensi: z.string().default(""),
    durasi: z.string().default(""),
    intensitas: z.string().default(""),
    jenis: z.string().default(""),
    kontraindikasi: z.array(z.string()).default([]),
    catatan_keamanan: z.string().default(""),
  }),
  target_terapi: z.array(ClinicalTherapyTargetSchema).default([]),
  monitoring: z.object({
    harian: z.array(z.string()).default([]),
    mingguan: z.array(z.string()).default([]),
    bulanan: z.array(z.string()).default([]),
  }),
  indikator_visual: z.array(ClinicalIndicatorSchema).default([]),
  risiko_komplikasi: z.array(ClinicalComplicationRiskSchema).default([]),
  red_flags: z.array(z.string()).default([]),
  ringkasan_dokter: z.string().min(120, "ringkasan_dokter terlalu singkat — wajib beberapa kalimat, bukan 1-2 kalimat"),
  ringkasan_pasien: z.string().min(80, "ringkasan_pasien terlalu singkat — wajib penjelasan yang mudah dipahami pasien, bukan 1-2 kalimat"),
  kesimpulan_ai: z.string().min(150, "kesimpulan_ai terlalu singkat — wajib 1-2 paragraf profesional, bukan 1 kalimat"),
  overall_risk_level: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]).default("LOW"),
  guideline_references: z.array(z.string()).default([]),
});
export type ClinicalAssessmentOutput = z.infer<typeof ClinicalAssessmentOutputSchema>;

// ---------------------------------------------------------------------
// Assessment AI Summary — lightweight, focused interpretation generated
// immediately after a nutrition/functional assessment (MUST, NRS-2002,
// SGA, MNA, ECOG, Karnofsky, Barthel, FRAIL, CFS, Morse Fall Scale,
// SARC-F/SARC-CalF) is saved. Deliberately scoped to just that
// assessment's scores — NOT a full CDSS re-aggregation of every module
// (that remains the separate, heavier "AI Evaluation" / ClinicalAssessment
// feature above).
// ---------------------------------------------------------------------
export const AssessmentSummaryOutputSchema = z.object({
  ringkasan: z.string().min(5), // 2-4 kalimat: sintesis semua skor instrumen
  kesimpulan_nutrisi: z.enum(["NORMAL", "AT_RISK", "MALNUTRITION", "GLIM_COMPATIBLE"]),
  diagnosis_gizi: z.string(), // terminologi standar (mis. PES statement singkat)
  intervensi: z.array(z.string()).min(1).max(8),
  monitoring: z.array(z.string()).min(1).max(8),
  red_flags: z.array(z.string()).default([]),
  guideline_references: z.array(z.string()).default([]),
});
export type AssessmentSummaryOutput = z.infer<typeof AssessmentSummaryOutputSchema>;


// ---------------------------------------------------------------------
// Bouchard Activity Record — AI Insight
// ---------------------------------------------------------------------
export const BouchardInsightOutputSchema = z.object({
  summary: z.string().min(10),
  findings: z.array(z.string()).default([]),
  risk_level: z.enum(["LOW", "MODERATE", "HIGH"]).default("LOW"),
  who_recommendation: z.string().min(5),
  acsm_recommendation: z.string().min(5),
  exercise_prescription: z.array(z.string()).default([]),
  nutrition_adjustment: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});
export type BouchardInsightOutput = z.infer<typeof BouchardInsightOutputSchema>;
