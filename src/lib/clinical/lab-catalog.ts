// =====================================================================
// CareLivia — Laboratory Test Catalog
// Reference ranges are general adult defaults (PERKENI / KDIGO / ESPEN /
// common clinical chemistry ranges) meant as a sensible starting point —
// clinicians can override the reference range per entry, since normal
// ranges vary by lab, method, age, sex, and pregnancy status.
// =====================================================================

export type LabCategory =
  | "GLUKOSA"
  | "HEMATOLOGI"
  | "FUNGSI_GINJAL"
  | "ELEKTROLIT"
  | "PROFIL_LIPID"
  | "FUNGSI_HATI"
  | "NUTRISI"
  | "LAINNYA";

export const LAB_CATEGORY_LABELS: Record<LabCategory, string> = {
  GLUKOSA: "Glukosa",
  HEMATOLOGI: "Hematologi",
  FUNGSI_GINJAL: "Fungsi Ginjal",
  ELEKTROLIT: "Elektrolit",
  PROFIL_LIPID: "Profil Lipid",
  FUNGSI_HATI: "Fungsi Hati",
  NUTRISI: "Nutrisi",
  LAINNYA: "Lainnya",
};

export interface LabTestDef {
  name: string;
  unit: string;
  refMin?: number;
  refMax?: number;
}

export const LAB_CATALOG: Record<LabCategory, LabTestDef[]> = {
  GLUKOSA: [
    { name: "GDP", unit: "mg/dL", refMin: 70, refMax: 100 },
    { name: "GD2PP", unit: "mg/dL", refMin: 70, refMax: 140 },
    { name: "GDS", unit: "mg/dL", refMin: 70, refMax: 200 },
    { name: "HbA1c", unit: "%", refMin: 4, refMax: 5.7 },
    { name: "Insulin", unit: "µIU/mL", refMin: 2.6, refMax: 24.9 },
    { name: "HOMA-IR", unit: "", refMin: 0, refMax: 2.5 },
  ],
  HEMATOLOGI: [
    { name: "Hb", unit: "g/dL", refMin: 12, refMax: 16 },
    { name: "Ht", unit: "%", refMin: 36, refMax: 48 },
    { name: "Leukosit", unit: "10³/µL", refMin: 4.5, refMax: 11 },
    { name: "Trombosit", unit: "10³/µL", refMin: 150, refMax: 450 },
    { name: "MCV", unit: "fL", refMin: 80, refMax: 100 },
    { name: "MCH", unit: "pg", refMin: 27, refMax: 33 },
    { name: "MCHC", unit: "g/dL", refMin: 32, refMax: 36 },
    { name: "LED", unit: "mm/jam", refMin: 0, refMax: 20 },
  ],
  FUNGSI_GINJAL: [
    { name: "Ureum", unit: "mg/dL", refMin: 10, refMax: 50 },
    { name: "Kreatinin", unit: "mg/dL", refMin: 0.6, refMax: 1.3 },
    { name: "eGFR", unit: "mL/min/1.73m²", refMin: 90, refMax: 120 },
    { name: "BUN", unit: "mg/dL", refMin: 7, refMax: 20 },
    { name: "Mikroalbumin", unit: "mg/L", refMin: 0, refMax: 30 },
    { name: "Protein Urine", unit: "mg/24h", refMin: 0, refMax: 150 },
  ],
  ELEKTROLIT: [
    { name: "Natrium", unit: "mmol/L", refMin: 135, refMax: 145 },
    { name: "Kalium", unit: "mmol/L", refMin: 3.5, refMax: 5.0 },
    { name: "Klorida", unit: "mmol/L", refMin: 96, refMax: 106 },
    { name: "Kalsium", unit: "mg/dL", refMin: 8.5, refMax: 10.5 },
    { name: "Magnesium", unit: "mg/dL", refMin: 1.7, refMax: 2.2 },
    { name: "Fosfor", unit: "mg/dL", refMin: 2.5, refMax: 4.5 },
  ],
  PROFIL_LIPID: [
    { name: "Kolesterol Total", unit: "mg/dL", refMin: 0, refMax: 200 },
    { name: "HDL", unit: "mg/dL", refMin: 40, refMax: 60 },
    { name: "LDL", unit: "mg/dL", refMin: 0, refMax: 100 },
    { name: "Trigliserida", unit: "mg/dL", refMin: 0, refMax: 150 },
    { name: "Non-HDL", unit: "mg/dL", refMin: 0, refMax: 130 },
  ],
  FUNGSI_HATI: [
    { name: "SGOT", unit: "U/L", refMin: 5, refMax: 40 },
    { name: "SGPT", unit: "U/L", refMin: 7, refMax: 56 },
    { name: "Albumin", unit: "g/dL", refMin: 3.5, refMax: 5.0 },
    { name: "Bilirubin", unit: "mg/dL", refMin: 0.1, refMax: 1.2 },
    { name: "ALP", unit: "U/L", refMin: 44, refMax: 147 },
    { name: "GGT", unit: "U/L", refMin: 9, refMax: 48 },
  ],
  NUTRISI: [
    { name: "Vitamin D", unit: "ng/mL", refMin: 30, refMax: 100 },
    { name: "Vitamin B12", unit: "pg/mL", refMin: 200, refMax: 900 },
    { name: "Ferritin", unit: "ng/mL", refMin: 20, refMax: 250 },
    { name: "Asam Folat", unit: "ng/mL", refMin: 3, refMax: 20 },
    { name: "Zinc", unit: "µg/dL", refMin: 60, refMax: 120 },
    { name: "CRP", unit: "mg/L", refMin: 0, refMax: 5 },
    { name: "Prealbumin", unit: "mg/dL", refMin: 15, refMax: 36 },
  ],
  LAINNYA: [
    { name: "Asam Urat", unit: "mg/dL", refMin: 3.5, refMax: 7.2 },
    { name: "TSH", unit: "µIU/mL", refMin: 0.4, refMax: 4.0 },
    { name: "FT4", unit: "ng/dL", refMin: 0.8, refMax: 1.8 },
    { name: "D-Dimer", unit: "µg/mL FEU", refMin: 0, refMax: 0.5 },
  ],
};

export function findLabTest(category: LabCategory, testName: string): LabTestDef | undefined {
  return LAB_CATALOG[category]?.find((t) => t.name === testName);
}

// Parameters with a dedicated trend chart per the spec (line chart).
export const LAB_TREND_PARAMETERS = ["HbA1c", "GDP", "Kreatinin", "Kolesterol Total", "LDL", "eGFR"];

export const LAB_STATUS_LABELS: Record<string, { emoji: string; label: string; className: string }> = {
  NORMAL: { emoji: "🟢", label: "Normal", className: "text-emerald-600 dark:text-emerald-400" },
  BORDERLINE: { emoji: "🟡", label: "Borderline", className: "text-amber-600 dark:text-amber-400" },
  TINGGI: { emoji: "🔴", label: "Tinggi", className: "text-rose-600 dark:text-rose-400" },
  RENDAH: { emoji: "🔵", label: "Rendah", className: "text-sky-600 dark:text-sky-400" },
};

// NORMAL | BORDERLINE | TINGGI | RENDAH — borderline = within 10% of the
// nearer bound but outside range; when no reference range is given the
// value is simply reported as NORMAL (nothing to compare against).
export function computeLabStatus(value: number, min?: number | null, max?: number | null): string {
  if (min == null && max == null) return "NORMAL";
  if (min != null && value < min) {
    const margin = (min - value) / Math.max(min, 1);
    return margin <= 0.1 ? "BORDERLINE" : "RENDAH";
  }
  if (max != null && value > max) {
    const margin = (value - max) / Math.max(max, 1);
    return margin <= 0.1 ? "BORDERLINE" : "TINGGI";
  }
  return "NORMAL";
}
