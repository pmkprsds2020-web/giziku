// =====================================================================
// CareLivia Clinical Engine — Constants & Reference Tables
// Based on PERKENI, ESPEN, ASPEN, KDIGO, WHO, Kemenkes RI
// SSOT for all clinical constants used across the system.
// =====================================================================

import {
  ActivityLevel,
  StressLevel,
  BMICategory,
  DiagnosisType,
  Gender,
} from "@prisma/client";

// Re-export types for use across the application
export type { DiagnosisType, ActivityLevel, StressLevel, Gender };

// ---------------------------------------------------------------------
// ACTIVITY FACTOR (FA) — based on WHO / CareLivia adjusted
// ---------------------------------------------------------------------
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  BED_REST: 1.1,
  VERY_LIGHT: 1.2,
  LIGHT: 1.3,
  MODERATE: 1.5,
  HEAVY: 1.7,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  BED_REST: "Istirahat Bedrest",
  VERY_LIGHT: "Sangat Ringan",
  LIGHT: "Ringan",
  MODERATE: "Sedang",
  HEAVY: "Berat",
};

// ---------------------------------------------------------------------
// STRESS FACTOR (FS) — based on ESPEN/ASPEN clinical stress
// ---------------------------------------------------------------------
export const STRESS_FACTOR: Record<StressLevel, number> = {
  NONE: 1.0,
  MILD: 1.1,
  MODERATE: 1.2,
  SEVERE: 1.3,
  VERY_SEVERE: 1.5,
};

export const STRESS_LABELS: Record<StressLevel, string> = {
  NONE: "Tidak Ada Stress",
  MILD: "Stress Ringan",
  MODERATE: "Stress Sedang",
  SEVERE: "Stress Berat",
  VERY_SEVERE: "Stress Sangat Berat",
};

// ---------------------------------------------------------------------
// BMI CATEGORIES (WHO Asia-Pacific + Kemenkes RI)
// ---------------------------------------------------------------------
export function classifyBMI(bmi: number): {
  category: BMICategory;
  label: string;
  color: string;
} {
  if (bmi < 17) return { category: "SEVERELY_UNDERWEIGHT", label: "Kurus Berat", color: "#0ea5e9" };
  if (bmi < 18.5) return { category: "UNDERWEIGHT", label: "Kurus", color: "#06b6d4" };
  if (bmi < 23) return { category: "NORMAL", label: "Normal", color: "#10b981" };
  if (bmi < 25) return { category: "OVERWEIGHT", label: "Pre-Obesitas", color: "#f59e0b" };
  if (bmi < 30) return { category: "OBESE_I", label: "Obesitas I", color: "#f97316" };
  if (bmi < 35) return { category: "OBESE_II", label: "Obesitas II", color: "#ef4444" };
  return { category: "OBESE_III", label: "Obesitas III", color: "#b91c1c" };
}

// ---------------------------------------------------------------------
// DIAGNOSIS-SPECIFIC ADJUSTMENTS (PERKENI / KDIGO / ESPEN / ASPEN)
// ---------------------------------------------------------------------
export interface DiagnosisAdjustment {
  label: string;
  icd?: string;
  calFactor: number;
  proteinPerKg: [number, number];
  fatPct: [number, number];
  carbPct: [number, number];
  fiberTarget: number;
  sodiumMax: number;
  potassiumMax?: number;
  phosphorusMax?: number;
  notes: string;
  forbidden: string[];
  recommended: string[];
}

export const DIAGNOSIS_ADJUSTMENTS: Record<DiagnosisType, DiagnosisAdjustment> = {
  DM: {
    label: "Diabetes Mellitus (PERKENI)",
    icd: "E11",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [20, 30],
    carbPct: [45, 60],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "PERKENI: karbohidrat 45-60% energi, rendah GI, serat ≥25g.",
    forbidden: ["gula", "sirup", "soda", "madu"],
    recommended: ["beras merah", "oat", "kacang", "sayuran hijau"],
  },
  HT: {
    label: "Hipertensi (DASH)",
    icd: "I10",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [25, 30],
    carbPct: [50, 60],
    fiberTarget: 30,
    sodiumMax: 1500,
    potassiumMax: 4700,
    notes: "DASH: natrium <1500mg, kalium tinggi, buah & sayur.",
    forbidden: ["garam", "kecap", "asin", "kornet"],
    recommended: ["pisang", "bayam", "tomat", "jeruk"],
  },
  CHF: {
    label: "Congestive Heart Failure",
    icd: "I50",
    calFactor: 1.1,
    proteinPerKg: [1.1, 1.4],
    fatPct: [25, 30],
    carbPct: [50, 55],
    fiberTarget: 25,
    sodiumMax: 2000,
    notes: "ESPEN: batasi cairan & natrium, sedikit-sering.",
    forbidden: ["garam", "asin", "kaldu"],
    recommended: ["ikan", "sayur", "buah"],
  },
  CKD: {
    label: "Chronic Kidney Disease (KDIGO)",
    icd: "N18",
    calFactor: 1.0,
    proteinPerKg: [0.6, 0.8],
    fatPct: [25, 35],
    carbPct: [50, 60],
    fiberTarget: 20,
    sodiumMax: 2000,
    potassiumMax: 2000,
    phosphorusMax: 800,
    notes: "KDIGO: protein 0.6-0.8 g/kg, batas K & P.",
    forbidden: ["pisang", "tomat", "kacang", "cola", "jeruk"],
    recommended: ["apel", "kubis", "wortel", "putih telur"],
  },
  CKD_ND: {
    label: "CKD Non-Dialysis",
    icd: "N18.3",
    calFactor: 1.0,
    proteinPerKg: [0.55, 0.6],
    fatPct: [25, 35],
    carbPct: [55, 65],
    fiberTarget: 20,
    sodiumMax: 2000,
    potassiumMax: 2000,
    phosphorusMax: 800,
    notes: "Protein rendah 0.55-0.6 g/kg, energi 30-35 kcal/kg.",
    forbidden: ["pisang", "jeruk", "kacang", "tomat"],
    recommended: ["apel", "kubis", "roti", "beras"],
  },
  CKD_HD: {
    label: "CKD on Hemodialysis",
    icd: "Z99.2",
    calFactor: 1.15,
    proteinPerKg: [1.0, 1.2],
    fatPct: [25, 35],
    carbPct: [50, 60],
    fiberTarget: 20,
    sodiumMax: 2000,
    potassiumMax: 2500,
    phosphorusMax: 1000,
    notes: "HD: protein 1.0-1.2 g/kg, cairan dipantau.",
    forbidden: ["asin", "kacang", "cola"],
    recommended: ["putih telur", "ikan", "beras"],
  },
  CKD_PD: {
    label: "CKD on Peritoneal Dialysis",
    icd: "Z99.2",
    calFactor: 1.2,
    proteinPerKg: [1.2, 1.3],
    fatPct: [25, 35],
    carbPct: [45, 55],
    fiberTarget: 20,
    sodiumMax: 2000,
    potassiumMax: 3000,
    phosphorusMax: 1000,
    notes: "PD: protein 1.2-1.3 g/kg, absorbsi glukosa dialikat.",
    forbidden: ["asin", "gula berlebih"],
    recommended: ["putih telur", "daging", "ikan"],
  },
  LIVER: {
    label: "Penyakit Hati (ESPEN)",
    icd: "K76",
    calFactor: 1.2,
    proteinPerKg: [1.0, 1.5],
    fatPct: [20, 30],
    carbPct: [50, 60],
    fiberTarget: 25,
    sodiumMax: 2000,
    notes: "Sirosis: 35-40 kcal/kg, protein 1.0-1.5 g/kg, sedikit-sering.",
    forbidden: ["alkohol", "lemak jenuh"],
    recommended: ["whey", "karbo kompleks", "sayur"],
  },
  CANCER: {
    label: "Kanker (ESPEN Cancer)",
    icd: "C80",
    calFactor: 1.25,
    proteinPerKg: [1.2, 1.5],
    fatPct: [30, 40],
    carbPct: [35, 50],
    fiberTarget: 20,
    sodiumMax: 2300,
    notes: "ESPEN Cancer: 25-30 kcal/kg, protein 1.2-1.5 g/kg, anti-catabolic.",
    forbidden: ["raw", "tidak pasti"],
    recommended: ["whey", "telur", "almond"],
  },
  DYSLIPIDEMIA: {
    label: "Dislipidemia",
    icd: "E78",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [20, 25],
    carbPct: [50, 60],
    fiberTarget: 30,
    sodiumMax: 2300,
    notes: "Lemak jenuh <7%, serat larut ≥10g, omega-3.",
    forbidden: ["gorengan", "lemak jenuh", "jeroan"],
    recommended: ["oat", "kacang", "ikan", "alpukat"],
  },
  GOUT: {
    label: "Gout / Asam Urat",
    icd: "M10",
    calFactor: 1.0,
    proteinPerKg: [0.8, 1.0],
    fatPct: [25, 30],
    carbPct: [55, 60],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "Hindari purin tinggi (jeroan, seafood), cairan ≥2L.",
    forbidden: ["jeroan", "seafood", "alkohol", "bayam"],
    recommended: ["ceri", "susu", "air", "nasi"],
  },
  GERD: {
    label: "GERD",
    icd: "K21",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [20, 25],
    carbPct: [50, 60],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "Porsi kecil sering, hindari pemicu reflux.",
    forbidden: ["coklat", "kafein", "pedas", "berlemak"],
    recommended: ["oat", "pisang", "melon", "ayam"],
  },
  PUD: {
    label: "Peptic Ulcer Disease",
    icd: "K27",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [25, 30],
    carbPct: [50, 60],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "Protein cukup untuk penyembuhan mukosa.",
    forbidden: ["pedas", "kafein", "alkohol"],
    recommended: ["kubis", "pisang", "susu"],
  },
  IBD: {
    label: "Inflammatory Bowel Disease",
    icd: "K50",
    calFactor: 1.15,
    proteinPerKg: [1.2, 1.5],
    fatPct: [25, 30],
    carbPct: [50, 55],
    fiberTarget: 15,
    sodiumMax: 2300,
    notes: "ESPEN: 25-30 kcal/kg, protein 1.2-1.5, rendah serat saat flare.",
    forbidden: ["serat tinggi", "mentah", "kacang"],
    recommended: ["putih telur", "ikan", "nasi"],
  },
  OBESITY: {
    label: "Obesitas",
    icd: "E66",
    calFactor: 0.85,
    proteinPerKg: [1.2, 1.5],
    fatPct: [20, 30],
    carbPct: [40, 50],
    fiberTarget: 30,
    sodiumMax: 2300,
    notes: "Defisit 500-750 kcal/hari, protein tinggi preservasi otot.",
    forbidden: ["gula", "gorengan", "fast food"],
    recommended: ["sayur", "protein lean", "biji-bijian"],
  },
  MALNUTRITION: {
    label: "Malnutrition (ESPEN)",
    icd: "E46",
    calFactor: 1.3,
    proteinPerKg: [1.3, 1.5],
    fatPct: [30, 35],
    carbPct: [45, 55],
    fiberTarget: 20,
    sodiumMax: 2300,
    notes: "Refeeding: naikkan bertahap, thiamin, pantau elektrolit.",
    forbidden: ["gula kosong"],
    recommended: ["susu", "telur", "pisang", "nasi"],
  },
  SARCOPENIA: {
    label: "Sarkopenia",
    icd: "M62.84",
    calFactor: 1.1,
    proteinPerKg: [1.2, 1.5],
    fatPct: [25, 30],
    carbPct: [50, 55],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "Protein 1.2-1.5 g/kg + resistance exercise + vitD.",
    forbidden: [],
    recommended: ["whey", "telur", "ikan", "kedelai"],
  },
  POST_OP: {
    label: "Post-Operative",
    icd: "Z48",
    calFactor: 1.2,
    proteinPerKg: [1.2, 1.5],
    fatPct: [25, 30],
    carbPct: [50, 55],
    fiberTarget: 20,
    sodiumMax: 2300,
    notes: "Anabolik: protein tinggi, energi 30-35 kcal/kg, Zn/vitC untuk luka.",
    forbidden: [],
    recommended: ["telur", "ikan", "sayur", "buah"],
  },
  PREGNANCY: {
    label: "Kehamilan (Trimester 2-3)",
    icd: "Z34",
    calFactor: 1.0,
    proteinPerKg: [1.1, 1.3],
    fatPct: [20, 30],
    carbPct: [50, 60],
    fiberTarget: 28,
    sodiumMax: 2300,
    notes: "T2: +340 kcal, T3: +450 kcal, asam folat, Fe, Ca.",
    forbidden: ["alkohol", "raw", "kafein berlebih"],
    recommended: ["sayur hijau", "ikan", "susu", "telur"],
  },
  LACTATION: {
    label: "Laktasi",
    icd: "Z39",
    calFactor: 1.0,
    proteinPerKg: [1.1, 1.3],
    fatPct: [20, 30],
    carbPct: [50, 60],
    fiberTarget: 28,
    sodiumMax: 2300,
    notes: "+500 kcal/hari, cairan ≥3L, DHA, Ca.",
    forbidden: ["alkohol", "kafein berlebih"],
    recommended: ["susu", "ikan", "sayur", "buah"],
  },
  PEDIATRIC: {
    label: "Pediatrik",
    icd: "Z00",
    calFactor: 1.1,
    proteinPerKg: [1.0, 1.5],
    fatPct: [25, 35],
    carbPct: [50, 60],
    fiberTarget: 20,
    sodiumMax: 1900,
    notes: "WHO: pertumbuhan, energi/kg tinggi, zat besi, vitA.",
    forbidden: [],
    recommended: ["susu", "telur", "sayur", "buah"],
  },
  GERIATRIC: {
    label: "Geriatrik (ESPEN Older)",
    icd: "Z78",
    calFactor: 1.0,
    proteinPerKg: [1.0, 1.2],
    fatPct: [25, 35],
    carbPct: [45, 55],
    fiberTarget: 25,
    sodiumMax: 2000,
    notes: "ESPEN: 30 kcal/kg, protein 1.0-1.2, vitD, hidrasi.",
    forbidden: [],
    recommended: ["susu", "telur", "ikan", "sayur"],
  },
  STROKE: {
    label: "Stroke",
    icd: "I63",
    calFactor: 1.1,
    proteinPerKg: [1.0, 1.2],
    fatPct: [25, 30],
    carbPct: [50, 60],
    fiberTarget: 25,
    sodiumMax: 1500,
    notes: "Natrium rendah, tekstur makanan sesuai swallowing.",
    forbidden: ["garam", "asin"],
    recommended: ["sayur", "buah", "ikan"],
  },
  COPD: {
    label: "COPD",
    icd: "J44",
    calFactor: 1.25,
    proteinPerKg: [1.2, 1.5],
    fatPct: [30, 40],
    carbPct: [40, 50],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "ESPEN: tinggi lemak rendah karbo mengurangi CO2.",
    forbidden: [],
    recommended: ["lemak sehat", "protein", "sayur"],
  },
  OTHER: {
    label: "Umum / Lainnya",
    icd: "Z00",
    calFactor: 1.0,
    proteinPerKg: [0.8, 1.0],
    fatPct: [25, 30],
    carbPct: [50, 60],
    fiberTarget: 25,
    sodiumMax: 2300,
    notes: "Pedoman Gizi Seimbang umum.",
    forbidden: [],
    recommended: ["sayur", "buah", "protein", "karbo kompleks"],
  },
};

// ---------------------------------------------------------------------
// PREGNANCY / LACTATION additional calorie offsets (WHO)
// ---------------------------------------------------------------------
export const PREGNANCY_KCAL: Record<number, number> = {
  1: 0,
  2: 340,
  3: 450,
};

export const LACTATION_KCAL: number = 500;

// ---------------------------------------------------------------------
// MACRO CALORIE DENSITY
// ---------------------------------------------------------------------
export const KCAL_PER_GRAM = {
  protein: 4,
  carb: 4,
  fat: 9,
  alcohol: 7,
};

export const DEFAULT_MACRO = {
  proteinPct: 15,
  fatPct: 25,
  carbPct: 60,
};

// ---------------------------------------------------------------------
// MEAL DISTRIBUTION (Indonesian pattern)
// ---------------------------------------------------------------------
export const MEAL_DISTRIBUTION = {
  BREAKFAST: 0.2,
  MORNING_SNACK: 0.1,
  LUNCH: 0.3,
  AFTERNOON_SNACK: 0.1,
  DINNER: 0.25,
  EVENING_SNACK: 0.05,
} as const;

// ---------------------------------------------------------------------
// EXERCISE MET VALUES (Compendium of Physical Activities)
// ---------------------------------------------------------------------
export const MET_TABLE: Record<string, { name: string; met: number; type: string }> = {
  walking: { name: "Jalan Kaki", met: 3.5, type: "AEROBIC" },
  brisk_walk: { name: "Jalan Cepat", met: 5.0, type: "AEROBIC" },
  cycling: { name: "Bersepeda", met: 7.5, type: "AEROBIC" },
  swimming: { name: "Berenang", met: 8.0, type: "AEROBIC" },
  jogging: { name: "Jogging", met: 9.8, type: "AEROBIC" },
  yoga: { name: "Yoga", met: 3.0, type: "FLEXIBILITY" },
  stretching: { name: "Peregangan", met: 2.3, type: "FLEXIBILITY" },
  resistance_band: { name: "Resistance Band", met: 4.0, type: "RESISTANCE" },
  light_weights: { name: "Angkat Beban Ringan", met: 3.5, type: "RESISTANCE" },
  moderate_weights: { name: "Angkat Beban Sedang", met: 6.0, type: "RESISTANCE" },
  taichi: { name: "Tai Chi", met: 3.0, type: "BALANCE" },
  balance_exercise: { name: "Latihan Keseimbangan", met: 2.5, type: "BALANCE" },
  functional_training: { name: "Latihan Fungsional", met: 4.5, type: "FUNCTIONAL" },
  stairs: { name: "Naik Tangga", met: 8.0, type: "AEROBIC" },
  gardening: { name: "Berkebun", met: 4.0, type: "AEROBIC" },
  housework: { name: "Kerja Rumah", met: 3.0, type: "AEROBIC" },
};

// ---------------------------------------------------------------------
// AGE-BASED CALORIE ADJUSTMENT (CareLivia correction)
// ---------------------------------------------------------------------
export function ageCorrectionFactor(ageYears: number, gender: Gender): number {
  if (ageYears <= 30) return 1.0;
  const excessYears = ageYears - 30;
  const rate = gender === "MALE" ? 0.004 : 0.003;
  return Math.max(0.7, 1 - excessYears * rate);
}

// ---------------------------------------------------------------------
// IDEAL BODY WEIGHT (BBI) — CareLivia formula (Indonesia-adapted Broca)
// ---------------------------------------------------------------------
export function idealBodyWeight(heightCm: number, gender: Gender): number {
  const base = heightCm - 100;
  return gender === "MALE" ? base * 0.9 : base * 0.85;
}

// ---------------------------------------------------------------------
// WATER REQUIREMENT (per kg) — ESPEN
// ---------------------------------------------------------------------
export function waterRequirement(weightKg: number, ageYears: number): number {
  if (ageYears >= 65) return weightKg * 35;
  return weightKg * 30;
}
