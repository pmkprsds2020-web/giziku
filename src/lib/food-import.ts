import * as XLSX from "xlsx";

// =====================================================================
// Food Import — Excel template / parse / validate utilities
// Column order here is the single source of truth for the template,
// the parser, and the exporter, so they never drift apart.
// =====================================================================

export const TEMPLATE_VERSION = "v1";

export type FoodTemplateColumn = {
  header: string; // Excel column header (Indonesian, matches the spec)
  field: string; // internal camelCase field used by FoodImportRow
  required: boolean;
  type: "text" | "number";
  noNegative?: boolean;
  example: string | number;
};

export const FOOD_TEMPLATE_COLUMNS: FoodTemplateColumn[] = [
  { header: "kode_bahan", field: "code", required: false, type: "text", example: "BM-0001" },
  { header: "nama_bahan", field: "name", required: true, type: "text", example: "Nasi Putih" },
  { header: "kategori", field: "categoryName", required: true, type: "text", example: "Karbohidrat" },
  { header: "sub_kategori", field: "subcategoryName", required: false, type: "text", example: "Serealia" },
  { header: "satuan_rumah_tangga", field: "urt", required: false, type: "text", example: "centong" },
  { header: "berat_satuan_g", field: "urtGram", required: false, type: "number", example: 100 },
  { header: "energi_kcal_100g", field: "energy", required: true, type: "number", noNegative: true, example: 130 },
  { header: "protein_g_100g", field: "protein", required: true, type: "number", noNegative: true, example: 2.7 },
  { header: "lemak_g_100g", field: "fat", required: true, type: "number", noNegative: true, example: 0.3 },
  { header: "karbohidrat_g_100g", field: "carb", required: true, type: "number", noNegative: true, example: 28.2 },
  { header: "serat_g_100g", field: "fiber", required: false, type: "number", noNegative: true, example: 0.4 },
  { header: "gula_g_100g", field: "sugar", required: false, type: "number", noNegative: true, example: 0.1 },
  { header: "natrium_mg_100g", field: "sodium", required: false, type: "number", noNegative: true, example: 1 },
  { header: "kalium_mg_100g", field: "potassium", required: false, type: "number", noNegative: true, example: 35 },
  { header: "kalsium_mg_100g", field: "calcium", required: false, type: "number", noNegative: true, example: 5 },
  { header: "fosfor_mg_100g", field: "phosphorus", required: false, type: "number", noNegative: true, example: 43 },
  { header: "zat_besi_mg_100g", field: "iron", required: false, type: "number", noNegative: true, example: 0.2 },
  { header: "seng_mg_100g", field: "zinc", required: false, type: "number", noNegative: true, example: 0.4 },
  { header: "magnesium_mg_100g", field: "magnesium", required: false, type: "number", noNegative: true, example: 12 },
  { header: "vitamin_a_mcg", field: "vitA", required: false, type: "number", noNegative: true, example: 0 },
  { header: "vitamin_b1_mg", field: "vitB1", required: false, type: "number", noNegative: true, example: 0.02 },
  { header: "vitamin_b2_mg", field: "vitB2", required: false, type: "number", noNegative: true, example: 0.01 },
  { header: "vitamin_b3_mg", field: "vitB3", required: false, type: "number", noNegative: true, example: 0.4 },
  { header: "vitamin_b6_mg", field: "vitB6", required: false, type: "number", noNegative: true, example: 0.03 },
  { header: "vitamin_b12_mcg", field: "vitB12", required: false, type: "number", noNegative: true, example: 0 },
  { header: "folat_mcg", field: "folate", required: false, type: "number", noNegative: true, example: 3 },
  { header: "vitamin_c_mg", field: "vitC", required: false, type: "number", noNegative: true, example: 0 },
  { header: "vitamin_d_IU", field: "vitD", required: false, type: "number", noNegative: true, example: 0 },
  { header: "vitamin_e_mg", field: "vitE", required: false, type: "number", noNegative: true, example: 0 },
  { header: "vitamin_k_mcg", field: "vitK", required: false, type: "number", noNegative: true, example: 0 },
  { header: "kolesterol_mg", field: "cholesterol", required: false, type: "number", noNegative: true, example: 0 },
  { header: "indeks_glikemik", field: "gi", required: false, type: "number", noNegative: true, example: 65 },
  { header: "beban_glikemik", field: "glycemicLoad", required: false, type: "number", noNegative: true, example: 23 },
  { header: "harga_per_porsi", field: "price", required: true, type: "number", noNegative: true, example: 1500 },
  { header: "edible_portion", field: "bdd", required: false, type: "number", example: 100 },
  { header: "sumber_data", field: "source", required: false, type: "text", example: "TKPI" },
  { header: "catatan", field: "description", required: false, type: "text", example: "" },
];

const INSTRUCTIONS: string[][] = [
  ["Petunjuk Pengisian — Template Database Bahan Makanan"],
  [""],
  ["Kolom WAJIB diisi:", "nama_bahan, kategori, energi_kcal_100g, protein_g_100g, lemak_g_100g, karbohidrat_g_100g, harga_per_porsi"],
  ["Kolom lain", "boleh dikosongkan — sistem akan mengisi 0 / default."],
  [""],
  ["Format angka", "Gunakan titik (.) untuk desimal, contoh: 2.7 — jangan pakai koma."],
  ["Nilai gizi (kolom *_100g / _mcg / _mg)", "Selalu per 100 gram bahan mentah/edible portion, TIDAK BOLEH negatif."],
  ["harga_per_porsi", "Diisi sebagai harga per 100 gram (mengikuti konvensi harga di database CareLivia), bukan per porsi saji."],
  ["edible_portion", "Persentase bagian yang bisa dimakan (0-100). Kosongkan jika tidak tahu — default 100."],
  ["kategori / sub_kategori", "Jika nama kategori belum ada di database, sistem akan membuatkan kategori baru secara otomatis — pastikan penulisan konsisten (misal selalu \"Karbohidrat\", jangan campur \"karbohidrat\"/\"Karbo\")."],
  ["kode_bahan", "Opsional, tapi jika diisi harus unik — dipakai untuk deteksi data duplikat saat import ulang."],
  ["sumber_data", "TKPI / DKBM / USDA / CUSTOM. Kosongkan jika tidak tahu, akan diisi CUSTOM."],
  [""],
  ["Contoh baris yang benar", "Lihat baris ke-2 pada sheet 'Data' — sudah terisi contoh nilai gizi Nasi Putih per 100g."],
  [""],
  ["Data TIDAK BOLEH kosong", "nama_bahan, kategori"],
  ["Data TIDAK BOLEH negatif", "seluruh kolom gram/mg/mcg/kcal serta harga_per_porsi"],
];

export function downloadFoodTemplate() {
  const headers = FOOD_TEMPLATE_COLUMNS.map((c) => c.header);
  const example = FOOD_TEMPLATE_COLUMNS.map((c) => c.example);

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, example]);
  const instructionSheet = XLSX.utils.aoa_to_sheet(INSTRUCTIONS);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataSheet, "Data");
  XLSX.utils.book_append_sheet(wb, instructionSheet, "Petunjuk Pengisian");

  XLSX.writeFile(wb, "Template_Database_Bahan_Makanan.xlsx");
}

export function downloadFoodDatabaseExport(rows: Record<string, any>[]) {
  const headers = FOOD_TEMPLATE_COLUMNS.map((c) => c.header);
  const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Database Bahan Makanan");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Export_Database_Bahan_Makanan_${stamp}.xlsx`);
}

export function downloadErrorLog(errors: { rowIndex: number; name?: string; message: string }[]) {
  const aoa = [
    ["Baris", "Nama Bahan", "Pesan Error"],
    ...errors.map((e) => [e.rowIndex, e.name ?? "", e.message]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Error Log");
  XLSX.writeFile(wb, `Log_Error_Import_${Date.now()}.xlsx`);
}

// ---------------------------------------------------------------------
// Parse an uploaded .xlsx/.xls/.csv File into raw header->value rows
// ---------------------------------------------------------------------
export async function parseFoodExcelFile(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.includes("Data") ? "Data" : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
}

export type ParsedFoodRow = {
  rowIndex: number; // 1-based, matches the row number in Excel (header = row 1)
  raw: Record<string, any>;
  errors: string[];
  normalized: {
    code: string | null;
    name: string;
    categoryName: string;
    subcategoryName: string | null;
    urt: string | null;
    urtGram: number | null;
    energy: number;
    protein: number;
    fat: number;
    carb: number;
    fiber: number;
    sugar: number;
    sodium: number;
    potassium: number;
    calcium: number;
    magnesium: number;
    iron: number;
    phosphorus: number;
    zinc: number;
    vitA: number;
    vitB1: number;
    vitB2: number;
    vitB3: number;
    vitB6: number;
    vitB12: number;
    folate: number;
    vitC: number;
    vitD: number;
    vitE: number;
    vitK: number;
    cholesterol: number;
    gi: number;
    glycemicLoad: number;
    price: number;
    bdd: number;
    source: string;
    description: string;
  };
};

function toNumber(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// Validates one raw Excel row -> { errors, normalized }. Pure function,
// no network calls — duplicate detection happens separately (needs DB).
export function validateFoodRow(raw: Record<string, any>, rowIndex: number): ParsedFoodRow {
  const errors: string[] = [];
  const get = (header: string) => raw[header] ?? raw[header.trim()] ?? "";

  const name = String(get("nama_bahan") ?? "").trim();
  if (!name) errors.push("Nama bahan kosong.");

  const categoryName = String(get("kategori") ?? "").trim();
  if (!categoryName) errors.push("Kategori kosong.");

  const numericFields: { field: string; header: string; required: boolean }[] = [
    { field: "energy", header: "energi_kcal_100g", required: true },
    { field: "protein", header: "protein_g_100g", required: true },
    { field: "fat", header: "lemak_g_100g", required: true },
    { field: "carb", header: "karbohidrat_g_100g", required: true },
    { field: "price", header: "harga_per_porsi", required: true },
  ];

  const numericValues: Record<string, number> = {};
  for (const nf of numericFields) {
    const raw2 = toNumber(get(nf.header));
    if (raw2 === null) {
      if (nf.required) errors.push(`${nf.header} wajib diisi.`);
      numericValues[nf.field] = 0;
    } else if (Number.isNaN(raw2)) {
      errors.push(`${nf.header} harus berupa angka.`);
      numericValues[nf.field] = 0;
    } else if (raw2 < 0) {
      errors.push(`${nf.header} tidak boleh negatif.`);
      numericValues[nf.field] = 0;
    } else {
      numericValues[nf.field] = raw2;
    }
  }

  const optionalNumericMap: [string, string][] = [
    ["fiber", "serat_g_100g"],
    ["sugar", "gula_g_100g"],
    ["sodium", "natrium_mg_100g"],
    ["potassium", "kalium_mg_100g"],
    ["calcium", "kalsium_mg_100g"],
    ["phosphorus", "fosfor_mg_100g"],
    ["iron", "zat_besi_mg_100g"],
    ["zinc", "seng_mg_100g"],
    ["magnesium", "magnesium_mg_100g"],
    ["vitA", "vitamin_a_mcg"],
    ["vitB1", "vitamin_b1_mg"],
    ["vitB2", "vitamin_b2_mg"],
    ["vitB3", "vitamin_b3_mg"],
    ["vitB6", "vitamin_b6_mg"],
    ["vitB12", "vitamin_b12_mcg"],
    ["folate", "folat_mcg"],
    ["vitC", "vitamin_c_mg"],
    ["vitD", "vitamin_d_IU"],
    ["vitE", "vitamin_e_mg"],
    ["vitK", "vitamin_k_mcg"],
    ["cholesterol", "kolesterol_mg"],
    ["gi", "indeks_glikemik"],
    ["glycemicLoad", "beban_glikemik"],
  ];

  const optionalValues: Record<string, number> = {};
  for (const [field, header] of optionalNumericMap) {
    const v = toNumber(get(header));
    if (v === null) {
      optionalValues[field] = 0;
    } else if (Number.isNaN(v)) {
      errors.push(`${header} harus berupa angka.`);
      optionalValues[field] = 0;
    } else if (v < 0) {
      errors.push(`${header} tidak boleh negatif.`);
      optionalValues[field] = 0;
    } else {
      optionalValues[field] = v;
    }
  }

  const urtGramRaw = toNumber(get("berat_satuan_g"));
  const bddRaw = toNumber(get("edible_portion"));

  return {
    rowIndex,
    raw,
    errors,
    normalized: {
      code: String(get("kode_bahan") ?? "").trim() || null,
      name,
      categoryName,
      subcategoryName: String(get("sub_kategori") ?? "").trim() || null,
      urt: String(get("satuan_rumah_tangga") ?? "").trim() || null,
      urtGram: urtGramRaw && !Number.isNaN(urtGramRaw) ? urtGramRaw : null,
      energy: numericValues.energy,
      protein: numericValues.protein,
      fat: numericValues.fat,
      carb: numericValues.carb,
      price: numericValues.price,
      fiber: optionalValues.fiber,
      sugar: optionalValues.sugar,
      sodium: optionalValues.sodium,
      potassium: optionalValues.potassium,
      calcium: optionalValues.calcium,
      magnesium: optionalValues.magnesium,
      iron: optionalValues.iron,
      phosphorus: optionalValues.phosphorus,
      zinc: optionalValues.zinc,
      vitA: optionalValues.vitA,
      vitB1: optionalValues.vitB1,
      vitB2: optionalValues.vitB2,
      vitB3: optionalValues.vitB3,
      vitB6: optionalValues.vitB6,
      vitB12: optionalValues.vitB12,
      folate: optionalValues.folate,
      vitC: optionalValues.vitC,
      vitD: optionalValues.vitD,
      vitE: optionalValues.vitE,
      vitK: optionalValues.vitK,
      cholesterol: optionalValues.cholesterol,
      gi: optionalValues.gi,
      glycemicLoad: optionalValues.glycemicLoad,
      bdd: bddRaw && !Number.isNaN(bddRaw) ? bddRaw : 100,
      source: String(get("sumber_data") ?? "").trim().toUpperCase() || "CUSTOM",
      description: String(get("catatan") ?? "").trim(),
    },
  };
}
