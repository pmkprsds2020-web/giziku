-- =====================================================================
-- 005_nutrition_assessment.sql
-- Purpose: Nutrition assessment + presets + preset history
-- Dependencies: 004_patient_module.sql
-- Tables: anthropometry, nutrition_assessments, nutrition_presets, nutrition_preset_history,
--         nutrition_goals (NEW), favorite_foods (NEW), food_preferences (NEW), food_allergies (NEW)
-- =====================================================================

-- Anthropometry
CREATE TABLE IF NOT EXISTS anthropometry (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT now(),
    weight      DOUBLE PRECISION NOT NULL,
    height      DOUBLE PRECISION NOT NULL,
    bmi         DOUBLE PRECISION NOT NULL,
    bmi_category TEXT,
    waist       DOUBLE PRECISION,
    hip         DOUBLE PRECISION,
    whr         DOUBLE PRECISION,
    muac        DOUBLE PRECISION,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_anthro_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT chk_anthro_weight CHECK (weight > 0),
    CONSTRAINT chk_anthro_height CHECK (height > 0)
);
DROP TRIGGER IF EXISTS trg_anthropometry_updated ON anthropometry;
CREATE TRIGGER trg_anthropometry_updated BEFORE UPDATE ON anthropometry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Nutrition Assessments (MUST, NRS-2002, SGA, MNA, ECOG, Barthel, FRAIL, Fall Risk)
CREATE TABLE IF NOT EXISTS nutrition_assessments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT now(),
    must            TEXT,
    must_score      DOUBLE PRECISION,
    sga             TEXT,
    nrs2002         TEXT,
    nrs_score       DOUBLE PRECISION,
    mna             TEXT,
    mna_score       DOUBLE PRECISION,
    pps             TEXT,
    ecog            TEXT,
    barthel         INTEGER,
    frailty         TEXT,
    frailty_score   INTEGER,
    fall_risk       TEXT,
    hand_grip       DOUBLE PRECISION,
    calf_circ       DOUBLE PRECISION,
    activity        activity_level_enum DEFAULT 'BED_REST',
    stress          stress_level_enum DEFAULT 'NONE',
    notes           TEXT,
    created_by      TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_assessment_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT chk_barthel_range CHECK (barthel IS NULL OR (barthel >= 0 AND barthel <= 100))
);
DROP TRIGGER IF EXISTS trg_nutrition_assessments_updated ON nutrition_assessments;
CREATE TRIGGER trg_nutrition_assessments_updated BEFORE UPDATE ON nutrition_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Nutrition Presets (Save 1/2/3 + unlimited + templates)
CREATE TABLE IF NOT EXISTS nutrition_presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    color           TEXT DEFAULT '#10b981',
    icon            TEXT DEFAULT 'utensils',
    is_template     BOOLEAN DEFAULT false,
    is_favorite     BOOLEAN DEFAULT false,
    total_cal       DOUBLE PRECISION NOT NULL,
    target_weight   DOUBLE PRECISION,
    bmr             DOUBLE PRECISION,
    tdee            DOUBLE PRECISION,
    protein_pct     DOUBLE PRECISION NOT NULL,
    carb_pct        DOUBLE PRECISION NOT NULL,
    fat_pct         DOUBLE PRECISION NOT NULL,
    protein_g       DOUBLE PRECISION NOT NULL,
    carb_g          DOUBLE PRECISION NOT NULL,
    fat_g           DOUBLE PRECISION NOT NULL,
    fiber_g         DOUBLE PRECISION DEFAULT 25,
    sodium_mg       DOUBLE PRECISION DEFAULT 2300,
    potassium_mg    DOUBLE PRECISION,
    fluid_ml        DOUBLE PRECISION,
    goal            preset_goal_enum DEFAULT 'GENERAL',
    diagnoses       TEXT DEFAULT '',
    version         INTEGER DEFAULT 1,
    created_by      TEXT DEFAULT 'system',
    updated_by      TEXT DEFAULT 'system',
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_preset_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_nutrition_presets_updated ON nutrition_presets;
CREATE TRIGGER trg_nutrition_presets_updated BEFORE UPDATE ON nutrition_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Nutrition Preset History (audit trail for preset changes)
CREATE TABLE IF NOT EXISTS nutrition_preset_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id   UUID NOT NULL,
    changes     JSONB NOT NULL,
    version     INTEGER NOT NULL,
    actor       TEXT DEFAULT 'system',
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_preset_history_preset FOREIGN KEY (preset_id)
        REFERENCES nutrition_presets(id) ON DELETE CASCADE
);

-- =====================================================================
-- NEW MODULE: Nutrition Goals, Favorite Foods, Preferences, Allergies
-- =====================================================================

-- Nutrition Goals (patient-specific nutrition targets)
CREATE TABLE IF NOT EXISTS nutrition_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    goal_type       TEXT NOT NULL,
    target_value    DOUBLE PRECISION,
    current_value   DOUBLE PRECISION,
    unit            TEXT,
    target_date     TIMESTAMPTZ,
    status          TEXT DEFAULT 'ACTIVE',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_nutrition_goal_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_nutrition_goals_updated ON nutrition_goals;
CREATE TRIGGER trg_nutrition_goals_updated BEFORE UPDATE ON nutrition_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Favorite Foods (patient's frequently used foods)
CREATE TABLE IF NOT EXISTS favorite_foods (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    food_id     UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_fav_food_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_food_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE CASCADE,
    CONSTRAINT uq_fav_food_patient_food UNIQUE (patient_id, food_id)
);

-- Food Preferences (patient diet preferences)
CREATE TABLE IF NOT EXISTS food_preferences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    food_id     UUID,
    category    TEXT,
    preference  TEXT NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_food_pref_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_pref_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_food_preferences_updated ON food_preferences;
CREATE TRIGGER trg_food_preferences_updated BEFORE UPDATE ON food_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Food Allergies (patient allergy tracking)
CREATE TABLE IF NOT EXISTS food_allergies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    food_id     UUID,
    allergen    TEXT NOT NULL,
    severity    TEXT DEFAULT 'MILD',
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_allergy_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_allergy_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_food_allergies_updated ON food_allergies;
CREATE TRIGGER trg_food_allergies_updated BEFORE UPDATE ON food_allergies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
