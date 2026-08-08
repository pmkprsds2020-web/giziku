-- =====================================================================
-- 004_patient_module.sql
-- Purpose: Patient, diagnosis, and recipe tables
-- Dependencies: 003_food_database.sql
-- Tables: patients, diagnoses, recipes, recipe_items
-- =====================================================================

-- Patients
CREATE TABLE IF NOT EXISTS patients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn                 TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    gender              gender_enum NOT NULL,
    birth_date          TIMESTAMPTZ NOT NULL,
    phone               TEXT DEFAULT '',
    address             TEXT DEFAULT '',
    religion            religion_enum DEFAULT 'ISLAM',
    blood_type          blood_type_enum DEFAULT 'UNKNOWN',
    allergy             TEXT DEFAULT '',
    height              DOUBLE PRECISION,
    weight              DOUBLE PRECISION,
    is_pregnant         BOOLEAN DEFAULT false,
    pregnancy_trimester INTEGER DEFAULT 0,
    is_lactating        BOOLEAN DEFAULT false,
    lactation_month     INTEGER DEFAULT 0,
    notes               TEXT,
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_patient_height CHECK (height IS NULL OR height > 0),
    CONSTRAINT chk_patient_weight CHECK (weight IS NULL OR weight > 0),
    CONSTRAINT chk_pregnancy_trimester CHECK (pregnancy_trimester >= 0 AND pregnancy_trimester <= 3)
);
DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Diagnoses
CREATE TABLE IF NOT EXISTS diagnoses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    type        diagnosis_type_enum NOT NULL,
    icd         TEXT,
    severity    TEXT,
    notes       TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_diagnosis_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_diagnoses_updated ON diagnoses;
CREATE TRIGGER trg_diagnoses_updated BEFORE UPDATE ON diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    servings    INTEGER DEFAULT 1,
    method      TEXT,
    image_url   TEXT,
    deleted_at  TIMESTAMPTZ,
    deleted_by  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_recipe_servings CHECK (servings >= 1)
);
DROP TRIGGER IF EXISTS trg_recipes_updated ON recipes;
CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Recipe Items
CREATE TABLE IF NOT EXISTS recipe_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id   UUID NOT NULL,
    food_id     UUID NOT NULL,
    amount      DOUBLE PRECISION NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_recipe_item_recipe FOREIGN KEY (recipe_id)
        REFERENCES recipes(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_item_food FOREIGN KEY (food_id)
        REFERENCES foods(id),
    CONSTRAINT chk_recipe_amount CHECK (amount > 0)
);
DROP TRIGGER IF EXISTS trg_recipe_items_updated ON recipe_items;
CREATE TRIGGER trg_recipe_items_updated BEFORE UPDATE ON recipe_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
