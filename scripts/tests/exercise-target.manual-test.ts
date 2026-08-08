import {
  computeExerciseTarget,
  selectExerciseCandidates,
  adjustDurationsToTarget,
  planExerciseForPatient,
} from "../../src/lib/clinical/exercise-target";

function log(name: string, obj: any) {
  console.log(`\n=== ${name} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

// Case 1 — pasien normal aktif (BB 70, TB 170, ECOG 0, Barthel 100, PAL 1.75)
const case1 = planExerciseForPatient(
  {
    weightKg: 70, ageYears: 40, bmi: 24.2, dailyCalorieTarget: 2000,
    pal: 1.75, palCategory: "Active", ecog: 0, barthel: 100, diagnoses: [],
  },
  { limitedMobility: false, isFrail: false, highFallRisk: false, bmi: 24.2, ageYears: 40, diagnoses: [] },
);
log("Case 1 - normal active", { targetBurned: case1.target.targetBurned, actualBurned: case1.duration.actualBurned, status: case1.duration.achievementStatus });
console.assert(case1.target.targetBurned > 0, "Case1: target must be > 0");
console.assert(case1.duration.actualBurned > 0, "Case1: actual must be > 0");

// Case 2 — sedentary (PAL 1.30)
const case2 = planExerciseForPatient(
  { weightKg: 70, ageYears: 40, bmi: 24.2, dailyCalorieTarget: 2000, pal: 1.30, palCategory: "Sedentary", diagnoses: [] },
  { limitedMobility: false, isFrail: false, highFallRisk: false, bmi: 24.2, ageYears: 40, diagnoses: [] },
);
log("Case 2 - sedentary", { targetBurned: case2.target.targetBurned, pct: case2.target.targetPercentage });
console.assert(case2.target.targetBurned > case1.target.targetBurned, "Case2: sedentary target should be greater than active");
console.assert(case2.target.targetPercentage <= 0.25, "Case2: within clinical bounds");

// Case 3 — frail, high fall risk, Barthel rendah
const case3 = planExerciseForPatient(
  { weightKg: 70, ageYears: 78, bmi: 22, dailyCalorieTarget: 1600, ecog: 3, barthel: 35, frailty: "Frail", fallRisk: "High", diagnoses: [] },
  { limitedMobility: true, isFrail: true, highFallRisk: true, bmi: 22, ageYears: 78, diagnoses: [] },
);
log("Case 3 - frail", { targetBurned: case3.target.targetBurned, actualBurned: case3.duration.actualBurned, status: case3.duration.achievementStatus, forceProhibited: case3.target.forceProhibited });
console.assert(case3.target.recommendedIntensity === "LOW", "Case3: intensity must be LOW");
console.assert(case3.target.forceProhibited === true, "Case3: must not force target");

// Case 4 — tidak ada Bouchard (fallback chain)
const case4 = planExerciseForPatient(
  { weightKg: 65, ageYears: 50, bmi: 23, dailyCalorieTarget: 1800, activityLevel: "LIGHT", diagnoses: [] },
  { limitedMobility: false, isFrail: false, highFallRisk: false, bmi: 23, ageYears: 50, diagnoses: [] },
);
log("Case 4 - no bouchard fallback", { basis: case4.target.targetBasis, targetBurned: case4.target.targetBurned });
console.assert(case4.target.targetBurned > 0, "Case4: plan must still be creatable without Bouchard");

// Case 4b — no bouchard, no assessment.activity, no ECOG/Barthel at all
const case4b = planExerciseForPatient(
  { weightKg: 65, ageYears: 50, bmi: 23, dailyCalorieTarget: 1800, diagnoses: [] },
  { limitedMobility: false, isFrail: false, highFallRisk: false, bmi: 23, ageYears: 50, diagnoses: [] },
);
log("Case 4b - zero data fallback (must not be 0 kcal)", { basis: case4b.target.targetBasis, targetBurned: case4b.target.targetBurned });
console.assert(case4b.target.targetBurned > 0, "Case4b: target must never be 0 when calorie target & weight available (bug repro from screenshot)");

// Case 5 — Bouchard tersedia harus masuk perhitungan
const case5 = computeExerciseTarget({ weightKg: 70, ageYears: 60, bmi: 27, dailyCalorieTarget: 1800, pal: 1.42, palCategory: "Low Active", diagnoses: [] });
log("Case 5 - bouchard PAL used", { basis: case5.targetBasis, category: case5.activityCategory });
console.assert(case5.targetBasis === "BOUCHARD", "Case5: Bouchard PAL must be prioritized");

// Screenshot repro: target must not become 0 with weight/height/diagnosis/assessment present but no Bouchard
const screenshotRepro = planExerciseForPatient(
  { weightKg: 68, ageYears: 55, bmi: 25, dailyCalorieTarget: 1900, ecog: 1, barthel: 100, diagnoses: ["DM"] },
  { limitedMobility: false, isFrail: false, highFallRisk: false, bmi: 25, ageYears: 55, diagnoses: ["DM"] },
);
log("Screenshot repro", { targetBurned: screenshotRepro.target.targetBurned, actualBurned: screenshotRepro.duration.actualBurned, achievementPct: screenshotRepro.duration.achievementPercentage });
console.assert(screenshotRepro.target.targetBurned > 0, "Screenshot repro: target must not be 0");
console.assert(screenshotRepro.duration.actualBurned > 0, "Screenshot repro: actual must not be near-zero");

console.log("\nAll assertions passed (no console.assert failures printed above).");
