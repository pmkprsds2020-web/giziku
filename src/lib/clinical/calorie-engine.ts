// =====================================================================
// CareLivia Calorie Engine — Core Domain Logic
// Implements the 11-step CareLivia formula (NOT Harris-Benedict/Mifflin).
// Every step is auditable by the clinician.
// =====================================================================

import {
  ActivityLevel,
  StressLevel,
  DiagnosisType,
  Gender,
} from "@prisma/client";
import {
  ACTIVITY_FACTOR,
  STRESS_FACTOR,
  classifyBMI,
  DIAGNOSIS_ADJUSTMENTS,
  PREGNANCY_KCAL,
  LACTATION_KCAL,
  KCAL_PER_GRAM,
  idealBodyWeight,
  ageCorrectionFactor,
  type DiagnosisAdjustment,
} from "./constants";

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

export interface CalorieResult {
  steps: CalorieStep[];
  bmi: number;
  bmiLabel: string;
  bmiColor: string;
  ibw: number; // ideal body weight
  adjustedWeight: number; // weight used for calc (IBW if obese, else actual)
  baseCalorie: number; // kcal/day before corrections
  ageFactor: number;
  activityFactor: number;
  stressFactor: number;
  bmiFactor: number;
  pregnancyKcal: number;
  lactationKcal: number;
  diagnosisFactor: number;
  targetCalorie: number; // final kcal/day
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
// CareLivia base calorie per kg — uses adjusted body weight
// Base: 25 kcal/kg (light), scaled internally by age correction.
// This is CareLivia's simplified predictive equation.
// ---------------------------------------------------------------------
function careliviaBaseKcalPerKg(ageYears: number): number {
  // CareLivia base: 25 kcal/kg/day for adult 18-65
  // Pediatrics & geriatrics adjusted
  if (ageYears < 3) return 100;
  if (ageYears < 10) return 80;
  if (ageYears < 18) return 35;
  if (ageYears >= 65) return 30;
  return 25;
}

// ---------------------------------------------------------------------
// BMI correction factor (CareLivia)
// If obese, use IBW (ideal body weight) instead of actual to avoid
// overfeeding. If underweight, use actual + 10% recovery buffer.
// ---------------------------------------------------------------------
function bmiWeightAdjustment(
  bmi: number,
  actualWeight: number,
  ibw: number,
  isObese: boolean,
): { weight: number; factor: number; note: string } {
  if (isObese) {
    // Use adjusted body weight: IBW + 0.25*(actual - IBW)
    const adjusted = ibw + 0.25 * (actualWeight - ibw);
    return { weight: adjusted, factor: 1.0, note: "Obesitas → Adjusted BW (IBW + 25% excess)" };
  }
  if (bmi < 18.5) {
    return { weight: actualWeight, factor: 1.1, note: "Underweight → +10% recovery buffer" };
  }
  return { weight: actualWeight, factor: 1.0, note: "Berat badan normal → actual weight" };
}

// ---------------------------------------------------------------------
// MAIN: Compute full CareLivia calorie target with audit trail
// ---------------------------------------------------------------------
export function computeCalorieTarget(input: CalorieInput): CalorieResult {
  const steps: CalorieStep[] = [];
  const warnings: string[] = [];

  // STEP 1 — BMI
  const heightM = input.heightCm / 100;
  const bmi = input.weightKg / (heightM * heightM);
  const bmiClass = classifyBMI(bmi);
  steps.push({
    step: 1,
    name: "Hitung BMI",
    description: "Body Mass Index = berat / tinggi²",
    formula: `${input.weightKg} / (${heightM})²`,
    input: `BB ${input.weightKg} kg, TB ${input.heightCm} cm`,
    output: Math.round(bmi * 10) / 10,
    unit: "kg/m²",
  });

  // STEP 2 — BBI (Ideal Body Weight)
  const ibw = idealBodyWeight(input.heightCm, input.gender);
  steps.push({
    step: 2,
    name: "Hitung BBI",
    description: `Broca-Carelivia: (TB-100) × ${input.gender === "MALE" ? "0.9" : "0.85"}`,
    formula: `(${input.heightCm}-100) × ${input.gender === "MALE" ? "0.9" : "0.85"}`,
    input: `TB ${input.heightCm} cm, ${input.gender}`,
    output: Math.round(ibw * 10) / 10,
    unit: "kg",
  });

  // STEP 3 — Kalori Dasar (Base)
  const isObese = bmi >= 25;
  const weightAdj = bmiWeightAdjustment(bmi, input.weightKg, ibw, isObese);
  const baseKcalPerKg = careliviaBaseKcalPerKg(input.ageYears);
  const baseCalorie = weightAdj.weight * baseKcalPerKg * weightAdj.factor;
  steps.push({
    step: 3,
    name: "Kalori Dasar",
    description: weightAdj.note,
    formula: `${Math.round(weightAdj.weight)} kg × ${baseKcalPerKg} kcal/kg ${weightAdj.factor !== 1 ? "× " + weightAdj.factor : ""}`,
    input: `BB adj ${Math.round(weightAdj.weight)} kg, umur ${input.ageYears} th`,
    output: Math.round(baseCalorie),
    unit: "kcal/hari",
  });

  // STEP 4 — Koreksi Usia
  const ageFactor = ageCorrectionFactor(input.ageYears, input.gender);
  const afterAge = baseCalorie * ageFactor;
  steps.push({
    step: 4,
    name: "Koreksi Usia",
    description: "Penurunan BMR seiring usia (CareLivia)",
    formula: `${Math.round(baseCalorie)} × ${ageFactor}`,
    input: `Umur ${input.ageYears} th, ${input.gender}`,
    output: Math.round(afterAge),
    unit: "kcal/hari",
  });

  // STEP 5 — Faktor Aktivitas
  const activityFactor = ACTIVITY_FACTOR[input.activity];
  const afterActivity = afterAge * activityFactor;
  steps.push({
    step: 5,
    name: "Faktor Aktivitas",
    description: "WHO activity factor",
    formula: `${Math.round(afterAge)} × ${activityFactor}`,
    input: input.activity,
    output: Math.round(afterActivity),
    unit: "kcal/hari",
  });

  // STEP 6 — Faktor BMI (additional clinical adjustment)
  // CareLivia applies a small BMI-based tweak beyond the weight adjustment
  let bmiFactor = 1.0;
  if (bmi < 18.5) bmiFactor = 1.05; // slight increase for recovery
  else if (bmi >= 30) bmiFactor = 0.95; // slight decrease for deficit
  const afterBmi = afterActivity * bmiFactor;
  steps.push({
    step: 6,
    name: "Faktor BMI",
    description: "Koreksi klinis berbasis kategori BMI",
    formula: `${Math.round(afterActivity)} × ${bmiFactor}`,
    input: `BMI ${Math.round(bmi * 10) / 10} (${bmiClass.label})`,
    output: Math.round(afterBmi),
    unit: "kcal/hari",
  });

  // STEP 7 — Faktor Stress
  const stressFactor = STRESS_FACTOR[input.stress];
  const afterStress = afterBmi * stressFactor;
  steps.push({
    step: 7,
    name: "Faktor Stress",
    description: "ESPEN/ASPEN stress factor",
    formula: `${Math.round(afterBmi)} × ${stressFactor}`,
    input: input.stress,
    output: Math.round(afterStress),
    unit: "kcal/hari",
  });

  // STEP 8 — Kehamilan
  let pregnancyKcal = 0;
  if (input.isPregnant) {
    const trimester = input.pregnancyTrimester ?? 1;
    pregnancyKcal = PREGNANCY_KCAL[trimester] ?? 0;
    if (trimester === 1) {
      warnings.push("Trimester 1 tidak memerlukan tambahan kalori; fokus asam folat.");
    }
  }
  const afterPregnancy = afterStress + pregnancyKcal;
  steps.push({
    step: 8,
    name: "Tambahan Kehamilan",
    description: "WHO pregnancy kcal offset",
    formula: `${Math.round(afterStress)} + ${pregnancyKcal}`,
    input: input.isPregnant ? `Trimester ${input.pregnancyTrimester ?? 1}` : "Tidak hamil",
    output: Math.round(afterPregnancy),
    unit: "kcal/hari",
  });

  // STEP 9 — Laktasi
  const lactationKcal = input.isLactating ? LACTATION_KCAL : 0;
  const afterLactation = afterPregnancy + lactationKcal;
  steps.push({
    step: 9,
    name: "Tambahan Laktasi",
    description: "WHO lactation +500 kcal",
    formula: `${Math.round(afterPregnancy)} + ${lactationKcal}`,
    input: input.isLactating ? "Laktasi aktif" : "Tidak laktasi",
    output: Math.round(afterLactation),
    unit: "kcal/hari",
  });

  // STEP 10 — Faktor Diagnosis + Target Kalori
  const primaryDiagnosis = input.diagnoses[0]
    ? DIAGNOSIS_ADJUSTMENTS[input.diagnoses[0]]
    : DIAGNOSIS_ADJUSTMENTS.OTHER;
  const diagnosisFactor = primaryDiagnosis.calFactor;
  const targetCalorie = Math.round(afterLactation * diagnosisFactor);
  steps.push({
    step: 10,
    name: "Faktor Diagnosis → Target Kalori",
    description: primaryDiagnosis.notes,
    formula: `${Math.round(afterLactation)} × ${diagnosisFactor}`,
    input: input.diagnoses.length ? input.diagnoses.join(", ") : "Umum",
    output: targetCalorie,
    unit: "kcal/hari",
  });

  // STEP 11 — Makronutrien
  const proteinPct = (primaryDiagnosis.proteinPerKg[0] + primaryDiagnosis.proteinPerKg[1]) / 2;
  // Protein from g/kg target
  const proteinGFromKg = proteinPct * weightAdj.weight;
  const proteinKcal = proteinGFromKg * KCAL_PER_GRAM.protein;
  // Remaining kcal split between carb and fat using diagnosis ratio
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

  steps.push({
    step: 11,
    name: "Distribusi Makronutrien",
    description: `Protein ${proteinPct} g/kg × ${Math.round(weightAdj.weight)} kg; sisa energi split ${Math.round(carbMid)}:${Math.round(fatMid)} (K:C:L)`,
    formula: `P=${Math.round(proteinG)}g (${Math.round(proteinPctFinal)}%), K=${Math.round(carbG)}g (${Math.round(carbPctFinal)}%), L=${Math.round(fatG)}g (${Math.round(fatPctFinal)}%)`,
    input: `Target ${targetCalorie} kcal`,
    output: Math.round(proteinG + carbG + fatG),
    unit: "g total",
  });

  // Warnings
  if (targetCalorie < 1000) warnings.push("Target kalori <1000 kcal — evaluasi medis diperlukan.");
  if (targetCalorie > 4000) warnings.push("Target kalori >4000 kcal — verifikasi input.");
  if (input.diagnoses.includes("MALNUTRITION")) {
    warnings.push("Risiko Refeeding Syndrome: naikkan bertahap, pantau elektrolit & thiamin.");
  }
  if (input.diagnoses.includes("CKD") || input.diagnoses.includes("CKD_ND")) {
    warnings.push("CKD: pantau kalium & fosfor, batasi cairan bila perlu.");
  }

  return {
    steps,
    bmi: Math.round(bmi * 10) / 10,
    bmiLabel: bmiClass.label,
    bmiColor: bmiClass.color,
    ibw: Math.round(ibw * 10) / 10,
    adjustedWeight: Math.round(weightAdj.weight * 10) / 10,
    baseCalorie: Math.round(baseCalorie),
    ageFactor,
    activityFactor,
    stressFactor,
    bmiFactor,
    pregnancyKcal,
    lactationKcal,
    diagnosisFactor,
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
