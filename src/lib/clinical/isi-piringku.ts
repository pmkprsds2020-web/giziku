// =====================================================================
// CareLivia — Isi Piringku Kemenkes RI Engine
// Pedoman Gizi Seimbang (PGS) — "Isi Piringku" implementation
// Ref: Permenkes RI No.41/2014, Pedoman Gizi Seimbang Kemenkes RI 2023
// =====================================================================
//
// Konsep "Isi Piringku" untuk makan utama (sarapan/makan siang/makan malam):
//
//   ┌─────────────────┬─────────────────┐
//   │  SETENGAH PIRING│  SETENGAH PIRING│
//   │     PERTAMA     │     KEDUA       │
//   │                 │                 │
//   │ ┌─────────┐     │ ┌─────────┐     │
//   │ │ STAPLE  │ ┌─┐ │ │  VEG    │ ┌─┐ │
//   │ │  2/3    │ │P│ │ │  2/3    │ │F│ │
//   │ │         │ │R│ │ │         │ │R│ │
//   │ └─────────┘ │O│ │ └─────────┘ │U│ │
//   │             │T│ │             │I│ │
//   │             │E│ │             │T│ │
//   │             │I│ │             │ │ │
//   │             │N│ │             │ │ │
//   │             │ │ │             │ │ │
//   │             │1/3│             │1/3│
//   │             │   │             │   │
//   └─────────────────┴─────────────────┘
//
// Setengah piring pertama: Makanan Pokok (2/3) + Lauk Pauk (1/3)
// Setengah piring kedua:  Sayuran (2/3) + Buah (1/3)
// =====================================================================

import type { DiagnosisType } from "@prisma/client";
import { isForbiddenByLab, isRecommendedByLab, type LabPlateModifiers } from "./lab-food-rules";

// ---------------------------------------------------------------------
// Isi Piringku Food Groups
// ---------------------------------------------------------------------
export enum PlateGroup {
  STAPLE = "STAPLE", // Makanan pokok (2/3 setengah piring pertama)
  PROTEIN = "PROTEIN", // Lauk pauk (1/3 setengah piring pertama)
  VEGETABLE = "VEGETABLE", // Sayuran (2/3 setengah piring kedua)
  FRUIT = "FRUIT", // Buah (1/3 setengah piring kedua)
  OTHER = "OTHER", // Snack / extra (untuk slot selain makan utama)
}

export const PLATE_GROUP_LABEL: Record<PlateGroup, string> = {
  STAPLE: "Makanan Pokok",
  PROTEIN: "Lauk Pauk (Protein)",
  VEGETABLE: "Sayuran",
  FRUIT: "Buah",
  OTHER: "Lainnya",
};

export const PLATE_GROUP_ICON: Record<PlateGroup, string> = {
  STAPLE: "🍚",
  PROTEIN: "🍗",
  VEGETABLE: "🥦",
  FRUIT: "🍎",
  OTHER: "🥤",
};

// Ideal proportion of total plate area (per main meal)
export const PLATE_GROUP_PROPORTION: Record<PlateGroup, number> = {
  STAPLE: 2 / 3 * 0.5, // 2/3 dari setengah piring = 1/3 piring
  PROTEIN: 1 / 3 * 0.5, // 1/3 dari setengah piring = 1/6 piring
  VEGETABLE: 2 / 3 * 0.5, // 2/3 dari setengah piring = 1/3 piring
  FRUIT: 1 / 3 * 0.5, // 1/3 dari setengah piring = 1/6 piring
  OTHER: 0,
};

// Color tokens for visualization (Tailwind + hex)
export const PLATE_GROUP_COLOR: Record<PlateGroup, { bg: string; ring: string; text: string; hex: string }> = {
  STAPLE: { bg: "bg-amber-100", ring: "ring-amber-400", text: "text-amber-700", hex: "#f59e0b" },
  PROTEIN: { bg: "bg-rose-100", ring: "ring-rose-400", text: "text-rose-700", hex: "#f43f5e" },
  VEGETABLE: { bg: "bg-emerald-100", ring: "ring-emerald-400", text: "text-emerald-700", hex: "#10b981" },
  FRUIT: { bg: "bg-purple-100", ring: "ring-purple-400", text: "text-purple-700", hex: "#a855f7" },
  OTHER: { bg: "bg-slate-100", ring: "ring-slate-400", text: "text-slate-700", hex: "#64748b" },
};

// ---------------------------------------------------------------------
// Map existing FoodCategory (DB slug) → PlateGroup
// ---------------------------------------------------------------------
export const CATEGORY_TO_PLATE: Record<string, PlateGroup> = {
  serealia: PlateGroup.STAPLE,
  umbi: PlateGroup.STAPLE,
  daging: PlateGroup.PROTEIN,
  ikan: PlateGroup.PROTEIN,
  telur: PlateGroup.PROTEIN,
  susu: PlateGroup.PROTEIN,
  kacang: PlateGroup.PROTEIN,
  sayur: PlateGroup.VEGETABLE,
  buah: PlateGroup.FRUIT,
  // Non-plate groups (used only in snacks / extras)
  lemak: PlateGroup.OTHER,
  gula: PlateGroup.OTHER,
  bumbu: PlateGroup.OTHER,
  minuman: PlateGroup.OTHER,
};

// ---------------------------------------------------------------------
// Meal slot distribution per Isi Piringku (Kemenkes RI 2023)
// Uses mid-point of recommended range
// ---------------------------------------------------------------------
export const ISI_PIRINGKU_DISTRIBUTION = {
  BREAKFAST: 0.225, // 20-25% → 22.5%
  MORNING_SNACK: 0.075, // 5-10% → 7.5%
  LUNCH: 0.325, // 30-35% → 32.5%
  AFTERNOON_SNACK: 0.075, // 5-10% → 7.5%
  DINNER: 0.25, // 25-30% → 25% (lower end so snacks fit)
  EVENING_SNACK: 0.05, // 0-5% → 5%
} as const;

export const MAIN_MEAL_SLOTS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
export const SNACK_SLOTS = ["MORNING_SNACK", "AFTERNOON_SNACK", "EVENING_SNACK"] as const;

// ---------------------------------------------------------------------
// Plate target proportion per group (per main meal, as fraction of slot
// calories). Total = 1.0
// ---------------------------------------------------------------------
export const PLATE_TARGET_SHARE: Record<PlateGroup, number> = {
  STAPLE: 0.4, // 40% of slot cal (carb-dominant)
  PROTEIN: 0.3, // 30% of slot cal
  VEGETABLE: 0.2, // 20% of slot cal (low cal but high volume)
  FRUIT: 0.1, // 10% of slot cal
  OTHER: 0,
};

// Acceptable tolerance for compliance scoring
export const PLATE_TOLERANCE = 0.15; // ±15% off ideal share still scores

// ---------------------------------------------------------------------
// Plate compliance tier
// ---------------------------------------------------------------------
export type ComplianceTier = "EXCELLENT" | "GOOD" | "POOR";

export const COMPLIANCE_TIER_LABEL: Record<ComplianceTier, string> = {
  EXCELLENT: "Sangat Sesuai",
  GOOD: "Cukup Sesuai",
  POOR: "Tidak Sesuai",
};

export const COMPLIANCE_TIER_COLOR: Record<ComplianceTier, string> = {
  EXCELLENT: "#10b981", // green-500
  GOOD: "#f59e0b", // amber-500
  POOR: "#ef4444", // red-500
};

export const COMPLIANCE_TIER_ICON: Record<ComplianceTier, string> = {
  EXCELLENT: "🟢",
  GOOD: "🟡",
  POOR: "🔴",
};

export function complianceTier(score: number): ComplianceTier {
  if (score >= 90) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  return "POOR";
}

// ---------------------------------------------------------------------
// Diagnosis-specific Isi Piringku modifiers
// Adjusts target shares and adds forbidden/recommended within group
// ---------------------------------------------------------------------
export interface DiagnosisPlateModifier {
  // Override target share (must sum to 1.0 for main meals)
  shareOverride?: Partial<Record<PlateGroup, number>>;
  // Forbidden keywords within group (food name contains)
  forbiddenInGroup?: Partial<Record<PlateGroup, string[]>>;
  // Recommended keywords within group (preferred selection)
  recommendedInGroup?: Partial<Record<PlateGroup, string[]>>;
  // Min/max gram bounds per group (per main meal)
  gramBounds?: Partial<Record<PlateGroup, { min: number; max: number }>>;
  // Free-text clinical notes
  notes: string;
}

export const DIAGNOSIS_PLATE_MODIFIER: Record<DiagnosisType, DiagnosisPlateModifier> = {
  DM: {
    shareOverride: { STAPLE: 0.35, PROTEIN: 0.3, VEGETABLE: 0.25, FRUIT: 0.1 },
    forbiddenInGroup: {
      STAPLE: ["putih", "bubur", "mi instan", "roti putih"],
      FRUIT: ["semangka", "pisang besar", " mangga"],
    },
    recommendedInGroup: {
      STAPLE: ["merah", "gandum", "oat", "singkong", "jagung"],
      FRUIT: ["jeruk", "apel", "pir", "jambu"],
    },
    gramBounds: { STAPLE: { min: 75, max: 150 }, FRUIT: { min: 50, max: 100 } },
    notes: "DM: karbohidrat rendah GI, distribusi merata, serat tinggi.",
  },
  HT: {
    forbiddenInGroup: {
      PROTEIN: ["asin", "kornet", "iakan", "keju", "udang"],
      VEGETABLE: ["asin", "acar"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan kembung", "ikan tuna", "ayam dada", "tahu", "tempe"],
      VEGETABLE: ["bayam", "tomat", "sawi", "kangkung"],
      FRUIT: ["pisang", "jeruk", "melon"],
    },
    gramBounds: { VEGETABLE: { min: 100, max: 200 } },
    notes: "DASH: natrium rendah, kalium tinggi (sayur+buah).",
  },
  CHF: {
    forbiddenInGroup: { PROTEIN: ["asin", "asap"] },
    notes: "CHF: batasi natrium, cairan, sedikit-sering.",
  },
  CKD: {
    forbiddenInGroup: {
      VEGETABLE: ["tomat", "bayam", "kentang", "kangkung"],
      FRUIT: ["pisang", "jeruk", "semangka", "melon"],
      PROTEIN: ["kacang", "kedelai"],
    },
    recommendedInGroup: {
      VEGETABLE: ["kubis", "kol", "sawi", "wortel"],
      FRUIT: ["apel", "pir"],
      PROTEIN: ["putih telur", "ikan", "ayam dada"],
    },
    gramBounds: { VEGETABLE: { min: 50, max: 100 }, FRUIT: { min: 50, max: 100 } },
    notes: "CKD: batasi K & P, protein sesuai stadium.",
  },
  CKD_ND: {
    forbiddenInGroup: {
      VEGETABLE: ["tomat", "bayam", "kentang"],
      FRUIT: ["pisang", "jeruk", "semangka"],
      PROTEIN: ["kacang", "kedelai"],
    },
    notes: "CKD Non-Dialisis: protein rendah, K & P dibatasi.",
  },
  CKD_HD: {
    recommendedInGroup: {
      PROTEIN: ["putih telur", "ikan", "ayam dada"],
      VEGETABLE: ["kubis", "kol", "wortel"],
      FRUIT: ["apel", "pir"],
    },
    notes: "CKD HD: protein 1.0-1.2 g/kg, cairan dipantau.",
  },
  CKD_PD: {
    recommendedInGroup: { PROTEIN: ["putih telur", "daging", "ikan"] },
    notes: "CKD PD: protein 1.2-1.3 g/kg.",
  },
  LIVER: {
    recommendedInGroup: { PROTEIN: ["whey", "telur", "ikan", "tahu"] },
    notes: "Hati: protein cukup, sedikit-sering.",
  },
  CANCER: {
    recommendedInGroup: { PROTEIN: ["telur", "ikan", "ayam", "whey"] },
    shareOverride: { PROTEIN: 0.35, STAPLE: 0.35, VEGETABLE: 0.2, FRUIT: 0.1 },
    notes: "Kanker: protein tinggi anti-catabolic.",
  },
  DYSLIPIDEMIA: {
    forbiddenInGroup: {
      PROTEIN: ["jeroan", "goreng", "kuning", "daging kambing", "bebek"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan", "salmon", "tahu", "tempe", "ayam dada"],
      STAPLE: ["oat", "gandum", "merah"],
      FRUIT: ["alpukat"],
    },
    notes: "Dislipidemia: lemak jenuh <7%, omega-3 tinggi.",
  },
  GOUT: {
    forbiddenInGroup: {
      PROTEIN: ["jeroan", "seafood", "udang", "cumi", "kacang", "kedelai"],
      VEGETABLE: ["bayam"],
    },
    recommendedInGroup: { PROTEIN: ["telur", "susu", "ayam"], FRUIT: ["ceri"] },
    notes: "Gout: hindari purin tinggi.",
  },
  GERD: {
    forbiddenInGroup: {
      FRUIT: ["jeruk", "lemon"],
      VEGETABLE: ["tomat"],
      PROTEIN: ["goreng", "berlemak"],
    },
    recommendedInGroup: { PROTEIN: ["ayam", "ikan"], FRUIT: ["pisang", "melon"] },
    notes: "GERD: hindari pemicu reflux.",
  },
  PUD: {
    recommendedInGroup: { PROTEIN: ["susu", "telur"], VEGETABLE: ["kubis"] },
    notes: "PUD: protein untuk penyembuhan mukosa.",
  },
  IBD: {
    forbiddenInGroup: { VEGETABLE: ["serat tinggi", "mentah", "kacang"] },
    recommendedInGroup: { PROTEIN: ["putih telur", "ikan", "ayam"] },
    notes: "IBD: rendah serat saat flare.",
  },
  OBESITY: {
    shareOverride: { STAPLE: 0.3, PROTEIN: 0.35, VEGETABLE: 0.25, FRUIT: 0.1 },
    gramBounds: { STAPLE: { min: 50, max: 100 }, VEGETABLE: { min: 150, max: 250 } },
    notes: "Obesitas: defisit energi, protein tinggi, serat tinggi.",
  },
  MALNUTRITION: {
    shareOverride: { STAPLE: 0.4, PROTEIN: 0.35, VEGETABLE: 0.15, FRUIT: 0.1 },
    gramBounds: { PROTEIN: { min: 80, max: 150 }, STAPLE: { min: 100, max: 200 } },
    notes: "Malnutrisi: energi & protein tinggi (refeeding hati-hati).",
  },
  SARCOPENIA: {
    shareOverride: { PROTEIN: 0.35, STAPLE: 0.35, VEGETABLE: 0.2, FRUIT: 0.1 },
    recommendedInGroup: { PROTEIN: ["whey", "telur", "ikan", "tempe"] },
    notes: "Sarkopenia: protein 1.2-1.5 g/kg.",
  },
  POST_OP: {
    shareOverride: { PROTEIN: 0.35, STAPLE: 0.35, VEGETABLE: 0.2, FRUIT: 0.1 },
    recommendedInGroup: { PROTEIN: ["telur", "ikan", "ayam"], FRUIT: ["jeruk"] },
    notes: "Post-op: protein tinggi, Zn & vitC untuk luka.",
  },
  PREGNANCY: {
    recommendedInGroup: {
      PROTEIN: ["ikan", "telur", "susu", "ayam"],
      VEGETABLE: ["bayam", "sawi", "brokoli"],
      FRUIT: ["jeruk", "pisang", "jambu"],
    },
    notes: "Hamil: +340/450 kcal, folat, Fe, Ca.",
  },
  LACTATION: {
    recommendedInGroup: { PROTEIN: ["susu", "ikan", "telur"] },
    notes: "Laktasi: +500 kcal, cairan ≥3L.",
  },
  PEDIATRIC: {
    recommendedInGroup: { PROTEIN: ["susu", "telur", "ikan"], FRUIT: ["pisang", "papaya"] },
    notes: "Pediatrik: energi/kg tinggi, zat besi, vitA.",
  },
  GERIATRIC: {
    shareOverride: { PROTEIN: 0.35, STAPLE: 0.35, VEGETABLE: 0.2, FRUIT: 0.1 },
    recommendedInGroup: { PROTEIN: ["susu", "telur", "ikan", "tahu"] },
    notes: "Lansia: protein tinggi, mudah dikunyah, kalsium & vitD.",
  },
  STROKE: {
    forbiddenInGroup: { PROTEIN: ["asin", "asap"] },
    notes: "Stroke: natrium rendah, tekstur sesuai swallowing.",
  },
  COPD: {
    shareOverride: { PROTEIN: 0.3, STAPLE: 0.3, VEGETABLE: 0.25, FRUIT: 0.15 },
    notes: "COPD: rendah karbohidrat, tinggi lemak.",
  },
  OTHER: {
    notes: "Pedoman Gizi Seimbang umum.",
  },
};

// ---------------------------------------------------------------------
// Resolve effective share per group given diagnosis (defaults to base)
// ---------------------------------------------------------------------
export function resolveShare(diagnoses: DiagnosisType[]): Record<PlateGroup, number> {
  const base: Record<PlateGroup, number> = { ...PLATE_TARGET_SHARE };
  for (const d of diagnoses) {
    const mod = DIAGNOSIS_PLATE_MODIFIER[d];
    if (!mod?.shareOverride) continue;
    for (const [k, v] of Object.entries(mod.shareOverride)) {
      base[k as PlateGroup] = v as number;
    }
  }
  // Normalize to sum 1.0 (for main meals)
  const sum = base.STAPLE + base.PROTEIN + base.VEGETABLE + base.FRUIT;
  if (sum > 0 && Math.abs(sum - 1) > 0.01) {
    const f = 1 / sum;
    base.STAPLE *= f;
    base.PROTEIN *= f;
    base.VEGETABLE *= f;
    base.FRUIT *= f;
  }
  return base;
}

// ---------------------------------------------------------------------
// Resolve gram bounds for a group given diagnoses
// ---------------------------------------------------------------------
export function resolveGramBounds(
  diagnoses: DiagnosisType[],
  group: PlateGroup,
): { min: number; max: number } | null {
  for (const d of diagnoses) {
    const mod = DIAGNOSIS_PLATE_MODIFIER[d];
    if (mod?.gramBounds?.[group]) return mod.gramBounds[group]!;
  }
  return null;
}

// ---------------------------------------------------------------------
// Check forbidden / recommended within group
// ---------------------------------------------------------------------
export function isForbiddenInGroup(
  foodName: string,
  group: PlateGroup,
  diagnoses: DiagnosisType[],
  labMods?: LabPlateModifiers,
): boolean {
  const name = foodName.toLowerCase();
  for (const d of diagnoses) {
    const mod = DIAGNOSIS_PLATE_MODIFIER[d];
    if (!mod?.forbiddenInGroup?.[group]) continue;
    if (mod.forbiddenInGroup[group]!.some((kw) => name.includes(kw.toLowerCase()))) return true;
  }
  if (isForbiddenByLab(foodName, group, labMods)) return true;
  return false;
}

export function isRecommendedInGroup(
  foodName: string,
  group: PlateGroup,
  diagnoses: DiagnosisType[],
  labMods?: LabPlateModifiers,
): boolean {
  const name = foodName.toLowerCase();
  for (const d of diagnoses) {
    const mod = DIAGNOSIS_PLATE_MODIFIER[d];
    if (!mod?.recommendedInGroup?.[group]) continue;
    if (mod.recommendedInGroup[group]!.some((kw) => name.includes(kw.toLowerCase()))) return true;
  }
  if (isRecommendedByLab(foodName, group, labMods)) return true;
  return false;
}

// ---------------------------------------------------------------------
// Plate compliance scoring (per main meal)
// Returns 0-100 score + tier + per-group share deltas + recommendations
// ---------------------------------------------------------------------
export interface PlateComplianceResult {
  score: number; // 0-100
  tier: ComplianceTier;
  actualShare: Record<PlateGroup, number>; // fraction of slot cal
  idealShare: Record<PlateGroup, number>;
  groupPresent: Record<PlateGroup, boolean>;
  recommendations: string[];
}

export function scorePlateCompliance(args: {
  slotCal: number;
  items: { group: PlateGroup; cal: number; grams: number }[];
  idealShare: Record<PlateGroup, number>;
  gramBounds?: Partial<Record<PlateGroup, { min: number; max: number }>>;
}): PlateComplianceResult {
  const { slotCal, items, idealShare } = args;
  const recommendations: string[] = [];

  const groupCal: Record<PlateGroup, number> = {
    STAPLE: 0, PROTEIN: 0, VEGETABLE: 0, FRUIT: 0, OTHER: 0,
  };
  const groupGrams: Record<PlateGroup, number> = {
    STAPLE: 0, PROTEIN: 0, VEGETABLE: 0, FRUIT: 0, OTHER: 0,
  };

  for (const it of items) {
    groupCal[it.group] += it.cal;
    groupGrams[it.group] += it.grams;
  }

  const actualShare: Record<PlateGroup, number> = {
    STAPLE: slotCal > 0 ? groupCal.STAPLE / slotCal : 0,
    PROTEIN: slotCal > 0 ? groupCal.PROTEIN / slotCal : 0,
    VEGETABLE: slotCal > 0 ? groupCal.VEGETABLE / slotCal : 0,
    FRUIT: slotCal > 0 ? groupCal.FRUIT / slotCal : 0,
    OTHER: 0,
  };

  const groupPresent: Record<PlateGroup, boolean> = {
    STAPLE: groupCal.STAPLE > 0,
    PROTEIN: groupCal.PROTEIN > 0,
    VEGETABLE: groupCal.VEGETABLE > 0,
    FRUIT: groupCal.FRUIT > 0,
    OTHER: false,
  };

  // Compliance scoring — weighted combination
  let score = 0;
  let totalWeight = 0;

  // 1) Presence of all 4 groups (weight 50)
  const presentCount = ["STAPLE", "PROTEIN", "VEGETABLE", "FRUIT"].filter(
    (g) => groupPresent[g as PlateGroup],
  ).length;
  score += (presentCount / 4) * 50;
  totalWeight += 50;

  // Missing group recommendations
  if (!groupPresent.STAPLE) recommendations.push("Tambahkan makanan pokok (nasi/kentang/ubi).");
  if (!groupPresent.PROTEIN) recommendations.push("Tambahkan lauk pauk (ayam/ikan/tahu/tempe).");
  if (!groupPresent.VEGETABLE) recommendations.push("Tambahkan minimal 100 gram sayuran.");
  if (!groupPresent.FRUIT) recommendations.push("Tambahkan 1 porsi buah.");

  // 2) Share adherence (weight 30) — penalize deviation from ideal
  const groups: PlateGroup[] = ["STAPLE", "PROTEIN", "VEGETABLE", "FRUIT"];
  let shareScore = 0;
  for (const g of groups) {
    const ideal = idealShare[g];
    const actual = actualShare[g];
    const delta = Math.abs(actual - ideal);
    // Score: 100 if exact, 0 if delta >= 0.3
    const gScore = Math.max(0, 100 - (delta / 0.3) * 100);
    shareScore += gScore;
    // Recommendation if off by > 15%
    if (groupPresent[g] && delta > PLATE_TOLERANCE) {
      const idealG = Math.round(ideal * 100);
      if (actual > ideal + PLATE_TOLERANCE) {
        recommendations.push(
          `Kurangi porsi ${PLATE_GROUP_LABEL[g]} (saat ${Math.round(actual * 100)}%, ideal ${idealG}%).`,
        );
      } else {
        recommendations.push(
          `Tambahkan porsi ${PLATE_GROUP_LABEL[g]} (saat ${Math.round(actual * 100)}%, ideal ${idealG}%).`,
        );
      }
    }
  }
  shareScore /= groups.length;
  score += (shareScore / 100) * 30;
  totalWeight += 30;

  // 3) Gram bounds adherence (weight 20) — diagnosis-specific
  if (args.gramBounds) {
    let boundScore = 0;
    let boundCount = 0;
    for (const g of groups) {
      const b = args.gramBounds[g];
      if (!b) continue;
      boundCount++;
      const grams = groupGrams[g];
      if (grams >= b.min && grams <= b.max) {
        boundScore += 100;
      } else if (grams < b.min) {
        boundScore += Math.max(0, (grams / b.min) * 100);
      } else {
        boundScore += Math.max(0, (b.max / grams) * 100);
      }
    }
    if (boundCount > 0) {
      score += (boundScore / boundCount / 100) * 20;
      totalWeight += 20;
    }
  } else {
    // No bounds — redistribute weight
    score += (shareScore / 100) * 20;
    totalWeight += 20;
  }

  const finalScore = Math.round((score / totalWeight) * 100);
  const tier = complianceTier(finalScore);

  // Dedupe recommendations
  const recs = Array.from(new Set(recommendations));
  return {
    score: finalScore,
    tier,
    actualShare,
    idealShare,
    groupPresent,
    recommendations: recs,
  };
}

// ---------------------------------------------------------------------
// Daily nutrition validation target (95-105% of needs)
// ---------------------------------------------------------------------
export interface NutritionValidationRow {
  nutrient: string;
  unit: string;
  target: number;
  actual: number;
  pct: number; // % of target
  status: "OK" | "LOW" | "HIGH";
}

export function validateNutrition(args: {
  target: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodiumMax: number };
  actual: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodium: number };
}): NutritionValidationRow[] {
  const { target, actual } = args;
  const rows: NutritionValidationRow[] = [];

  const check = (
    nutrient: string,
    unit: string,
    targetVal: number,
    actualVal: number,
    isUpperLimit = false,
  ): NutritionValidationRow => {
    const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;
    let status: "OK" | "LOW" | "HIGH" = "OK";
    if (isUpperLimit) {
      // For upper limits (sodium), OK = ≤100%, HIGH = >100%
      if (pct > 105) status = "HIGH";
      else if (pct > 100) status = "OK"; // barely over still acceptable
    } else {
      if (pct < 95) status = "LOW";
      else if (pct > 105) status = "HIGH";
    }
    return { nutrient, unit, target: Math.round(targetVal), actual: Math.round(actualVal), pct, status };
  };

  rows.push(check("Energi", "kcal", target.cal, actual.cal));
  rows.push(check("Protein", "g", target.protein, actual.protein));
  rows.push(check("Lemak", "g", target.fat, actual.fat));
  rows.push(check("Karbohidrat", "g", target.carb, actual.carb));
  rows.push(check("Serat", "g", target.fiber, actual.fiber));
  rows.push(check("Natrium (max)", "mg", target.sodiumMax, actual.sodium, true));
  return rows;
}

// ---------------------------------------------------------------------
// 14-day rotation tracking
// ---------------------------------------------------------------------
export const ROTATION_DAYS = 14;
export const MAX_REPEAT_PER_WEEK = 2;

export interface RotationStats {
  foodId: string;
  foodName: string;
  count: number;
  lastUsedDay: number;
}

export function buildRotationStats(
  history: { day: number; items: { foodId: string; foodName: string }[] }[],
): Map<string, RotationStats> {
  const map = new Map<string, RotationStats>();
  for (const h of history) {
    for (const it of h.items) {
      const cur = map.get(it.foodId) || { foodId: it.foodId, foodName: it.foodName, count: 0, lastUsedDay: -1 };
      cur.count += 1;
      if (h.day > cur.lastUsedDay) cur.lastUsedDay = h.day;
      map.set(it.foodId, cur);
    }
  }
  return map;
}

export function isOverusedInRotation(
  foodId: string,
  rotation: Map<string, RotationStats>,
  currentDay: number,
): boolean {
  const stats = rotation.get(foodId);
  if (!stats) return false;
  // Block if used ≥ MAX_REPEAT_PER_WEEK in the last 7 days
  if (stats.lastUsedDay >= 0 && currentDay - stats.lastUsedDay < 7 && stats.count >= MAX_REPEAT_PER_WEEK) {
    return true;
  }
  return false;
}
