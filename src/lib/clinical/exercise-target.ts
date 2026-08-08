// =====================================================================
// CareLivia — Exercise Target Engine
// =====================================================================
// Single Source of Truth for "berapa target kalori latihan TAMBAHAN yang
// aman untuk pasien ini", dan "latihan apa yang boleh diberikan agar
// actual burned mendekati target tanpa memaksakan pasien".
//
// Menggantikan formula lama yang statis:
//   targetBurned = targetCalorie * 0.20   // sama untuk SEMUA pasien
//
// Dipakai oleh:
//   - src/app/api/exercise/route.ts        (rule-based generator)
//   - src/app/api/ai/exercise-plan/route.ts (AI generator — target &
//     rationale sama, hanya pemilihan item yang diserahkan ke AI)
//
// Prinsip:
//   1. Prioritaskan data Bouchard Activity Record (PAL aktual pasien).
//   2. Jika Bouchard tidak ada, fallback ke assessment.activity, lalu
//      ECOG/Barthel, lalu default konservatif klinis (BUKAN 0).
//   3. Target latihan TIDAK berbanding lurus dengan PAL — PAL tinggi
//      artinya pasien sudah aktif secara harian, sehingga target LATIHAN
//      TAMBAHAN justru harus lebih kecil (prioritas recovery/maintenance).
//   4. Kondisi klinis (ECOG, Barthel, frailty, fall risk, diagnosis
//      berisiko) hanya bisa MENURUNKAN target, tidak pernah menaikkan.
//   5. Actual burned menyesuaikan durasi secara bertahap menuju target,
//      TAPI tidak pernah dipaksakan pada pasien yang secara klinis tidak
//      aman untuk itu (frail / ECOG berat / Barthel rendah / fall risk
//      tinggi) — di kondisi tsb actual boleh < target (SAFETY_LIMIT).
// =====================================================================

import { MET_TABLE, type DiagnosisType } from "./constants";
import type { PalCategory } from "./bouchard";

// ---------------------------------------------------------------------
// Config — SSOT untuk semua angka yang dipakai, supaya mudah diaudit.
// ---------------------------------------------------------------------
export const EXERCISE_TARGET_CONFIG = {
  // % dari target kalori harian yang dialokasikan untuk latihan TAMBAHAN,
  // berdasarkan kategori PAL. Sengaja TERBALIK dengan intuisi "makin aktif
  // makin tinggi target" — pasien Sedentary butuh dorongan lebih besar
  // untuk mulai bergerak, sedangkan pasien Very Active sudah cukup aktif
  // dari aktivitas hariannya sehingga cukup maintenance/recovery.
  BASE_PERCENTAGE_BY_PAL_CATEGORY: {
    Sedentary: 0.22,
    "Low Active": 0.18,
    Active: 0.12,
    "Very Active": 0.08,
    Unknown: 0.15,
  } as Record<ActivityCategory, number>,

  MIN_PERCENTAGE: 0.05,
  MAX_PERCENTAGE: 0.25,
  // Batas bawah absolut agar target TIDAK PERNAH 0 kcal selama berat
  // badan & target kalori harian pasien tersedia (lihat butir #32 spec).
  MIN_TARGET_KCAL: 50,

  // Faktor keselamatan — dikalikan ke base percentage. Kalau beberapa
  // faktor terpicu sekaligus, dipakai yang PALING konservatif (nilai
  // terkecil), bukan dikalikan berulang, supaya tidak menghasilkan target
  // yang tidak masuk akal kecil.
  SAFETY_FACTOR: {
    ECOG_SEVERE: 0.35, // ECOG >= 3
    ECOG_MODERATE: 0.55, // ECOG == 2
    BARTHEL_VERY_LOW: 0.35, // < 40 (ketergantungan berat)
    BARTHEL_LOW: 0.55, // < 60 (ketergantungan sedang)
    FRAIL: 0.5,
    PREFRAIL: 0.75,
    HIGH_FALL_RISK: 0.65,
    DIAGNOSIS_CAUTION: 0.85, // CHF/CKD/COPD/STROKE/GOUT/SARCOPENIA/POST_OP dll.
  },

  // Diagnosis yang memerlukan kehati-hatian ekstra pada resep latihan
  // (bukan daftar kontraindikasi baru — hanya menurunkan target sedikit
  // & mengarahkan ke intensitas lebih rendah, sesuai DIAGNOSIS_ADJUSTMENTS
  // & exercise program library yang sudah ada).
  CAUTION_DIAGNOSES: new Set<string>([
    "CHF", "CKD", "CKD_ND", "CKD_HD", "CKD_PD", "COPD", "STROKE", "GOUT",
    "SARCOPENIA", "POST_OP", "MALNUTRITION",
  ]),

  DURATION_STEP_MIN: 5,
  MAX_ITEM_DURATION_MIN: 45,
  MAX_TOTAL_DURATION_MIN: 90,

  // Jika achievementPercentage >= ambang ini, dianggap "Tercapai".
  ACHIEVED_THRESHOLD_PCT: 90,
  PARTIAL_THRESHOLD_PCT: 70,
} as const;

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
export type ActivityCategory = PalCategory | "Unknown";

export type TargetBasis =
  | "BOUCHARD"
  | "ASSESSMENT_ACTIVITY"
  | "ECOG_BARTHEL"
  | "DEFAULT_CONSERVATIVE";

export interface ExerciseTargetInput {
  weightKg: number;
  ageYears: number;
  bmi: number;

  /** kkal/hari — hasil computeCalorieTarget().targetCalorie */
  dailyCalorieTarget: number;

  /** Dari Bouchard Activity Record terbaru (jika ada) */
  pal?: number | null;
  palCategory?: PalCategory | string | null;

  /** Fallback: assessment.activity (BED_REST..HEAVY) bila Bouchard belum ada */
  activityLevel?: string | null;

  ecog?: string | number | null;
  barthel?: number | null;
  karnofsky?: number | null;
  pps?: number | null;

  frailty?: string | null; // "Frail" | "Prefrail" | "Robust" | ...
  cfs?: number | null;
  fallRisk?: string | null; // "High" | "Low" | ...

  diagnoses: (DiagnosisType | string)[];
}

export interface ExerciseTargetResult {
  targetBurned: number;
  targetPercentage: number; // 0..1
  activityCategory: ActivityCategory;
  targetBasis: TargetBasis;
  recommendedDailyMinutes: number;
  recommendedIntensity: "LOW" | "MODERATE" | "HIGH";
  clinicalAdjustment: number; // multiplier applied on top of base %
  rationale: string[];
  warnings: string[];
  /** true bila target diturunkan karena keselamatan klinis (ECOG/Barthel/frailty/fall risk) */
  safetyAdjusted: boolean;
  /** true bila pasien tidak boleh "dipaksa" mengejar target lewat durasi */
  forceProhibited: boolean;
}

// ---------------------------------------------------------------------
// Step 1 — tentukan kategori aktivitas & basis perhitungan (fallback chain)
// ---------------------------------------------------------------------
function classifyActivityLevel(activityLevel?: string | null): ActivityCategory {
  switch (activityLevel) {
    case "BED_REST":
    case "VERY_LIGHT":
      return "Sedentary";
    case "LIGHT":
      return "Low Active";
    case "MODERATE":
      return "Active";
    case "HEAVY":
      return "Very Active";
    default:
      return "Unknown";
  }
}

function deriveActivityCategory(input: ExerciseTargetInput): {
  category: ActivityCategory;
  basis: TargetBasis;
  rationale: string[];
} {
  const rationale: string[] = [];

  // 1) Bouchard (prioritas utama)
  if (input.pal != null && input.pal > 0) {
    const category = (input.palCategory as ActivityCategory) || "Unknown";
    rationale.push(
      `Bouchard Activity Record: PAL ${input.pal.toFixed(2)} (${category}) dipakai sebagai dasar utama tingkat aktivitas.`,
    );
    return { category, basis: "BOUCHARD", rationale };
  }

  // 2) assessment.activity
  if (input.activityLevel) {
    const category = classifyActivityLevel(input.activityLevel);
    if (category !== "Unknown") {
      rationale.push(
        `Bouchard Activity Record belum tersedia — menggunakan tingkat aktivitas dari asesmen (${input.activityLevel}).`,
      );
      return { category, basis: "ASSESSMENT_ACTIVITY", rationale };
    }
  }

  // 3) ECOG / Barthel
  const ecogNum = input.ecog != null ? Number(input.ecog) : null;
  if (ecogNum != null && !Number.isNaN(ecogNum)) {
    const category: ActivityCategory =
      ecogNum >= 3 ? "Sedentary" : ecogNum === 2 ? "Sedentary" : ecogNum === 1 ? "Low Active" : "Active";
    rationale.push(
      `Bouchard & data aktivitas asesmen belum tersedia — tingkat aktivitas diestimasi dari ECOG ${ecogNum}.`,
    );
    return { category, basis: "ECOG_BARTHEL", rationale };
  }
  if (input.barthel != null) {
    const category: ActivityCategory =
      input.barthel < 40 ? "Sedentary" : input.barthel < 60 ? "Sedentary" : input.barthel < 100 ? "Low Active" : "Active";
    rationale.push(
      `Bouchard, aktivitas asesmen, dan ECOG belum tersedia — tingkat aktivitas diestimasi dari indeks Barthel ${input.barthel}.`,
    );
    return { category, basis: "ECOG_BARTHEL", rationale };
  }

  // 4) Default konservatif klinis — BUKAN 0, memakai persentase moderat
  // ("Unknown" pada BASE_PERCENTAGE_BY_PAL_CATEGORY) sehingga target tetap
  // valid selama dailyCalorieTarget & weight tersedia. Lihat butir #32.
  rationale.push(
    "Data aktivitas (Bouchard/asesmen/ECOG/Barthel) belum tersedia — menggunakan asumsi aktivitas ringan yang konservatif secara klinis sebagai default.",
  );
  return { category: "Unknown", basis: "DEFAULT_CONSERVATIVE", rationale };
}

// ---------------------------------------------------------------------
// Step 2 — faktor keselamatan klinis (hanya menurunkan, tidak pernah menaikkan)
// ---------------------------------------------------------------------
function computeSafetyAdjustment(input: ExerciseTargetInput): {
  factor: number;
  rationale: string[];
  warnings: string[];
  safetyAdjusted: boolean;
  forceProhibited: boolean;
} {
  const cfg = EXERCISE_TARGET_CONFIG.SAFETY_FACTOR;
  const rationale: string[] = [];
  const warnings: string[] = [];
  let factor = 1.0;
  let forceProhibited = false;

  const ecogNum = input.ecog != null ? Number(input.ecog) : null;
  if (ecogNum != null && !Number.isNaN(ecogNum)) {
    if (ecogNum >= 3) {
      factor = Math.min(factor, cfg.ECOG_SEVERE);
      rationale.push(`ECOG ${ecogNum} (keterbatasan berat) — target diturunkan untuk keselamatan, latihan tidak boleh dipaksakan.`);
      forceProhibited = true;
    } else if (ecogNum === 2) {
      factor = Math.min(factor, cfg.ECOG_MODERATE);
      rationale.push(`ECOG ${ecogNum} — target diturunkan, prioritaskan intensitas rendah.`);
    }
  }

  if (input.barthel != null) {
    if (input.barthel < 40) {
      factor = Math.min(factor, cfg.BARTHEL_VERY_LOW);
      rationale.push(`Indeks Barthel ${input.barthel} (ketergantungan berat) — target diturunkan, latihan tidak boleh dipaksakan.`);
      forceProhibited = true;
    } else if (input.barthel < 60) {
      factor = Math.min(factor, cfg.BARTHEL_LOW);
      rationale.push(`Indeks Barthel ${input.barthel} (ketergantungan sedang) — target diturunkan untuk keselamatan.`);
    }
  }

  if (input.frailty === "Frail") {
    factor = Math.min(factor, cfg.FRAIL);
    rationale.push("Status Frail — target diturunkan, latihan tidak boleh dipaksakan mencapai target.");
    forceProhibited = true;
  } else if (input.frailty === "Prefrail") {
    factor = Math.min(factor, cfg.PREFRAIL);
    rationale.push("Status Prefrail — target diturunkan sebagai kehati-hatian.");
  }
  if (input.cfs != null && input.cfs >= 6) {
    factor = Math.min(factor, cfg.FRAIL);
    rationale.push(`Clinical Frailty Scale ${input.cfs} — target diturunkan, latihan tidak boleh dipaksakan.`);
    forceProhibited = true;
  }

  if (input.fallRisk === "High") {
    factor = Math.min(factor, cfg.HIGH_FALL_RISK);
    rationale.push("Risiko jatuh tinggi — target diturunkan, prioritaskan latihan keseimbangan dengan pengawasan.");
  }

  const cautionDx = (input.diagnoses || []).filter((d) => EXERCISE_TARGET_CONFIG.CAUTION_DIAGNOSES.has(String(d)));
  if (cautionDx.length > 0) {
    factor = Math.min(factor, cfg.DIAGNOSIS_CAUTION);
    rationale.push(`Diagnosis memerlukan kehati-hatian (${cautionDx.join(", ")}) — target sedikit diturunkan, ikuti program latihan spesifik diagnosis.`);
  }

  const safetyAdjusted = factor < 1.0;
  return { factor, rationale, warnings, safetyAdjusted, forceProhibited };
}

// ---------------------------------------------------------------------
// Step 3 — orkestrasi utama: computeExerciseTarget()
// ---------------------------------------------------------------------
export function computeExerciseTarget(input: ExerciseTargetInput): ExerciseTargetResult {
  const warnings: string[] = [];

  if (!input.weightKg || input.weightKg <= 0) {
    warnings.push("Target latihan belum dapat dihitung karena data berat badan pasien belum lengkap.");
  }
  if (!input.dailyCalorieTarget || input.dailyCalorieTarget <= 0) {
    warnings.push("Target latihan belum dapat dihitung karena kebutuhan energi harian (target kalori) belum tersedia.");
  }

  const { category, basis, rationale: activityRationale } = deriveActivityCategory(input);
  const safety = computeSafetyAdjustment(input);

  const basePct = EXERCISE_TARGET_CONFIG.BASE_PERCENTAGE_BY_PAL_CATEGORY[category] ?? EXERCISE_TARGET_CONFIG.BASE_PERCENTAGE_BY_PAL_CATEGORY.Unknown;
  let targetPercentage = basePct * safety.factor;
  targetPercentage = Math.max(EXERCISE_TARGET_CONFIG.MIN_PERCENTAGE * safety.factor, Math.min(EXERCISE_TARGET_CONFIG.MAX_PERCENTAGE, targetPercentage));

  const rationale = [...activityRationale, ...safety.rationale];

  let targetBurned = 0;
  if (input.dailyCalorieTarget > 0) {
    targetBurned = Math.round(input.dailyCalorieTarget * targetPercentage);
    // Jangan pernah 0 secara diam-diam selama target kalori harian valid —
    // lihat butir #31/#32 spec (kasus screenshot "Target Burned = 0 kcal").
    if (targetBurned < EXERCISE_TARGET_CONFIG.MIN_TARGET_KCAL) {
      targetBurned = EXERCISE_TARGET_CONFIG.MIN_TARGET_KCAL;
      rationale.push(`Target dibulatkan ke batas minimum klinis ${EXERCISE_TARGET_CONFIG.MIN_TARGET_KCAL} kcal agar tetap bermakna secara fungsional.`);
    }
  }

  // Estimasi menit/hari untuk rationale UI — pakai MET representatif 4.0
  // (setara jalan kaki cepat/latihan fungsional ringan-sedang).
  const representativeMet = 4.0;
  const recommendedDailyMinutes =
    input.weightKg > 0 && targetBurned > 0
      ? Math.round((targetBurned * 60) / (representativeMet * input.weightKg))
      : 0;

  const recommendedIntensity: ExerciseTargetResult["recommendedIntensity"] = safety.forceProhibited
    ? "LOW"
    : category === "Sedentary" || category === "Low Active" || category === "Unknown"
      ? "MODERATE"
      : "MODERATE";

  return {
    targetBurned,
    targetPercentage: Math.round(targetPercentage * 1000) / 1000,
    activityCategory: category,
    targetBasis: basis,
    recommendedDailyMinutes,
    recommendedIntensity,
    clinicalAdjustment: Math.round(safety.factor * 1000) / 1000,
    rationale,
    warnings: [...warnings, ...safety.warnings],
    safetyAdjusted: safety.safetyAdjusted,
    forceProhibited: safety.forceProhibited,
  };
}

// =====================================================================
// Exercise selection + duration adjustment ("Actual Burned")
// =====================================================================

export interface ExerciseCandidate {
  key: string; // MET_TABLE key
  baseDuration: number;
}

export interface ClinicalFlags {
  limitedMobility: boolean; // ECOG >=3, Barthel <40
  isFrail: boolean;
  highFallRisk: boolean;
  bmi: number;
  ageYears: number;
  diagnoses: (DiagnosisType | string)[];
}

/**
 * Memilih kandidat latihan berdasarkan kondisi klinis pasien. Ini adalah
 * refactor dari logic yang sebelumnya berada langsung di /api/exercise
 * route.ts, dipindahkan ke sini agar bisa dipakai ulang & diaudit.
 */
export function selectExerciseCandidates(flags: ClinicalFlags): ExerciseCandidate[] {
  const { limitedMobility, isFrail, highFallRisk, bmi, ageYears, diagnoses } = flags;

  if (limitedMobility) {
    return [
      { key: "stretching", baseDuration: 10 },
      { key: "balance_exercise", baseDuration: 10 },
      { key: "functional_training", baseDuration: 10 },
    ];
  }
  if (isFrail || highFallRisk) {
    return [
      { key: "walking", baseDuration: 15 },
      { key: "balance_exercise", baseDuration: 10 },
      { key: "resistance_band", baseDuration: 10 },
      { key: "taichi", baseDuration: 15 },
    ];
  }
  const hasMetabolic = diagnoses.some((d) => d === "DM" || d === "HT");
  if (bmi >= 27 || hasMetabolic) {
    const items: ExerciseCandidate[] = [
      { key: "brisk_walk", baseDuration: 30 },
      { key: "light_weights", baseDuration: 15 },
      { key: "stretching", baseDuration: 10 },
    ];
    if (bmi < 35) items.push({ key: "cycling", baseDuration: 20 });
    return items;
  }
  if (ageYears >= 65) {
    return [
      { key: "walking", baseDuration: 25 },
      { key: "resistance_band", baseDuration: 15 },
      { key: "balance_exercise", baseDuration: 10 },
      { key: "yoga", baseDuration: 15 },
    ];
  }
  return [
    { key: "brisk_walk", baseDuration: 30 },
    { key: "moderate_weights", baseDuration: 20 },
    { key: "stretching", baseDuration: 10 },
    { key: "cycling", baseDuration: 20 },
  ];
}

export interface BuiltExerciseItem {
  key: string;
  name: string;
  type: string;
  intensity: "LOW" | "MODERATE" | "HIGH";
  duration: number;
  caloriesBurned: number;
  met: number;
}

/** Formula: MET × berat (kg) × durasi (menit) / 60 — dipertahankan sesuai spec. */
export function buildExerciseItem(key: string, duration: number, weightKg: number): BuiltExerciseItem {
  const m = MET_TABLE[key];
  const met = m?.met ?? 3;
  const burned = (met * weightKg * duration) / 60;
  return {
    key,
    name: m?.name ?? key,
    type: m?.type ?? "AEROBIC",
    intensity: duration >= 30 ? "MODERATE" : "LOW",
    duration,
    caloriesBurned: Math.round(burned),
    met,
  };
}

export type AchievementStatus = "ACHIEVED" | "PARTIALLY_ACHIEVED" | "SAFETY_LIMIT" | "BELOW_TARGET";

export interface DurationAdjustmentResult {
  items: BuiltExerciseItem[];
  actualBurned: number;
  achievementPercentage: number;
  achievementStatus: AchievementStatus;
}

/**
 * Menaikkan durasi kandidat latihan secara bertahap (+5 menit) sampai
 * actualBurned mendekati targetBurned, ATAU sampai batas durasi klinis
 * (MAX_ITEM_DURATION_MIN / MAX_TOTAL_DURATION_MIN) tercapai.
 *
 * Bila `allowIncrease` = false (pasien frail/ECOG berat/Barthel rendah/
 * fall risk tinggi — lihat forceProhibited di ExerciseTargetResult),
 * durasi TIDAK dinaikkan sama sekali — actual boleh < target, ditandai
 * SAFETY_LIMIT, bukan dipaksakan.
 */
export function adjustDurationsToTarget(
  candidates: ExerciseCandidate[],
  weightKg: number,
  targetBurned: number,
  allowIncrease: boolean,
): DurationAdjustmentResult {
  const durations = candidates.map((c) => c.baseDuration);
  const step = EXERCISE_TARGET_CONFIG.DURATION_STEP_MIN;

  const totalBurned = () =>
    candidates.reduce((s, c, i) => s + buildExerciseItem(c.key, durations[i], weightKg).caloriesBurned, 0);
  const totalDuration = () => durations.reduce((s, d) => s + d, 0);

  if (allowIncrease && weightKg > 0) {
    let guard = 0; // safety guard against infinite loops
    while (
      totalBurned() < targetBurned &&
      totalDuration() < EXERCISE_TARGET_CONFIG.MAX_TOTAL_DURATION_MIN &&
      guard < 200
    ) {
      // Round-robin: naikkan durasi item dengan MET tertinggi dulu (paling
      // efisien mengejar target tanpa menambah waktu latihan berlebihan),
      // tapi tetap hormati batas durasi per-item.
      const order = candidates
        .map((c, i) => ({ i, met: MET_TABLE[c.key]?.met ?? 3 }))
        .sort((a, b) => b.met - a.met);

      let increased = false;
      for (const { i } of order) {
        if (durations[i] < EXERCISE_TARGET_CONFIG.MAX_ITEM_DURATION_MIN && totalDuration() < EXERCISE_TARGET_CONFIG.MAX_TOTAL_DURATION_MIN) {
          durations[i] += step;
          increased = true;
          break;
        }
      }
      if (!increased) break;
      guard++;
    }
  }

  const items = candidates.map((c, i) => buildExerciseItem(c.key, durations[i], weightKg));
  const actualBurned = items.reduce((s, it) => s + it.caloriesBurned, 0);
  const achievementPercentage = targetBurned > 0 ? Math.round((actualBurned / targetBurned) * 1000) / 10 : 0;

  let achievementStatus: AchievementStatus;
  if (!allowIncrease && achievementPercentage < EXERCISE_TARGET_CONFIG.ACHIEVED_THRESHOLD_PCT) {
    achievementStatus = "SAFETY_LIMIT";
  } else if (achievementPercentage >= EXERCISE_TARGET_CONFIG.ACHIEVED_THRESHOLD_PCT) {
    achievementStatus = "ACHIEVED";
  } else if (achievementPercentage >= EXERCISE_TARGET_CONFIG.PARTIAL_THRESHOLD_PCT) {
    achievementStatus = "PARTIALLY_ACHIEVED";
  } else {
    achievementStatus = "BELOW_TARGET";
  }

  return { items, actualBurned, achievementPercentage, achievementStatus };
}

// ---------------------------------------------------------------------
// Orchestrator dipakai oleh rule-based /api/exercise route — menyatukan
// target engine + seleksi kandidat + penyesuaian durasi + audit trail.
// ---------------------------------------------------------------------
export interface PlanExerciseResult {
  target: ExerciseTargetResult;
  duration: DurationAdjustmentResult;
  notes: string;
}

export function planExerciseForPatient(
  targetInput: ExerciseTargetInput,
  clinicalFlags: ClinicalFlags,
): PlanExerciseResult {
  const target = computeExerciseTarget(targetInput);
  const candidates = selectExerciseCandidates(clinicalFlags);
  const duration = adjustDurationsToTarget(
    candidates,
    targetInput.weightKg,
    target.targetBurned,
    !target.forceProhibited,
  );

  const notesParts = [
    `Target latihan tambahan: ${target.targetBurned} kcal (${Math.round(target.targetPercentage * 100)}% kebutuhan energi harian, basis: ${target.activityCategory}).`,
  ];
  if (target.safetyAdjusted) {
    notesParts.push("Target disesuaikan turun karena pertimbangan keselamatan klinis.");
  }
  if (duration.achievementStatus === "SAFETY_LIMIT") {
    notesParts.push("Target energi latihan disesuaikan dengan keterbatasan fungsional pasien — tidak dipaksakan.");
  }

  return { target, duration, notes: notesParts.join(" ") };
}

/** Bentuk audit trail yang disimpan pada exercise_plans.plan_details (JSONB). */
export function buildExerciseAuditTrail(params: {
  dailyCalorieTarget: number;
  target: ExerciseTargetResult;
  duration: DurationAdjustmentResult;
  bouchard?: {
    avgPal?: number | null;
    palCategory?: string | null;
    avgEnergyExpenditure?: number | null;
    whoStatus?: { moderateVigorousMinutesPerWeek?: number } | null;
    assessmentDate?: string | null;
  } | null;
}) {
  const { dailyCalorieTarget, target, duration, bouchard } = params;
  return {
    target_calorie: dailyCalorieTarget,
    target_burned: target.targetBurned,
    target_percentage: Math.round(target.targetPercentage * 100),
    target_basis: target.targetBasis,
    activity_category: target.activityCategory,
    bouchard_pal: bouchard?.avgPal ?? null,
    bouchard_category: bouchard?.palCategory ?? null,
    bouchard_energy_expenditure: bouchard?.avgEnergyExpenditure ?? null,
    bouchard_assessment_date: bouchard?.assessmentDate ?? null,
    who_moderate_minutes: bouchard?.whoStatus?.moderateVigorousMinutesPerWeek ?? null,
    clinical_adjustment: target.clinicalAdjustment,
    clinical_adjustments: target.rationale,
    target_rationale: target.rationale.join(" "),
    warnings: target.warnings,
    actual_burned: duration.actualBurned,
    achievement_percentage: duration.achievementPercentage,
    achievement_status: duration.achievementStatus,
    safety_adjusted: target.safetyAdjusted,
    force_prohibited: target.forceProhibited,
  };
}
