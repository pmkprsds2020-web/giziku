// =====================================================================
// CareLivia — Nutrigenomic-Driven Food Selection Rules
//
// Same design as lib/clinical/lab-food-rules.ts: an INDEPENDENT layer of
// forbidden/recommended keyword maps, this time keyed off a patient's
// genomic findings (gene + genotype) instead of lab values. This module
// NEVER touches DIAGNOSIS_PLATE_MODIFIER or the core selection
// algorithm's control flow — it only produces modifiers that get merged
// alongside the diagnosis- and lab-based ones (see lib/ai/meal-generator.ts,
// mergePlateModifiers()). Passing no genomic data behaves identically to
// the pre-nutrigenomic engine.
//
// The rule set here intentionally covers only genotypes with a
// reasonably well-established nutrition implication per the Nutrigenomic
// AI module spec (FTO, MTHFR, APOE, LCT, CYP1A2, BCMO1, TCF7L2, FADS1/2,
// HFE). It is a food-selection nudge, not a diagnosis — findings with
// weaker/associative evidence are still shown in the clinical report but
// deliberately excluded here from changing what food gets selected.
// =====================================================================

import type { PlateGroup } from "./isi-piringku";
import type { LabPlateModifiers } from "./lab-food-rules";

export interface GenomicFindingLike {
  geneSymbol: string;
  genotype?: string | null;
  /** Free-text risk/phenotype call the AI extracted/interpreted for this
   * finding (e.g. "RISIKO", "VARIAN_RISIKO", "INTOLERAN", "SLOW",
   * "NON_PERSISTEN") — rules match on a case-insensitive substring so the
   * exact vocabulary used by different lab providers doesn't need to be
   * normalized upstream. */
  callTag?: string | null;
}

interface GenomicFoodRule {
  gene: string;
  /** Matches if genotype OR callTag contains any of these (case-insensitive). */
  matchAny: string[];
  forbiddenInGroup?: Partial<Record<PlateGroup, string[]>>;
  recommendedInGroup?: Partial<Record<PlateGroup, string[]>>;
  reason: string;
}

const GENOMIC_FOOD_RULES: GenomicFoodRule[] = [
  {
    gene: "FTO",
    matchAny: ["risiko", "risk", "aa", "varian"],
    forbiddenInGroup: { STAPLE: ["gula", "putih", "manis"] },
    recommendedInGroup: { PROTEIN: ["ikan", "ayam dada", "tahu", "tempe", "telur"] },
    reason: "Varian FTO risiko — porsi protein diprioritaskan dan karbohidrat sederhana dikurangi (kontrol energi & rasa kenyang).",
  },
  {
    gene: "MTHFR",
    matchAny: ["risiko", "risk", "tt", "menurun", "varian"],
    recommendedInGroup: {
      VEGETABLE: ["bayam", "brokoli", "asparagus", "kacang panjang"],
      PROTEIN: ["kacang", "edamame", "kedelai"],
    },
    reason: "Aktivitas MTHFR menurun — sumber folat alami (sayuran hijau, kacang-kacangan) diprioritaskan.",
  },
  {
    gene: "APOE",
    matchAny: ["e4", "ε4", "risiko", "risk"],
    forbiddenInGroup: {
      PROTEIN: ["santan", "mentega", "daging berlemak", "jeroan", "kulit"],
    },
    recommendedInGroup: {
      PROTEIN: ["ikan", "salmon"],
      OTHER: ["minyak zaitun", "alpukat"],
    },
    reason: "Alel APOE ε4 — lemak jenuh dibatasi, MUFA/PUFA (ikan, minyak zaitun, alpukat) diprioritaskan.",
  },
  {
    gene: "LCT",
    matchAny: ["non_persisten", "non-persisten", "intoleran", "intolerant", "gg"],
    forbiddenInGroup: { PROTEIN: ["susu sapi", "susu full cream"] },
    recommendedInGroup: { PROTEIN: ["susu lactose free", "susu kedelai", "yogurt"] },
    reason: "Genotipe LCT non-persisten (potensi intoleransi laktosa) — susu biasa diganti lactose-free/susu kedelai.",
  },
  {
    gene: "CYP1A2",
    matchAny: ["slow", "lambat", "ac", "cc"],
    forbiddenInGroup: { OTHER: ["kopi", "kafein"] },
    reason: "CYP1A2 metabolisme lambat — konsumsi kafein/kopi dibatasi (risiko kardiovaskular pada asupan berlebih).",
  },
  {
    gene: "BCMO1",
    matchAny: ["risiko", "risk", "menurun", "varian"],
    recommendedInGroup: {
      PROTEIN: ["hati", "telur", "ikan"],
      OTHER: ["vitamin a preformed"],
    },
    reason: "Konversi beta-karoten ke vitamin A menurun — sumber vitamin A preformed (bukan hanya provitamin dari sayur/buah) diprioritaskan.",
  },
  {
    gene: "TCF7L2",
    matchAny: ["risiko", "risk", "varian"],
    forbiddenInGroup: { STAPLE: ["putih", "gula", "instan"] },
    recommendedInGroup: { STAPLE: ["gandum", "oat", "merah"] },
    reason: "Varian TCF7L2 risiko diabetes tipe 2 — kontrol karbohidrat indeks glikemik rendah diperketat.",
  },
  {
    gene: "FADS1",
    matchAny: ["risiko", "risk", "rendah", "varian"],
    recommendedInGroup: { PROTEIN: ["ikan berlemak", "salmon", "sarden", "makarel"] },
    reason: "Efisiensi konversi ALA ke EPA/DHA rendah — omega-3 rantai panjang dari ikan diprioritaskan langsung (bukan hanya sumber nabati).",
  },
  {
    gene: "HFE",
    matchAny: ["risiko", "risk", "varian", "c282y"],
    forbiddenInGroup: { OTHER: ["suplemen zat besi"] },
    reason: "Varian HFE (potensi peningkatan penyerapan zat besi) — suplementasi zat besi bebas perlu kehati-hatian dan pengawasan klinis.",
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

/** Resolve combined genomic-driven food modifiers, in the exact same
 * shape as LabPlateModifiers so callers can merge the two with a single
 * mergePlateModifiers() (see meal-generator.ts). */
export function resolveGenomicFoodModifiers(
  findings: GenomicFindingLike[] | undefined | null,
): LabPlateModifiers {
  const result: LabPlateModifiers = { forbiddenInGroup: {}, recommendedInGroup: {}, activeReasons: [] };
  if (!findings || findings.length === 0) return result;

  for (const rule of GENOMIC_FOOD_RULES) {
    const finding = findings.find((f) => f.geneSymbol?.toUpperCase() === rule.gene);
    if (!finding) continue;
    const haystack = `${finding.genotype ?? ""} ${finding.callTag ?? ""}`.toLowerCase();
    if (!rule.matchAny.some((kw) => haystack.includes(kw.toLowerCase()))) continue;

    mergeKeywordMaps(result.forbiddenInGroup, rule.forbiddenInGroup);
    mergeKeywordMaps(result.recommendedInGroup, rule.recommendedInGroup);
    result.activeReasons.push(rule.reason);
  }

  return result;
}

/** Merge two LabPlateModifiers-shaped objects (lab-driven + genomic-driven)
 * into one combined object, so the rest of the meal-generator pipeline
 * (isForbiddenByLab / isRecommendedByLab) never needs to know there are
 * two independent sources feeding it. */
export function mergePlateModifiers(a: LabPlateModifiers, b: LabPlateModifiers): LabPlateModifiers {
  const merged: LabPlateModifiers = { forbiddenInGroup: {}, recommendedInGroup: {}, activeReasons: [] };
  mergeKeywordMaps(merged.forbiddenInGroup, a.forbiddenInGroup);
  mergeKeywordMaps(merged.forbiddenInGroup, b.forbiddenInGroup);
  mergeKeywordMaps(merged.recommendedInGroup, a.recommendedInGroup);
  mergeKeywordMaps(merged.recommendedInGroup, b.recommendedInGroup);
  merged.activeReasons = [...a.activeReasons, ...b.activeReasons];
  return merged;
}
