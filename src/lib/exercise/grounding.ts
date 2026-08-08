// =====================================================================
// CareLivia — Exercise Plan Grounding
//
// Formats rows from the `exercise_programs` reference library (see
// supabase/migrations/021_exercise_plan_library.sql /
// 022_exercise_plan_library_seed.sql) into a compact text block that is
// injected into the AI exercise-plan system prompt, so the model's
// output stays anchored to evidence-based FITT parameters, red flags,
// and contraindications instead of free-generating from scratch.
// =====================================================================

export interface ExerciseProgramRow {
  id: string;
  diagnosis_code: string;
  diagnosis_name_id: string;
  program_name: string;
  difficulty_level: string;
  goals: Array<{ id: string; label_id: string }>;
  fitt: {
    frequency?: string;
    intensity?: { method?: string; target?: string; notes?: string };
    time?: string;
    type?: string[];
  };
  modifications: Record<string, string>;
  red_flags: string[];
  contraindications: { absolute?: string[]; relative?: string[] };
  monitoring_targets: Array<{ metric: string; direction: string; target: string; timeframe?: string }>;
  patient_education?: string | null;
  evidence_references: string[];
}

/**
 * Builds a Bahasa Indonesia grounding block from up to `programs.length`
 * matched library entries. Returns an empty string if there is nothing to
 * ground on — callers should fall back to the base prompt in that case.
 */
export function buildExerciseGroundingBlock(programs: ExerciseProgramRow[]): string {
  if (!programs.length) return "";

  const sections = programs.map((p) => {
    const goals = (p.goals || []).map((g) => g.label_id).join("; ") || "-";
    const fittType = (p.fitt?.type || []).join(", ") || "-";
    const intensity = p.fitt?.intensity
      ? `${p.fitt.intensity.method ?? ""} ${p.fitt.intensity.target ?? ""} (${p.fitt.intensity.notes ?? ""})`
      : "-";
    const mods = Object.entries(p.modifications || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ") || "-";
    const absolute = (p.contraindications?.absolute || []).join("; ") || "-";
    const relative = (p.contraindications?.relative || []).join("; ") || "-";
    const monitoring = (p.monitoring_targets || [])
      .map((m) => `${m.metric} ${m.direction === "decrease" ? "↓" : m.direction === "increase" ? "↑" : "="} ${m.target}`)
      .join("; ") || "-";
    const redFlags = (p.red_flags || []).join("; ") || "-";
    const refs = (p.evidence_references || []).join(", ") || "-";

    return [
      `### Referensi: ${p.program_name} (${p.diagnosis_name_id}, level ${p.difficulty_level})`,
      `- Tujuan: ${goals}`,
      `- Frekuensi: ${p.fitt?.frequency ?? "-"} | Durasi: ${p.fitt?.time ?? "-"} | Intensitas: ${intensity}`,
      `- Jenis latihan dianjurkan: ${fittType}`,
      `- Modifikasi per komorbiditas: ${mods}`,
      `- Kontraindikasi absolut: ${absolute}`,
      `- Kontraindikasi relatif: ${relative}`,
      `- Red flags (hentikan latihan bila muncul): ${redFlags}`,
      `- Target monitoring: ${monitoring}`,
      `- Evidence: ${refs}`,
    ].join("\n");
  });

  return [
    "",
    "=== DATA RUJUKAN DARI EXERCISE PROGRAM LIBRARY CARELIVIA (evidence-based, WAJIB dijadikan acuan) ===",
    "Gunakan data di bawah ini sebagai batas aman dan sumber utama saat menyusun rencana latihan.",
    "Sertakan poin-poin kontraindikasi dan red flags yang relevan ke dalam field `contraindications` pada output.",
    "Sesuaikan (jangan hanya menyalin) durasi/intensitas dengan kondisi spesifik pasien di atas.",
    ...sections,
    "=== AKHIR DATA RUJUKAN ===",
    "",
  ].join("\n");
}

/** Extracts the program ids used, for traceability on the persisted exercise_plans row. */
export function extractProgramIds(programs: ExerciseProgramRow[]): string[] {
  return programs.map((p) => p.id);
}
