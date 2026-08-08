// =====================================================================
// CareLivia — Nutrigenomic Gene Reference (static knowledge base)
//
// Purpose: ground the AI interpretation prompt (lib/ai/prompts/
// nutrigenomic.ts) with vetted, evidence-labeled gene summaries instead
// of relying purely on the model's parametric memory, and power the
// "apa arti gen ini?" reference UI.
//
// Mirrors the seed rows in supabase/migrations/028_nutrigenomic_module.sql
// (gene_reference table) — kept in sync manually. This TS constant is the
// one actually imported by server code; the Supabase table exists so the
// same reference data is queryable/editable independently.
//
// IMPORTANT: this is reference/background knowledge only. It is NOT a
// substitute for the specific SNP/genotype extracted from a patient's
// actual report — the AI must only interpret genes it actually found in
// the uploaded document (see nutrigenomic upload validation rules).
// =====================================================================

export type GeneCategory =
  | "METABOLISME_ENERGI"
  | "LEMAK_KOLESTEROL"
  | "KARBOHIDRAT_GLUKOSA"
  | "VITAMIN_MIKRONUTRIEN"
  | "DETOKSIFIKASI"
  | "INFLAMASI"
  | "RITME_SIRKADIAN"
  | "PERFORMA_OLAHRAGA"
  | "FARMAKOGENOMIK"
  | "LAINNYA";

export type EvidenceLevel = "STRONG" | "MODERATE" | "LIMITED" | "ASSOCIATIVE";

export interface GeneReferenceEntry {
  gene: string;
  commonSnp: string;
  category: GeneCategory;
  description: string;
  evidenceLevel: EvidenceLevel;
}

export const GENE_CATEGORY_LABELS: Record<GeneCategory, string> = {
  METABOLISME_ENERGI: "Metabolisme Energi",
  LEMAK_KOLESTEROL: "Lemak & Kolesterol",
  KARBOHIDRAT_GLUKOSA: "Karbohidrat & Glukosa",
  VITAMIN_MIKRONUTRIEN: "Vitamin & Mikronutrien",
  DETOKSIFIKASI: "Detoksifikasi",
  INFLAMASI: "Inflamasi",
  RITME_SIRKADIAN: "Ritme Sirkadian",
  PERFORMA_OLAHRAGA: "Performa Olahraga",
  FARMAKOGENOMIK: "Farmakogenomik",
  LAINNYA: "Lainnya",
};

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  STRONG: "Bukti Kuat",
  MODERATE: "Bukti Sedang",
  LIMITED: "Bukti Terbatas",
  ASSOCIATIVE: "Asosiasi Awal",
};

export const GENE_REFERENCE: GeneReferenceEntry[] = [
  { gene: "FTO", commonSnp: "rs9939609", category: "METABOLISME_ENERGI", evidenceLevel: "STRONG",
    description: "Varian risiko dikaitkan dengan peningkatan risiko obesitas dan nafsu makan lebih tinggi terhadap makanan padat energi; beberapa studi menunjukkan respons lebih baik terhadap diet tinggi protein." },
  { gene: "MTHFR", commonSnp: "rs1801133", category: "VITAMIN_MIKRONUTRIEN", evidenceLevel: "STRONG",
    description: "Varian C677T menurunkan aktivitas enzim MTHFR, meningkatkan kebutuhan folat dan risiko hiperhomosisteinemia." },
  { gene: "APOE", commonSnp: "rs429358/rs7412", category: "LEMAK_KOLESTEROL", evidenceLevel: "STRONG",
    description: "Alel ε4 dikaitkan dengan respons LDL lebih tinggi terhadap lemak jenuh dan peningkatan risiko kardiovaskular." },
  { gene: "TCF7L2", commonSnp: "rs7903146", category: "KARBOHIDRAT_GLUKOSA", evidenceLevel: "STRONG",
    description: "Varian risiko diabetes tipe 2 paling konsisten pada studi GWAS; berkaitan dengan gangguan sekresi insulin." },
  { gene: "PPARG", commonSnp: "rs1801282", category: "KARBOHIDRAT_GLUKOSA", evidenceLevel: "MODERATE",
    description: "Berperan pada sensitivitas insulin dan diferensiasi adiposit; varian Pro12Ala dikaitkan dengan perbaikan sensitivitas insulin pada diet rendah lemak jenuh." },
  { gene: "MC4R", commonSnp: "rs17782313", category: "METABOLISME_ENERGI", evidenceLevel: "MODERATE",
    description: "Berperan pada regulasi nafsu makan di hipotalamus; varian dikaitkan dengan peningkatan asupan energi dan risiko obesitas." },
  { gene: "CYP1A2", commonSnp: "rs762551", category: "DETOKSIFIKASI", evidenceLevel: "MODERATE",
    description: "Menentukan kecepatan metabolisme kafein (\"fast\" vs \"slow\" metabolizer); metabolisme lambat dikaitkan risiko kardiovaskular lebih tinggi bila konsumsi kafein berlebih." },
  { gene: "ACE", commonSnp: "rs4646994 (I/D)", category: "PERFORMA_OLAHRAGA", evidenceLevel: "LIMITED",
    description: "Polimorfisme insersi/delesi dikaitkan dengan performa endurance (alel I) vs performa power (alel D)." },
  { gene: "ACTN3", commonSnp: "rs1815739", category: "PERFORMA_OLAHRAGA", evidenceLevel: "MODERATE",
    description: "Varian R577X menentukan produksi alfa-aktinin-3 pada serat otot cepat; genotipe RR dikaitkan performa power/sprint." },
  { gene: "ADRB2", commonSnp: "rs1042713", category: "METABOLISME_ENERGI", evidenceLevel: "LIMITED",
    description: "Reseptor beta-2 adrenergik berperan pada lipolisis dan respons terhadap latihan; varian dikaitkan perbedaan respons penurunan berat badan." },
  { gene: "VDR", commonSnp: "rs2228570", category: "VITAMIN_MIKRONUTRIEN", evidenceLevel: "MODERATE",
    description: "Reseptor vitamin D; varian dikaitkan dengan perbedaan penyerapan kalsium dan risiko defisiensi vitamin D." },
  { gene: "SOD2", commonSnp: "rs4880", category: "INFLAMASI", evidenceLevel: "LIMITED",
    description: "Enzim antioksidan mitokondria; varian dikaitkan kapasitas antioksidan endogen dan kebutuhan antioksidan dari makanan." },
  { gene: "GSTM1", commonSnp: "delesi gen (null)", category: "DETOKSIFIKASI", evidenceLevel: "MODERATE",
    description: "Delesi gen (genotipe null) menurunkan kapasitas detoksifikasi fase II; dikaitkan manfaat lebih besar dari sayuran cruciferous." },
  { gene: "COMT", commonSnp: "rs4680", category: "RITME_SIRKADIAN", evidenceLevel: "LIMITED",
    description: "Menentukan kecepatan metabolisme katekolamin; varian \"slow\" (Met/Met) dikaitkan sensitivitas lebih tinggi terhadap stres dan kafein." },
  { gene: "PEMT", commonSnp: "rs7946", category: "VITAMIN_MIKRONUTRIEN", evidenceLevel: "LIMITED",
    description: "Berperan pada sintesis fosfatidilkolin endogen; varian dikaitkan peningkatan kebutuhan kolin dari makanan, terutama saat hamil." },
  { gene: "BCMO1", commonSnp: "rs12934922", category: "VITAMIN_MIKRONUTRIEN", evidenceLevel: "MODERATE",
    description: "Menentukan efisiensi konversi beta-karoten menjadi vitamin A aktif; varian risiko menurunkan konversi, meningkatkan kebutuhan vitamin A preformed." },
  { gene: "FADS1", commonSnp: "rs174546", category: "LEMAK_KOLESTEROL", evidenceLevel: "MODERATE",
    description: "Mengatur enzim desaturase pada jalur sintesis omega-3/omega-6 rantai panjang (EPA/DHA/AA) dari prekursor tanaman." },
  { gene: "FADS2", commonSnp: "rs1535", category: "LEMAK_KOLESTEROL", evidenceLevel: "MODERATE",
    description: "Berpasangan dengan FADS1 pada jalur sintesis asam lemak esensial; varian dikaitkan efisiensi konversi ALA menjadi EPA/DHA lebih rendah." },
  { gene: "LCT", commonSnp: "rs4988235", category: "KARBOHIDRAT_GLUKOSA", evidenceLevel: "STRONG",
    description: "Menentukan persistensi laktase dewasa; genotipe non-persisten dikaitkan dengan intoleransi laktosa." },
  { gene: "HFE", commonSnp: "rs1800562 (C282Y)", category: "VITAMIN_MIKRONUTRIEN", evidenceLevel: "STRONG",
    description: "Varian dikaitkan hemokromatosis herediter dan peningkatan penyerapan zat besi; perlu kehati-hatian pada suplementasi zat besi." },
  { gene: "CLOCK", commonSnp: "rs1801260", category: "RITME_SIRKADIAN", evidenceLevel: "LIMITED",
    description: "Gen jam biologis utama; varian dikaitkan preferensi waktu makan dan risiko obesitas terkait pola makan malam hari." },
  { gene: "PER2", commonSnp: "rs2304672", category: "RITME_SIRKADIAN", evidenceLevel: "LIMITED",
    description: "Berperan pada regulasi ritme sirkadian; varian dikaitkan preferensi kronotipe dan waktu makan optimal." },
  { gene: "ADIPOQ", commonSnp: "rs1501299", category: "METABOLISME_ENERGI", evidenceLevel: "LIMITED",
    description: "Mengatur kadar adiponektin, hormon yang berperan pada sensitivitas insulin dan oksidasi lemak." },
  { gene: "UCP1", commonSnp: "rs1800592", category: "METABOLISME_ENERGI", evidenceLevel: "LIMITED",
    description: "Berperan pada termogenesis jaringan lemak coklat; varian dikaitkan efisiensi pembakaran energi basal." },
  { gene: "UCP2", commonSnp: "rs659366", category: "METABOLISME_ENERGI", evidenceLevel: "LIMITED",
    description: "Mengatur efisiensi mitokondria dan produksi ROS; dikaitkan variasi laju metabolisme basal." },
  { gene: "IL6", commonSnp: "rs1800795", category: "INFLAMASI", evidenceLevel: "MODERATE",
    description: "Sitokin proinflamasi; varian dikaitkan kadar inflamasi basal lebih tinggi dan risiko resistensi insulin." },
  { gene: "TNF", commonSnp: "rs1800629", category: "INFLAMASI", evidenceLevel: "MODERATE",
    description: "Faktor nekrosis tumor alfa; varian dikaitkan respons inflamasi lebih tinggi terhadap diet tinggi lemak jenuh." },
  { gene: "SLCO1B1", commonSnp: "rs4149056", category: "FARMAKOGENOMIK", evidenceLevel: "STRONG",
    description: "Transporter hepatik yang memengaruhi kadar plasma statin; varian dikaitkan risiko miopati terkait statin lebih tinggi (relevan bila pasien mengonsumsi statin)." },
];

const GENE_REFERENCE_MAP = new Map(GENE_REFERENCE.map((g) => [g.gene.toUpperCase(), g]));

export function getGeneReference(geneSymbol: string): GeneReferenceEntry | null {
  return GENE_REFERENCE_MAP.get(geneSymbol.trim().toUpperCase()) ?? null;
}

/** Compact text block injected into the AI interpretation prompt so the
 * model has vetted grounding for genes it recognizes, without treating
 * this list as the only genes it's allowed to interpret (a report may
 * contain genes not in this curated set — the model should still read
 * them from the PDF, just without this extra grounding context). */
export function buildGeneReferenceContext(geneSymbols: string[]): string {
  const rows = geneSymbols
    .map((g) => getGeneReference(g))
    .filter((g): g is GeneReferenceEntry => !!g)
    .map(
      (g) =>
        `- ${g.gene} (${g.commonSnp}) [${GENE_CATEGORY_LABELS[g.category]}, ${EVIDENCE_LEVEL_LABELS[g.evidenceLevel]}]: ${g.description}`,
    );
  return rows.length > 0 ? rows.join("\n") : "(Tidak ada gen dalam referensi terkurasi yang cocok — interpretasikan murni dari data ekstraksi.)";
}
