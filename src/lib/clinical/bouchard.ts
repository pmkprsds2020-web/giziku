// =====================================================================
// CareLivia — Bouchard Activity Record (BAR) Engine
// Based on: Kuliah Kedokteran Olahraga — Bouchard Activity Record
// (April Imam Prabowo, dr., DTM&H, MFM(Clin) — Bagian IKK & IKM FKIK UMY)
// WHO Physical Activity Guidelines 2020, ACSM Guidelines 2017/2018.
//
// SSOT for the 9 Bouchard activity categories, the 96-box/day recording
// grid, and every derived metric (Energy Expenditure, MET, PAL) used by
// the Bouchard Activity Record module and by any other CareLivia module
// (AI Meal Plan, Exercise Plan, Food Record energy balance, Clinical
// Decision Support) that reads a saved assessment.
// =====================================================================

// ---------------------------------------------------------------------
// 1. MASTER DATA — 9 kategori aktivitas fisik menurut Bouchard
// ---------------------------------------------------------------------

export type BouchardCode = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface BouchardCategory {
  code: BouchardCode;
  nama: string;
  deskripsi: string;
  contohAktivitas: string[];
  koefisienEnergi: number; // kkal / kg berat badan / 15 menit (per kotak)
  /** Bucket kasar untuk visualisasi intensitas (timeline, pie, bar). */
  bucket: "tidur" | "istirahat" | "ringan" | "sedang" | "berat";
}

export const BOUCHARD_CATEGORIES: BouchardCategory[] = [
  {
    code: 1,
    nama: "Berbaring",
    deskripsi: "Tidur, beristirahat di ranjang",
    contohAktivitas: ["Tidur", "Beristirahat di ranjang"],
    koefisienEnergi: 0.26,
    bucket: "tidur",
  },
  {
    code: 2,
    nama: "Duduk",
    deskripsi: "Aktivitas dalam posisi duduk",
    contohAktivitas: [
      "Mendengarkan di dalam kelas",
      "Makan",
      "Menulis atau mengetik",
      "Membaca",
      "Mendengarkan radio atau menonton TV",
      "Mandi (posisi duduk)",
    ],
    koefisienEnergi: 0.38,
    bucket: "istirahat",
  },
  {
    code: 3,
    nama: "Berdiri, aktivitas ringan",
    deskripsi: "Aktivitas ringan dalam posisi berdiri",
    contohAktivitas: [
      "Mencuci bagian tubuh",
      "Bercukur",
      "Menyisir rambut",
      "Memasak",
      "Membersihkan debu",
    ],
    koefisienEnergi: 0.57,
    bucket: "ringan",
  },
  {
    code: 4,
    nama: "Aktivitas berdiri sedang",
    deskripsi: "Berpakaian, ibadah, mandi berdiri, mengendarai kendaraan, berjalan santai",
    contohAktivitas: [
      "Berpakaian",
      "Sholat",
      "Mandi (posisi berdiri)",
      "Mengendarai mobil",
      "Berjalan-jalan",
    ],
    koefisienEnergi: 0.7,
    bucket: "ringan",
  },
  {
    code: 5,
    nama: "Pekerjaan manual ringan",
    deskripsi: "Pekerjaan rumah tangga & pekerjaan manual intensitas ringan",
    contohAktivitas: [
      "Pekerjaan rumah tangga (membersihkan jendela, menyapu, dll)",
      "Pekerjaan laboratorium",
      "Pertukangan kayu",
      "Pertukangan batu",
      "Mengendarai traktor pertanian",
      "Memberi makan hewan ternak",
      "Membereskan ranjang",
      "Berjalan agak cepat (ke sekolah, berbelanja)",
      "Penjahit",
      "Pembuat tahu/tempe (skala UMKM)",
      "Pelukis",
      "Mekanik",
      "Tukang kue (roti)",
    ],
    koefisienEnergi: 0.83,
    bucket: "ringan",
  },
  {
    code: 6,
    nama: "Olahraga/aktivitas senggang — ringan",
    deskripsi: "Olahraga atau aktivitas di waktu senggang tingkat ringan",
    contohAktivitas: [
      "Kano (ringan)",
      "Bola voli",
      "Tenis meja",
      "Baseball (kecuali pitcher)",
      "Golf",
      "Mendayung",
      "Panahan",
      "Bowling",
      "Croquet",
      "Berlayar",
      "Bersepeda",
    ],
    koefisienEnergi: 1.0,
    bucket: "ringan",
  },
  {
    code: 7,
    nama: "Pekerjaan manual tingkat sedang",
    deskripsi: "Pekerjaan fisik intensitas sedang",
    contohAktivitas: [
      "Mengoperasikan mesin",
      "Memperbaiki pagar",
      "Memasukkan tas-tas/kotak-kotak",
      "Bercocok tanam",
      "Pekerjaan kehutanan (gergaji listrik, kayu gelondongan)",
      "Pekerjaan pertambangan",
      "Menyekop pasir",
    ],
    koefisienEnergi: 1.2,
    bucket: "sedang",
  },
  {
    code: 8,
    nama: "Olahraga/aktivitas senggang — sedang",
    deskripsi: "Olahraga atau aktivitas di waktu senggang tingkat sedang",
    contohAktivitas: [
      "Baseball (pitcher)",
      "Bulutangkis",
      "Kano",
      "Mengendarai kuda",
      "Ski air",
      "Berenang",
      "Bersepeda (kompetisi)",
      "Menari",
      "Tenis",
      "Senam",
      "Jalan cepat",
      "Jogging (lari pelan)",
    ],
    koefisienEnergi: 1.4,
    bucket: "sedang",
  },
  {
    code: 9,
    nama: "Pekerjaan/olahraga berat",
    deskripsi: "Pekerjaan manual berat & olahraga/aktivitas senggang tingkat berat",
    contohAktivitas: [
      "Menebang pohon dengan kapak",
      "Menggergaji dengan gergaji tangan",
      "Memotong cabang dahan pohon",
      "Berlari (kompetisi)",
      "Tinju",
      "Mendaki gunung",
      "Squash",
      "Hoki air/lapangan",
      "Bola basket",
      "Football",
    ],
    koefisienEnergi: 1.95,
    bucket: "berat",
  },
];

export const BOUCHARD_CATEGORY_MAP: Record<BouchardCode, BouchardCategory> =
  Object.fromEntries(BOUCHARD_CATEGORIES.map((c) => [c.code, c])) as Record<
    BouchardCode,
    BouchardCategory
  >;

export const BUCKET_LABELS: Record<BouchardCategory["bucket"], string> = {
  tidur: "Tidur",
  istirahat: "Istirahat/Duduk",
  ringan: "Ringan",
  sedang: "Sedang",
  berat: "Berat",
};

export const BUCKET_COLORS: Record<BouchardCategory["bucket"], string> = {
  tidur: "#6366f1", // indigo
  istirahat: "#94a3b8", // slate
  ringan: "#22c55e", // green
  sedang: "#f59e0b", // amber
  berat: "#ef4444", // red
};

// ---------------------------------------------------------------------
// 2. GRID — 24 jam x 4 interval 15 menit = 96 kotak / hari
// ---------------------------------------------------------------------

export const BOUCHARD_HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
export const BOUCHARD_INTERVALS = ["0-15", "16-30", "31-45", "46-60"] as const;
export const BOUCHARD_BOXES_PER_DAY = 96;

/** One day = array of 96 cells, each holding a Bouchard code (1-9) or null (kosong/belum diisi). */
export type BouchardDayCodes = (BouchardCode | null)[];

export function emptyDay(): BouchardDayCodes {
  return Array<BouchardCode | null>(BOUCHARD_BOXES_PER_DAY).fill(null);
}

export function cellIndex(hour: number, intervalIdx: number): number {
  return hour * 4 + intervalIdx;
}

export const BOUCHARD_DAY_LABELS = ["Hari Kerja 1", "Hari Kerja 2", "Hari Libur"] as const;
export type BouchardDaySlot = 0 | 1 | 2;

// ---------------------------------------------------------------------
// 3. KALKULASI — sesuai langkah pada panduan BAR
//    1) Hitung jumlah kotak per kategori
//    2) Kalikan jumlah kotak x koefisien energi kategori
//    3) Jumlahkan seluruh kategori, kalikan dengan berat badan
//    4) Rerata 3 hari
//    5) Konversi ke METs / PAL
// ---------------------------------------------------------------------

export interface BouchardDayResult {
  filledBoxes: number;
  emptyBoxes: number;
  countByCode: Record<BouchardCode, number>;
  /** kkal / kg berat badan / hari (sebelum dikalikan berat badan) */
  perKgPerDay: number;
  /** kkal / hari (perKgPerDay x berat badan) */
  energyExpenditure: number;
  met: number;
  pal: number;
  minutesByBucket: Record<BouchardCategory["bucket"], number>;
  isComplete: boolean;
}

export function computeDayResult(
  codes: BouchardDayCodes,
  weightKg: number,
): BouchardDayResult {
  const countByCode = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 } as Record<
    BouchardCode,
    number
  >;
  let filledBoxes = 0;
  for (const c of codes) {
    if (c) {
      countByCode[c] += 1;
      filledBoxes += 1;
    }
  }
  const emptyBoxes = BOUCHARD_BOXES_PER_DAY - filledBoxes;

  let perKgPerDay = 0;
  const minutesByBucket: Record<BouchardCategory["bucket"], number> = {
    tidur: 0,
    istirahat: 0,
    ringan: 0,
    sedang: 0,
    berat: 0,
  };
  for (const cat of BOUCHARD_CATEGORIES) {
    const count = countByCode[cat.code];
    perKgPerDay += count * cat.koefisienEnergi;
    minutesByBucket[cat.bucket] += count * 15;
  }

  const energyExpenditure = perKgPerDay * weightKg;
  // 1 MET ≈ 1 kkal/kg/jam → nilai MET seseorang = berat badan (kg) x 24 jam.
  const metBasis = weightKg * 24;
  const met = metBasis > 0 ? energyExpenditure / metBasis : 0;
  // PAL (Physical Activity Level) menggunakan formula/basis yang sama dengan
  // MET pada metode BAR (TEE harian dibagi estimasi BMR x 24 jam).
  const pal = met;

  return {
    filledBoxes,
    emptyBoxes,
    countByCode,
    perKgPerDay: round2(perKgPerDay),
    energyExpenditure: round2(energyExpenditure),
    met: round2(met),
    pal: round2(pal),
    minutesByBucket,
    isComplete: filledBoxes === BOUCHARD_BOXES_PER_DAY,
  };
}

export interface BouchardAssessmentResult {
  days: BouchardDayResult[]; // panjang 3 (mengikuti BOUCHARD_DAY_LABELS)
  avgEnergyExpenditure: number;
  avgMet: number;
  avgPal: number;
  palCategory: PalCategory;
  minutesByBucketAvg: Record<BouchardCategory["bucket"], number>;
  whoStatus: WhoStatus;
  aerobicModerateEquivalentMinutesPerWeek: number;
}

export type PalCategory = "Sedentary" | "Low Active" | "Active" | "Very Active";

/**
 * Klasifikasi PAL mengikuti kategori WHO/FAO/UNU (2001), yang paling umum
 * dipakai bersama Physical Activity Level (nilai sama dengan estimasi METs
 * harian pada metode BAR):
 *  - Sedentary : < 1.40
 *  - Low Active: 1.40 – 1.59
 *  - Active    : 1.60 – 1.89
 *  - Very Active: ≥ 1.90
 */
export function classifyPAL(pal: number): PalCategory {
  if (pal < 1.4) return "Sedentary";
  if (pal < 1.6) return "Low Active";
  if (pal < 1.9) return "Active";
  return "Very Active";
}

export const PAL_CATEGORY_LABELS: Record<PalCategory, string> = {
  Sedentary: "Sedentary (Kurang Aktif)",
  "Low Active": "Low Active (Aktivitas Rendah)",
  Active: "Active (Aktif)",
  "Very Active": "Very Active (Sangat Aktif)",
};

export interface WhoStatus {
  moderateVigorousMinutesPerWeek: number;
  meetsWhoMinimum: boolean; // >=150 menit moderat (atau setara) / minggu
  meetsWhoOptimal: boolean; // >=300 menit moderat (atau setara) / minggu
  message: string;
}

/**
 * Estimasi menit aktivitas aerobik moderat-berat per minggu dari rerata
 * menit "sedang" + "berat" (x2, ekuivalensi WHO 1 menit berat ≈ 2 menit
 * moderat) per hari, diekstrapolasi ke 7 hari.
 */
export function evaluateWhoStatus(
  minutesByBucketAvgPerDay: Record<BouchardCategory["bucket"], number>,
): WhoStatus {
  const moderateEquivPerDay =
    minutesByBucketAvgPerDay.sedang + minutesByBucketAvgPerDay.berat * 2;
  const perWeek = Math.round(moderateEquivPerDay * 7);
  const meetsWhoMinimum = perWeek >= 150;
  const meetsWhoOptimal = perWeek >= 300;
  let message: string;
  if (meetsWhoOptimal) {
    message =
      "Aktivitas fisik pasien sudah melampaui rekomendasi optimal WHO (≥300 menit/minggu setara moderat).";
  } else if (meetsWhoMinimum) {
    message =
      "Aktivitas fisik pasien memenuhi rekomendasi minimal WHO (≥150 menit/minggu setara moderat), namun dapat ditingkatkan menuju 300 menit/minggu untuk manfaat tambahan.";
  } else {
    message = `Aktivitas fisik pasien (±${perWeek} menit/minggu setara moderat) BELUM memenuhi rekomendasi minimal WHO 150 menit/minggu. Disarankan meningkatkan aktivitas aerobik secara bertahap.`;
  }
  return { moderateVigorousMinutesPerWeek: perWeek, meetsWhoMinimum, meetsWhoOptimal, message };
}

export function computeAssessmentResult(
  daysCodes: [BouchardDayCodes, BouchardDayCodes, BouchardDayCodes],
  weightKg: number,
): BouchardAssessmentResult {
  const days = daysCodes.map((d) => computeDayResult(d, weightKg));
  const filledDays = days.filter((d) => d.filledBoxes > 0);
  const n = filledDays.length || 1;

  const avgEnergyExpenditure = round2(
    filledDays.reduce((s, d) => s + d.energyExpenditure, 0) / n,
  );
  const avgMet = round2(filledDays.reduce((s, d) => s + d.met, 0) / n);
  const avgPal = round2(filledDays.reduce((s, d) => s + d.pal, 0) / n);

  const minutesByBucketAvg: Record<BouchardCategory["bucket"], number> = {
    tidur: 0,
    istirahat: 0,
    ringan: 0,
    sedang: 0,
    berat: 0,
  };
  for (const key of Object.keys(minutesByBucketAvg) as (keyof typeof minutesByBucketAvg)[]) {
    minutesByBucketAvg[key] = round1(
      filledDays.reduce((s, d) => s + d.minutesByBucket[key], 0) / n,
    );
  }

  const whoStatus = evaluateWhoStatus(minutesByBucketAvg);

  return {
    days,
    avgEnergyExpenditure,
    avgMet,
    avgPal,
    palCategory: classifyPAL(avgPal),
    minutesByBucketAvg,
    whoStatus,
    aerobicModerateEquivalentMinutesPerWeek: whoStatus.moderateVigorousMinutesPerWeek,
  };
}

// ---------------------------------------------------------------------
// 4. Energy Balance — Food Record integration (Intake vs Expenditure)
// ---------------------------------------------------------------------

export interface EnergyBalance {
  intake: number;
  expenditure: number;
  balance: number; // intake - expenditure
  status: "Defisit" | "Seimbang" | "Surplus";
}

export function computeEnergyBalance(intakeKcal: number, expenditureKcal: number): EnergyBalance {
  const balance = round2(intakeKcal - expenditureKcal);
  const tolerance = expenditureKcal * 0.03; // ±3% dianggap seimbang
  let status: EnergyBalance["status"] = "Seimbang";
  if (balance > tolerance) status = "Surplus";
  else if (balance < -tolerance) status = "Defisit";
  return { intake: round2(intakeKcal), expenditure: round2(expenditureKcal), balance, status };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
