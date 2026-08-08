// =====================================================================
// CareLivia — Assessment → Meal Plan / Exercise Plan Auto-Sync
//
// Pure, framework-free rules (no I/O, no DB) — safe to import from both
// server API routes and client components. Encodes the "auto-sync"
// requirement from the Asesmen Gizi & Fungsional master prompt: results
// already captured in the assessment (MNA, SGA, MUST, FRAIL, CFS,
// SARC-F/SARC-CalF, Morse Fall Scale, TUG, ECOG, Barthel) must
// automatically shape downstream nutrition & exercise prescriptions
// WITHOUT the clinician re-entering anything.
//
// Design principle (mirrors the existing DIAGNOSIS_ADJUSTMENTS engine in
// clinical/constants.ts): only STRUCTURED, already-scored clinical data
// drives numeric targets deterministically. Free-text/AI narrative never
// changes a number — it only explains one. See meal-plan-route.ts.
// =====================================================================

export interface AssessmentLike {
  must?: string | null;
  sga?: string | null;
  mna?: string | null;
  frailty?: string | null;
  cfs?: number | null;
  sarcfPositive?: boolean | null;
  sarcCalfPositive?: boolean | null;
  fallRisk?: string | null;
  morseScore?: number | null;
  tugCategory?: string | null;
  ecog?: string | null;
  barthel?: number | null;
  handGrip?: number | null;
}

// Diagnosis types where protein is deliberately RESTRICTED by the clinical
// guideline engine (KDIGO for CKD, hepatic protocols for LIVER). When any
// of these are active, we never silently raise protein from assessment
// data alone — sarcopenia/frailty vs. renal/hepatic protein restriction is
// a genuine clinical trade-off that needs a physician's judgment call, so
// we surface it as an advisory flag instead of changing the number.
const PROTEIN_RESTRICTED_DIAGNOSES = new Set([
  "CKD", "CKD_ND", "CKD_HD", "CKD_PD", "LIVER",
]);

export interface ProteinAdjustment {
  /** [low, high] g/kgBB, or null if no assessment-driven boost applies */
  perKgRange: [number, number] | null;
  /** Human-readable clinical rationale, shown to the clinician */
  flags: string[];
  /** True when a protein-restricting diagnosis is active — number is NOT auto-changed even if perKgRange is set */
  restrictedByDiagnosis: boolean;
}

// ESPEN / PROT-AGE / EWGSOP2 geriatric guidance: malnutrition, probable
// sarcopenia, or frailty raises protein requirement to 1.2–1.5 g/kgBB
// (vs. ~0.8–1.0 g/kgBB general healthy adult baseline already used by
// the calorie engine).
export function computeProteinAdjustment(
  a: AssessmentLike,
  activeDiagnosisTypes: string[] = [],
): ProteinAdjustment {
  const flags: string[] = [];
  let low = 0;
  let high = 0;
  let any = false;

  const malnourished = a.mna === "MALNOURISHED" || a.sga === "C" || a.must === "HIGH";
  const atRiskMalnutrition = a.mna === "AT_RISK" || a.sga === "B" || a.must === "MEDIUM";
  const sarcopenic = !!a.sarcfPositive || !!a.sarcCalfPositive;
  const frail = a.frailty === "FRAIL" || (a.cfs != null && a.cfs >= 5);

  if (malnourished) {
    low = Math.max(low, 1.2);
    high = Math.max(high, 1.5);
    any = true;
    flags.push("Malnutrisi terdeteksi (MNA/SGA/MUST) — protein dinaikkan ke 1.2–1.5 g/kgBB sesuai ESPEN/ASPEN.");
  } else if (atRiskMalnutrition) {
    low = Math.max(low, 1.0);
    high = Math.max(high, 1.2);
    any = true;
    flags.push("Berisiko malnutrisi (MNA/SGA/MUST) — protein dijaga di 1.0–1.2 g/kgBB.");
  }
  if (sarcopenic) {
    low = Math.max(low, 1.2);
    high = Math.max(high, 1.5);
    any = true;
    flags.push("Probable sarcopenia (SARC-F/SARC-CalF positif) — protein dinaikkan ke 1.2–1.5 g/kgBB sesuai PROT-AGE/EWGSOP2.");
  }
  if (frail) {
    low = Math.max(low, 1.2);
    high = Math.max(high, 1.5);
    any = true;
    flags.push("Frailty terdeteksi (FRAIL/CFS ≥5) — protein dinaikkan ke 1.2–1.5 g/kgBB untuk mendukung massa & fungsi otot.");
  }

  const restrictedByDiagnosis = activeDiagnosisTypes.some((d) => PROTEIN_RESTRICTED_DIAGNOSES.has(d));
  if (restrictedByDiagnosis && any) {
    flags.push(
      "PERHATIAN: pasien juga memiliki diagnosis dengan pembatasan protein (CKD/LIVER). Target protein TIDAK dinaikkan otomatis — perlu keputusan klinis individual untuk menyeimbangkan kebutuhan anti-sarkopenia vs. pembatasan ginjal/hati.",
    );
  }

  if (!any) return { perKgRange: null, flags: [], restrictedByDiagnosis: false };
  return { perKgRange: [low, high], flags, restrictedByDiagnosis };
}

export interface ExerciseGuidance {
  priority: "RESISTANCE" | "BALANCE" | "NORMAL";
  fallPrecaution: boolean;
  /** Appended verbatim to the free-text mobilityNotes sent to the AI exercise-plan generator */
  notes: string[];
}

export function computeExerciseGuidance(a: AssessmentLike): ExerciseGuidance {
  const notes: string[] = [];
  let priority: ExerciseGuidance["priority"] = "NORMAL";
  let fallPrecaution = false;

  const frail = a.frailty === "FRAIL" || (a.cfs != null && a.cfs >= 5);
  const sarcopenic = !!a.sarcfPositive || !!a.sarcCalfPositive;
  if (frail || sarcopenic) {
    priority = "RESISTANCE";
    notes.push("Frailty/sarcopenia terdeteksi — prioritaskan latihan resistance (kekuatan otot) progresif intensitas ringan-sedang.");
  }

  const highFallRisk =
    a.fallRisk === "HIGH" ||
    (a.morseScore != null && a.morseScore >= 45) ||
    a.tugCategory === ">=30";
  if (highFallRisk) {
    fallPrecaution = true;
    if (priority === "NORMAL") priority = "BALANCE";
    notes.push(
      "Risiko jatuh tinggi (Morse Fall Scale/TUG) — tambahkan latihan keseimbangan, awasi langsung, hindari latihan berdiri bebas tanpa pegangan.",
    );
  }

  if (a.ecog === "3" || a.ecog === "4" || (a.barthel != null && a.barthel < 40)) {
    notes.push(
      "Keterbatasan fungsional berat (ECOG/Barthel) — batasi pada latihan rentang gerak (ROM) pasif/aktif-dibantu di tempat tidur/kursi, hindari latihan berdiri mandiri.",
    );
  }

  return { priority, fallPrecaution, notes };
}

// Composes the free-text "mobilityNotes" field consumed by
// /api/ai/exercise-plan — this is the single integration point that lets
// FRAIL/CFS/SARC-F/Morse/TUG automatically reach the exercise AI without
// changing that route's request schema.
export function buildMobilityNotes(a: AssessmentLike, extra?: string): string {
  const parts: string[] = [];
  if (a.ecog != null) parts.push(`ECOG ${a.ecog}`);
  if (a.barthel != null) parts.push(`Barthel ${a.barthel}`);
  if (a.frailty) parts.push(`Frailty (FRAIL): ${a.frailty}`);
  if (a.cfs != null) parts.push(`Clinical Frailty Scale: ${a.cfs}`);
  if (a.fallRisk) parts.push(`Risiko jatuh (Morse): ${a.fallRisk}${a.morseScore != null ? ` (skor ${a.morseScore})` : ""}`);
  if (a.tugCategory) parts.push(`TUG: ${a.tugCategory} detik`);
  if (a.sarcfPositive) parts.push("SARC-F positif (probable sarcopenia)");
  if (a.sarcCalfPositive) parts.push("SARC-CalF positif (probable sarcopenia)");
  if (a.handGrip != null) parts.push(`Hand grip ${a.handGrip}kg`);

  const guidance = computeExerciseGuidance(a);
  parts.push(...guidance.notes);
  if (extra) parts.push(extra);
  return parts.join(", ");
}

// ---------------------------------------------------------------------
// Lab-driven advisory flags — deterministic, NARRATIVE ONLY (never
// changes a numeric target by itself; mirrors the existing lab-summary
// design already used in meal-plan-route.ts for AI reasoning).
// ---------------------------------------------------------------------
export interface LabLike {
  testName: string;
  value: number;
  status?: string;
}

export function computeAlbuminFlag(labResults: LabLike[]): string | null {
  const albumin = labResults.find((l) => /albumin/i.test(l.testName));
  if (!albumin || typeof albumin.value !== "number") return null;
  if (albumin.value < 2.8) {
    return `Albumin rendah (${albumin.value} g/dL) — indikasi malnutrisi protein berat, pertimbangkan protein hingga 1.5 g/kgBB dan evaluasi lebih lanjut.`;
  }
  if (albumin.value < 3.5) {
    return `Albumin borderline rendah (${albumin.value} g/dL) — pantau status protein pada kunjungan berikutnya.`;
  }
  return null;
}
