-- =====================================================================
-- 006_weight_tracking.sql
-- Purpose: Weight records + body composition + weight goals + weight prediction
-- Dependencies: 004_patient_module.sql
-- Tables: weight_records, body_compositions (NEW), weight_goals (NEW), weight_predictions (NEW)
-- =====================================================================

-- Weight Records (serial weight measurements — never overwrite)
CREATE TABLE IF NOT EXISTS weight_records (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID NOT NULL,
    date              TIMESTAMPTZ DEFAULT now(),
    weight            DOUBLE PRECISION NOT NULL,
    height            DOUBLE PRECISION,
    bmi               DOUBLE PRECISION,
    bmi_category      TEXT,
    weight_change     DOUBLE PRECISION,
    weight_change_pct DOUBLE PRECISION,
    note              TEXT,
    created_by        TEXT DEFAULT 'system',
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_weight_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT chk_weight_positive CHECK (weight > 0)
);
DROP TRIGGER IF EXISTS trg_weight_records_updated ON weight_records;
CREATE TRIGGER trg_weight_records_updated BEFORE UPDATE ON weight_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Body Composition
-- =====================================================================
CREATE TABLE IF NOT EXISTS body_compositions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    measured_at     TIMESTAMPTZ DEFAULT now(),
    method          body_comp_method_enum DEFAULT 'BIA',
    body_fat_pct    DOUBLE PRECISION,
    muscle_mass_kg  DOUBLE PRECISION,
    visceral_fat    DOUBLE PRECISION,
    bone_mass_kg    DOUBLE PRECISION,
    water_pct       DOUBLE PRECISION,
    basal_metabolism DOUBLE PRECISION,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_body_comp_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_body_compositions_updated ON body_compositions;
CREATE TRIGGER trg_body_compositions_updated BEFORE UPDATE ON body_compositions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Weight Goals (target weight + timeline)
-- =====================================================================
CREATE TABLE IF NOT EXISTS weight_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    start_weight    DOUBLE PRECISION NOT NULL,
    target_weight   DOUBLE PRECISION NOT NULL,
    start_date      TIMESTAMPTZ DEFAULT now(),
    target_date     TIMESTAMPTZ,
    status          TEXT DEFAULT 'ACTIVE',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_weight_goal_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT chk_weight_goal CHECK (start_weight > 0 AND target_weight > 0)
);
DROP TRIGGER IF EXISTS trg_weight_goals_updated ON weight_goals;
CREATE TRIGGER trg_weight_goals_updated BEFORE UPDATE ON weight_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Weight Prediction (AI-based trend forecasting)
-- =====================================================================
CREATE TABLE IF NOT EXISTS weight_predictions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    predicted_date      TIMESTAMPTZ NOT NULL,
    predicted_weight    DOUBLE PRECISION NOT NULL,
    confidence_pct      DOUBLE PRECISION,
    model               TEXT DEFAULT 'linear_regression',
    input_data          JSONB,
    created_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_weight_pred_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
