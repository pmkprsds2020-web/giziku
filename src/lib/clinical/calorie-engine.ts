// =====================================================================
// CareLivia Calorie Engine v3.0 — Core Domain Logic
// -----------------------------------------------------------------------
// Formula design (per clinical audit, formulaVersion "CareLivia Energy
// Calculator v3.0"):
//   1. BMI = BB / TB(m)²
//   2. BBI (PERKENI 2024, Broca modification) = 0.9 × (TB-100) for BOTH
//      sexes, with exception: BBI = TB-100 if male&TB<160cm or
//      female&TB<150cm.
//   3. Energi Dasar ("Estimasi Kebutuhan Energi Dasar", NOT BMR) =
//      BBI × kcal/kg (pria 30, wanita 25) for adults ≥18y. Pediatric
//      patients (<18y) use a separate WHO/Kemenkes kcal/kg-by-age table
//      since the adult PERKENI ratio does not apply to growing children.
//   4-7. ADDITIVE clinical corrections (each = Energi Dasar × %), summed:
//      - Usia:      <40=0%, 40-59=-5%, 60-69=-10%, ≥70=-20%
//      - Aktivitas: Bed Rest +10%, Sangat Ringan +12%, Ringan +15%,
//                    Sedang +20%, Berat +30% (sourced from Bouchard
//                    Activity Record when available, else manual pick)
//      - Berat Badan (BMI): Underweight +20%, Normal 0%, Overweight -10%,
//                    Obesitas -20%
//      - Stress Metabolik: Tidak 0%, Ringan +10%, Sedang +20%,
//                    Berat/Sangat Berat +30%
//      Corrections are SUMMED (additive), never multiplied together.
//   8. Subtotal = Energi Dasar + all 4 corrections = "Estimated Energy
//      Requirement".
//   9. Faktor kondisi klinis (multiplicative, ESPEN/PERKENI/KDIGO
//      hypermetabolic disease-state factor per diagnosis — excludes
//      OBESITY, which is handled by step 12 instead of a multiplier).
//   10-11. Kehamilan/Laktasi: ABSOLUTE kcal add-on (WHO trimester-based
//      for pregnancy: T1 +0, T2 +340, T3 +450; lactation +500), not a
//      percentage of energy.
//   12. Weight-loss deficit (only if weight goal = WEIGHT_LOSS, default
//      triggered by OBESITY diagnosis): flat -500 kcal/day default
//      (ADA 2026 allows 500-750 kcal/day), applied to the Estimated
//      Energy Requirement — never combined with a BMI multiplier for the
//      same effect (no double counting).
//   13. Safety check: flags CLINICAL_REVIEW_REQUIRED if the final target
//      falls below a safe floor, and VERY_LOW_CALORIE warning in the
//      800-1000 kcal band (ADA 2026 — only for selected patients under
//      trained supervision).
//   14. Macronutrients computed from the FINAL target only, after all of
//      the above (protein from g/kg BBI, remainder split carb:fat by
//      diagnosis ratio — grams always sum back to the final kcal target).
// Every step is auditable by the clinician via `steps`.
// =====================================================================

import {
  ActivityLevel,
  StressLevel,
  DiagnosisType,
  Gender,
} from "@prisma/client";
import {
  classifyBMI,
  DIAGNOSIS_ADJUSTMENTS,
  PREGNANCY_KCAL,
  LACTATION_KCAL,
  KCAL_PER_GRAM,
  idealBodyWeight,
  type DiagnosisAdjustment,
} from "./constants";

export const CALORIE_FORMULA_VERSION = "CareLivia Energy Calculator v3.0";

// ---------------------------------------------------------------------
// ADDITIVE CORRECTION TABLES (CareLivia Energy Calculator v3.0)
// Each value is a PERCENTAGE of Energi Dasar (baseline), summed together
// — never multiplied. Do not invent factors outside these tables; if a
// case needs something not covered here, flag "Requires clinical review"
// instead.
// ---------------------------------------------------------------------

/** Koreksi usia — dewasa (≥18 tahun) sesuai tabel klinis. */
export function ageCorrectionPct(ageYears: number): number {
  if (ageYears < 40) return 0;
  if (ageYears <= 59) return -0.05;
  if (ageYears <= 69) return -0.1;
  return -0.2;
}

/**
 * Koreksi aktivitas fisik (additive %). VERY_LIGHT (+12%) diinterpolasi
 * antara Bed Rest (+10%) dan Ringan (+15%) untuk mengakomodasi 5 level
 * ActivityLevel di skema data — bukan bagian dari tabel asli 4-kategori.
 */
export const ACTIVITY_CORRECTION_PCT: Record<ActivityLevel, number> = {
  BED_REST: 0.1,
  VERY_LIGHT: 0.12,
  LIGHT: 0.15,
  MODERATE: 0.2,
  HEAVY: 0.3,
};

/** Sumber data aktivitas yang dipakai untuk koreksi. */
export type ActivitySource = "BOUCHARD" | "MANUAL";

/**
 * Kategori PAL dari Bouchard Activity Record (lihat bouchard.ts) dipetakan
 * ke tabel koreksi additive yang sama, karena Bouchard adalah sumber
 * aktivitas prioritas ketika tersedia.
 */
export const BOUCHARD_PAL_CORRECTION_PCT: Record<
  "Sedentary" | "Low Active" | "Active" | "Very Active",
  number
> = {
  Sedentary: 0.1,
  "Low Active": 0.15,
  Active: 0.2,
  "Very Active": 0.3,
};

/** Koreksi berat badan berdasarkan kategori BMI (additive %). */
export function weightCorrectionPct(bmi: number): number {
  if (bmi < 18.5) return 0.2; // Underweight (termasuk severely underweight)
  if (bmi < 25) return 0; // Normal
  if (bmi < 30) return -0.1; // Overweight / Pre-obesitas
  return -0.2; // Obesitas (I/II/III)
}

/** Koreksi stress metabolik (additive %). Severe & Very Severe di-cap di +30%
 * (batas tertinggi tabel) — jangan membuat faktor baru di luar tabel. */
export const STRESS_CORRECTION_PCT: Record<StressLevel, number> = {
  NONE: 0,
  MILD: 0.1,
  MODERATE: 0.2,
  SEVERE: 0.3,
  VERY_SEVERE: 0.3,
};

/** Base kcal/kg BBI untuk dewasa (≥18 tahun), PERKENI 2024. */
export function adultBaseKcalPerKg(gender: Gender): number {
  return gender === "MALE" ? 30 : 25;
}

/**
 * Base kcal/kg untuk pasien pediatrik (<18 tahun) — tabel WHO/Kemenkes
 * terpisah dari rasio dewasa PERKENI, karena kebutuhan energi anak per kg
 * jauh lebih tinggi dan didorong oleh pertumbuhan, bukan BBI dewasa.
 * Tabel koreksi additive (usia/aktivitas/BB/stress) TIDAK diterapkan pada
 * cabang pediatrik ini.
 */
export function pediatricBaseKcalPerKg(ageYears: number): number {
  if (ageYears < 3) return 100;
  if (ageYears < 10) return 80;
  return 35; // 10-17 tahun
}

export type WeightGoal = "MAINTENANCE" | "WEIGHT_LOSS" | "WEIGHT_GAIN";

export interface CalorieInput {
  gender: Gender;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  stress: StressLevel;
  diagnoses: DiagnosisType[];
  isPregnant?: boolean;
  pregnancyTrimester?: number;
  isLactating?: boolean;
  /** Kategori PAL dari Bouchard Activity Record, jika sudah tersedia.
   * Bila diisi, ini menjadi sumber PRIORITAS untuk koreksi aktivitas,
   * menggantikan pilihan manual `activity`. */
  bouchardPalCategory?: "Sedentary" | "Low Active" | "Active" | "Very Active";
  /** Tujuan terapi. Default: WEIGHT_LOSS otomatis jika diagnosis
   * mengandung OBESITY, selain itu MAINTENANCE. */
  weightGoal?: WeightGoal;
  /** Defisit energi untuk weight loss (kcal/hari, absolut). ADA 2026:
   * 500-750 kcal/hari. Default 500. Diabaikan jika weightGoal bukan
   * WEIGHT_LOSS. */
  energyDeficitKcal?: number;
}

export interface CalorieStep {
  step: number;
  name: string;
  description: string;
  formula: string;
  input: string;
  output: number;
  unit: string;
}

export type SafetyStatus = "PASS" | "WARNING" | "CLINICAL_REVIEW_REQUIRED";

export interface CalorieResult {
  steps: CalorieStep[];
  bmi: number;
  bmiLabel: string;
  bmiColor: string;
  ibw: number; // BBI — ideal body weight (PERKENI 0.9×(TB-100), with exception)
  /** @deprecated v3.0 no longer swaps actual weight for an "adjusted body
   * weight" when obese — BBI is always used as calculation basis. Kept
   * equal to `ibw` for backward compatibility with older callers. */
  adjustedWeight: number;
  baseCalorie: number; // Energi Dasar, kcal/day, before corrections
  /** @deprecated multiplicative factor, replaced by ageCorrectionPctValue (additive %). Always 1 in v3.0. */
  ageFactor: number;
  /** @deprecated multiplicative factor, replaced by activityCorrectionPctValue (additive %). Always 1 in v3.0. */
  activityFactor: number;
  /** @deprecated multiplicative factor, replaced by stressCorrectionPctValue (additive %). Always 1 in v3.0. */
  stressFactor: number;
  /** @deprecated multiplicative factor, replaced by weightCorrectionPctValue (additive %). Always 1 in v3.0. */
  bmiFactor: number;
  // --- v3.0 additive correction detail (% of Energi Dasar + resulting kcal) ---
  ageCorrectionPctValue: number;
  ageCorrectionKcal: number;
  activityCorrectionPctValue: number;
  activityCorrectionKcal: number;
  activitySource: ActivitySource;
  weightCorrectionPctValue: number;
  weightCorrectionKcal: number;
  stressCorrectionPctValue: number;
  stressCorrectionKcal: number;
  estimatedEnergyRequirement: number; // Energi Dasar + 4 koreksi additive
  pregnancyKcal: number;
  lactationKcal: number;
  diagnosisFactor: number;
  weightGoal: WeightGoal;
  weightLossDeficitKcal: number;
  safetyStatus: SafetyStatus;
  clinicalReviewRequired: boolean;
  formulaVersion: string;
  targetCalorie: number; // FINAL target kcal/day
  macros: {
    proteinG: number;
    fatG: number;
    carbG: number;
    proteinKcal: number;
    fatKcal: number;
    carbKcal: number;
    proteinPct: number;
    fatPct: number;
    carbPct: number;
  };
  fiberTarget: number;
  sodiumMax: number;
  potassiumMax?: number;
  phosphorusMax?: number;
  waterMl: number;
  primaryDiagnosis: DiagnosisAdjustment | null;
  warnings: string[];
}

// ---------------------------------------------------------------------
// MAIN: Compute full CareLivia calorie target with audit trail
// (CareLivia Energy Calculator v3.0 — additive corrections + BBI SSOT)
// ---------------------------------------------------------------------
export function computeCalorieTarget(input: CalorieInput): CalorieResult {
  const steps: CalorieStep[] = [];
  const warnings: string[] = [];
  let stepNo = 0;
  const nextStep = (
    name: string,
    description: string,
    formula: string,
    stepInput: string,
    output: number,
    unit: string,
  ) => {
    stepNo += 1;
    steps.push({ step: stepNo, name, description, formula, input: stepInput, output, unit });
  };

  // STEP 1 — BMI
  const heightM = input.heightCm / 100;
  const bmi = input.weightKg / (heightM * heightM);
  const bmiClass = classifyBMI(bmi);
  nextStep(
    "Hitung BMI",
    "Body Mass Index = berat / tinggi²",
    `${input.weightKg} / (${heightM})²`,
    `BB ${input.weightKg} kg, TB ${input.heightCm} cm`,
    Math.round(bmi * 100) / 100,
    "kg/m²",
  );

  // STEP 2 — BBI (PERKENI 2024: 0.9×(TB-100), exception for short stature)
  const ibw = idealBodyWeight(input.heightCm, input.gender);
  const isShortException =
    (input.gender === "MALE" && input.heightCm < 160) ||
    (input.gender === "FEMALE" && input.heightCm < 150);
  nextStep(
    "Hitung BBI (PERKENI 2024)",
    isShortException
      ? `Pengecualian tinggi badan pendek (${input.gender === "MALE" ? "pria <160cm" : "wanita <150cm"}): BBI = TB-100`
      : "Broca modifikasi PERKENI: BBI = 0.9 × (TB-100), sama untuk pria & wanita",
    isShortException
      ? `${input.heightCm} - 100`
      : `0.9 × (${input.heightCm} - 100)`,
    `TB ${input.heightCm} cm, ${input.gender}`,
    Math.round(ibw * 10) / 10,
    "kg",
  );

  // Pediatric branch (<18 tahun): tabel additive dewasa tidak berlaku.
  const isPediatric = input.ageYears < 18;

  // STEP 3 — Energi Dasar
  const baseKcalPerKg = isPediatric
    ? pediatricBaseKcalPerKg(input.ageYears)
    : adultBaseKcalPerKg(input.gender);
  const baseCalorie = ibw * baseKcalPerKg;
  nextStep(
    "Estimasi Kebutuhan Energi Dasar",
    isPediatric
      ? "Cabang pediatrik (WHO/Kemenkes, kcal/kg berdasarkan usia) — bukan BMR"
      : `Dewasa PERKENI: BBI × ${baseKcalPerKg} kcal/kg (${input.gender === "MALE" ? "pria" : "wanita"}) — bukan BMR`,
    `${Math.round(ibw * 10) / 10} kg × ${baseKcalPerKg} kcal/kg`,
    `BBI ${Math.round(ibw * 10) / 10} kg, umur ${input.ageYears} th`,
    Math.round(baseCalorie),
    "kcal/hari",
  );

  // STEP 4 — Koreksi Usia (additive %, dewasa only)
  const ageCorrectionPctValue = isPediatric ? 0 : ageCorrectionPct(input.ageYears);
  const ageCorrectionKcal = baseCalorie * ageCorrectionPctValue;
  nextStep(
    "Koreksi Usia",
    isPediatric
      ? "Tidak diterapkan untuk pasien pediatrik (<18 tahun)"
      : "Tabel additive: <40=0%, 40–59=-5%, 60–69=-10%, ≥70=-20%",
    `${Math.round(baseCalorie)} × ${(ageCorrectionPctValue * 100).toFixed(0)}%`,
    `Umur ${input.ageYears} th`,
    Math.round(ageCorrectionKcal * 100) / 100,
    "kcal/hari",
  );

  // STEP 5 — Koreksi Aktivitas (additive %, prioritas Bouchard)
  const activitySource: ActivitySource = input.bouchardPalCategory ? "BOUCHARD" : "MANUAL";
  const activityCorrectionPctValue = input.bouchardPalCategory
    ? BOUCHARD_PAL_CORRECTION_PCT[input.bouchardPalCategory]
    : ACTIVITY_CORRECTION_PCT[input.activity];
  const activityCorrectionKcal = isPediatric ? 0 : baseCalorie * activityCorrectionPctValue;
  nextStep(
    "Koreksi Aktivitas",
    activitySource === "BOUCHARD"
      ? `Sumber: Bouchard Activity Record (PAL: ${input.bouchardPalCategory})`
      : "Sumber: klasifikasi aktivitas manual (Bouchard belum tersedia)",
    `${Math.round(baseCalorie)} × ${(activityCorrectionPctValue * 100).toFixed(0)}%`,
    activitySource === "BOUCHARD" ? (input.bouchardPalCategory as string) : input.activity,
    Math.round(activityCorrectionKcal * 100) / 100,
    "kcal/hari",
  );

  // STEP 6 — Koreksi Berat Badan (BMI, additive %)
  const weightCorrectionPctValue = weightCorrectionPct(bmi);
  const weightCorrectionKcal = isPediatric ? 0 : baseCalorie * weightCorrectionPctValue;
  nextStep(
    "Koreksi Berat Badan (BMI)",
    "Tabel additive: Underweight +20%, Normal 0%, Overweight -10%, Obesitas -20%",
    `${Math.round(baseCalorie)} × ${(weightCorrectionPctValue * 100).toFixed(0)}%`,
    `BMI ${Math.round(bmi * 100) / 100} (${bmiClass.label})`,
    Math.round(weightCorrectionKcal * 100) / 100,
    "kcal/hari",
  );

  // STEP 7 — Koreksi Stress Metabolik (additive %)
  const stressCorrectionPctValue = STRESS_CORRECTION_PCT[input.stress];
  const stressCorrectionKcal = isPediatric ? 0 : baseCalorie * stressCorrectionPctValue;
  nextStep(
    "Koreksi Stress Metabolik",
    input.stress === "NONE"
      ? "Tidak ada stress metabolik → 0%"
      : "Tabel additive: Ringan +10%, Sedang +20%, Berat/Sangat Berat +30% (dari kondisi klinis pasien)",
    `${Math.round(baseCalorie)} × ${(stressCorrectionPctValue * 100).toFixed(0)}%`,
    input.stress,
    Math.round(stressCorrectionKcal * 100) / 100,
    "kcal/hari",
  );

  // STEP 8 — Subtotal: Estimated Energy Requirement
  const estimatedEnergyRequirement =
    baseCalorie + ageCorrectionKcal + activityCorrectionKcal + weightCorrectionKcal + stressCorrectionKcal;
  nextStep(
    "Estimated Energy Requirement",
    "Energi Dasar + Koreksi Usia + Aktivitas + Berat Badan + Stress (SEMUA ADDITIVE, bukan perkalian bertingkat)",
    `${Math.round(baseCalorie)} ${ageCorrectionKcal >= 0 ? "+" : "-"} ${Math.abs(Math.round(ageCorrectionKcal))} ${activityCorrectionKcal >= 0 ? "+" : "-"} ${Math.abs(Math.round(activityCorrectionKcal))} ${weightCorrectionKcal >= 0 ? "+" : "-"} ${Math.abs(Math.round(weightCorrectionKcal))} ${stressCorrectionKcal >= 0 ? "+" : "-"} ${Math.abs(Math.round(stressCorrectionKcal))}`,
    "Subtotal semua koreksi",
    Math.round(estimatedEnergyRequirement),
    "kcal/hari",
  );

  // STEP 9 — Faktor Kondisi Klinis (multiplicative disease-state factor,
  // TIDAK termasuk OBESITY — obesitas ditangani via defisit terpisah di
  // Step 12 agar tidak double counting dengan koreksi BMI -20% di Step 6).
  const primaryDiagnosis = input.diagnoses[0]
    ? DIAGNOSIS_ADJUSTMENTS[input.diagnoses[0]]
    : DIAGNOSIS_ADJUSTMENTS.OTHER;
  const diagnosisFactor = primaryDiagnosis.calFactor;
  const afterDiagnosis = estimatedEnergyRequirement * diagnosisFactor;
  nextStep(
    "Faktor Kondisi Klinis",
    primaryDiagnosis.notes,
    `${Math.round(estimatedEnergyRequirement)} × ${diagnosisFactor}`,
    input.diagnoses.length ? input.diagnoses.join(", ") : "Umum",
    Math.round(afterDiagnosis),
    "kcal/hari",
  );

  // STEP 10 — Kehamilan (absolut kcal, WHO trimester-based, BUKAN %)
  let pregnancyKcal = 0;
  if (input.isPregnant) {
    const trimester = input.pregnancyTrimester ?? 1;
    pregnancyKcal = PREGNANCY_KCAL[trimester] ?? 0;
    if (trimester === 1) {
      warnings.push("Trimester 1 tidak memerlukan tambahan kalori; fokus asam folat.");
    }
  }
  const afterPregnancy = afterDiagnosis + pregnancyKcal;
  nextStep(
    "Tambahan Kehamilan",
    "WHO — offset absolut (bukan persentase): T1 +0, T2 +340, T3 +450 kcal/hari",
    `${Math.round(afterDiagnosis)} + ${pregnancyKcal}`,
    input.isPregnant ? `Trimester ${input.pregnancyTrimester ?? 1}` : "Tidak hamil",
    Math.round(afterPregnancy),
    "kcal/hari",
  );

  // STEP 11 — Laktasi (absolut kcal)
  const lactationKcal = input.isLactating ? LACTATION_KCAL : 0;
  const afterLactation = afterPregnancy + lactationKcal;
  nextStep(
    "Tambahan Laktasi",
    "WHO — offset absolut +500 kcal/hari (bukan persentase)",
    `${Math.round(afterPregnancy)} + ${lactationKcal}`,
    input.isLactating ? "Laktasi aktif" : "Tidak laktasi",
    Math.round(afterLactation),
    "kcal/hari",
  );

  // STEP 12 — Defisit Weight Loss (flat kcal, TERPISAH dari koreksi BMI)
  const weightGoal: WeightGoal =
    input.weightGoal ?? (input.diagnoses.includes("OBESITY") ? "WEIGHT_LOSS" : "MAINTENANCE");
  const requestedDeficit = input.energyDeficitKcal ?? 500;
  const weightLossDeficitKcal =
    weightGoal === "WEIGHT_LOSS" ? Math.min(Math.max(requestedDeficit, 0), 750) : 0;
  const afterDeficit = afterLactation - weightLossDeficitKcal;
  nextStep(
    "Defisit Weight Loss",
    weightGoal === "WEIGHT_LOSS"
      ? "ADA 2026: defisit 500-750 kcal/hari, diterapkan ke Estimated Energy Requirement (bukan ke BBI×kcal/kg langsung), terpisah dari koreksi BMI -20% obesitas"
      : "Tidak ada defisit — tujuan terapi bukan weight loss",
    `${Math.round(afterLactation)} - ${weightLossDeficitKcal}`,
    `Weight goal: ${weightGoal}`,
    Math.round(afterDeficit),
    "kcal/hari",
  );

  // STEP 13 — Safety Check
  let safetyStatus: SafetyStatus = "PASS";
  const perKgFloor = isPediatric ? 0 : afterDeficit / Math.max(input.weightKg, 1);
  if (afterDeficit < 800) {
    safetyStatus = "CLINICAL_REVIEW_REQUIRED";
    warnings.push(
      "⚠ Target energi < 800 kcal/hari — SANGAT RENDAH. Memerlukan evaluasi dokter/ahli gizi sebelum Meal Plan dibuat. Jangan digunakan sebagai diet mandiri.",
    );
  } else if (afterDeficit < 1000) {
    safetyStatus = "WARNING";
    warnings.push(
      "⚠ Target energi berada di kisaran very-low-calorie diet (800-1000 kcal). Menurut ADA 2026, ini hanya untuk pasien terpilih dengan supervisi klinis ketat.",
    );
  } else if (afterDeficit < 1200 && !isPediatric) {
    safetyStatus = "WARNING";
    warnings.push("Target energi di bawah 1200 kcal/hari — evaluasi klinis disarankan sebelum digunakan.");
  }
  if (afterDeficit > 4000) {
    safetyStatus = safetyStatus === "PASS" ? "WARNING" : safetyStatus;
    warnings.push("Target kalori >4000 kcal — verifikasi kembali input data pasien.");
  }
  const clinicalReviewRequired = safetyStatus === "CLINICAL_REVIEW_REQUIRED";
  nextStep(
    "Safety Check",
    clinicalReviewRequired
      ? "GAGAL — di bawah batas keamanan, memerlukan review klinis sebelum Meal Plan otomatis dibuat"
      : safetyStatus === "WARNING"
        ? "PERINGATAN — perlu perhatian klinis"
        : "LULUS — dalam rentang aman",
    `${Math.round(afterDeficit)} kcal ÷ ${input.weightKg} kg = ${Math.round(perKgFloor * 10) / 10} kcal/kg`,
    safetyStatus,
    Math.round(afterDeficit),
    "kcal/hari",
  );

  // STEP 14 — TARGET FINAL
  const targetCalorie = Math.round(afterDeficit);
  nextStep(
    "Target Energi Final",
    "Estimated Energy Requirement × faktor diagnosis + hamil/laktasi − defisit weight-loss",
    `= ${targetCalorie}`,
    "Hasil akhir seluruh langkah",
    targetCalorie,
    "kcal/hari",
  );

  // STEP 15 — Makronutrien (dihitung dari TARGET FINAL, grams selalu
  // menjumlah kembali ke target — protein dari g/kg BBI, sisanya dibagi
  // karbo:lemak sesuai rasio diagnosis)
  const proteinPerKg = (primaryDiagnosis.proteinPerKg[0] + primaryDiagnosis.proteinPerKg[1]) / 2;
  const proteinGFromKg = proteinPerKg * ibw;
  const proteinKcal = proteinGFromKg * KCAL_PER_GRAM.protein;
  const remainingKcal = targetCalorie - proteinKcal;
  const fatMid = (primaryDiagnosis.fatPct[0] + primaryDiagnosis.fatPct[1]) / 2;
  const carbMid = (primaryDiagnosis.carbPct[0] + primaryDiagnosis.carbPct[1]) / 2;
  const splitSum = fatMid + carbMid || 1;
  const fatKcal = (remainingKcal * fatMid) / splitSum;
  const carbKcal = (remainingKcal * carbMid) / splitSum;
  const proteinG = proteinKcal / KCAL_PER_GRAM.protein;
  const fatG = fatKcal / KCAL_PER_GRAM.fat;
  const carbG = carbKcal / KCAL_PER_GRAM.carb;

  const proteinPctFinal = (proteinKcal / targetCalorie) * 100;
  const fatPctFinal = (fatKcal / targetCalorie) * 100;
  const carbPctFinal = (carbKcal / targetCalorie) * 100;

  nextStep(
    "Distribusi Makronutrien",
    `Protein ${proteinPerKg} g/kg BBI × ${Math.round(ibw * 10) / 10} kg; sisa energi split ${Math.round(carbMid)}:${Math.round(fatMid)} (K:L) — gram selalu menjumlah ke target final`,
    `P=${Math.round(proteinG)}g (${Math.round(proteinPctFinal)}%), K=${Math.round(carbG)}g (${Math.round(carbPctFinal)}%), L=${Math.round(fatG)}g (${Math.round(fatPctFinal)}%)`,
    `Target ${targetCalorie} kcal`,
    Math.round(proteinG + carbG + fatG),
    "g total",
  );

  // Additional clinical warnings
  if (input.diagnoses.includes("MALNUTRITION")) {
    warnings.push("Risiko Refeeding Syndrome: naikkan bertahap, pantau elektrolit & thiamin.");
  }
  if (input.diagnoses.includes("CKD") || input.diagnoses.includes("CKD_ND")) {
    warnings.push("CKD: pantau kalium & fosfor, batasi cairan bila perlu.");
  }

  return {
    steps,
    bmi: Math.round(bmi * 100) / 100,
    bmiLabel: bmiClass.label,
    bmiColor: bmiClass.color,
    ibw: Math.round(ibw * 10) / 10,
    adjustedWeight: Math.round(ibw * 10) / 10, // deprecated alias, kept = BBI
    baseCalorie: Math.round(baseCalorie),
    // deprecated multiplicative fields (kept = 1, no longer used for math)
    ageFactor: 1,
    activityFactor: 1,
    stressFactor: 1,
    bmiFactor: 1,
    ageCorrectionPctValue,
    ageCorrectionKcal: Math.round(ageCorrectionKcal * 100) / 100,
    activityCorrectionPctValue,
    activityCorrectionKcal: Math.round(activityCorrectionKcal * 100) / 100,
    activitySource,
    weightCorrectionPctValue,
    weightCorrectionKcal: Math.round(weightCorrectionKcal * 100) / 100,
    stressCorrectionPctValue,
    stressCorrectionKcal: Math.round(stressCorrectionKcal * 100) / 100,
    estimatedEnergyRequirement: Math.round(estimatedEnergyRequirement),
    pregnancyKcal,
    lactationKcal,
    diagnosisFactor,
    weightGoal,
    weightLossDeficitKcal,
    safetyStatus,
    clinicalReviewRequired,
    formulaVersion: CALORIE_FORMULA_VERSION,
    targetCalorie,
    macros: {
      proteinG: Math.round(proteinG),
      fatG: Math.round(fatG),
      carbG: Math.round(carbG),
      proteinKcal: Math.round(proteinKcal),
      fatKcal: Math.round(fatKcal),
      carbKcal: Math.round(carbKcal),
      proteinPct: Math.round(proteinPctFinal),
      fatPct: Math.round(fatPctFinal),
      carbPct: Math.round(carbPctFinal),
    },
    fiberTarget: primaryDiagnosis.fiberTarget,
    sodiumMax: primaryDiagnosis.sodiumMax,
    potassiumMax: primaryDiagnosis.potassiumMax,
    phosphorusMax: primaryDiagnosis.phosphorusMax,
    waterMl: Math.round(
      (input.ageYears >= 65 ? input.weightKg * 35 : input.weightKg * 30),
    ),
    primaryDiagnosis,
    warnings,
  };
}

// ---------------------------------------------------------------------
// Calculate nutrition for a given food + amount (grams)
// ---------------------------------------------------------------------
export function computeFoodNutrition(food: {
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
}, amountGram: number) {
  const ratio = amountGram / 100;
  return {
    cal: food.energy * ratio,
    protein: food.protein * ratio,
    fat: food.fat * ratio,
    carb: food.carb * ratio,
    fiber: food.fiber * ratio,
    sodium: food.sodium * ratio,
    potassium: food.potassium * ratio,
  };
}

// ---------------------------------------------------------------------
// Compute meal plan compliance vs target
// ---------------------------------------------------------------------
export function computeCompliance(
  totals: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodium: number },
  target: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodiumMax: number },
): number {
  const calRatio = Math.min(totals.cal, target.cal) / Math.max(target.cal, 1);
  const proteinRatio = Math.min(totals.protein, target.protein) / Math.max(target.protein, 1);
  const fatRatio = Math.min(totals.fat, target.fat) / Math.max(target.fat, 1);
  const carbRatio = Math.min(totals.carb, target.carb) / Math.max(target.carb, 1);
  const sodiumOk = totals.sodium <= target.sodiumMax ? 1 : target.sodiumMax / Math.max(totals.sodium, 1);
  const fiberRatio = Math.min(totals.fiber, target.fiber) / Math.max(target.fiber, 1);
  const avg = (calRatio + proteinRatio + fatRatio + carbRatio + sodiumOk + fiberRatio) / 6;
  return Math.round(avg * 100);
}
