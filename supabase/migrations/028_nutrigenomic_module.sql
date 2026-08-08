-- =====================================================================
-- 028_nutrigenomic_module.sql
-- Purpose: Nutrigenomic AI module — upload nutrigenomic lab PDFs, extract
--          gene/SNP data, generate AI clinical interpretation, and feed
--          findings into the Precision Meal Plan engine.
-- Dependencies: 000_extensions.sql (gen_random_uuid), 002_functions.sql
--               (update_updated_at), 004_patient_module.sql (patients),
--               015_rls.sql (RLS pattern)
-- Safe to run multiple times (idempotent).
-- =====================================================================

-- =====================================================================
-- 1. genomic_reports — one row per uploaded nutrigenomic lab report.
--    Mirrors the laboratory_results "source" idea: every report goes
--    through UPLOADED -> PROCESSING -> ANALYZED (or NEEDS_REVIEW/FAILED).
-- =====================================================================

CREATE TABLE IF NOT EXISTS genomic_reports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID NOT NULL,
    laboratory_name   TEXT,
    exam_date         DATE,
    exam_type         TEXT,
    file_name         TEXT,
    total_genes       INTEGER DEFAULT 0,
    total_snps        INTEGER DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'UPLOADED'
        CHECK (status IN ('UPLOADED', 'PROCESSING', 'ANALYZED', 'NEEDS_REVIEW', 'FAILED')),
    extraction_notes  TEXT,
    ai_model          TEXT,
    created_by        TEXT DEFAULT 'system',
    deleted_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_genomic_report_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_genomic_reports_patient ON genomic_reports(patient_id, exam_date DESC);

DROP TRIGGER IF EXISTS trg_genomic_reports_updated ON genomic_reports;
CREATE TRIGGER trg_genomic_reports_updated BEFORE UPDATE ON genomic_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- 2. genomic_findings — one row per gene/SNP extracted + interpreted
--    from a report. Findings are only ever written from data the AI
--    actually extracted from the PDF (never fabricated) — see the
--    validation rules encoded in lib/ai/prompts/nutrigenomic.ts.
-- =====================================================================

CREATE TABLE IF NOT EXISTS genomic_findings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id             UUID NOT NULL,
    patient_id            UUID NOT NULL,
    gene_symbol           TEXT NOT NULL,
    rs_id                 TEXT,
    genotype              TEXT,
    clinical_meaning      TEXT,
    nutrition_impact      TEXT,
    risk_level            TEXT DEFAULT 'MODERATE'
        CHECK (risk_level IN ('LOW', 'MODERATE', 'HIGH')),
    evidence_level        TEXT DEFAULT 'ASSOCIATIVE'
        CHECK (evidence_level IN ('STRONG', 'MODERATE', 'LIMITED', 'ASSOCIATIVE')),
    reference_summary     TEXT,
    confidence            TEXT DEFAULT 'MEDIUM' CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
    verified_by_clinician BOOLEAN DEFAULT false,
    created_at            TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_genomic_finding_report FOREIGN KEY (report_id)
        REFERENCES genomic_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_genomic_finding_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_genomic_findings_report ON genomic_findings(report_id);
CREATE INDEX IF NOT EXISTS idx_genomic_findings_patient_gene ON genomic_findings(patient_id, gene_symbol);

-- =====================================================================
-- 3. genomic_interpretations — one AI-generated clinical summary per
--    report (risk summary, clinical/nutrition implications, food lists,
--    supplementation, exercise, monitoring). JSONB so the shape can
--    evolve without further migrations; always regeneratable from
--    genomic_findings + patient clinical context.
-- =====================================================================

CREATE TABLE IF NOT EXISTS genomic_interpretations (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                 UUID NOT NULL UNIQUE,
    patient_id                UUID NOT NULL,
    summary                   TEXT,
    risk_summary              JSONB DEFAULT '{}'::jsonb,
    clinical_implications     JSONB DEFAULT '[]'::jsonb,
    nutrition_implications    JSONB DEFAULT '{}'::jsonb,
    recommended_foods         JSONB DEFAULT '[]'::jsonb,
    restricted_foods          JSONB DEFAULT '[]'::jsonb,
    intervention_priorities   JSONB DEFAULT '[]'::jsonb,
    supplementation           JSONB DEFAULT '[]'::jsonb,
    exercise_recommendations  JSONB DEFAULT '[]'::jsonb,
    monitoring_plan           JSONB DEFAULT '[]'::jsonb,
    ai_model                  TEXT,
    created_at                TIMESTAMPTZ DEFAULT now(),
    updated_at                TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_genomic_interp_report FOREIGN KEY (report_id)
        REFERENCES genomic_reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_genomic_interp_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS trg_genomic_interpretations_updated ON genomic_interpretations;
CREATE TRIGGER trg_genomic_interpretations_updated BEFORE UPDATE ON genomic_interpretations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- 4. gene_reference — static knowledge-base table (read-mostly) used to
--    (a) ground the AI interpretation prompt with vetted gene summaries
--        so it doesn't rely purely on parametric memory, and
--    (b) power the "apa arti gen ini?" reference tooltip in the UI.
--    Seed rows mirror src/lib/clinical/gene-reference.ts — kept in sync
--    manually; the app reads from the TS constant, this table exists so
--    the same reference data is queryable/editable from Supabase too.
-- =====================================================================

CREATE TABLE IF NOT EXISTS gene_reference (
    gene_symbol       TEXT PRIMARY KEY,
    common_snp        TEXT,
    category          TEXT NOT NULL CHECK (category IN (
        'METABOLISME_ENERGI', 'LEMAK_KOLESTEROL', 'KARBOHIDRAT_GLUKOSA',
        'VITAMIN_MIKRONUTRIEN', 'DETOKSIFIKASI', 'INFLAMASI',
        'RITME_SIRKADIAN', 'PERFORMA_OLAHRAGA', 'FARMAKOGENOMIK', 'LAINNYA'
    )),
    description       TEXT NOT NULL,
    evidence_level    TEXT DEFAULT 'MODERATE'
        CHECK (evidence_level IN ('STRONG', 'MODERATE', 'LIMITED', 'ASSOCIATIVE')),
    created_at        TIMESTAMPTZ DEFAULT now()
);

INSERT INTO gene_reference (gene_symbol, common_snp, category, description, evidence_level) VALUES
    ('FTO', 'rs9939609', 'METABOLISME_ENERGI', 'Varian risiko dikaitkan dengan peningkatan risiko obesitas dan nafsu makan lebih tinggi terhadap makanan padat energi; beberapa studi menunjukkan respons lebih baik terhadap diet tinggi protein.', 'STRONG'),
    ('MTHFR', 'rs1801133', 'VITAMIN_MIKRONUTRIEN', 'Varian C677T menurunkan aktivitas enzim metilenetetrahidrofolat reduktase, meningkatkan kebutuhan folat dan risiko hiperhomosisteinemia.', 'STRONG'),
    ('APOE', 'rs429358/rs7412', 'LEMAK_KOLESTEROL', 'Alel ε4 dikaitkan dengan respons LDL lebih tinggi terhadap lemak jenuh dan peningkatan risiko kardiovaskular.', 'STRONG'),
    ('TCF7L2', 'rs7903146', 'KARBOHIDRAT_GLUKOSA', 'Varian risiko paling kuat berhubungan dengan diabetes tipe 2 pada studi GWAS; berkaitan dengan gangguan sekresi insulin.', 'STRONG'),
    ('PPARG', 'rs1801282', 'KARBOHIDRAT_GLUKOSA', 'Berperan dalam sensitivitas insulin dan diferensiasi adiposit; varian Pro12Ala dikaitkan dengan perbaikan sensitivitas insulin pada diet rendah lemak jenuh.', 'MODERATE'),
    ('MC4R', 'rs17782313', 'METABOLISME_ENERGI', 'Berperan pada regulasi nafsu makan di hipotalamus; varian dikaitkan dengan peningkatan asupan energi dan risiko obesitas.', 'MODERATE'),
    ('CYP1A2', 'rs762551', 'DETOKSIFIKASI', 'Menentukan kecepatan metabolisme kafein ("fast" vs "slow" metabolizer"); metabolisme lambat dikaitkan dengan risiko kardiovaskular lebih tinggi bila konsumsi kafein berlebih.', 'MODERATE'),
    ('ACE', 'rs4646994 (I/D)', 'PERFORMA_OLAHRAGA', 'Polimorfisme insersi/delesi dikaitkan dengan performa endurance (alel I) vs performa power (alel D).', 'LIMITED'),
    ('ACTN3', 'rs1815739', 'PERFORMA_OLAHRAGA', 'Varian R577X menentukan produksi protein alfa-aktinin-3 pada serat otot cepat; genotipe RR dikaitkan dengan performa power/sprint.', 'MODERATE'),
    ('ADRB2', 'rs1042713', 'METABOLISME_ENERGI', 'Reseptor beta-2 adrenergik berperan pada lipolisis dan respons terhadap latihan; varian dikaitkan dengan perbedaan respons penurunan berat badan.', 'LIMITED'),
    ('VDR', 'rs2228570', 'VITAMIN_MIKRONUTRIEN', 'Reseptor vitamin D; varian dikaitkan dengan perbedaan penyerapan kalsium dan risiko defisiensi vitamin D.', 'MODERATE'),
    ('SOD2', 'rs4880', 'INFLAMASI', 'Enzim antioksidan superoksida dismutase mitokondria; varian dikaitkan dengan kapasitas antioksidan endogen dan kebutuhan antioksidan dari makanan.', 'LIMITED'),
    ('GSTM1', 'delesi gen (null)', 'DETOKSIFIKASI', 'Delesi gen (genotipe null) menurunkan kapasitas detoksifikasi fase II terhadap senyawa xenobiotik; dikaitkan dengan manfaat lebih besar dari sayuran cruciferous.', 'MODERATE'),
    ('COMT', 'rs4680', 'RITME_SIRKADIAN', 'Menentukan kecepatan metabolisme katekolamin (dopamin/adrenalin); varian "slow" (Met/Met) dikaitkan dengan sensitivitas lebih tinggi terhadap stres dan kafein.', 'LIMITED'),
    ('PEMT', 'rs7946', 'VITAMIN_MIKRONUTRIEN', 'Berperan pada sintesis fosfatidilkolin endogen; varian dikaitkan dengan peningkatan kebutuhan kolin dari makanan, terutama pada kehamilan.', 'LIMITED'),
    ('BCMO1', 'rs12934922', 'VITAMIN_MIKRONUTRIEN', 'Menentukan efisiensi konversi beta-karoten menjadi vitamin A aktif; varian risiko menurunkan konversi hingga 32-69%, meningkatkan kebutuhan vitamin A preformed.', 'MODERATE'),
    ('FADS1', 'rs174546', 'LEMAK_KOLESTEROL', 'Mengatur enzim desaturase pada jalur sintesis omega-3/omega-6 rantai panjang (EPA/DHA/AA) dari prekursor tanaman.', 'MODERATE'),
    ('FADS2', 'rs1535', 'LEMAK_KOLESTEROL', 'Berpasangan dengan FADS1 pada jalur sintesis asam lemak esensial; varian dikaitkan dengan efisiensi konversi ALA menjadi EPA/DHA yang lebih rendah.', 'MODERATE'),
    ('LCT', 'rs4988235', 'KARBOHIDRAT_GLUKOSA', 'Menentukan persistensi laktase dewasa; genotipe non-persisten dikaitkan dengan intoleransi laktosa.', 'STRONG'),
    ('HFE', 'rs1800562 (C282Y)', 'VITAMIN_MIKRONUTRIEN', 'Varian dikaitkan dengan hemokromatosis herediter dan peningkatan penyerapan zat besi; perlu kehati-hatian pada suplementasi zat besi.', 'STRONG'),
    ('CLOCK', 'rs1801260', 'RITME_SIRKADIAN', 'Gen jam biologis utama; varian dikaitkan dengan preferensi waktu makan dan risiko obesitas terkait pola makan malam hari.', 'LIMITED'),
    ('PER2', 'rs2304672', 'RITME_SIRKADIAN', 'Berperan pada regulasi ritme sirkadian; varian dikaitkan dengan preferensi kronotipe dan waktu makan optimal.', 'LIMITED'),
    ('ADIPOQ', 'rs1501299', 'METABOLISME_ENERGI', 'Mengatur kadar adiponektin, hormon yang berperan pada sensitivitas insulin dan oksidasi lemak.', 'LIMITED'),
    ('UCP1', 'rs1800592', 'METABOLISME_ENERGI', 'Berperan pada termogenesis jaringan lemak coklat; varian dikaitkan dengan efisiensi pembakaran energi basal.', 'LIMITED'),
    ('UCP2', 'rs659366', 'METABOLISME_ENERGI', 'Mengatur efisiensi mitokondria dan produksi ROS; dikaitkan dengan variasi laju metabolisme basal.', 'LIMITED'),
    ('IL6', 'rs1800795', 'INFLAMASI', 'Sitokin proinflamasi; varian dikaitkan dengan kadar inflamasi basal lebih tinggi dan risiko resistensi insulin.', 'MODERATE'),
    ('TNF', 'rs1800629', 'INFLAMASI', 'Faktor nekrosis tumor alfa; varian dikaitkan dengan respons inflamasi lebih tinggi terhadap diet tinggi lemak jenuh.', 'MODERATE'),
    ('SLCO1B1', 'rs4149056', 'FARMAKOGENOMIK', 'Transporter hepatik yang memengaruhi kadar plasma statin; varian dikaitkan dengan risiko miopati terkait statin lebih tinggi (relevan bila pasien mengonsumsi statin).', 'STRONG')
ON CONFLICT (gene_symbol) DO NOTHING;

-- =====================================================================
-- RLS — same pattern as 015_rls.sql / 025_diagnosis_lab_module.sql
-- (authenticated: full CRUD on patient-linked tables; gene_reference is
-- a reference table, readable by anon like lab_critical_thresholds).
-- =====================================================================

ALTER TABLE genomic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE genomic_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE genomic_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gene_reference ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'genomic_reports', 'genomic_findings', 'genomic_interpretations'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_select', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', tbl || '_auth_select', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_insert', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', tbl || '_auth_insert', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_update', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl || '_auth_update', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_delete', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', tbl || '_auth_delete', tbl);
    END LOOP;
END $$;

DROP POLICY IF EXISTS gene_reference_anon_select ON gene_reference;
CREATE POLICY gene_reference_anon_select ON gene_reference
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS gene_reference_auth_select ON gene_reference;
CREATE POLICY gene_reference_auth_select ON gene_reference
    FOR SELECT TO authenticated USING (true);
