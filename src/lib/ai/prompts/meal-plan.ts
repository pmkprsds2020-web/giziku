export const MEAL_PLAN_SYSTEM_PROMPT = `Anda adalah ahli gizi klinis CareLivia yang berpengalaman dalam Pedoman Gizi Seimbang Kemenkes RI ("Isi Piringku") dan tata laksana gizi klinis (PERKENI, KDIGO, DASH, ESPEN).

Tugas Anda HANYA memberikan lapisan narasi klinis di atas rencana makan yang sudah dihitung secara presisi matematis (gram, kalori, makronutrien sudah dioptimasi oleh sistem — jangan hitung ulang atau ubah angka tersebut).

Anda WAJIB merespons HANYA dengan JSON valid sesuai schema berikut, tanpa teks tambahan, tanpa markdown code fence:

{
  "reasoning": string (evaluasi singkat maks 150 kata, Bahasa Indonesia, apakah rencana sudah sesuai Isi Piringku & target gizi),
  "clinical_notes": string[] (catatan klinis penting terkait diagnosis pasien),
  "alternatives": [{ "originalFood": string, "alternativeFood": string, "reason": string }] (opsional, alternatif bahan makanan jika relevan),
  "warnings": string[] (peringatan jika ada risiko klinis, interaksi obat-makanan, atau ketidaksesuaian),
  "compliance_commentary": string (komentar singkat tentang skor kepatuhan Isi Piringku)
}`;

export function buildMealPlanUserPrompt(input: {
  patientName: string;
  diagnoses: string[];
  clinicalNotes: string;
  targetCal: number;
  targetProtein: number;
  targetFat: number;
  targetCarb: number;
  targetFiber: number;
  targetSodium: number;
  totals: { cal: number; protein: number; fat: number; carb: number; fiber: number; sodium: number };
  mealSummary: string;
  overallCompliance: number;
  overallTierLabel: string;
  validationSummary: string;
}): string {
  return `Pasien: ${input.patientName}
Diagnosis: ${input.diagnoses.join(", ") || "Umum"}
Panduan klinis: ${input.clinicalNotes}

Target: ${input.targetCal} kcal, Protein ${input.targetProtein}g, Lemak ${input.targetFat}g, Karbohidrat ${input.targetCarb}g, Serat ${input.targetFiber}g, Natrium maks ${input.targetSodium}mg

Rencana makan (total ${input.totals.cal} kcal, P ${input.totals.protein}g, L ${input.totals.fat}g, K ${input.totals.carb}g, Serat ${input.totals.fiber}g, Natrium ${input.totals.sodium}mg):
${input.mealSummary}

Compliance Isi Piringku: ${input.overallCompliance}% (${input.overallTierLabel})
Validasi nutrisi: ${input.validationSummary}

Berikan evaluasi sesuai schema JSON yang ditentukan.`;
}
