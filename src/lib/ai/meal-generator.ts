// =====================================================================
// CareLivia — Isi Piringku Compliant Meal Plan Generator
// Implements Pedoman Gizi Seimbang Kemenkes RI ("Isi Piringku").
//
// For every main meal (BREAKFAST, LUNCH, DINNER) the algorithm MUST
// produce 4 distinct items:
//   1. STAPLE   — Makanan pokok (2/3 setengah piring pertama)
//   2. PROTEIN  — Lauk pauk (1/3 setengah piring pertama)
//   3. VEGETABLE— Sayuran (2/3 setengah piring kedua)
//   4. FRUIT    — Buah (1/3 setengah piring kedua)
//
// For snacks, only 1 light item (fruit / dairy / nuts) is produced.
//
// Features:
//   - Calorie-aware gram calculation per group share
//   - Diagnosis-specific modifiers (forbidden/recommended within group)
//   - Gram bounds per group (CKD, OBESITY, MALNUTRITION, etc.)
//   - 3 alternatives per group with equivalent nutrition
//   - 14-day rotation tracking (max 2 repeats/week) — now a SOFT penalty
//     baked into scoring, plus WEIGHTED RANDOM selection so "Generate
//     Ulang" produces genuinely different menus instead of always
//     picking the single highest-scoring food.
//   - Per-meal plate compliance scoring (🟢🟡🔴) + recommendations
//   - Daily nutrition validation (95-105% target)
//   - AI reasoning via z-ai-web-dev-sdk
// =====================================================================

import { MealSlot } from "@prisma/client";
import {
  DIAGNOSIS_ADJUSTMENTS,
  type DiagnosisAdjustment,
  type DiagnosisType,
} from "@/lib/clinical/constants";
import { computeFoodNutrition, type CalorieResult } from "@/lib/clinical/calorie-engine";
import {
  PlateGroup,
  CATEGORY_TO_PLATE,
  ISI_PIRINGKU_DISTRIBUTION,
  MAIN_MEAL_SLOTS,
  SNACK_SLOTS,
  PLATE_GROUP_LABEL,
  PLATE_GROUP_ICON,
  PLATE_GROUP_COLOR,
  resolveShare,
  resolveGramBounds,
  isForbiddenInGroup,
  isRecommendedInGroup,
  scorePlateCompliance,
  validateNutrition,
  buildRotationStats,
  isOverusedInRotation,
  type PlateComplianceResult,
  type NutritionValidationRow,
  COMPLIANCE_TIER_LABEL,
  COMPLIANCE_TIER_COLOR,
  type ComplianceTier,
} from "@/lib/clinical/isi-piringku";
import {
  resolveLabFoodModifiers,
  type LabResultLike,
  type LabPlateModifiers,
} from "@/lib/clinical/lab-food-rules";
import {
  resolveGenomicFoodModifiers,
  mergePlateModifiers,
  type GenomicFindingLike,
} from "@/lib/clinical/genomic-food-rules";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------
interface FoodCandidate {
  id: string;
  name: string;
  energy: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  magnesium: number;
  phosphorus: number;
  zinc: number;
  vitA: number;
  vitC: number;
  cholesterol: number;
  gi: number;
  price: number;
  urt?: string | null;
  urtGram?: number | null;
  tags?: string;
  categorySlug: string;
  group: PlateGroup;
}

export interface GeneratedMealItem {
  slot: MealSlot;
  foodId: string;
  foodName: string;
  amount: number; // grams
  cal: number;
  protein: number;
  fat: number;
  carb: number;
  fiber: number;
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  cholesterol: number;
  urt?: string | null;
  group: PlateGroup;
  groupLabel: string;
  groupIcon: string;
  groupColor: string;
  alternatives: FoodAlternative[];
}

export interface FoodAlternative {
  foodId: string;
  foodName: string;
  amount: number; // grams (adjusted for equivalent calories)
  cal: number;
  protein: number;
  urt?: string | null;
  reason: string; // why this is a good alternative
}

export interface PlateSlotSummary {
  slot: MealSlot;
  slotLabel: string;
  slotTargetCal: number;
  slotActualCal: number;
  items: GeneratedMealItem[];
  compliance: PlateComplianceResult;
}

export interface GeneratedMealPlan {
  items: GeneratedMealItem[];
  slotSummaries: PlateSlotSummary[];
  totals: {
    cal: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
    sodium: number;
    potassium: number;
    calcium: number;
    iron: number;
    cholesterol: number;
  };
  targets: {
    cal: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
    sodiumMax: number;
  };
  validation: NutritionValidationRow[];
  overallCompliance: number;
  overallTier: ComplianceTier;
  overallTierLabel: string;
  overallTierColor: string;
  rotationWarnings: string[];
  groupCoverage: {
    staple: number;
    protein: number;
    vegetable: number;
    fruit: number;
  };
  diversityScore: number;
  generationSeed: string;
  // Human-readable list of lab-driven food rules that were active during
  // this generation (e.g. "LDL tinggi — ..."). Empty when no lab data was
  // supplied or no rule fired. Surfaced in AI reasoning + UI so clinicians
  // can see when a menu decision was influenced by a lab result.
  labFoodAdjustments: string[];
  // Same idea as labFoodAdjustments but sourced from the patient's
  // confirmed nutrigenomic findings (Nutrigenomic AI module) instead of
  // lab values. Empty when no genomic data was supplied or no rule fired.
  genomicFoodAdjustments: string[];
}

// ---------------------------------------------------------------------
// Slot labels (Indonesian)
// ---------------------------------------------------------------------
const SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: "Sarapan",
  MORNING_SNACK: "Snack Pagi",
  LUNCH: "Makan Siang",
  AFTERNOON_SNACK: "Snack Sore",
  DINNER: "Makan Malam",
  EVENING_SNACK: "Snack Malam",
};

// ---------------------------------------------------------------------
// Build candidate list — fetch all approved foods, map to plate groups
// ---------------------------------------------------------------------
async function loadCandidates(
  adj: DiagnosisAdjustment,
  diagnoses: DiagnosisType[],
): Promise<FoodCandidate[]> {
  // Use Supabase server client instead of Prisma
  const { getServerClient } = await import("@/lib/supabase/data-layer");
  const { client } = await getServerClient();

  const { data: allFoods, error } = await client
    .from("foods")
    .select("*, food_categories(*)")
    .is("deleted_at", null)
    .eq("approved", true);

  if (error) {
    console.error("[meal-generator] Failed to load foods from Supabase:", error);
    return [];
  }

  // Global forbidden (diagnosis-level, e.g. "gula", "alkohol")
  const globalForbidden = adj.forbidden;

  return (allFoods || [])
    .filter((f: any) => {
      const name = (f.name || "").toLowerCase();
      // Apply global forbidden
      if (globalForbidden.some((kw) => name.includes(kw.toLowerCase()))) return false;
      return true;
    })
    .map((f: any) => {
      const slug = f.food_categories?.slug ?? "";
      const group = CATEGORY_TO_PLATE[slug] ?? PlateGroup.OTHER;
      return {
        id: f.id,
        name: f.name,
        energy: f.energy,
        protein: f.protein,
        fat: f.fat,
        carb: f.carb,
        fiber: f.fiber,
        sodium: f.sodium,
        potassium: f.potassium,
        calcium: f.calcium,
        iron: f.iron,
        magnesium: f.magnesium,
        phosphorus: f.phosphorus,
        zinc: f.zinc,
        vitA: f.vit_a,
        vitC: f.vit_c,
        cholesterol: f.cholesterol,
        gi: f.gi,
        price: f.price,
        urt: f.urt,
        urtGram: f.urt_gram,
        tags: f.tags,
        categorySlug: slug,
        group,
      };
    });
}

// =======================================================================
// RNG — seeded per generation call so behavior is reproducible for a
// given seed (useful for debugging) but different on every "Generate
// Ulang" click, since the caller passes a fresh seed each time.
// =======================================================================
function makeRng(seed: string): () => number {
  // Simple xmur3 hash → mulberry32 PRNG. No crypto needed, deterministic
  // per seed, fast, good-enough distribution for menu variety purposes.
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =======================================================================
// Weighted random pick — replaces "always take the #1 score" behavior.
// Takes the top-N scored candidates and picks among them probabilistically
// using a softmax-like weighting, so higher scores are still favored but
// not guaranteed, giving real menu variety across Generate Ulang clicks.
// =======================================================================
function weightedRandomPick<T extends { score: number }>(
  scoredPool: T[],
  rng: () => number,
  topN: number = 6,
  temperature: number = 10,
): T | null {
  if (scoredPool.length === 0) return null;
  const pool = scoredPool.slice(0, topN);
  const maxScore = pool[0].score;
  const weights = pool.map((p) => Math.exp((p.score - maxScore) / temperature));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return pool[0];
  let r = rng() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------
// Score candidate within a group for a specific diagnosis.
// Now also folds in a SOFT rotation penalty (instead of the old binary
// "overused = fully excluded" filter) so recently-used foods are merely
// deprioritized, not hard-blocked — this widens the pool available to
// weightedRandomPick and produces more natural variety.
// ---------------------------------------------------------------------
function scoreCandidate(
  food: FoodCandidate,
  group: PlateGroup,
  diagnoses: DiagnosisType[],
  adj: DiagnosisAdjustment,
  slot: MealSlot,
  rotation?: Map<string, { count: number; lastUsedDay: number }>,
  currentDay?: number,
  labMods?: LabPlateModifiers,
): number {
  let score = 50;

  // Recommended within group → big bonus
  if (isRecommendedInGroup(food.name, group, diagnoses, labMods)) score += 35;

  // Forbidden within group → heavy penalty
  if (isForbiddenInGroup(food.name, group, diagnoses, labMods)) score -= 200;

  // Diagnosis-level recommended keywords (across groups)
  if (adj.recommended.some((kw) => food.name.toLowerCase().includes(kw.toLowerCase()))) score += 10;
  if (adj.forbidden.some((kw) => food.name.toLowerCase().includes(kw.toLowerCase()))) score -= 200;

  // Group-specific quality scoring
  switch (group) {
    case PlateGroup.STAPLE:
      // Prefer low GI, complex carbs
      if (food.carb > 15) score += 12;
      if (food.gi > 0 && food.gi < 55) score += 18;
      if (food.gi >= 70) score -= 20;
      if (food.fiber >= 2) score += 8;
      break;
    case PlateGroup.PROTEIN:
      // Prefer high protein, low saturated fat
      if (food.protein >= 15) score += 18;
      if (food.protein >= 25) score += 12;
      // Lean protein bonus
      if (food.fat < 5) score += 10;
      // Penalty for high cholesterol for CVD/dyslipidemia
      if (food.cholesterol > 200 && (diagnoses.includes("DYSLIPIDEMIA") || diagnoses.includes("HT"))) {
        score -= 25;
      }
      break;
    case PlateGroup.VEGETABLE:
      // Prefer high fiber, high vitA/C, low cal (volume-dense)
      if (food.fiber >= 2) score += 12;
      if (food.vitA >= 200) score += 8;
      if (food.vitC >= 15) score += 8;
      if (food.energy < 50) score += 6; // leafy greens
      // Color variety bonus (tag-based)
      if (food.tags && food.tags.includes("hijau")) score += 4;
      if (food.tags && food.tags.includes("oranye")) score += 4;
      break;
    case PlateGroup.FRUIT:
      // Prefer whole fruits, low GI, vitC
      if (food.vitC >= 20) score += 12;
      if (food.fiber >= 2) score += 8;
      if (food.gi > 0 && food.gi < 55) score += 10;
      if (food.gi >= 65) score -= 10;
      break;
    case PlateGroup.OTHER:
      // Snacks — prefer light foods (<150 kcal/100g)
      if (food.energy < 100) score += 8;
      if (food.energy > 300) score -= 15;
      break;
  }

  // CKD-specific potassium penalty
  if (adj.potassiumMax && food.potassium > 250) score -= 20;
  // Sodium penalty if exceeds
  if (food.sodium > 300) score -= 8;

  // Snack slot prefers lighter options
  const isSnack = (SNACK_SLOTS as readonly string[]).includes(slot);
  if (isSnack && food.energy < 120) score += 8;
  if (isSnack && food.energy > 300) score -= 20;

  // Price penalty (prefer affordable)
  if (food.price > 0) {
    score -= Math.min(6, food.price / 2000);
  }

  // ---- SOFT rotation penalty (graduated, not a hard exclusion) ----
  if (rotation && currentDay !== undefined) {
    const stat = rotation.get(food.id);
    if (stat) {
      const daysSinceUsed = currentDay - stat.lastUsedDay;
      let rotationPenalty = 0;
      if (daysSinceUsed <= 0) rotationPenalty = 100; // used today already elsewhere
      else if (daysSinceUsed === 1) rotationPenalty = 60;
      else if (daysSinceUsed === 2) rotationPenalty = 45;
      else if (daysSinceUsed === 3) rotationPenalty = 32;
      else if (daysSinceUsed === 4) rotationPenalty = 20;
      else if (daysSinceUsed <= 6) rotationPenalty = 10;
      // >6 days: no penalty
      // Extra penalty scaling with how many times it's been repeated recently
      rotationPenalty += Math.min(30, stat.count * 8);
      score -= rotationPenalty;
    }
  }

  return score;
}

// ---------------------------------------------------------------------
// Calorie-aware gram calculator
// Returns grams needed to hit a calorie target from a food, capped by
// reasonable per-meal bounds for the group.
// ---------------------------------------------------------------------
function gramsForCal(
  food: FoodCandidate,
  calTarget: number,
  minG: number,
  maxG: number,
): number {
  const rawGrams = (calTarget / Math.max(food.energy, 1)) * 100;
  return Math.min(Math.max(minG, Math.round(rawGrams / 5) * 5), maxG);
}

// Default gram bounds per group (per main meal) — diagnosis may override
const DEFAULT_GRAM_BOUNDS: Record<PlateGroup, { min: number; max: number }> = {
  STAPLE: { min: 75, max: 200 },
  PROTEIN: { min: 50, max: 150 },
  VEGETABLE: { min: 75, max: 200 },
  FRUIT: { min: 50, max: 150 },
  OTHER: { min: 30, max: 100 },
};

// ---------------------------------------------------------------------
// Pick best candidate for a group, honoring rotation.
// CHANGED: instead of deterministically returning the #1-scored food
// every time, this now does a WEIGHTED RANDOM pick among the top-N
// scored candidates (using the rotation-aware score from scoreCandidate
// plus the per-generation `rng`). This is the core fix for "Generate
// Ulang selalu menghasilkan menu yang sama".
// ---------------------------------------------------------------------
function pickBest(
  candidates: FoodCandidate[],
  group: PlateGroup,
  slot: MealSlot,
  diagnoses: DiagnosisType[],
  adj: DiagnosisAdjustment,
  usedToday: Set<string>,
  rotation: Map<string, { count: number; lastUsedDay: number }>,
  currentDay: number,
  rng: () => number,
  labMods?: LabPlateModifiers,
): FoodCandidate | null {
  const scored = candidates
    .filter((f) => f.group === group)
    .filter((f) => !isForbiddenInGroup(f.name, group, diagnoses, labMods))
    .filter((f) => !usedToday.has(f.id))
    .map((f) => ({
      food: f,
      score: scoreCandidate(f, group, diagnoses, adj, slot, rotation, currentDay, labMods),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const picked = weightedRandomPick(scored, rng, 6, 10);
  return picked?.food ?? null;
}

// ---------------------------------------------------------------------
// Build alternatives for a chosen food (3 alternatives per group)
// Equivalent nutrition: similar calories within ±15%
// ---------------------------------------------------------------------
function buildAlternatives(
  chosen: FoodCandidate,
  group: PlateGroup,
  candidates: FoodCandidate[],
  diagnoses: DiagnosisType[],
  adj: DiagnosisAdjustment,
  slot: MealSlot,
  targetCal: number,
  usedToday: Set<string>,
  labMods?: LabPlateModifiers,
): FoodAlternative[] {
  const alts = candidates
    .filter((f) => f.group === group && f.id !== chosen.id)
    .filter((f) => !isForbiddenInGroup(f.name, group, diagnoses, labMods))
    .map((f) => {
      const score = scoreCandidate(f, group, diagnoses, adj, slot, undefined, undefined, labMods);
      // Equivalent calorie target → recompute grams
      const bounds = resolveGramBounds(diagnoses, group) ?? DEFAULT_GRAM_BOUNDS[group];
      const grams = gramsForCal(f, targetCal, bounds.min, bounds.max);
      const nut = computeFoodNutrition(f, grams);
      const calDelta = Math.abs(nut.cal - targetCal) / Math.max(targetCal, 1);
      // Penalize high calorie delta
      const finalScore = score - calDelta * 50;
      return { food: f, grams, nut, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3);

  return alts.map((a) => ({
    foodId: a.food.id,
    foodName: a.food.name,
    amount: a.grams,
    cal: Math.round(a.nut.cal),
    protein: Math.round(a.nut.protein * 10) / 10,
    urt: a.food.urt,
    reason: buildAltReason(a.food, chosen, group),
  }));
}

function buildAltReason(alt: FoodCandidate, chosen: FoodCandidate, group: PlateGroup): string {
  const reasons: string[] = [];
  if (alt.protein > chosen.protein) reasons.push("protein lebih tinggi");
  if (alt.fiber > chosen.fiber) reasons.push("serat lebih tinggi");
  if (alt.fat < chosen.fat) reasons.push("lemak lebih rendah");
  if (alt.sodium < chosen.sodium) reasons.push("natrium lebih rendah");
  if (alt.gi > 0 && alt.gi < chosen.gi) reasons.push("GI lebih rendah");
  if (alt.vitC > chosen.vitC) reasons.push("vitC lebih tinggi");
  if (alt.energy < chosen.energy) reasons.push("kalori lebih rendah");
  if (reasons.length === 0) reasons.push("setara nutrisi");
  return `Pengganti ${PLATE_GROUP_LABEL[group].toLowerCase()}: ${reasons.slice(0, 3).join(", ")}.`;
}

// ---------------------------------------------------------------------
// Fill a main meal: STAPLE + PROTEIN + VEGETABLE + FRUIT
// ---------------------------------------------------------------------
function fillMainMeal(
  candidates: FoodCandidate[],
  slot: MealSlot,
  slotTargetCal: number,
  diagnoses: DiagnosisType[],
  adj: DiagnosisAdjustment,
  idealShare: Record<PlateGroup, number>,
  usedToday: Set<string>,
  rotation: Map<string, { count: number; lastUsedDay: number }>,
  currentDay: number,
  rng: () => number,
  labMods?: LabPlateModifiers,
): { items: GeneratedMealItem[]; slotCal: number } {
  const items: GeneratedMealItem[] = [];
  let slotCal = 0;

  const groups: PlateGroup[] = [PlateGroup.STAPLE, PlateGroup.PROTEIN, PlateGroup.VEGETABLE, PlateGroup.FRUIT];

  for (const group of groups) {
    const chosen = pickBest(candidates, group, slot, diagnoses, adj, usedToday, rotation, currentDay, rng, labMods);
    if (!chosen) continue;

    const share = idealShare[group];
    const groupCalTarget = slotTargetCal * share;
    const bounds = resolveGramBounds(diagnoses, group) ?? DEFAULT_GRAM_BOUNDS[group];
    const grams = gramsForCal(chosen, groupCalTarget, bounds.min, bounds.max);
    const nut = computeFoodNutrition(chosen, grams);

    // Build alternatives
    const alts = buildAlternatives(chosen, group, candidates, diagnoses, adj, slot, nut.cal, usedToday, labMods);

    items.push({
      slot,
      foodId: chosen.id,
      foodName: chosen.name,
      amount: grams,
      cal: Math.round(nut.cal),
      protein: Math.round(nut.protein * 10) / 10,
      fat: Math.round(nut.fat * 10) / 10,
      carb: Math.round(nut.carb * 10) / 10,
      fiber: Math.round(nut.fiber * 10) / 10,
      sodium: Math.round(nut.sodium),
      potassium: Math.round(nut.potassium),
      calcium: Math.round(chosen.calcium * (grams / 100)),
      iron: Math.round(chosen.iron * (grams / 100) * 10) / 10,
      cholesterol: Math.round(chosen.cholesterol * (grams / 100)),
      urt: chosen.urt,
      group,
      groupLabel: PLATE_GROUP_LABEL[group],
      groupIcon: PLATE_GROUP_ICON[group],
      groupColor: PLATE_GROUP_COLOR[group].hex,
      alternatives: alts,
    });
    usedToday.add(chosen.id);
    slotCal += nut.cal;
  }

  return { items, slotCal };
}

// ---------------------------------------------------------------------
// Fill a snack: single light item (fruit / dairy / nuts)
// ---------------------------------------------------------------------
function fillSnack(
  candidates: FoodCandidate[],
  slot: MealSlot,
  slotTargetCal: number,
  diagnoses: DiagnosisType[],
  adj: DiagnosisAdjustment,
  usedToday: Set<string>,
  rotation: Map<string, { count: number; lastUsedDay: number }>,
  currentDay: number,
  rng: () => number,
  labMods?: LabPlateModifiers,
): { items: GeneratedMealItem[]; slotCal: number } {
  // Snacks prefer FRUIT, then PROTEIN (dairy/nuts), then STAPLE (oat)
  const snackGroups: PlateGroup[] = [PlateGroup.FRUIT, PlateGroup.PROTEIN, PlateGroup.STAPLE];

  for (const group of snackGroups) {
    const chosen = pickBest(candidates, group, slot, diagnoses, adj, usedToday, rotation, currentDay, rng, labMods);
    if (!chosen) continue;

    const bounds = { min: 30, max: 100 };
    const grams = gramsForCal(chosen, slotTargetCal, bounds.min, bounds.max);
    const nut = computeFoodNutrition(chosen, grams);
    const alts = buildAlternatives(chosen, group, candidates, diagnoses, adj, slot, nut.cal, usedToday, labMods);

    return {
      items: [
        {
          slot,
          foodId: chosen.id,
          foodName: chosen.name,
          amount: grams,
          cal: Math.round(nut.cal),
          protein: Math.round(nut.protein * 10) / 10,
          fat: Math.round(nut.fat * 10) / 10,
          carb: Math.round(nut.carb * 10) / 10,
          fiber: Math.round(nut.fiber * 10) / 10,
          sodium: Math.round(nut.sodium),
          potassium: Math.round(nut.potassium),
          calcium: Math.round(chosen.calcium * (grams / 100)),
          iron: Math.round(chosen.iron * (grams / 100) * 10) / 10,
          cholesterol: Math.round(chosen.cholesterol * (grams / 100)),
          urt: chosen.urt,
          group,
          groupLabel: PLATE_GROUP_LABEL[group],
          groupIcon: PLATE_GROUP_ICON[group],
          groupColor: PLATE_GROUP_COLOR[group].hex,
          alternatives: alts,
        },
      ],
      slotCal: nut.cal,
    };
  }

  return { items: [], slotCal: 0 };
}

// ---------------------------------------------------------------------
// OPTIMIZATION PHASE — Iterative gram adjustment to hit macro targets
// ---------------------------------------------------------------------

interface OptimizationTarget {
  cal: number;
  protein: number;
  fat: number;
  carb: number;
}

interface OptimizationResult {
  items: GeneratedMealItem[];
  iterations: number;
  finalError: number;
  converged: boolean;
}

function computeTotalsFromItems(items: GeneratedMealItem[]) {
  return items.reduce(
    (acc, i) => ({
      cal: acc.cal + i.cal,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carb: acc.carb + i.carb,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0 },
  );
}

function recomputeItemNutrition(item: GeneratedMealItem, newGrams: number): GeneratedMealItem {
  const ratio = newGrams / item.amount;
  return {
    ...item,
    amount: newGrams,
    cal: Math.round(item.cal * ratio),
    protein: Math.round(item.protein * ratio * 10) / 10,
    fat: Math.round(item.fat * ratio * 10) / 10,
    carb: Math.round(item.carb * ratio * 10) / 10,
    fiber: Math.round(item.fiber * ratio * 10) / 10,
    sodium: Math.round(item.sodium * ratio),
    potassium: Math.round(item.potassium * ratio),
    calcium: Math.round(item.calcium * ratio),
    iron: Math.round(item.iron * ratio * 10) / 10,
    cholesterol: Math.round(item.cholesterol * ratio),
  };
}

function optimizeGrams(
  items: GeneratedMealItem[],
  target: OptimizationTarget,
  gramBounds: Record<string, { min: number; max: number }>,
  maxIterations: number = 200,
): OptimizationResult {
  // Store per-100g values for each item (from original generation)
  const per100Data = items.map((item) => {
    const ratio = 100 / Math.max(item.amount, 1);
    return {
      energy: item.cal * ratio,
      protein: item.protein * ratio,
      fat: item.fat * ratio,
      carb: item.carb * ratio,
      fiber: item.fiber * ratio,
      sodium: item.sodium * ratio,
      potassium: item.potassium * ratio,
      calcium: item.calcium * ratio,
      iron: item.iron * ratio,
      cholesterol: item.cholesterol * ratio,
    };
  });

  let workingGrams = items.map((i) => i.amount);
  let converged = false;
  let finalError = Infinity;
  const learningRate = 0.15; // Damping factor

  for (let iter = 0; iter < maxIterations; iter++) {
    // Compute current totals from per-100g data
    const totals = { cal: 0, protein: 0, fat: 0, carb: 0 };
    for (let i = 0; i < items.length; i++) {
      const g = workingGrams[i];
      const p = per100Data[i];
      totals.cal += p.energy * g / 100;
      totals.protein += p.protein * g / 100;
      totals.fat += p.fat * g / 100;
      totals.carb += p.carb * g / 100;
    }

    const calErr = target.cal - totals.cal;
    const proteinErr = target.protein - totals.protein;
    const fatErr = target.fat - totals.fat;
    const carbErr = target.carb - totals.carb;

    const rmsError = Math.sqrt(
      (calErr * calErr) * 1.0 +
      (proteinErr * proteinErr) * 0.4 +
      (fatErr * fatErr) * 0.4 +
      (carbErr * carbErr) * 0.4,
    );
    finalError = rmsError;

    const calPct = Math.abs(calErr) / Math.max(target.cal, 1) * 100;
    if (calPct < 2 && Math.abs(proteinErr) < 3 && Math.abs(fatErr) < 3 && Math.abs(carbErr) < 4) {
      converged = true;
      console.log(`[optimizer] CONVERGED at iteration ${iter + 1}: cal=${Math.round(totals.cal)}/${target.cal} (${calPct.toFixed(1)}%), P=${Math.round(totals.protein)}/${target.protein}, L=${Math.round(totals.fat)}/${target.fat}, K=${Math.round(totals.carb)}/${target.carb}`);
      break;
    }

    if (iter < 5 || iter % 20 === 0) {
      console.log(`[optimizer] Iteration ${iter + 1}: cal=${Math.round(totals.cal)}/${target.cal} (err=${Math.round(calErr)}), P err=${Math.round(proteinErr)}g, L err=${Math.round(fatErr)}g, K err=${Math.round(carbErr)}g, RMS=${Math.round(rmsError)}`);
    }

    // PER-NUTRIENT ADJUSTMENT: adjust each item based on which nutrients it contributes to
    // Items that are mostly protein get adjusted by the protein error
    // Items that are mostly fat get adjusted by the fat error
    // This prevents protein overshoot when scaling for calories
    const newGrams = [...workingGrams];

    // Calculate error as fraction of current total
    const calAdjustFrac = calErr / Math.max(totals.cal, 1);
    const proteinAdjustFrac = proteinErr / Math.max(totals.protein, 1);
    const fatAdjustFrac = fatErr / Math.max(totals.fat, 1);
    const carbAdjustFrac = carbErr / Math.max(totals.carb, 1);

    for (let i = 0; i < items.length; i++) {
      const p = per100Data[i];
      const g = workingGrams[i];
      const bounds = gramBounds[items[i].group] ?? { min: 5, max: 350 };

      // What percentage of this item's calories come from each macro?
      const itemCal = p.energy * g / 100;
      const itemProteinCal = (p.protein * 4) * g / 100;
      const itemFatCal = (p.fat * 9) * g / 100;
      const itemCarbCal = (p.carb * 4) * g / 100;
      const totalMacroCal = Math.max(itemProteinCal + itemFatCal + itemCarbCal, 1);

      // This item's macro profile (what % of its energy is protein/fat/carb)
      const proteinWeight = itemProteinCal / totalMacroCal;
      const fatWeight = itemFatCal / totalMacroCal;
      const carbWeight = itemCarbCal / totalMacroCal;

      // Adjust this item based on the errors of the nutrients it contributes to
      // If protein is too high, reduce protein-heavy items
      // If fat is too low, increase fat-heavy items
      // If cal is too low, increase all items (but weighted by macro profile)
      const macroAdjust =
        proteinAdjustFrac * proteinWeight +
        fatAdjustFrac * fatWeight +
        carbAdjustFrac * carbWeight;

      // Combined adjustment: 60% from calorie error (affects all items) + 40% from macro-specific error
      const totalAdjust = learningRate * (calAdjustFrac * 0.6 + macroAdjust * 0.4);

      // Apply adjustment
      const delta = g * totalAdjust;
      let adjustedGrams = Math.round(g + delta);

      // Clamp to bounds
      adjustedGrams = Math.max(bounds.min, Math.min(bounds.max, adjustedGrams));

      newGrams[i] = adjustedGrams;
    }

    workingGrams = newGrams;
  }

  if (!converged) {
    console.warn(`[optimizer] Did NOT converge after ${maxIterations} iterations. Final RMS: ${Math.round(finalError)}`);
  }

  // Build final items with optimized grams
  const optimizedItems = items.map((item, i) => {
    const newGrams = workingGrams[i];
    const p = per100Data[i];
    const ratio = newGrams / 100;
    return {
      ...item,
      amount: newGrams,
      cal: Math.round(p.energy * ratio),
      protein: Math.round(p.protein * ratio * 10) / 10,
      fat: Math.round(p.fat * ratio * 10) / 10,
      carb: Math.round(p.carb * ratio * 10) / 10,
      fiber: Math.round(p.fiber * ratio * 10) / 10,
      sodium: Math.round(p.sodium * ratio),
      potassium: Math.round(p.potassium * ratio),
      calcium: Math.round(p.calcium * ratio),
      iron: Math.round(p.iron * ratio * 10) / 10,
      cholesterol: Math.round(p.cholesterol * ratio),
    };
  });

  return { items: optimizedItems, iterations: maxIterations, finalError, converged };
}

function getNutrientPerGram(item: GeneratedMealItem, nutrient: "cal" | "protein" | "fat" | "carb"): number {
  if (item.amount <= 0) return 0;
  switch (nutrient) {
    case "cal": return item.cal / item.amount;
    case "protein": return item.protein / item.amount;
    case "fat": return item.fat / item.amount;
    case "carb": return item.carb / item.amount;
  }
}

// ---------------------------------------------------------------------
// Diversity score: fraction of today's chosen food IDs that were NOT
// present in the recent rotation history at all (i.e. genuinely new
// picks vs. repeats), expressed 0-100.
// ---------------------------------------------------------------------
function computeDiversityScore(
  items: GeneratedMealItem[],
  rotation: Map<string, { count: number; lastUsedDay: number }>,
): number {
  if (items.length === 0) return 100;
  const uniqueIds = new Set(items.map((i) => i.foodId));
  let novel = 0;
  for (const id of uniqueIds) {
    if (!rotation.has(id)) novel++;
  }
  return Math.round((novel / uniqueIds.size) * 100);
}

// ---------------------------------------------------------------------
// MAIN: Generate Isi Piringku compliant meal plan with gram optimization
// ---------------------------------------------------------------------
export async function generateMealPlan(
  calResult: CalorieResult,
  diagnoses: DiagnosisType[],
  options?: {
    rotationHistory?: { day: number; items: { foodId: string; foodName: string }[] }[];
    currentDay?: number;
    /** Pass a fresh value (e.g. crypto.randomUUID() or Date.now().toString())
     * on every "Generate Ulang" call so the weighted-random food selection
     * produces a different — but still nutritionally valid — menu each
     * time. If omitted, a time-based seed is generated automatically so
     * repeat calls still vary by default. */
    generationSeed?: string;
    /** Latest lab results for this patient (any order — only the most
     * recent value per test name is used). When provided, food selection
     * itself (not just the AI narrative) is additionally constrained by
     * abnormal values — e.g. LDL tinggi excludes high-saturated-fat
     * proteins — on top of whatever the diagnosis list already implies.
     * Omitting this parameter reproduces the exact pre-lab-integration
     * selection behavior. */
    labResults?: LabResultLike[];
    /** Confirmed nutrigenomic findings for this patient (gene + genotype),
     * from genomic_findings via the Nutrigenomic AI module. Adds another
     * INDEPENDENT layer of forbidden/recommended food keywords on top of
     * diagnosis- and lab-based ones — see genomic-food-rules.ts. Omitting
     * this parameter reproduces the exact pre-nutrigenomic selection
     * behavior. */
    genomicFindings?: GenomicFindingLike[];
  },
): Promise<GeneratedMealPlan> {
  const adj =
    diagnoses.length > 0
      ? DIAGNOSIS_ADJUSTMENTS[diagnoses[0]]
      : DIAGNOSIS_ADJUSTMENTS.OTHER;

  const candidates = await loadCandidates(adj, diagnoses);

  const usedToday = new Set<string>();
  const rotation = buildRotationStats(options?.rotationHistory ?? []);
  const currentDay = options?.currentDay ?? 0;
  const rawLabMods = resolveLabFoodModifiers(options?.labResults);
  const genomicMods = resolveGenomicFoodModifiers(options?.genomicFindings);
  if (rawLabMods.activeReasons.length > 0) {
    console.log("[meal-generator] Lab-driven food rules active:", rawLabMods.activeReasons);
  }
  if (genomicMods.activeReasons.length > 0) {
    console.log("[meal-generator] Genomic-driven food rules active:", genomicMods.activeReasons);
  }
  // Combined view used by the food-selection engine below (fillMainMeal/
  // fillSnack only ever see one merged modifier set — they don't need to
  // know whether a rule came from labs or genomics).
  const labMods = mergePlateModifiers(rawLabMods, genomicMods);

  // Fresh seed per call unless caller explicitly pins one (e.g. for tests).
  const generationSeed =
    options?.generationSeed ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rng = makeRng(generationSeed);
  console.log("[meal-generator] generationSeed:", generationSeed);

  const idealShare = resolveShare(diagnoses);
  const gramBounds: Partial<Record<PlateGroup, { min: number; max: number }>> = {};
  for (const g of [PlateGroup.STAPLE, PlateGroup.PROTEIN, PlateGroup.VEGETABLE, PlateGroup.FRUIT]) {
    const b = resolveGramBounds(diagnoses, g);
    if (b) gramBounds[g] = b;
  }

  const allItems: GeneratedMealItem[] = [];
  const slotSummaries: PlateSlotSummary[] = [];
  const targetCal = calResult.targetCalorie;
  const rotationWarnings: string[] = [];

  const allSlots = Object.keys(ISI_PIRINGKU_DISTRIBUTION) as MealSlot[];

  for (const slot of allSlots) {
    const slotTargetCal = targetCal * ISI_PIRINGKU_DISTRIBUTION[slot];
    const isMain = (MAIN_MEAL_SLOTS as readonly string[]).includes(slot);

    const filled = isMain
      ? fillMainMeal(candidates, slot, slotTargetCal, diagnoses, adj, idealShare, usedToday, rotation, currentDay, rng, labMods)
      : fillSnack(candidates, slot, slotTargetCal, diagnoses, adj, usedToday, rotation, currentDay, rng, labMods);

    allItems.push(...filled.items);

    // Plate compliance for main meals only
    if (isMain) {
      const compliance = scorePlateCompliance({
        slotCal: filled.slotCal,
        items: filled.items.map((i) => ({ group: i.group, cal: i.cal, grams: i.amount })),
        idealShare,
        gramBounds,
      });
      slotSummaries.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        slotTargetCal: Math.round(slotTargetCal),
        slotActualCal: Math.round(filled.slotCal),
        items: filled.items,
        compliance,
      });

      // Warn about rotation if any item is overused
      for (const it of filled.items) {
        if (isOverusedInRotation(it.foodId, rotation, currentDay)) {
          rotationWarnings.push(
            `${it.foodName} sudah digunakan ≥${2}x minggu ini — pertimbangkan variasi.`,
          );
        }
      }
    } else {
      // For snacks, no plate compliance — just summary
      slotSummaries.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        slotTargetCal: Math.round(slotTargetCal),
        slotActualCal: Math.round(filled.slotCal),
        items: filled.items,
        compliance: {
          score: 100,
          tier: "EXCELLENT" as ComplianceTier,
          actualShare: { STAPLE: 0, PROTEIN: 0, VEGETABLE: 0, FRUIT: 0, OTHER: 0 },
          idealShare,
          groupPresent: { STAPLE: false, PROTEIN: false, VEGETABLE: false, FRUIT: false, OTHER: false },
          recommendations: [],
        },
      });
    }
  }

  // =====================================================================
  // PHASE 2: OPTIMIZATION — Iterative gram adjustment to hit macro targets
  // =====================================================================
  console.log("[optimizer] START — Phase 2: Gram optimization");
  console.log(`[optimizer] Pre-optimization totals: cal=${Math.round(allItems.reduce((s, i) => s + i.cal, 0))}/${calResult.targetCalorie}, P=${Math.round(allItems.reduce((s, i) => s + i.protein, 0))}/${calResult.macros.proteinG}g, L=${Math.round(allItems.reduce((s, i) => s + i.fat, 0))}/${calResult.macros.fatG}g, K=${Math.round(allItems.reduce((s, i) => s + i.carb, 0))}/${calResult.macros.carbG}g`);

  const optTarget: OptimizationTarget = {
    cal: calResult.targetCalorie,
    protein: calResult.macros.proteinG,
    fat: calResult.macros.fatG,
    carb: calResult.macros.carbG,
  };

  // Build gram bounds map for optimizer
  const optGramBounds: Record<string, { min: number; max: number }> = {};
  for (const g of [PlateGroup.STAPLE, PlateGroup.PROTEIN, PlateGroup.VEGETABLE, PlateGroup.FRUIT, PlateGroup.OTHER]) {
    const b = resolveGramBounds(diagnoses, g) ?? DEFAULT_GRAM_BOUNDS[g];
    optGramBounds[g] = { min: Math.max(5, b.min * 0.5), max: b.max * 1.5 }; // Wider bounds for optimization
  }

  const optResult = optimizeGrams(allItems, optTarget, optGramBounds, 200);

  // Replace allItems with optimized items
  allItems.length = 0;
  allItems.push(...optResult.items);

  // Update slotSummaries with optimized items
  for (const summary of slotSummaries) {
    summary.items = optResult.items.filter((i) => i.slot === summary.slot);
    summary.slotActualCal = Math.round(summary.items.reduce((s, i) => s + i.cal, 0));
  }

  console.log(`[optimizer] END — ${optResult.converged ? "CONVERGED" : "NOT CONVERGED"} after ${optResult.iterations} iterations. Final RMS: ${Math.round(optResult.finalError)}`);

  // Compute totals
  const totals = allItems.reduce(
    (acc, i) => ({
      cal: acc.cal + i.cal,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carb: acc.carb + i.carb,
      fiber: acc.fiber + i.fiber,
      sodium: acc.sodium + i.sodium,
      potassium: acc.potassium + i.potassium,
      calcium: acc.calcium + i.calcium,
      iron: acc.iron + i.iron,
      cholesterol: acc.cholesterol + i.cholesterol,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0, cholesterol: 0 },
  );

  const targets = {
    cal: calResult.targetCalorie,
    protein: calResult.macros.proteinG,
    fat: calResult.macros.fatG,
    carb: calResult.macros.carbG,
    fiber: calResult.fiberTarget,
    sodiumMax: calResult.sodiumMax,
  };

  const validation = validateNutrition({
    target: targets,
    actual: {
      cal: totals.cal,
      protein: totals.protein,
      fat: totals.fat,
      carb: totals.carb,
      fiber: totals.fiber,
      sodium: totals.sodium,
    },
  });

  // Overall compliance = average of main meal scores
  const mainSummaries = slotSummaries.filter((s) =>
    (MAIN_MEAL_SLOTS as readonly string[]).includes(s.slot),
  );
  const overallCompliance =
    mainSummaries.length > 0
      ? Math.round(mainSummaries.reduce((sum, s) => sum + s.compliance.score, 0) / mainSummaries.length)
      : 0;

  const tier = mainSummaries.length > 0 ? mainSummaries[0].compliance.tier : "EXCELLENT";
  // Use average tier: if any main meal is POOR, overall is POOR; else if any GOOD, GOOD; else EXCELLENT
  let overallTier: ComplianceTier = "EXCELLENT";
  if (mainSummaries.some((s) => s.compliance.tier === "POOR")) overallTier = "POOR";
  else if (mainSummaries.some((s) => s.compliance.tier === "GOOD")) overallTier = "GOOD";

  // Group coverage counts (how many of each group across the day)
  const groupCoverage = {
    staple: allItems.filter((i) => i.group === PlateGroup.STAPLE).length,
    protein: allItems.filter((i) => i.group === PlateGroup.PROTEIN).length,
    vegetable: allItems.filter((i) => i.group === PlateGroup.VEGETABLE).length,
    fruit: allItems.filter((i) => i.group === PlateGroup.FRUIT).length,
  };

  const diversityScore = computeDiversityScore(allItems, rotation);
  console.log("[meal-generator] diversityScore:", diversityScore, "seed:", generationSeed);

  return {
    items: allItems,
    slotSummaries,
    totals: {
      cal: Math.round(totals.cal),
      protein: Math.round(totals.protein),
      fat: Math.round(totals.fat),
      carb: Math.round(totals.carb),
      fiber: Math.round(totals.fiber),
      sodium: Math.round(totals.sodium),
      potassium: Math.round(totals.potassium),
      calcium: Math.round(totals.calcium),
      iron: Math.round(totals.iron),
      cholesterol: Math.round(totals.cholesterol),
    },
    targets,
    validation,
    overallCompliance,
    overallTier,
    overallTierLabel: COMPLIANCE_TIER_LABEL[overallTier],
    overallTierColor: COMPLIANCE_TIER_COLOR[overallTier],
    rotationWarnings: Array.from(new Set(rotationWarnings)),
    groupCoverage,
    diversityScore,
    generationSeed,
    labFoodAdjustments: labMods.activeReasons,
    genomicFoodAdjustments: genomicMods.activeReasons,
  };
}

// ---------------------------------------------------------------------
// buildPlanViewFromStoredItems
//
// Rebuilds the same rich "plan" shape generateMealPlan() returns
// (slotSummaries, plate compliance, group coverage, validation) but
// from items ALREADY PERSISTED in meal_plan_items — no AI call, no
// food selection, no randomness. This is the "Hitung ulang nutrisi"
// step used when loading the patient's active meal plan (page mount,
// refresh, navigation back) so the full Isi Piringku visualization +
// validation table render from the database instead of vanishing
// because the AI-generation preview state was never persisted.
// ---------------------------------------------------------------------
export function buildPlanViewFromStoredItems(
  storedItems: {
    slot: MealSlot;
    foodId: string;
    foodName: string;
    amount: number;
    cal: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
    sodium: number;
    categorySlug?: string | null;
    urt?: string | null;
  }[],
  calResult: CalorieResult,
  diagnoses: DiagnosisType[],
): GeneratedMealPlan {
  const idealShare = resolveShare(diagnoses);
  const gramBounds: Partial<Record<PlateGroup, { min: number; max: number }>> = {};
  for (const g of [PlateGroup.STAPLE, PlateGroup.PROTEIN, PlateGroup.VEGETABLE, PlateGroup.FRUIT]) {
    const b = resolveGramBounds(diagnoses, g);
    if (b) gramBounds[g] = b;
  }

  const allItems: GeneratedMealItem[] = storedItems.map((i) => {
    const group = (i.categorySlug && CATEGORY_TO_PLATE[i.categorySlug]) || PlateGroup.OTHER;
    return {
      slot: i.slot,
      foodId: i.foodId,
      foodName: i.foodName,
      amount: i.amount,
      cal: i.cal,
      protein: i.protein,
      fat: i.fat,
      carb: i.carb,
      fiber: i.fiber,
      sodium: i.sodium,
      potassium: 0,
      calcium: 0,
      iron: 0,
      cholesterol: 0,
      urt: i.urt ?? null,
      group,
      groupLabel: PLATE_GROUP_LABEL[group],
      groupIcon: PLATE_GROUP_ICON[group],
      groupColor: PLATE_GROUP_COLOR[group].hex,
      alternatives: [], // Not recomputed on load — only present right after a fresh generate
    };
  });

  const allSlots = Object.keys(ISI_PIRINGKU_DISTRIBUTION) as MealSlot[];
  const targetCal = calResult.targetCalorie;
  const slotSummaries: PlateSlotSummary[] = [];

  for (const slot of allSlots) {
    const slotItems = allItems.filter((i) => i.slot === slot);
    const slotTargetCal = targetCal * ISI_PIRINGKU_DISTRIBUTION[slot];
    const slotActualCal = slotItems.reduce((s, i) => s + i.cal, 0);
    const isMain = (MAIN_MEAL_SLOTS as readonly string[]).includes(slot);

    if (isMain) {
      const compliance = scorePlateCompliance({
        slotCal: slotActualCal,
        items: slotItems.map((i) => ({ group: i.group, cal: i.cal, grams: i.amount })),
        idealShare,
        gramBounds,
      });
      slotSummaries.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        slotTargetCal: Math.round(slotTargetCal),
        slotActualCal: Math.round(slotActualCal),
        items: slotItems,
        compliance,
      });
    } else {
      slotSummaries.push({
        slot,
        slotLabel: SLOT_LABELS[slot],
        slotTargetCal: Math.round(slotTargetCal),
        slotActualCal: Math.round(slotActualCal),
        items: slotItems,
        compliance: {
          score: 100,
          tier: "EXCELLENT" as ComplianceTier,
          actualShare: { STAPLE: 0, PROTEIN: 0, VEGETABLE: 0, FRUIT: 0, OTHER: 0 },
          idealShare,
          groupPresent: { STAPLE: false, PROTEIN: false, VEGETABLE: false, FRUIT: false, OTHER: false },
          recommendations: [],
        },
      });
    }
  }

  const totals = allItems.reduce(
    (acc, i) => ({
      cal: acc.cal + i.cal,
      protein: acc.protein + i.protein,
      fat: acc.fat + i.fat,
      carb: acc.carb + i.carb,
      fiber: acc.fiber + i.fiber,
      sodium: acc.sodium + i.sodium,
      potassium: acc.potassium + i.potassium,
      calcium: acc.calcium + i.calcium,
      iron: acc.iron + i.iron,
      cholesterol: acc.cholesterol + i.cholesterol,
    }),
    { cal: 0, protein: 0, fat: 0, carb: 0, fiber: 0, sodium: 0, potassium: 0, calcium: 0, iron: 0, cholesterol: 0 },
  );

  const targets = {
    cal: calResult.targetCalorie,
    protein: calResult.macros.proteinG,
    fat: calResult.macros.fatG,
    carb: calResult.macros.carbG,
    fiber: calResult.fiberTarget,
    sodiumMax: calResult.sodiumMax,
  };

  const validation = validateNutrition({
    target: targets,
    actual: {
      cal: totals.cal,
      protein: totals.protein,
      fat: totals.fat,
      carb: totals.carb,
      fiber: totals.fiber,
      sodium: totals.sodium,
    },
  });

  const mainSummaries = slotSummaries.filter((s) =>
    (MAIN_MEAL_SLOTS as readonly string[]).includes(s.slot),
  );
  const overallCompliance =
    mainSummaries.length > 0
      ? Math.round(mainSummaries.reduce((sum, s) => sum + s.compliance.score, 0) / mainSummaries.length)
      : 0;

  let overallTier: ComplianceTier = "EXCELLENT";
  if (mainSummaries.some((s) => s.compliance.tier === "POOR")) overallTier = "POOR";
  else if (mainSummaries.some((s) => s.compliance.tier === "GOOD")) overallTier = "GOOD";

  const groupCoverage = {
    staple: allItems.filter((i) => i.group === PlateGroup.STAPLE).length,
    protein: allItems.filter((i) => i.group === PlateGroup.PROTEIN).length,
    vegetable: allItems.filter((i) => i.group === PlateGroup.VEGETABLE).length,
    fruit: allItems.filter((i) => i.group === PlateGroup.FRUIT).length,
  };

  return {
    items: allItems,
    slotSummaries,
    totals: {
      cal: Math.round(totals.cal),
      protein: Math.round(totals.protein),
      fat: Math.round(totals.fat),
      carb: Math.round(totals.carb),
      fiber: Math.round(totals.fiber),
      sodium: Math.round(totals.sodium),
      potassium: Math.round(totals.potassium),
      calcium: Math.round(totals.calcium),
      iron: Math.round(totals.iron),
      cholesterol: Math.round(totals.cholesterol),
    },
    targets,
    validation,
    overallCompliance,
    overallTier,
    overallTierLabel: COMPLIANCE_TIER_LABEL[overallTier],
    overallTierColor: COMPLIANCE_TIER_COLOR[overallTier],
    rotationWarnings: [],
    groupCoverage,
    diversityScore: 0,
    generationSeed: "stored", // marker: this view was reconstructed from DB, not freshly generated
    labFoodAdjustments: [],
    genomicFoodAdjustments: [],
  };
}

// ---------------------------------------------------------------------
// AI Reasoning: natural-language evaluation via LLM
// ---------------------------------------------------------------------
export async function generateAIReasoning(
  calResult: CalorieResult,
  plan: GeneratedMealPlan,
  diagnoses: DiagnosisType[],
  patientName: string,
  patientId?: string,
  labSummary?: string,
): Promise<{ text: string; model: string }> {
  const adj =
    diagnoses.length > 0
      ? DIAGNOSIS_ADJUSTMENTS[diagnoses[0]]
      : DIAGNOSIS_ADJUSTMENTS.OTHER;

  const fallback = `Rencana makan disusun mengikuti Pedoman "Isi Piringku" Kemenkes RI dengan compliance ${plan.overallCompliance}% (${plan.overallTierLabel}). Setiap makan utama mengandung makanan pokok, lauk pauk, sayuran, dan buah. Komposisi disesuaikan untuk diagnosis: ${adj.label}. AI reasoning gagal dimuat — silakan klik "Evaluasi AI" untuk mencoba lagi.`;

  try {
    // Lazy import: keeps this deterministic engine file importable even in
    // contexts where OPENAI_API_KEY isn't set (e.g. isi-piringku preview route).
    const { generateStructured } = await import("@/lib/ai/validator/validate");
    const { MealPlanReasoningOutputSchema } = await import("@/lib/ai/schemas/meal-plan");
    const { MEAL_PLAN_SYSTEM_PROMPT, buildMealPlanUserPrompt } = await import(
      "@/lib/ai/prompts/meal-plan"
    );
    const { AI_MODELS } = await import("@/lib/ai/models");
    const { logAIUsage } = await import("@/lib/ai/logging");

    const mealSummary = plan.slotSummaries
      .map((s) => {
        const items = s.items
          .map((i) => `${i.groupIcon} ${i.foodName} ${i.amount}g (${i.cal}kcal)`)
          .join(", ");
        return `${s.slotLabel}: ${items || "(kosong)"} | Compliance: ${s.compliance.score}%`;
      })
      .join("\n");

    // Fold notable lab results into the clinical-notes context so the
    // narrative can reference them (e.g. "LDL tinggi — rencana ini
    // menekankan sumber lemak tak jenuh"). Labs never change the
    // food/gram numbers themselves — only this explanatory text.
    const clinicalNotes = labSummary
      ? `${adj.notes} Hasil laboratorium terbaru yang relevan: ${labSummary}. Jelaskan singkat kaitan rencana makan ini dengan hasil lab tersebut bila relevan.`
      : adj.notes;

    const user = buildMealPlanUserPrompt({
      patientName,
      diagnoses,
      clinicalNotes,
      targetCal: calResult.targetCalorie,
      targetProtein: calResult.macros.proteinG,
      targetFat: calResult.macros.fatG,
      targetCarb: calResult.macros.carbG,
      targetFiber: calResult.fiberTarget,
      targetSodium: calResult.sodiumMax,
      totals: plan.totals,
      mealSummary,
      overallCompliance: plan.overallCompliance,
      overallTierLabel: plan.overallTierLabel,
      validationSummary: plan.validation
        .map((v) => `${v.nutrient} ${v.actual}/${v.target}${v.unit} (${v.pct}%)`)
        .join(", "),
    });

    const result = await generateStructured({
      model: AI_MODELS.reasoning,
      system: MEAL_PLAN_SYSTEM_PROMPT,
      user,
      schema: MealPlanReasoningOutputSchema,
    });

    await logAIUsage({
      feature: "meal-plan-reasoning",
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      responseTimeMs: result.responseTimeMs,
      success: true,
      patientId: patientId ?? null,
    });

    const parts = [result.data.reasoning];
    if (result.data.clinical_notes.length) parts.push(`Catatan klinis: ${result.data.clinical_notes.join("; ")}`);
    if (result.data.warnings.length) parts.push(`⚠️ ${result.data.warnings.join("; ")}`);

    return { text: parts.join("\n\n"), model: result.model };
  } catch (e) {
    console.error("[AI Reasoning] error:", e);
    return { text: fallback, model: "fallback-deterministic" };
  }
}

// Re-export for convenience
export { PLATE_GROUP_LABEL, PLATE_GROUP_ICON, PLATE_GROUP_COLOR };
export type { PlateComplianceResult, NutritionValidationRow, ComplianceTier };
