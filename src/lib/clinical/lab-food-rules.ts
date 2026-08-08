// =====================================================================
// CareLivia — Lab-Driven Food Selection Rules
//
// Extends the diagnosis-based plate modifier system (DIAGNOSIS_PLATE_MODIFIER
// in isi-piringku.ts) with an INDEPENDENT layer keyed off actual lab values,
// not the diagnosis enum. This means the food-selection engine can react to
// e.g. "LDL tinggi" or "Asam Urat tinggi" even before a matching diagnosis
// has been coded — and can differentiate severity within a diagnosis using
// real numbers instead of only the diagnosis label.
//
// Design constraint: this module NEVER touches DIAGNOSIS_PLATE_MODIFIER or
// the core selection algorithm's control flow. It only produces additional
// forbidden/recommended keyword maps that get merged in alongside the
// diagnosis-based ones at scoring/filtering time. Every consumer of this
// module treats it as fully optional — passing no lab data behaves
// identically to the pre-lab-integration engine.
// =====================================================================

import type { PlateGroup } from "./isi-piringku";

export interface LabResultLike {
  testName: string;
  value: number;
  status: string; // NORMAL | BORDERLINE | TINGGI | RENDAH
  category?: string;
}

export interface LabPlateModifiers {
  forbiddenInGroup: Partial<Record<PlateGroup, string[]>>;
  recommendedInGroup: Partial<Record<PlateGroup, string[]>>;
  // Human-readable explanations for each rule that actually fired, so the
  // AI reasoning layer and clinician-facing warnings can say *why*.
  activeReasons: string[];
}

interface LabFoodRule {
  testName: string;
  // Only fires for this lab status (kept deliberately conservative — most
  // rules only trigger on TINGGI/RENDAH, not BORDERLINE, to avoid
  // over-restricting on a value that's only marginally outside range).
  triggerStatus: string[];
  forbiddenInGroup?: Partial<Record<PlateGroup, string[]>>;
  recommendedInGroup?: Partial<Record<PlateGroup, string[]>>;
  reason: string;
}

// Evidence basis noted per rule (PERKENI / ESPEN / KDIGO / general clinical
// chemistry). Keyword lists intentionally mirror the style already used in
// DIAGNOSIS_PLATE_MODIFIER so both layers combine predictably.
const LAB_FOOD_RULES: LabFoodRule[] = [
  {
    testName: "LDL",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      PROTEIN: ["jeroan", "goreng", "kulit", "santan", "kuning telur", "daging kambing", "bebek"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan", "salmon", "tahu", "tempe", "ayam dada"],
      STAPLE: ["oat", "gandum"],
    },
    reason: "LDL tinggi — rencana ini menekankan sumber lemak tak jenuh & menghindari lemak jenuh/trans.",
  },
  {
    testName: "Kolesterol Total",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      PROTEIN: ["jeroan", "goreng", "kulit", "santan", "kuning telur"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan", "tahu", "tempe"],
    },
    reason: "Kolesterol total tinggi — sumber lemak jenuh dibatasi.",
  },
  {
    testName: "Trigliserida",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      STAPLE: ["gula", "sirup"],
      PROTEIN: ["goreng"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan"],
      STAPLE: ["oat", "gandum"],
    },
    reason: "Trigliserida tinggi — gula sederhana & gorengan dibatasi, omega-3 diprioritaskan.",
  },
  {
    testName: "Asam Urat",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      PROTEIN: ["jeroan", "seafood", "udang", "cumi", "kacang", "kedelai", "emping"],
      VEGETABLE: ["bayam", "kembang kol"],
    },
    recommendedInGroup: {
      PROTEIN: ["telur", "susu", "ayam"],
      FRUIT: ["ceri"],
    },
    reason: "Asam urat tinggi — sumber purin tinggi (jeroan, seafood, kacang-kacangan) dihindari.",
  },
  {
    testName: "Kalium",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      VEGETABLE: ["bayam", "tomat", "kentang", "kangkung"],
      FRUIT: ["pisang", "jeruk", "semangka", "melon", "alpukat"],
    },
    recommendedInGroup: {
      VEGETABLE: ["kubis", "kol", "sawi", "wortel"],
      FRUIT: ["apel", "pir"],
    },
    reason: "Kalium darah tinggi (hiperkalemia) — sayur/buah tinggi kalium dibatasi lebih ketat dari standar diagnosis.",
  },
  {
    testName: "Kalium",
    triggerStatus: ["RENDAH"],
    recommendedInGroup: {
      FRUIT: ["pisang", "jeruk"],
      VEGETABLE: ["bayam"],
    },
    reason: "Kalium darah rendah (hipokalemia) — sumber kalium alami dianjurkan (perhatikan bila ada pembatasan cairan/ginjal lain).",
  },
  {
    testName: "HbA1c",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: {
      STAPLE: ["putih", "bubur", "mi instan", "roti putih", "gula"],
    },
    recommendedInGroup: {
      STAPLE: ["merah", "gandum", "oat", "singkong", "jagung"],
    },
    reason: "HbA1c tinggi — kontrol glikemik diperketat, karbohidrat indeks glikemik rendah diprioritaskan.",
  },
  {
    testName: "GDP",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: { STAPLE: ["gula", "putih"] },
    reason: "Gula darah puasa tinggi — sumber gula sederhana dibatasi.",
  },
  {
    testName: "GDS",
    triggerStatus: ["TINGGI"],
    forbiddenInGroup: { STAPLE: ["gula", "putih"] },
    reason: "Gula darah sewaktu tinggi — sumber gula sederhana dibatasi.",
  },
  {
    testName: "eGFR",
    triggerStatus: ["RENDAH"],
    forbiddenInGroup: {
      VEGETABLE: ["tomat", "bayam", "kentang", "kangkung"],
      FRUIT: ["pisang", "jeruk", "semangka"],
      PROTEIN: ["kacang", "kedelai"],
    },
    recommendedInGroup: {
      PROTEIN: ["putih telur", "ikan", "ayam dada"],
    },
    reason: "eGFR rendah (fungsi ginjal menurun) — kalium & fosfor dibatasi meski belum terdiagnosis CKD formal.",
  },
];

function mergeKeywordMaps(
  target: Partial<Record<PlateGroup, string[]>>,
  source?: Partial<Record<PlateGroup, string[]>>,
): void {
  if (!source) return;
  for (const [group, keywords] of Object.entries(source)) {
    const g = group as PlateGroup;
    target[g] = [...new Set([...(target[g] || []), ...keywords])];
  }
}

// Resolve the combined lab-driven modifiers for a patient's current labs.
// Only the LATEST result per test name is considered (mirrors how the
// report/AI-evaluation layers already treat lab history).
export function resolveLabFoodModifiers(labs: LabResultLike[] | undefined | null): LabPlateModifiers {
  const result: LabPlateModifiers = { forbiddenInGroup: {}, recommendedInGroup: {}, activeReasons: [] };
  if (!labs || labs.length === 0) return result;

  const latestByTest = new Map<string, LabResultLike>();
  for (const r of labs) {
    if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
  }

  for (const rule of LAB_FOOD_RULES) {
    const latest = latestByTest.get(rule.testName);
    if (!latest) continue;
    if (!rule.triggerStatus.includes(latest.status)) continue;

    mergeKeywordMaps(result.forbiddenInGroup, rule.forbiddenInGroup);
    mergeKeywordMaps(result.recommendedInGroup, rule.recommendedInGroup);
    result.activeReasons.push(rule.reason);
  }

  return result;
}

export function isForbiddenByLab(foodName: string, group: PlateGroup, labMods?: LabPlateModifiers): boolean {
  if (!labMods?.forbiddenInGroup?.[group]) return false;
  const name = foodName.toLowerCase();
  return labMods.forbiddenInGroup[group]!.some((kw) => name.includes(kw.toLowerCase()));
}

export function isRecommendedByLab(foodName: string, group: PlateGroup, labMods?: LabPlateModifiers): boolean {
  if (!labMods?.recommendedInGroup?.[group]) return false;
  const name = foodName.toLowerCase();
  return labMods.recommendedInGroup[group]!.some((kw) => name.includes(kw.toLowerCase()));
}
