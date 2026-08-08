// =====================================================================
// CareLivia — Rule-Based Fallback for Clinical Assessment (AI Evaluation)
//
// Purpose: whenever the AI Engine cannot be reached (missing API key,
// timeout, provider outage, rate limit, or repeated schema-validation
// failure), the clinician must NEVER see an empty page or a bare 503.
// This module deterministically derives the same 14-card CDSS shape
// (ClinicalAssessmentOutput) directly from data already computed by
// CareLivia's own clinical engine (calorie-engine.ts, constants.ts,
// lab-catalog.ts) — no AI call involved.
//
// It intentionally covers the minimum set the product requires even
// offline: interpretasi energi/protein/lemak/karbohidrat/serat/natrium,
// kepatuhan meal plan, dan rekomendasi dasar — then goes further where
// the data allows (diagnosis-specific guidance, monitoring, red flags).
//
// This is a safety net, not a replacement for the full AI reasoning —
// every generated section says so explicitly so the clinician knows to
// re-run "Buat Evaluasi AI" once the AI Engine is back.
// =====================================================================

import type { ClinicalAssessmentOutput } from "./schemas/features";
import { DIAGNOSIS_ADJUSTMENTS, classifyBMI } from "@/lib/clinical/constants";
import { LAB_CATEGORY_LABELS, type LabCategory } from "@/lib/clinical/lab-catalog";
import { computeCalorieTarget } from "@/lib/clinical/calorie-engine";

// Lower number = higher clinical priority when multiple diagnoses are active.
const DX_PRIORITY: Record<string, number> = {
  CKD_HD: 1,
  CKD_PD: 1,
  CANCER: 2,
  CKD: 2,
  CKD_ND: 2,
  MALNUTRITION: 2,
  CHF: 3,
  STROKE: 3,
  SARCOPENIA: 3,
  POST_OP: 3,
  DM: 4,
  LIVER: 4,
  COPD: 4,
  HT: 5,
  DYSLIPIDEMIA: 6,
  OBESITY: 6,
  IBD: 6,
  GOUT: 6,
  GERD: 7,
  PUD: 7,
  PREGNANCY: 4,
  LACTATION: 5,
  PEDIATRIC: 5,
  GERIATRIC: 5,
  OTHER: 8,
};

const RED_FLAG_BY_DX: Record<string, string[]> = {
  CKD_HD: ["Sesak napas berat atau edema mendadak", "Produksi urin sangat berkurang", "Kadar kalium sangat tinggi (aritmia)"],
  CKD: ["Bengkak mendadak pada wajah/tungkai", "Sesak napas", "Mual muntah berat / tidak bisa makan sama sekali"],
  CKD_ND: ["Bengkak mendadak pada wajah/tungkai", "Sesak napas", "Produksi urin menurun drastis"],
  DM: ["Gula darah >300 mg/dL atau <70 mg/dL disertai gejala berat", "Napas berbau aseton, mual muntah hebat (curiga ketoasidosis)"],
  HT: ["Tekanan darah sangat tinggi disertai nyeri kepala hebat/pandangan kabur", "Nyeri dada"],
  CHF: ["Sesak napas mendadak memberat, terutama saat berbaring", "Bengkak tungkai bertambah cepat", "Berat badan naik >1-2 kg dalam 1-2 hari"],
  STROKE: ["Kelemahan/baal mendadak pada wajah/lengan/tungkai", "Bicara pelo mendadak", "Kesulitan menelan"],
  LIVER: ["Perut membesar mendadak (asites)", "Kulit/mata kuning bertambah", "Perubahan kesadaran/bingung"],
  COPD: ["Sesak napas memberat mendadak", "Bibir/kuku membiru"],
};

interface WeightStep {
  step: number;
  description: string;
}
interface CalorieResultLike {
  bmi: number;
  bmiLabel: string;
  ibw: number;
  adjustedWeight: number;
  targetCalorie: number;
  macros: { proteinG: number; fatG: number; carbG: number };
  fiberTarget: number;
  sodiumMax: number;
  potassiumMax?: number;
  phosphorusMax?: number;
  waterMl: number;
  warnings: string[];
  steps: WeightStep[];
}

export interface FallbackAssessmentContext {
  patient: { name: string; gender: string };
  age: number;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  ibw: number | null;
  activeDx: Array<{ type: string; classification?: string; status?: string; severity?: string; notes?: string; target?: string }>;
  latestAssessment: any | null;
  activeMealPlan: any | null;
  foodRecords: any[];
  exercisePlans: any[];
  labResults: any[];
  calorieResult: ReturnType<typeof computeCalorieTarget> | null;
}

function pct(actual: number | null | undefined, target: number | null | undefined): number | null {
  if (!actual || !target) return null;
  return Math.round((actual / target) * 100);
}

function dxLabel(type: string): string {
  return DIAGNOSIS_ADJUSTMENTS[type as keyof typeof DIAGNOSIS_ADJUSTMENTS]?.label || type;
}

export function buildFallbackClinicalAssessment(ctx: FallbackAssessmentContext): ClinicalAssessmentOutput {
  const { patient, age, height, weight, activeDx, latestAssessment, activeMealPlan, labResults, calorieResult } = ctx;

  const sortedDx = [...activeDx].sort(
    (a, b) => (DX_PRIORITY[a.type] ?? 9) - (DX_PRIORITY[b.type] ?? 9),
  );
  const primaryDx = sortedDx[0];
  const secondaryDx = sortedDx.slice(1);

  const bmi = calorieResult?.bmi ?? ctx.bmi ?? null;
  const bmiInfo = bmi ? classifyBMI(bmi) : null;

  // ---- 1. Ringkasan klinis -----------------------------------------
  const ringkasan_klinis = {
    diagnosis_utama: primaryDx ? dxLabel(primaryDx.type) : "Tidak ada diagnosis aktif tercatat",
    diagnosis_penyerta: secondaryDx.map((d) => dxLabel(d.type)),
    status_gizi: bmiInfo
      ? `${bmiInfo.label} (BMI ${bmi?.toFixed(1)})`
      : "Data antropometri belum lengkap untuk menentukan status gizi",
    target_kalori_kcal: calorieResult?.targetCalorie ?? 0,
    target_protein_g: calorieResult?.macros.proteinG ?? 0,
  };

  // ---- 2. Analisis antropometri --------------------------------------
  const weightStep = calorieResult?.steps.find((s) => s.step === 3);
  const analisis_antropometri = {
    metode_berat_badan: weightStep
      ? weightStep.description.split(":")[0] || "Berat Aktual"
      : "Belum dapat ditentukan (data tinggi/berat/usia tidak lengkap)",
    alasan: calorieResult
      ? `Berdasarkan perhitungan sistem CareLivia: ${weightStep?.description || "-"}. Berat yang dipakai untuk perhitungan kebutuhan gizi adalah ${calorieResult.adjustedWeight} kg dari berat badan ${weight ?? "-"} kg dan tinggi badan ${height ?? "-"} cm (BMI ${calorieResult.bmi}, kategori ${calorieResult.bmiLabel}). Evaluasi otomatis ini menggunakan nilai yang sama seperti telah dihitung sistem, tanpa perhitungan ulang.`
      : "Data tinggi badan, berat badan, atau usia pasien belum lengkap sehingga kebutuhan gizi otomatis tidak dapat dihitung. Lengkapi data antropometri pasien untuk mendapatkan target kalori dan makronutrien yang akurat.",
  };

  // ---- 3. Analisis diagnosis -----------------------------------------
  const analisis_diagnosis = sortedDx.map((d) => {
    const adj = DIAGNOSIS_ADJUSTMENTS[d.type as keyof typeof DIAGNOSIS_ADJUSTMENTS];
    return {
      diagnosis: dxLabel(d.type),
      dampak_intervensi: adj
        ? `${adj.notes} Protein dianjurkan ${adj.proteinPerKg[0]}-${adj.proteinPerKg[1]} g/kgBB, lemak ${adj.fatPct[0]}-${adj.fatPct[1]}% energi, karbohidrat ${adj.carbPct[0]}-${adj.carbPct[1]}% energi, serat ${adj.fiberTarget}g, natrium maksimal ${adj.sodiumMax}mg${adj.potassiumMax ? `, kalium maksimal ${adj.potassiumMax}mg` : ""}${adj.phosphorusMax ? `, fosfor maksimal ${adj.phosphorusMax}mg` : ""}.`
        : "Belum ada pedoman internal spesifik untuk diagnosis ini pada CareLivia — gunakan penilaian klinis individual.",
    };
  });

  // ---- Meal plan compliance (used in several sections below) ---------
  const calPct = activeMealPlan ? pct(activeMealPlan.totalCal, activeMealPlan.targetCal) : null;
  const proteinPct = activeMealPlan ? pct(activeMealPlan.totalProtein, activeMealPlan.targetProtein) : null;
  const sodiumPct = activeMealPlan ? pct(activeMealPlan.totalSodium, activeMealPlan.targetSodium) : null;

  // ---- Lab abnormalities (latest per test) ----------------------------
  const latestByTest = new Map<string, any>();
  for (const r of labResults || []) {
    if (!latestByTest.has(r.testName)) latestByTest.set(r.testName, r);
  }
  const abnormalLabs = [...latestByTest.values()].filter((r) => r.status && r.status !== "NORMAL");

  // ---- 4. Temuan penting (min 3, forced by schema) --------------------
  const temuan_penting: string[] = [];
  if (bmiInfo) {
    temuan_penting.push(`Status gizi berdasarkan BMI: ${bmiInfo.label} (BMI ${bmi?.toFixed(1)}).`);
  } else {
    temuan_penting.push("Data antropometri (tinggi/berat badan) belum lengkap sehingga status gizi berbasis BMI belum dapat ditentukan.");
  }
  if (sortedDx.length > 0) {
    temuan_penting.push(`Terdapat ${sortedDx.length} diagnosis aktif: ${sortedDx.map((d) => dxLabel(d.type)).join(", ")}.`);
  } else {
    temuan_penting.push("Belum ada diagnosis aktif tercatat pada rekam pasien.");
  }
  if (latestAssessment) {
    const scoreParts: string[] = [];
    if (latestAssessment.must) scoreParts.push(`MUST: ${latestAssessment.must}`);
    if (latestAssessment.nrs2002) scoreParts.push(`NRS-2002: ${latestAssessment.nrs2002}`);
    if (latestAssessment.sga) scoreParts.push(`SGA: ${latestAssessment.sga}`);
    if (latestAssessment.mna) scoreParts.push(`MNA: ${latestAssessment.mna}`);
    if (scoreParts.length) temuan_penting.push(`Skrining gizi terkini menunjukkan ${scoreParts.join(", ")}.`);
  } else {
    temuan_penting.push("Belum ada skrining gizi (MUST/NRS-2002/SGA/MNA) tercatat — disarankan dilakukan skrining untuk menilai risiko malnutrisi lebih akurat.");
  }
  if (activeMealPlan) {
    temuan_penting.push(
      `Kepatuhan meal plan aktif: energi tercapai ${calPct ?? "-"}%, protein ${proteinPct ?? "-"}%, natrium ${sodiumPct ?? "-"}% dari target.`,
    );
  } else {
    temuan_penting.push("Belum ada meal plan aktif tersusun untuk pasien ini.");
  }
  if (abnormalLabs.length > 0) {
    temuan_penting.push(
      `Ditemukan ${abnormalLabs.length} parameter laboratorium di luar rentang normal: ${abnormalLabs.slice(0, 5).map((r) => `${r.testName} (${r.status})`).join(", ")}.`,
    );
  } else if (labResults.length === 0) {
    temuan_penting.push("Belum ada hasil laboratorium tercatat — sebagian penilaian klinis (status glikemik, fungsi ginjal, profil lipid) tidak dapat dikonfirmasi tanpa data lab.");
  }
  temuan_penting.push(
    "Evaluasi ini dihasilkan otomatis oleh mesin aturan klinis CareLivia (rule-based fallback) karena AI Engine sedang tidak dapat diakses — analisis naratif yang lebih mendalam akan tersedia begitu AI Engine kembali normal; klik \"Perbarui Evaluasi\" untuk mencoba lagi.",
  );

  // ---- 5. Prioritas intervensi ----------------------------------------
  const prioritas_intervensi = sortedDx.map((d, i) => ({
    rank: i + 1,
    masalah: `Tata laksana nutrisi untuk ${dxLabel(d.type)}`,
    urgensi: (i === 0 ? "TINGGI" : i === 1 ? "SEDANG" : "RENDAH") as "RENDAH" | "SEDANG" | "TINGGI",
    alasan_klinis:
      DIAGNOSIS_ADJUSTMENTS[d.type as keyof typeof DIAGNOSIS_ADJUSTMENTS]?.notes ||
      "Diprioritaskan berdasarkan urutan klinis umum untuk kombinasi diagnosis pasien.",
  }));
  if (calPct !== null && calPct < 80) {
    prioritas_intervensi.push({
      rank: prioritas_intervensi.length + 1,
      masalah: "Defisit asupan energi terhadap target meal plan",
      urgensi: calPct < 60 ? "TINGGI" : "SEDANG",
      alasan_klinis: `Asupan energi baru tercapai ${calPct}% dari target — risiko kehilangan massa otot dan perburukan status gizi bila dibiarkan.`,
    });
  }

  // ---- 6. Rekomendasi nutrisi ------------------------------------------
  const rekomendasi_nutrisi: ClinicalAssessmentOutput["rekomendasi_nutrisi"] = [];
  for (const d of sortedDx) {
    const adj = DIAGNOSIS_ADJUSTMENTS[d.type as keyof typeof DIAGNOSIS_ADJUSTMENTS];
    if (!adj) continue;
    const proteinLow = weight ? (weight * adj.proteinPerKg[0]).toFixed(0) : "-";
    const proteinHigh = weight ? (weight * adj.proteinPerKg[1]).toFixed(0) : "-";
    rekomendasi_nutrisi.push({
      area: `Protein — ${dxLabel(d.type)}`,
      rekomendasi: `Target protein ${proteinLow}-${proteinHigh} g/hari (${adj.proteinPerKg[0]}-${adj.proteinPerKg[1]} g/kgBB).`,
      alasan_klinis: adj.notes,
      guideline_based: true,
    });
    rekomendasi_nutrisi.push({
      area: `Natrium — ${dxLabel(d.type)}`,
      rekomendasi: `Batasi natrium maksimal ${adj.sodiumMax} mg/hari.`,
      alasan_klinis: `Sesuai pedoman internal CareLivia untuk ${dxLabel(d.type)}.`,
      guideline_based: true,
    });
  }
  if (calorieResult) {
    rekomendasi_nutrisi.push({
      area: "Serat",
      rekomendasi: `Target serat ${calorieResult.fiberTarget} g/hari dari sayur, buah, dan biji-bijian utuh.`,
      alasan_klinis: "Serat membantu kontrol glikemik, profil lipid, dan fungsi pencernaan sesuai diagnosis aktif.",
      guideline_based: true,
    });
  }
  if (calPct !== null && calPct < 90) {
    rekomendasi_nutrisi.push({
      area: "Kepatuhan Asupan",
      rekomendasi: "Tingkatkan frekuensi makan/snack bergizi untuk mendekati target energi meal plan.",
      alasan_klinis: `Realisasi asupan energi baru ${calPct}% dari target, berisiko defisit energi kumulatif.`,
      guideline_based: false,
    });
  }

  // ---- 7. Alasan pemilihan menu -----------------------------------------
  const alasan_pemilihan_menu: ClinicalAssessmentOutput["alasan_pemilihan_menu"] = [];
  if (activeMealPlan?.items?.length) {
    const bySlot = new Map<string, any[]>();
    for (const it of activeMealPlan.items) {
      if (!bySlot.has(it.slot)) bySlot.set(it.slot, []);
      bySlot.get(it.slot)!.push(it);
    }
    for (const [slot, items] of bySlot) {
      alasan_pemilihan_menu.push({
        kelompok: slot,
        item: items.map((it: any) => it.food?.name || "?").join(", "),
        alasan: "Item ini merupakan bagian dari meal plan aktif yang telah disusun sebelumnya sesuai target energi dan makronutrien pasien.",
      });
    }
  }

  // ---- 8. Makanan dianjurkan / dibatasi ----------------------------------
  const recommendedMap = new Map<string, string>();
  const forbiddenMap = new Map<string, string>();
  for (const d of sortedDx) {
    const adj = DIAGNOSIS_ADJUSTMENTS[d.type as keyof typeof DIAGNOSIS_ADJUSTMENTS];
    if (!adj) continue;
    for (const item of adj.recommended) {
      if (!recommendedMap.has(item)) recommendedMap.set(item, `Baik untuk kondisi ${dxLabel(d.type)}.`);
    }
    for (const item of adj.forbidden) {
      if (!forbiddenMap.has(item)) forbiddenMap.set(item, `Perlu dibatasi/dihindari karena kondisi ${dxLabel(d.type)}.`);
    }
  }
  const makanan_dianjurkan = [...recommendedMap.entries()].map(([item, alasan]) => ({ item, alasan }));
  const makanan_dibatasi = [...forbiddenMap.entries()].map(([item, alasan]) => ({ item, alasan }));
  if (makanan_dianjurkan.length === 0) {
    makanan_dianjurkan.push({ item: "Sayur dan buah beragam warna", alasan: "Sumber serat, vitamin, dan mineral untuk gizi seimbang." });
  }
  if (makanan_dibatasi.length === 0) {
    makanan_dibatasi.push({ item: "Makanan tinggi gula dan garam olahan", alasan: "Prinsip gizi seimbang umum untuk menjaga kesehatan metabolik." });
  }

  // ---- 9. Rekomendasi aktivitas fisik -------------------------------------
  const hasCardiacOrRenalSevere = sortedDx.some((d) => ["CHF", "CKD_HD", "STROKE"].includes(d.type));
  const rekomendasi_aktivitas_fisik = {
    frekuensi: "3-5x per minggu",
    durasi: hasCardiacOrRenalSevere ? "10-15 menit, ditingkatkan bertahap" : "20-30 menit",
    intensitas: hasCardiacOrRenalSevere ? "Ringan, sesuai toleransi" : "Ringan-Sedang",
    jenis: "Aerobik ringan (jalan kaki) dan latihan kekuatan ringan sesuai toleransi",
    kontraindikasi: hasCardiacOrRenalSevere
      ? ["Latihan intensitas berat sebelum kondisi klinis stabil", "Latihan saat sesak napas atau nyeri dada"]
      : [],
    catatan_keamanan:
      "Rekomendasi umum dari mesin aturan — sesuaikan dengan kondisi klinis terkini pasien dan konsultasikan dengan dokter/fisioterapis sebelum memulai program baru, khususnya bila terdapat kondisi kardiovaskular atau ginjal berat.",
  };

  // ---- 10. Target terapi -----------------------------------------------
  const target_terapi: ClinicalAssessmentOutput["target_terapi"] = [];
  if (calorieResult) {
    target_terapi.push(
      { parameter: "Energi", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalCal} kkal (${calPct ?? "-"}%)` : "-", target: `${calorieResult.targetCalorie} kkal`, keterangan: "" },
      { parameter: "Protein", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalProtein} g (${proteinPct ?? "-"}%)` : "-", target: `${calorieResult.macros.proteinG} g`, keterangan: "" },
      { parameter: "Lemak", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalFat} g` : "-", target: `${calorieResult.macros.fatG} g`, keterangan: "" },
      { parameter: "Karbohidrat", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalCarb} g` : "-", target: `${calorieResult.macros.carbG} g`, keterangan: "" },
      { parameter: "Serat", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalFiber} g` : "-", target: `${calorieResult.fiberTarget} g`, keterangan: "" },
      { parameter: "Natrium", nilai_saat_ini: activeMealPlan ? `${activeMealPlan.totalSodium} mg (${sodiumPct ?? "-"}%)` : "-", target: `maks ${calorieResult.sodiumMax} mg`, keterangan: "" },
    );
    if (calorieResult.potassiumMax) target_terapi.push({ parameter: "Kalium", nilai_saat_ini: "-", target: `maks ${calorieResult.potassiumMax} mg`, keterangan: "" });
    if (calorieResult.phosphorusMax) target_terapi.push({ parameter: "Fosfor", nilai_saat_ini: "-", target: `maks ${calorieResult.phosphorusMax} mg`, keterangan: "" });
  }

  // ---- 11. Monitoring -----------------------------------------------------
  const monitoring = {
    harian: ["Asupan makan dan cairan (food record)", "Gejala akut sesuai diagnosis (mis. sesak, edema, gula darah bila relevan)"],
    mingguan: ["Berat badan", "Kepatuhan meal plan (energi, protein, natrium)"],
    bulanan: ["Evaluasi ulang status gizi (skrining MUST/NRS-2002/SGA/MNA)", "Laboratorium sesuai indikasi klinis"],
  };

  // ---- Indikator visual ----------------------------------------------------
  const statusFromLab = (status: string): "BAIK" | "PERHATIAN" | "RISIKO_SEDANG" | "RISIKO_TINGGI" => {
    if (status === "NORMAL") return "BAIK";
    if (status === "BORDERLINE") return "PERHATIAN";
    return "RISIKO_SEDANG";
  };
  const indikator_visual: ClinicalAssessmentOutput["indikator_visual"] = [];
  if (bmiInfo) indikator_visual.push({ parameter: "Status Gizi (BMI)", nilai: `${bmi?.toFixed(1)}`, status: bmiInfo.label.toLowerCase().includes("normal") ? "BAIK" : "PERHATIAN" });
  if (calPct !== null) indikator_visual.push({ parameter: "Kepatuhan Energi", nilai: `${calPct}%`, status: calPct >= 90 ? "BAIK" : calPct >= 70 ? "PERHATIAN" : "RISIKO_SEDANG" });
  if (proteinPct !== null) indikator_visual.push({ parameter: "Kepatuhan Protein", nilai: `${proteinPct}%`, status: proteinPct >= 90 ? "BAIK" : proteinPct >= 70 ? "PERHATIAN" : "RISIKO_SEDANG" });
  for (const r of abnormalLabs.slice(0, 6)) {
    indikator_visual.push({ parameter: r.testName, nilai: `${r.value}${r.unit || ""}`, status: statusFromLab(r.status) });
  }

  // ---- Risiko komplikasi + red flags ----------------------------------
  const risiko_komplikasi: ClinicalAssessmentOutput["risiko_komplikasi"] = sortedDx.map((d) => ({
    nama: `Perburukan ${dxLabel(d.type)} / komplikasi terkait nutrisi`,
    level: DX_PRIORITY[d.type] <= 2 ? ("TINGGI" as const) : DX_PRIORITY[d.type] <= 4 ? ("SEDANG" as const) : ("RENDAH" as const),
    alasan: "Ditentukan berdasarkan prioritas klinis umum untuk diagnosis ini; risiko aktual dapat berbeda dan perlu dinilai ulang oleh dokter penanggung jawab.",
  }));
  const red_flags: string[] = [];
  for (const d of sortedDx) {
    const flags = RED_FLAG_BY_DX[d.type];
    if (flags) red_flags.push(...flags);
  }

  // ---- Ringkasan dokter / pasien / kesimpulan --------------------------
  const dxText = sortedDx.length ? sortedDx.map((d) => dxLabel(d.type)).join(", ") : "tanpa diagnosis aktif tercatat";
  const ringkasan_dokter = `Pasien ${patient.name}, usia ${age} tahun, dengan diagnosis aktif: ${dxText}. ${bmiInfo ? `Status gizi berdasarkan BMI ${bmi?.toFixed(1)} kg/m²: ${bmiInfo.label}.` : "Data antropometri belum lengkap."} ${calorieResult ? `Target kebutuhan gizi terhitung: ${calorieResult.targetCalorie} kkal, protein ${calorieResult.macros.proteinG} g, natrium maksimal ${calorieResult.sodiumMax} mg.` : ""} ${calPct !== null ? `Realisasi meal plan saat ini mencapai ${calPct}% dari target energi dan ${proteinPct ?? "-"}% dari target protein.` : "Belum ada meal plan aktif untuk dievaluasi kepatuhannya."} ${abnormalLabs.length > 0 ? `Terdapat ${abnormalLabs.length} parameter laboratorium di luar rentang normal yang perlu ditinjau.` : ""} Catatan: evaluasi ini dihasilkan oleh mesin aturan klinis (rule-based fallback) karena AI Engine tidak tersedia saat evaluasi dibuat — disarankan menjalankan ulang evaluasi AI penuh begitu layanan AI kembali normal untuk analisis reasoning yang lebih mendalam.`;

  const ringkasan_pasien = `Berdasarkan data yang tercatat, kondisi Bapak/Ibu ${patient.name} saat ini terkait dengan ${dxText === "tanpa diagnosis aktif tercatat" ? "belum ada diagnosis khusus yang tercatat" : dxText}. ${bmiInfo ? `Status gizi Anda saat ini termasuk kategori ${bmiInfo.label.toLowerCase()}.` : ""} ${calorieResult ? `Kebutuhan energi harian Anda sekitar ${calorieResult.targetCalorie} kkal dengan protein sekitar ${calorieResult.macros.proteinG} gram.` : ""} Cobalah mengikuti anjuran makanan yang dianjurkan dan membatasi makanan yang disebutkan pada bagian "Makanan Dianjurkan & Dibatasi" di bawah ini, serta konsultasikan hasil evaluasi ini dengan dokter atau ahli gizi Anda.`;

  const kesimpulan_ai = `Evaluasi otomatis ini dihasilkan oleh mesin aturan klinis CareLivia (rule-based fallback engine) karena AI Engine sedang tidak dapat diakses saat permintaan dibuat, sehingga isinya berupa interpretasi berbasis pedoman internal CareLivia (bukan penalaran naratif penuh dari model AI).\n\nSecara ringkas, pasien ${patient.name} (${age} tahun) memiliki ${sortedDx.length} diagnosis aktif (${dxText}) dengan status gizi ${bmiInfo?.label.toLowerCase() || "belum dapat ditentukan"}. ${calPct !== null ? `Kepatuhan terhadap meal plan aktif saat ini berada di ${calPct}% dari target energi.` : "Belum ada meal plan aktif yang dapat dievaluasi kepatuhannya."} Disarankan untuk menjalankan kembali "Buat Evaluasi AI" ketika layanan AI Engine telah pulih, agar diperoleh analisis klinis naratif yang lebih mendalam dan personal berbasis evidence-based medicine.`;

  const overall_risk_level: ClinicalAssessmentOutput["overall_risk_level"] =
    sortedDx.some((d) => DX_PRIORITY[d.type] <= 1)
      ? "HIGH"
      : sortedDx.length >= 2
        ? "MODERATE"
        : sortedDx.length === 1
          ? "MODERATE"
          : "LOW";

  const guideline_references = [
    "ESPEN Clinical Nutrition Guidelines",
    "ASPEN Adult Malnutrition Guidelines",
    "PERKENI Pengelolaan Diabetes Melitus",
    "KDIGO Nutrition in CKD",
    "Pedoman Gizi Seimbang Kemenkes RI",
    "(Dihasilkan oleh mesin aturan klinis CareLivia sebagai cadangan saat AI Engine tidak tersedia)",
  ];

  return {
    ringkasan_klinis,
    analisis_antropometri,
    analisis_diagnosis,
    temuan_penting,
    prioritas_intervensi,
    rekomendasi_nutrisi,
    alasan_pemilihan_menu,
    makanan_dianjurkan,
    makanan_dibatasi,
    rekomendasi_aktivitas_fisik,
    target_terapi,
    monitoring,
    indikator_visual,
    risiko_komplikasi,
    red_flags,
    ringkasan_dokter,
    ringkasan_pasien,
    kesimpulan_ai,
    overall_risk_level,
    guideline_references,
  };
}
