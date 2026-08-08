-- =====================================================================
-- 025_diagnosis_lab_module.sql
-- Purpose: Rich Diagnosis management (status/priority/target/doctor) +
--          brand-new Laboratory Results module, both as CDSS inputs for
--          AI Meal Plan, Exercise Plan, Evaluasi AI CareLivia, and the
--          Laporan Klinis PDF.
-- Dependencies: 004_patient_module.sql (diagnoses, patients), 002_functions.sql
--               (update_updated_at()), 015_rls.sql (RLS pattern)
-- Safe to run multiple times (idempotent).
-- =====================================================================

-- =====================================================================
-- 1. EXTEND diagnoses — keep the existing `type` (closed clinical-engine
--    enum used by calorie/meal/exercise generators) untouched, add the
--    richer per-diagnosis metadata requested for the management card.
-- =====================================================================

ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS classification TEXT DEFAULT 'UTAMA'
        CHECK (classification IN ('UTAMA', 'SEKUNDER', 'KOMORBID', 'KOMPLIKASI')),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AKTIF'
        CHECK (status IN ('AKTIF', 'REMISI', 'SEMBUH', 'KRONIS', 'EVALUASI')),
    ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'SEDANG'
        CHECK (priority IN ('TINGGI', 'SEDANG', 'RENDAH')),
    ADD COLUMN IF NOT EXISTS diagnosed_at DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS doctor TEXT,
    ADD COLUMN IF NOT EXISTS target TEXT;

COMMENT ON COLUMN diagnoses.classification IS 'Jenis diagnosis: Utama / Sekunder / Komorbid / Komplikasi';
COMMENT ON COLUMN diagnoses.status IS 'Status klinis: Aktif / Remisi / Sembuh / Kronis / Dalam Evaluasi';
COMMENT ON COLUMN diagnoses.priority IS 'Prioritas intervensi: Tinggi / Sedang / Rendah';
COMMENT ON COLUMN diagnoses.target IS 'Target terapi bebas teks, mis. "HbA1c <7%"';

-- Diagnosis history — append-only audit trail, one row per change
CREATE TABLE IF NOT EXISTS diagnosis_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnosis_id    UUID NOT NULL,
    patient_id      UUID NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'DELETED')),
    changes         JSONB,
    changed_by      TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    -- No FK on diagnosis_id: the audit trail must survive the diagnosis
    -- row being deleted (that's exactly the event it needs to record).
    CONSTRAINT fk_diag_history_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_diagnosis_history_patient ON diagnosis_history(patient_id, created_at DESC);

-- =====================================================================
-- 2. laboratory_results — brand-new module, categorized clinical labs
--    used as an AI Evaluation / Meal Plan / Exercise Plan input.
-- =====================================================================

CREATE TABLE IF NOT EXISTS laboratory_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    category        TEXT NOT NULL CHECK (category IN (
        'GLUKOSA', 'HEMATOLOGI', 'FUNGSI_GINJAL', 'ELEKTROLIT',
        'PROFIL_LIPID', 'FUNGSI_HATI', 'NUTRISI', 'LAINNYA'
    )),
    test_name       TEXT NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    unit            TEXT,
    reference_min   DOUBLE PRECISION,
    reference_max   DOUBLE PRECISION,
    -- Computed at write-time by the application (value vs reference_min/max):
    -- NORMAL | BORDERLINE | TINGGI | RENDAH
    status          TEXT NOT NULL DEFAULT 'NORMAL'
        CHECK (status IN ('NORMAL', 'BORDERLINE', 'TINGGI', 'RENDAH')),
    lab_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    laboratory_name TEXT,
    notes           TEXT,
    attachment_url  TEXT,
    source          TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'OCR')),
    created_by      TEXT DEFAULT 'system',
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_lab_result_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lab_results_patient ON laboratory_results(patient_id, lab_date DESC);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_trend ON laboratory_results(patient_id, test_name, lab_date);

DROP TRIGGER IF EXISTS trg_laboratory_results_updated ON laboratory_results;
CREATE TRIGGER trg_laboratory_results_updated BEFORE UPDATE ON laboratory_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- 3. Clinical alert thresholds — reference table so "nilai kritis" alerts
--    (Dashboard / AI Evaluation / Laporan) are configurable, not hardcoded
--    in application code. Seeded with the values named in the spec.
-- =====================================================================

CREATE TABLE IF NOT EXISTS lab_critical_thresholds (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name       TEXT NOT NULL UNIQUE,
    critical_low    DOUBLE PRECISION,
    critical_high   DOUBLE PRECISION,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO lab_critical_thresholds (test_name, critical_low, critical_high, message) VALUES
    ('HbA1c', NULL, 9.0, 'HbA1c sangat tinggi — kontrol glikemik buruk, risiko komplikasi meningkat'),
    ('eGFR', 30, NULL, 'eGFR sangat rendah — fungsi ginjal menurun drastis'),
    ('Kalium', 3.0, 5.5, 'Kalium di luar batas aman — risiko aritmia'),
    ('LDL', NULL, 190, 'LDL sangat tinggi — risiko kardiovaskular tinggi'),
    ('GDS', 40, 400, 'Gula darah sewaktu pada rentang kritis')
ON CONFLICT (test_name) DO NOTHING;

-- =====================================================================
-- 4. Lab monitoring schedule — drives "Pengingat Pemeriksaan Laboratorium"
--    per diagnosis (e.g. HbA1c tiap 3 bulan pada DM).
-- =====================================================================

CREATE TABLE IF NOT EXISTS lab_monitoring_schedule (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnosis_type  diagnosis_type_enum NOT NULL,
    test_name       TEXT NOT NULL,
    interval_months INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_lab_schedule UNIQUE (diagnosis_type, test_name)
);

INSERT INTO lab_monitoring_schedule (diagnosis_type, test_name, interval_months) VALUES
    ('DM', 'HbA1c', 3),
    ('DM', 'Kreatinin', 6),
    ('CKD', 'eGFR', 3),
    ('CKD', 'Mikroalbumin', 6),
    ('CKD_ND', 'eGFR', 3),
    ('CKD_HD', 'eGFR', 3),
    ('DYSLIPIDEMIA', 'Kolesterol Total', 6),
    ('DYSLIPIDEMIA', 'LDL', 6),
    ('HT', 'Kreatinin', 12),
    ('GOUT', 'Asam Urat', 3)
ON CONFLICT (diagnosis_type, test_name) DO NOTHING;

-- =====================================================================
-- RLS — same pattern as 015_rls.sql (authenticated: full CRUD)
-- =====================================================================

ALTER TABLE diagnosis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_critical_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_monitoring_schedule ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'diagnosis_history', 'laboratory_results',
        'lab_critical_thresholds', 'lab_monitoring_schedule'
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

-- Reference tables (thresholds/schedule) are readable by anon too — they
-- carry no patient data, just clinical constants used to render UI hints.
DROP POLICY IF EXISTS lab_critical_thresholds_anon_select ON lab_critical_thresholds;
CREATE POLICY lab_critical_thresholds_anon_select ON lab_critical_thresholds
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS lab_monitoring_schedule_anon_select ON lab_monitoring_schedule;
CREATE POLICY lab_monitoring_schedule_anon_select ON lab_monitoring_schedule
    FOR SELECT TO anon USING (true);
