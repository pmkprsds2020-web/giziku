-- =====================================================================
-- 029_bouchard_activity_record.sql
-- Purpose: Bouchard Activity Record (BAR) module — 3-day / 96-box-per-day
--          physical activity log used to compute Energy Expenditure,
--          MET, and Physical Activity Level (PAL), and to feed AI Meal
--          Plan, Exercise Plan, Food Record (energy balance), and the
--          AI Clinical Decision Support module.
-- Dependencies: 000_extensions.sql (gen_random_uuid), 002_functions.sql
--               (update_updated_at), 004_patient_module.sql (patients),
--               015_rls.sql (RLS pattern)
-- Safe to run multiple times (idempotent).
-- =====================================================================

-- =====================================================================
-- 1. bouchard_assessments — one row per 3-day assessment.
--    Each day is stored as a JSONB array of 96 entries (15-minute boxes),
--    each entry either null (kosong) or an integer 1-9 (kode kategori
--    Bouchard). Computed results (energy expenditure, MET, PAL, minutes
--    per intensity bucket) are cached alongside the raw grid so the
--    dashboard, history, and comparison views never need to recompute
--    from scratch (the same computation is also available in
--    src/lib/clinical/bouchard.ts for the frontend live-preview).
-- =====================================================================

CREATE TABLE IF NOT EXISTS bouchard_assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    assessment_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg           NUMERIC(6,2) NOT NULL,

    -- Hari 1 = Hari Kerja 1, Hari 2 = Hari Kerja 2, Hari 3 = Hari Libur
    day1_date           DATE,
    day1_codes          JSONB NOT NULL DEFAULT '[]'::jsonb,
    day2_date           DATE,
    day2_codes          JSONB NOT NULL DEFAULT '[]'::jsonb,
    day3_date           DATE,
    day3_codes          JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Cached computed results (see computeAssessmentResult in bouchard.ts)
    day_results         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- per-day breakdown
    avg_energy_expenditure NUMERIC(8,2) DEFAULT 0,             -- kcal/hari
    avg_met             NUMERIC(6,3) DEFAULT 0,
    avg_pal             NUMERIC(6,3) DEFAULT 0,
    pal_category        TEXT CHECK (pal_category IN ('Sedentary','Low Active','Active','Very Active')),
    minutes_by_bucket   JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {tidur,istirahat,ringan,sedang,berat}
    who_status          JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- AI insight (see /api/ai/bouchard-insight)
    ai_summary          TEXT,
    ai_findings         JSONB DEFAULT '[]'::jsonb,
    ai_recommendations  JSONB DEFAULT '[]'::jsonb,
    ai_risk_level       TEXT CHECK (ai_risk_level IN ('LOW','MODERATE','HIGH')),
    ai_model            TEXT,

    notes               TEXT,
    created_by          TEXT DEFAULT 'system',
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT fk_bouchard_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bouchard_patient ON bouchard_assessments(patient_id, assessment_date DESC);

DROP TRIGGER IF EXISTS trg_bouchard_assessments_updated ON bouchard_assessments;
CREATE TRIGGER trg_bouchard_assessments_updated BEFORE UPDATE ON bouchard_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- 2. bouchard_activity_master — reference table for the 9 Bouchard
--    categories (kode 1-9), mirrored from BOUCHARD_CATEGORIES in
--    src/lib/clinical/bouchard.ts. Kept in the database as well so the
--    grid input UI, exports, and any future SQL-side reporting can read
--    the master list without a frontend round-trip.
-- =====================================================================

CREATE TABLE IF NOT EXISTS bouchard_activity_master (
    kode                SMALLINT PRIMARY KEY CHECK (kode BETWEEN 1 AND 9),
    nama                TEXT NOT NULL,
    deskripsi           TEXT,
    contoh_aktivitas    JSONB NOT NULL DEFAULT '[]'::jsonb,
    koefisien_energi    NUMERIC(5,3) NOT NULL,
    bucket              TEXT NOT NULL CHECK (bucket IN ('tidur','istirahat','ringan','sedang','berat'))
);

INSERT INTO bouchard_activity_master (kode, nama, deskripsi, contoh_aktivitas, koefisien_energi, bucket) VALUES
(1, 'Berbaring', 'Tidur, beristirahat di ranjang', '["Tidur","Beristirahat di ranjang"]', 0.26, 'tidur'),
(2, 'Duduk', 'Aktivitas dalam posisi duduk', '["Mendengarkan di dalam kelas","Makan","Menulis atau mengetik","Membaca","Mendengarkan radio atau menonton TV","Mandi (posisi duduk)"]', 0.38, 'istirahat'),
(3, 'Berdiri, aktivitas ringan', 'Aktivitas ringan dalam posisi berdiri', '["Mencuci bagian tubuh","Bercukur","Menyisir rambut","Memasak","Membersihkan debu"]', 0.57, 'ringan'),
(4, 'Aktivitas berdiri sedang', 'Berpakaian, ibadah, mandi berdiri, mengendarai kendaraan, berjalan santai', '["Berpakaian","Sholat","Mandi (posisi berdiri)","Mengendarai mobil","Berjalan-jalan"]', 0.70, 'ringan'),
(5, 'Pekerjaan manual ringan', 'Pekerjaan rumah tangga & pekerjaan manual intensitas ringan', '["Pekerjaan rumah tangga (jendela, menyapu, dll)","Pekerjaan laboratorium","Pertukangan kayu","Pertukangan batu","Mengendarai traktor pertanian","Memberi makan hewan ternak","Membereskan ranjang","Berjalan agak cepat","Penjahit","Pembuat tahu/tempe (UMKM)","Pelukis","Mekanik","Tukang kue (roti)"]', 0.83, 'ringan'),
(6, 'Olahraga/aktivitas senggang — ringan', 'Olahraga atau aktivitas di waktu senggang tingkat ringan', '["Kano (ringan)","Bola voli","Tenis meja","Baseball (kecuali pitcher)","Golf","Mendayung","Panahan","Bowling","Croquet","Berlayar","Bersepeda"]', 1.00, 'ringan'),
(7, 'Pekerjaan manual tingkat sedang', 'Pekerjaan fisik intensitas sedang', '["Mengoperasikan mesin","Memperbaiki pagar","Memasukkan tas/kotak","Bercocok tanam","Pekerjaan kehutanan","Pekerjaan pertambangan","Menyekop pasir"]', 1.20, 'sedang'),
(8, 'Olahraga/aktivitas senggang — sedang', 'Olahraga atau aktivitas di waktu senggang tingkat sedang', '["Baseball (pitcher)","Bulutangkis","Kano","Mengendarai kuda","Ski air","Berenang","Bersepeda (kompetisi)","Menari","Tenis","Senam","Jalan cepat","Jogging"]', 1.40, 'sedang'),
(9, 'Pekerjaan/olahraga berat', 'Pekerjaan manual berat & olahraga/aktivitas senggang tingkat berat', '["Menebang pohon","Menggergaji dengan gergaji tangan","Memotong cabang dahan pohon","Berlari (kompetisi)","Tinju","Mendaki gunung","Squash","Hoki air/lapangan","Bola basket","Football"]', 1.95, 'berat')
ON CONFLICT (kode) DO UPDATE SET
    nama = EXCLUDED.nama,
    deskripsi = EXCLUDED.deskripsi,
    contoh_aktivitas = EXCLUDED.contoh_aktivitas,
    koefisien_energi = EXCLUDED.koefisien_energi,
    bucket = EXCLUDED.bucket;

-- =====================================================================
-- 3. Row Level Security
-- =====================================================================

ALTER TABLE bouchard_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bouchard_activity_master ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY['bouchard_assessments'];
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

DROP POLICY IF EXISTS bouchard_activity_master_anon_select ON bouchard_activity_master;
CREATE POLICY bouchard_activity_master_anon_select ON bouchard_activity_master
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS bouchard_activity_master_auth_select ON bouchard_activity_master;
CREATE POLICY bouchard_activity_master_auth_select ON bouchard_activity_master
    FOR SELECT TO authenticated USING (true);
