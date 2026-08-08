-- =====================================================================
-- CARELIVIA CNMS — Production Safe Database Setup (Idempotent)
-- 
-- Run this SINGLE file in Supabase SQL Editor.
-- Safe to run multiple times — no data loss, no extension drops.
--
-- Features:
--   ✅ CREATE TABLE IF NOT EXISTS (won't error if table exists)
--   ✅ ALTER TABLE ADD COLUMN IF NOT EXISTS (adds missing columns)
--   ✅ CREATE INDEX IF NOT EXISTS
--   ✅ CREATE OR REPLACE FUNCTION
--   ✅ DROP TRIGGER IF EXISTS + CREATE TRIGGER
--   ✅ DROP POLICY IF EXISTS + CREATE POLICY
--   ✅ DO $$ IF NOT EXISTS for enums
--   ✅ ON CONFLICT DO NOTHING for seed data
--   ✅ Does NOT drop tables, functions, or extensions
--   ✅ Does NOT drop Supabase internal functions
--   ✅ Does NOT drop pg_trgm functions (show_limit, etc.)
--   ✅ All PK and FK use UUID with gen_random_uuid()
-- =====================================================================

-- ========== 1. EXTENSIONS ==========
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ========== 2. ENUMS ==========
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN CREATE TYPE gender_enum AS ENUM ('MALE','FEMALE'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_type_enum') THEN CREATE TYPE blood_type_enum AS ENUM ('A','B','AB','O','UNKNOWN'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'religion_enum') THEN CREATE TYPE religion_enum AS ENUM ('ISLAM','KRISTEN','KATOLIK','HINDU','BUDDHA','KONGHUCU','OTHER'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diagnosis_type_enum') THEN CREATE TYPE diagnosis_type_enum AS ENUM ('DM','HT','CHF','CKD','CKD_ND','CKD_HD','CKD_PD','LIVER','CANCER','DYSLIPIDEMIA','GOUT','GERD','PUD','IBD','OBESITY','MALNUTRITION','SARCOPENIA','POST_OP','PREGNANCY','LACTATION','PEDIATRIC','GERIATRIC','STROKE','COPD','OTHER'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_level_enum') THEN CREATE TYPE activity_level_enum AS ENUM ('BED_REST','VERY_LIGHT','LIGHT','MODERATE','HEAVY'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stress_level_enum') THEN CREATE TYPE stress_level_enum AS ENUM ('NONE','MILD','MODERATE','SEVERE','VERY_SEVERE'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_slot_enum') THEN CREATE TYPE meal_slot_enum AS ENUM ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'food_source_enum') THEN CREATE TYPE food_source_enum AS ENUM ('TKPI','DKBM','USDA','CUSTOM'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shopping_period_enum') THEN CREATE TYPE shopping_period_enum AS ENUM ('DAILY','WEEKLY','MONTHLY'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_type_enum') THEN CREATE TYPE exercise_type_enum AS ENUM ('AEROBIC','RESISTANCE','FLEXIBILITY','BALANCE','FUNCTIONAL'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_intensity_enum') THEN CREATE TYPE exercise_intensity_enum AS ENUM ('LOW','MODERATE','HIGH'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preset_goal_enum') THEN CREATE TYPE preset_goal_enum AS ENUM ('WEIGHT_LOSS','WEIGHT_MAINTAIN','WEIGHT_GAIN','HIGH_PROTEIN','LOW_CARB','LOW_FAT','CKD_DIET','DIABETES_DIET','HYPERTENSION_DIET','GENERAL'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_request_status_enum') THEN CREATE TYPE ai_request_status_enum AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_request_type_enum') THEN CREATE TYPE ai_request_type_enum AS ENUM ('MEAL_PLAN','EXERCISE_PLAN','NUTRITION_ADVICE','FOOD_RECOMMENDATION','COMPLIANCE_ANALYSIS'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_comp_method_enum') THEN CREATE TYPE body_comp_method_enum AS ENUM ('BIA','SKINFOLD','DEXA','BOD_POD','ESTIMATE'); END IF; END $$;

-- ========== 3. FUNCTIONS ==========
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Simplified audit function — logs basic info without complex JSON diff
-- This avoids the "relation v_diff does not exist" error from single-line parsing
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_entity TEXT := TG_TABLE_NAME;
    v_entity_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := (OLD.id)::UUID;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_entity_id := (NEW.id)::UUID;
    ELSIF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_entity_id := (NEW.id)::UUID;
    END IF;

    -- Only log if audit_logs table exists
    BEGIN
        INSERT INTO audit_logs (entity, entity_id, action, actor, created_at)
        VALUES (
            v_entity,
            v_entity_id,
            v_action,
            COALESCE(current_setting('app.current_user', true), 'system'),
            now()
        );
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== 4. TABLES (all UUID, all IF NOT EXISTS) ==========

-- Food database
CREATE TABLE IF NOT EXISTS food_categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS trg_food_categories_updated ON food_categories; CREATE TRIGGER trg_food_categories_updated BEFORE UPDATE ON food_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS food_subcategories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL, category_id UUID NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), CONSTRAINT fk_food_subcategory_category FOREIGN KEY (category_id) REFERENCES food_categories(id) ON DELETE CASCADE);
DROP TRIGGER IF EXISTS trg_food_subcategories_updated ON food_subcategories; CREATE TRIGGER trg_food_subcategories_updated BEFORE UPDATE ON food_subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS food_labels (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL, color TEXT DEFAULT '#10b981', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS trg_food_labels_updated ON food_labels; CREATE TRIGGER trg_food_labels_updated BEFORE UPDATE ON food_labels FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, english_name TEXT, alias TEXT, code TEXT, category_id UUID NOT NULL, subcategory_id UUID, source food_source_enum DEFAULT 'CUSTOM', description TEXT,
    energy DOUBLE PRECISION NOT NULL DEFAULT 0, protein DOUBLE PRECISION NOT NULL DEFAULT 0, fat DOUBLE PRECISION NOT NULL DEFAULT 0, carb DOUBLE PRECISION NOT NULL DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, water DOUBLE PRECISION DEFAULT 0, ash DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, calcium DOUBLE PRECISION DEFAULT 0, magnesium DOUBLE PRECISION DEFAULT 0, iron DOUBLE PRECISION DEFAULT 0, phosphorus DOUBLE PRECISION DEFAULT 0, zinc DOUBLE PRECISION DEFAULT 0, vit_a DOUBLE PRECISION DEFAULT 0, vit_b1 DOUBLE PRECISION DEFAULT 0, vit_b2 DOUBLE PRECISION DEFAULT 0, vit_b6 DOUBLE PRECISION DEFAULT 0, vit_b12 DOUBLE PRECISION DEFAULT 0, vit_c DOUBLE PRECISION DEFAULT 0, vit_d DOUBLE PRECISION DEFAULT 0, vit_e DOUBLE PRECISION DEFAULT 0, vit_k DOUBLE PRECISION DEFAULT 0, cholesterol DOUBLE PRECISION DEFAULT 0, gi INTEGER DEFAULT 0,
    urt TEXT, urt_gram DOUBLE PRECISION, bdd DOUBLE PRECISION DEFAULT 100, price DOUBLE PRECISION DEFAULT 0, price_unit TEXT DEFAULT 'g', price_location TEXT, price_source TEXT, price_updated_at TIMESTAMPTZ, price_is_estimate BOOLEAN DEFAULT false, unit TEXT DEFAULT 'g', image_url TEXT, tags TEXT DEFAULT '', approved BOOLEAN DEFAULT true, version INTEGER DEFAULT 1, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
-- Add FK constraints only if they don't exist (using DO block to avoid errors)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_category' AND table_name = 'foods') THEN
        ALTER TABLE foods ADD CONSTRAINT fk_food_category FOREIGN KEY (category_id) REFERENCES food_categories(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_subcategory' AND table_name = 'foods') THEN
        ALTER TABLE foods ADD CONSTRAINT fk_food_subcategory FOREIGN KEY (subcategory_id) REFERENCES food_subcategories(id) ON DELETE SET NULL;
    END IF;
END $$;
DROP TRIGGER IF EXISTS trg_foods_updated ON foods; CREATE TRIGGER trg_foods_updated BEFORE UPDATE ON foods FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Search vector: only add if column doesn't exist or is not generated
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'foods' AND column_name = 'search_vector') THEN
        ALTER TABLE foods ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(name, '')), 'A') || setweight(to_tsvector('simple', coalesce(english_name, '')), 'B') || setweight(to_tsvector('simple', coalesce(alias, '')), 'B') || setweight(to_tsvector('simple', coalesce(tags, '')), 'C')) STORED;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS food_labels_junction (food_id UUID NOT NULL, label_id UUID NOT NULL, PRIMARY KEY (food_id, label_id));
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_flj_food' AND table_name = 'food_labels_junction') THEN
        ALTER TABLE food_labels_junction ADD CONSTRAINT fk_flj_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_flj_label' AND table_name = 'food_labels_junction') THEN
        ALTER TABLE food_labels_junction ADD CONSTRAINT fk_flj_label FOREIGN KEY (label_id) REFERENCES food_labels(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS food_price_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_id UUID NOT NULL, price DOUBLE PRECISION NOT NULL, previous_price DOUBLE PRECISION, unit TEXT DEFAULT 'g', location TEXT, source TEXT, notes TEXT, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_price_history_food' AND table_name = 'food_price_history') THEN ALTER TABLE food_price_history ADD CONSTRAINT fk_price_history_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE; END IF; END $$;

CREATE TABLE IF NOT EXISTS food_change_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_id UUID NOT NULL, action TEXT NOT NULL, changes JSONB, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_change_log_food' AND table_name = 'food_change_logs') THEN ALTER TABLE food_change_logs ADD CONSTRAINT fk_change_log_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE; END IF; END $$;

-- Patient module
CREATE TABLE IF NOT EXISTS patients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), mrn TEXT UNIQUE NOT NULL, name TEXT NOT NULL, gender gender_enum NOT NULL, birth_date TIMESTAMPTZ NOT NULL, phone TEXT DEFAULT '', address TEXT DEFAULT '', religion religion_enum DEFAULT 'ISLAM', blood_type blood_type_enum DEFAULT 'UNKNOWN', allergy TEXT DEFAULT '', height DOUBLE PRECISION, weight DOUBLE PRECISION, is_pregnant BOOLEAN DEFAULT false, pregnancy_trimester INTEGER DEFAULT 0, is_lactating BOOLEAN DEFAULT false, lactation_month INTEGER DEFAULT 0, notes TEXT, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS trg_patients_updated ON patients; CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS diagnoses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, type diagnosis_type_enum NOT NULL, icd TEXT, severity TEXT, notes TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_diagnosis_patient' AND table_name = 'diagnoses') THEN ALTER TABLE diagnoses ADD CONSTRAINT fk_diagnosis_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_diagnoses_updated ON diagnoses; CREATE TRIGGER trg_diagnoses_updated BEFORE UPDATE ON diagnoses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS recipes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, servings INTEGER DEFAULT 1, method TEXT, image_url TEXT, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS trg_recipes_updated ON recipes; CREATE TRIGGER trg_recipes_updated BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS recipe_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id UUID NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_recipe_item_recipe' AND table_name = 'recipe_items') THEN ALTER TABLE recipe_items ADD CONSTRAINT fk_recipe_item_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_recipe_item_food' AND table_name = 'recipe_items') THEN ALTER TABLE recipe_items ADD CONSTRAINT fk_recipe_item_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_recipe_items_updated ON recipe_items; CREATE TRIGGER trg_recipe_items_updated BEFORE UPDATE ON recipe_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Nutrition assessment
CREATE TABLE IF NOT EXISTS anthropometry (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, recorded_at TIMESTAMPTZ DEFAULT now(), weight DOUBLE PRECISION NOT NULL, height DOUBLE PRECISION NOT NULL, bmi DOUBLE PRECISION NOT NULL, bmi_category TEXT, waist DOUBLE PRECISION, hip DOUBLE PRECISION, whr DOUBLE PRECISION, muac DOUBLE PRECISION, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_anthro_patient' AND table_name = 'anthropometry') THEN ALTER TABLE anthropometry ADD CONSTRAINT fk_anthro_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_anthropometry_updated ON anthropometry; CREATE TRIGGER trg_anthropometry_updated BEFORE UPDATE ON anthropometry FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS nutrition_assessments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, recorded_at TIMESTAMPTZ DEFAULT now(), must TEXT, must_score DOUBLE PRECISION, sga TEXT, nrs2002 TEXT, nrs_score DOUBLE PRECISION, mna TEXT, mna_score DOUBLE PRECISION, pps TEXT, ecog TEXT, barthel INTEGER, frailty TEXT, frailty_score INTEGER, fall_risk TEXT, hand_grip DOUBLE PRECISION, calf_circ DOUBLE PRECISION, activity activity_level_enum DEFAULT 'BED_REST', stress stress_level_enum DEFAULT 'NONE', notes TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_assessment_patient' AND table_name = 'nutrition_assessments') THEN ALTER TABLE nutrition_assessments ADD CONSTRAINT fk_assessment_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_nutrition_assessments_updated ON nutrition_assessments; CREATE TRIGGER trg_nutrition_assessments_updated BEFORE UPDATE ON nutrition_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS nutrition_presets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID, name TEXT NOT NULL, description TEXT DEFAULT '', color TEXT DEFAULT '#10b981', icon TEXT DEFAULT 'utensils', is_template BOOLEAN DEFAULT false, is_favorite BOOLEAN DEFAULT false, total_cal DOUBLE PRECISION NOT NULL, target_weight DOUBLE PRECISION, bmr DOUBLE PRECISION, tdee DOUBLE PRECISION, protein_pct DOUBLE PRECISION NOT NULL, carb_pct DOUBLE PRECISION NOT NULL, fat_pct DOUBLE PRECISION NOT NULL, protein_g DOUBLE PRECISION NOT NULL, carb_g DOUBLE PRECISION NOT NULL, fat_g DOUBLE PRECISION NOT NULL, fiber_g DOUBLE PRECISION DEFAULT 25, sodium_mg DOUBLE PRECISION DEFAULT 2300, potassium_mg DOUBLE PRECISION, fluid_ml DOUBLE PRECISION, goal preset_goal_enum DEFAULT 'GENERAL', diagnoses TEXT DEFAULT '', version INTEGER DEFAULT 1, created_by TEXT DEFAULT 'system', updated_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_preset_patient' AND table_name = 'nutrition_presets') THEN ALTER TABLE nutrition_presets ADD CONSTRAINT fk_preset_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_nutrition_presets_updated ON nutrition_presets; CREATE TRIGGER trg_nutrition_presets_updated BEFORE UPDATE ON nutrition_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS nutrition_preset_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), preset_id UUID NOT NULL, changes JSONB NOT NULL, version INTEGER NOT NULL, actor TEXT DEFAULT 'system', reason TEXT, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_preset_history_preset' AND table_name = 'nutrition_preset_history') THEN ALTER TABLE nutrition_preset_history ADD CONSTRAINT fk_preset_history_preset FOREIGN KEY (preset_id) REFERENCES nutrition_presets(id) ON DELETE CASCADE; END IF; END $$;

CREATE TABLE IF NOT EXISTS nutrition_goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, goal_type TEXT NOT NULL, target_value DOUBLE PRECISION, current_value DOUBLE PRECISION, unit TEXT, target_date TIMESTAMPTZ, status TEXT DEFAULT 'ACTIVE', notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_nutrition_goal_patient' AND table_name = 'nutrition_goals') THEN ALTER TABLE nutrition_goals ADD CONSTRAINT fk_nutrition_goal_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_nutrition_goals_updated ON nutrition_goals; CREATE TRIGGER trg_nutrition_goals_updated BEFORE UPDATE ON nutrition_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS favorite_foods (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, food_id UUID NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), CONSTRAINT uq_fav_food_patient_food UNIQUE (patient_id, food_id));
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fav_food_patient' AND table_name = 'favorite_foods') THEN ALTER TABLE favorite_foods ADD CONSTRAINT fk_fav_food_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fav_food_food' AND table_name = 'favorite_foods') THEN ALTER TABLE favorite_foods ADD CONSTRAINT fk_fav_food_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE; END IF;
END $$;

CREATE TABLE IF NOT EXISTS food_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, food_id UUID, category TEXT, preference TEXT NOT NULL, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_pref_patient' AND table_name = 'food_preferences') THEN ALTER TABLE food_preferences ADD CONSTRAINT fk_food_pref_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_pref_food' AND table_name = 'food_preferences') THEN ALTER TABLE food_preferences ADD CONSTRAINT fk_food_pref_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_food_preferences_updated ON food_preferences; CREATE TRIGGER trg_food_preferences_updated BEFORE UPDATE ON food_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS food_allergies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, food_id UUID, allergen TEXT NOT NULL, severity TEXT DEFAULT 'MILD', notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_allergy_patient' AND table_name = 'food_allergies') THEN ALTER TABLE food_allergies ADD CONSTRAINT fk_allergy_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_allergy_food' AND table_name = 'food_allergies') THEN ALTER TABLE food_allergies ADD CONSTRAINT fk_allergy_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_food_allergies_updated ON food_allergies; CREATE TRIGGER trg_food_allergies_updated BEFORE UPDATE ON food_allergies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Weight tracking
CREATE TABLE IF NOT EXISTS weight_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, date TIMESTAMPTZ DEFAULT now(), weight DOUBLE PRECISION NOT NULL, height DOUBLE PRECISION, bmi DOUBLE PRECISION, bmi_category TEXT, weight_change DOUBLE PRECISION, weight_change_pct DOUBLE PRECISION, note TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_weight_patient' AND table_name = 'weight_records') THEN ALTER TABLE weight_records ADD CONSTRAINT fk_weight_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_weight_records_updated ON weight_records; CREATE TRIGGER trg_weight_records_updated BEFORE UPDATE ON weight_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS body_compositions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, measured_at TIMESTAMPTZ DEFAULT now(), method body_comp_method_enum DEFAULT 'BIA', body_fat_pct DOUBLE PRECISION, muscle_mass_kg DOUBLE PRECISION, visceral_fat DOUBLE PRECISION, bone_mass_kg DOUBLE PRECISION, water_pct DOUBLE PRECISION, basal_metabolism DOUBLE PRECISION, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_body_comp_patient' AND table_name = 'body_compositions') THEN ALTER TABLE body_compositions ADD CONSTRAINT fk_body_comp_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_body_compositions_updated ON body_compositions; CREATE TRIGGER trg_body_compositions_updated BEFORE UPDATE ON body_compositions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS weight_goals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, start_weight DOUBLE PRECISION NOT NULL, target_weight DOUBLE PRECISION NOT NULL, start_date TIMESTAMPTZ DEFAULT now(), target_date TIMESTAMPTZ, status TEXT DEFAULT 'ACTIVE', notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_weight_goal_patient' AND table_name = 'weight_goals') THEN ALTER TABLE weight_goals ADD CONSTRAINT fk_weight_goal_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_weight_goals_updated ON weight_goals; CREATE TRIGGER trg_weight_goals_updated BEFORE UPDATE ON weight_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS weight_predictions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, predicted_date TIMESTAMPTZ NOT NULL, predicted_weight DOUBLE PRECISION NOT NULL, confidence_pct DOUBLE PRECISION, model TEXT DEFAULT 'linear_regression', input_data JSONB, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_weight_pred_patient' AND table_name = 'weight_predictions') THEN ALTER TABLE weight_predictions ADD CONSTRAINT fk_weight_pred_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;

-- Meal plan
CREATE TABLE IF NOT EXISTS meal_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, preset_id UUID, date TIMESTAMPTZ DEFAULT now(), target_cal DOUBLE PRECISION NOT NULL, target_protein DOUBLE PRECISION NOT NULL, target_fat DOUBLE PRECISION NOT NULL, target_carb DOUBLE PRECISION NOT NULL, target_fiber DOUBLE PRECISION NOT NULL, target_sodium DOUBLE PRECISION NOT NULL, total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, compliance DOUBLE PRECISION DEFAULT 0, status TEXT DEFAULT 'DRAFT', ai_model TEXT, ai_reasoning TEXT, notes TEXT, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_plan_patient' AND table_name = 'meal_plans') THEN ALTER TABLE meal_plans ADD CONSTRAINT fk_meal_plan_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_plan_preset' AND table_name = 'meal_plans') THEN ALTER TABLE meal_plans ADD CONSTRAINT fk_meal_plan_preset FOREIGN KEY (preset_id) REFERENCES nutrition_presets(id) ON DELETE SET NULL; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_meal_plans_updated ON meal_plans; CREATE TRIGGER trg_meal_plans_updated BEFORE UPDATE ON meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS meal_plan_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meal_plan_id UUID NOT NULL, slot meal_slot_enum NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_item_plan' AND table_name = 'meal_plan_items') THEN ALTER TABLE meal_plan_items ADD CONSTRAINT fk_meal_item_plan FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_item_food' AND table_name = 'meal_plan_items') THEN ALTER TABLE meal_plan_items ADD CONSTRAINT fk_meal_item_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_meal_plan_items_updated ON meal_plan_items; CREATE TRIGGER trg_meal_plan_items_updated BEFORE UPDATE ON meal_plan_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS meal_plan_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meal_plan_id UUID NOT NULL, action TEXT NOT NULL, changes JSONB, snapshot JSONB, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_plan_history_plan' AND table_name = 'meal_plan_history') THEN ALTER TABLE meal_plan_history ADD CONSTRAINT fk_meal_plan_history_plan FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE; END IF; END $$;

CREATE TABLE IF NOT EXISTS meal_plan_versions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), meal_plan_id UUID NOT NULL, version INTEGER NOT NULL, snapshot JSONB NOT NULL, reason TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_meal_plan_version_plan' AND table_name = 'meal_plan_versions') THEN ALTER TABLE meal_plan_versions ADD CONSTRAINT fk_meal_plan_version_plan FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE CASCADE; END IF; END $$;

-- Food records
CREATE TABLE IF NOT EXISTS food_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, date TIMESTAMPTZ DEFAULT now(), slot meal_slot_enum NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, consumed DOUBLE PRECISION DEFAULT 100, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_record_patient' AND table_name = 'food_records') THEN ALTER TABLE food_records ADD CONSTRAINT fk_food_record_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_food_record_food' AND table_name = 'food_records') THEN ALTER TABLE food_records ADD CONSTRAINT fk_food_record_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_food_records_updated ON food_records; CREATE TRIGGER trg_food_records_updated BEFORE UPDATE ON food_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS food_record_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_record_id UUID NOT NULL, action TEXT NOT NULL, changes JSONB, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fr_history_record' AND table_name = 'food_record_history') THEN ALTER TABLE food_record_history ADD CONSTRAINT fk_fr_history_record FOREIGN KEY (food_record_id) REFERENCES food_records(id) ON DELETE CASCADE; END IF; END $$;

CREATE TABLE IF NOT EXISTS food_record_photos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_record_id UUID, patient_id UUID NOT NULL, image_url TEXT NOT NULL, thumbnail_url TEXT, ai_analysis JSONB, notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fr_photo_record' AND table_name = 'food_record_photos') THEN ALTER TABLE food_record_photos ADD CONSTRAINT fk_fr_photo_record FOREIGN KEY (food_record_id) REFERENCES food_records(id) ON DELETE SET NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fr_photo_patient' AND table_name = 'food_record_photos') THEN ALTER TABLE food_record_photos ADD CONSTRAINT fk_fr_photo_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
END $$;

CREATE TABLE IF NOT EXISTS food_record_ai (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_record_id UUID, food_record_photo_id UUID, ai_model TEXT, detected_foods JSONB, estimated_calories DOUBLE PRECISION, estimated_protein DOUBLE PRECISION, estimated_fat DOUBLE PRECISION, estimated_carb DOUBLE PRECISION, confidence_pct DOUBLE PRECISION, raw_response JSONB, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fr_ai_record' AND table_name = 'food_record_ai') THEN ALTER TABLE food_record_ai ADD CONSTRAINT fk_fr_ai_record FOREIGN KEY (food_record_id) REFERENCES food_records(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fr_ai_photo' AND table_name = 'food_record_ai') THEN ALTER TABLE food_record_ai ADD CONSTRAINT fk_fr_ai_photo FOREIGN KEY (food_record_photo_id) REFERENCES food_record_photos(id) ON DELETE CASCADE; END IF;
END $$;

-- Saved menus
CREATE TABLE IF NOT EXISTS saved_menus (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID, name TEXT NOT NULL, category TEXT NOT NULL, notes TEXT DEFAULT '', total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, total_potassium DOUBLE PRECISION DEFAULT 0, version INTEGER DEFAULT 1, last_used_at TIMESTAMPTZ, use_count INTEGER DEFAULT 0, created_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_saved_menu_patient' AND table_name = 'saved_menus') THEN ALTER TABLE saved_menus ADD CONSTRAINT fk_saved_menu_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_saved_menus_updated ON saved_menus; CREATE TRIGGER trg_saved_menus_updated BEFORE UPDATE ON saved_menus FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS saved_menu_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), saved_menu_id UUID NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, food_name TEXT NOT NULL, urt TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_saved_menu_item_menu' AND table_name = 'saved_menu_items') THEN ALTER TABLE saved_menu_items ADD CONSTRAINT fk_saved_menu_item_menu FOREIGN KEY (saved_menu_id) REFERENCES saved_menus(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_saved_menu_item_food' AND table_name = 'saved_menu_items') THEN ALTER TABLE saved_menu_items ADD CONSTRAINT fk_saved_menu_item_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_saved_menu_items_updated ON saved_menu_items; CREATE TRIGGER trg_saved_menu_items_updated BEFORE UPDATE ON saved_menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Saved meal plans
CREATE TABLE IF NOT EXISTS saved_meal_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID, name TEXT NOT NULL, description TEXT DEFAULT '', notes TEXT DEFAULT '', total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, total_potassium DOUBLE PRECISION DEFAULT 0, version INTEGER DEFAULT 1, last_used_at TIMESTAMPTZ, use_count INTEGER DEFAULT 0, created_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_saved_meal_plan_patient' AND table_name = 'saved_meal_plans') THEN ALTER TABLE saved_meal_plans ADD CONSTRAINT fk_saved_meal_plan_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_saved_meal_plans_updated ON saved_meal_plans; CREATE TRIGGER trg_saved_meal_plans_updated BEFORE UPDATE ON saved_meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS saved_meal_plan_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), saved_meal_plan_id UUID NOT NULL, slot TEXT NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, food_name TEXT NOT NULL, urt TEXT, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_smpi_plan' AND table_name = 'saved_meal_plan_items') THEN ALTER TABLE saved_meal_plan_items ADD CONSTRAINT fk_smpi_plan FOREIGN KEY (saved_meal_plan_id) REFERENCES saved_meal_plans(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_smpi_food' AND table_name = 'saved_meal_plan_items') THEN ALTER TABLE saved_meal_plan_items ADD CONSTRAINT fk_smpi_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;

CREATE TABLE IF NOT EXISTS comparison_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, meal_plan_id UUID, saved_menu_name TEXT, food_record_date TIMESTAMPTZ NOT NULL, compliance_score DOUBLE PRECISION DEFAULT 0, results JSONB, ai_insight TEXT, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_comparison_patient' AND table_name = 'comparison_history') THEN ALTER TABLE comparison_history ADD CONSTRAINT fk_comparison_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_comparison_meal_plan' AND table_name = 'comparison_history') THEN ALTER TABLE comparison_history ADD CONSTRAINT fk_comparison_meal_plan FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL; END IF;
END $$;

-- Shopping
CREATE TABLE IF NOT EXISTS shopping_lists (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, meal_plan_id UUID UNIQUE, period shopping_period_enum DEFAULT 'WEEKLY', multiplier DOUBLE PRECISION DEFAULT 7, total_estimate DOUBLE PRECISION DEFAULT 0, currency TEXT DEFAULT 'IDR', checked_count INTEGER DEFAULT 0, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_patient' AND table_name = 'shopping_lists') THEN ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_meal_plan' AND table_name = 'shopping_lists') THEN ALTER TABLE shopping_lists ADD CONSTRAINT fk_shopping_meal_plan FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id) ON DELETE SET NULL; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_shopping_lists_updated ON shopping_lists; CREATE TRIGGER trg_shopping_lists_updated BEFORE UPDATE ON shopping_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS shopping_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shopping_list_id UUID NOT NULL, food_id UUID NOT NULL, amount DOUBLE PRECISION NOT NULL, unit TEXT DEFAULT 'g', est_price DOUBLE PRECISION DEFAULT 0, checked BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_item_list' AND table_name = 'shopping_items') THEN ALTER TABLE shopping_items ADD CONSTRAINT fk_shopping_item_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_item_food' AND table_name = 'shopping_items') THEN ALTER TABLE shopping_items ADD CONSTRAINT fk_shopping_item_food FOREIGN KEY (food_id) REFERENCES foods(id); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_shopping_items_updated ON shopping_items; CREATE TRIGGER trg_shopping_items_updated BEFORE UPDATE ON shopping_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS market_prices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), food_id UUID NOT NULL, price DOUBLE PRECISION NOT NULL, unit TEXT DEFAULT 'g', province TEXT, city TEXT, district TEXT, source_type TEXT, source_name TEXT, recorded_at TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_market_price_food' AND table_name = 'market_prices') THEN ALTER TABLE market_prices ADD CONSTRAINT fk_market_price_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE; END IF; END $$;

CREATE TABLE IF NOT EXISTS shopping_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, shopping_list_id UUID, total_items INTEGER, total_estimate DOUBLE PRECISION, actual_total DOUBLE PRECISION, shopped_at TIMESTAMPTZ DEFAULT now(), notes TEXT, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_history_patient' AND table_name = 'shopping_history') THEN ALTER TABLE shopping_history ADD CONSTRAINT fk_shopping_history_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_shopping_history_list' AND table_name = 'shopping_history') THEN ALTER TABLE shopping_history ADD CONSTRAINT fk_shopping_history_list FOREIGN KEY (shopping_list_id) REFERENCES shopping_lists(id) ON DELETE SET NULL; END IF;
END $$;

CREATE TABLE IF NOT EXISTS price_sources (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, type TEXT NOT NULL, location TEXT, website TEXT, contact TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DROP TRIGGER IF EXISTS trg_price_sources_updated ON price_sources; CREATE TRIGGER trg_price_sources_updated BEFORE UPDATE ON price_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Exercise + AI
CREATE TABLE IF NOT EXISTS exercise_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, date TIMESTAMPTZ DEFAULT now(), total_burned DOUBLE PRECISION DEFAULT 0, target_burned DOUBLE PRECISION DEFAULT 0, notes TEXT, deleted_at TIMESTAMPTZ, deleted_by TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_exercise_patient' AND table_name = 'exercise_plans') THEN ALTER TABLE exercise_plans ADD CONSTRAINT fk_exercise_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_exercise_plans_updated ON exercise_plans; CREATE TRIGGER trg_exercise_plans_updated BEFORE UPDATE ON exercise_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS exercise_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), exercise_plan_id UUID NOT NULL, name TEXT NOT NULL, type exercise_type_enum NOT NULL, intensity exercise_intensity_enum NOT NULL, duration INTEGER NOT NULL, calories_burned DOUBLE PRECISION NOT NULL, met DOUBLE PRECISION DEFAULT 3, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_exercise_item_plan' AND table_name = 'exercise_items') THEN ALTER TABLE exercise_items ADD CONSTRAINT fk_exercise_item_plan FOREIGN KEY (exercise_plan_id) REFERENCES exercise_plans(id) ON DELETE CASCADE; END IF; END $$;
DROP TRIGGER IF EXISTS trg_exercise_items_updated ON exercise_items; CREATE TRIGGER trg_exercise_items_updated BEFORE UPDATE ON exercise_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS ai_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID, request_type ai_request_type_enum NOT NULL, status ai_request_status_enum DEFAULT 'PENDING', input_data JSONB, output_data JSONB, model TEXT, tokens_used INTEGER, duration_ms INTEGER, error_message TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ai_request_patient' AND table_name = 'ai_requests') THEN ALTER TABLE ai_requests ADD CONSTRAINT fk_ai_request_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL; END IF; END $$;
DROP TRIGGER IF EXISTS trg_ai_requests_updated ON ai_requests; CREATE TRIGGER trg_ai_requests_updated BEFORE UPDATE ON ai_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS ai_recommendations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), patient_id UUID NOT NULL, ai_request_id UUID, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'MEDIUM', status TEXT DEFAULT 'PENDING', metadata JSONB, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ai_rec_patient' AND table_name = 'ai_recommendations') THEN ALTER TABLE ai_recommendations ADD CONSTRAINT fk_ai_rec_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ai_rec_request' AND table_name = 'ai_recommendations') THEN ALTER TABLE ai_recommendations ADD CONSTRAINT fk_ai_rec_request FOREIGN KEY (ai_request_id) REFERENCES ai_requests(id) ON DELETE SET NULL; END IF;
END $$;
DROP TRIGGER IF EXISTS trg_ai_recommendations_updated ON ai_recommendations; CREATE TRIGGER trg_ai_recommendations_updated BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS ai_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ai_request_id UUID, level TEXT DEFAULT 'INFO', message TEXT, data JSONB, created_at TIMESTAMPTZ DEFAULT now());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_ai_log_request' AND table_name = 'ai_logs') THEN ALTER TABLE ai_logs ADD CONSTRAINT fk_ai_log_request FOREIGN KEY (ai_request_id) REFERENCES ai_requests(id) ON DELETE CASCADE; END IF; END $$;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), entity TEXT NOT NULL, entity_id UUID NOT NULL, action TEXT NOT NULL, diff JSONB, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());

-- Audit triggers (idempotent)
DROP TRIGGER IF EXISTS trg_audit_patients ON patients; CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_foods ON foods; CREATE TRIGGER trg_audit_foods AFTER INSERT OR UPDATE OR DELETE ON foods FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_meal_plans ON meal_plans; CREATE TRIGGER trg_audit_meal_plans AFTER INSERT OR UPDATE OR DELETE ON meal_plans FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_food_records ON food_records; CREATE TRIGGER trg_audit_food_records AFTER INSERT OR UPDATE OR DELETE ON food_records FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_weight_records ON weight_records; CREATE TRIGGER trg_audit_weight_records AFTER INSERT OR UPDATE OR DELETE ON weight_records FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_nutrition_assessments ON nutrition_assessments; CREATE TRIGGER trg_audit_nutrition_assessments AFTER INSERT OR UPDATE OR DELETE ON nutrition_assessments FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_nutrition_presets ON nutrition_presets; CREATE TRIGGER trg_audit_nutrition_presets AFTER INSERT OR UPDATE OR DELETE ON nutrition_presets FOR EACH ROW EXECUTE FUNCTION log_audit_event();
DROP TRIGGER IF EXISTS trg_audit_shopping_lists ON shopping_lists; CREATE TRIGGER trg_audit_shopping_lists AFTER INSERT OR UPDATE OR DELETE ON shopping_lists FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ========== 5. INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_english_name_trgm ON foods USING GIN (english_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_alias_trgm ON foods USING GIN (alias gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_search_vector ON foods USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_foods_name_bt ON foods (name);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients (mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient_date ON meal_plans (patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON meal_plans (patient_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items (meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_food ON meal_plan_items (food_id);
CREATE INDEX IF NOT EXISTS idx_food_records_patient_date ON food_records (patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_food_records_patient_slot ON food_records (patient_id, slot);
CREATE INDEX IF NOT EXISTS idx_weight_records_patient_date ON weight_records (patient_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items (shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_food ON shopping_items (food_id);
CREATE INDEX IF NOT EXISTS idx_saved_menus_patient ON saved_menus (patient_id);
CREATE INDEX IF NOT EXISTS idx_saved_menus_category ON saved_menus (category);
CREATE INDEX IF NOT EXISTS idx_saved_meal_plans_patient ON saved_meal_plans (patient_id);
CREATE INDEX IF NOT EXISTS idx_saved_meal_plan_items_plan ON saved_meal_plan_items (saved_meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_patient ON nutrition_presets (patient_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_templates ON nutrition_presets (is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_favorites ON nutrition_presets (patient_id) WHERE is_favorite = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_food_price_history_food_date ON food_price_history (food_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparison_history_patient ON comparison_history (patient_id);
CREATE INDEX IF NOT EXISTS idx_comparison_history_date ON comparison_history (food_record_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_patient ON ai_requests (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests (status) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX IF NOT EXISTS idx_body_compositions_patient ON body_compositions (patient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor);
CREATE INDEX IF NOT EXISTS idx_market_prices_food ON market_prices (food_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices (province, city);

-- ========== 6. RLS (Enable + Policies, all idempotent) ==========
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'food_categories','food_subcategories','food_labels','food_labels_junction',
        'foods','food_price_history','food_change_logs',
        'recipes','recipe_items',
        'patients','diagnoses','anthropometry','nutrition_assessments',
        'weight_records','nutrition_presets','nutrition_preset_history',
        'nutrition_goals','favorite_foods','food_preferences','food_allergies',
        'body_compositions','weight_goals','weight_predictions',
        'meal_plans','meal_plan_items','meal_plan_history','meal_plan_versions',
        'food_records','food_record_history','food_record_photos','food_record_ai',
        'saved_menus','saved_menu_items',
        'saved_meal_plans','saved_meal_plan_items','comparison_history',
        'shopping_lists','shopping_items','market_prices','shopping_history','price_sources',
        'exercise_plans','exercise_items',
        'ai_requests','ai_recommendations','ai_logs',
        'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

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
DROP POLICY IF EXISTS foods_anon_select ON foods; CREATE POLICY foods_anon_select ON foods FOR SELECT TO anon USING (deleted_at IS NULL AND approved = true);
DROP POLICY IF EXISTS food_categories_anon_select ON food_categories; CREATE POLICY food_categories_anon_select ON food_categories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS food_subcategories_anon_select ON food_subcategories; CREATE POLICY food_subcategories_anon_select ON food_subcategories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS food_labels_anon_select ON food_labels; CREATE POLICY food_labels_anon_select ON food_labels FOR SELECT TO anon USING (true);

-- ========== 7. SEED DATA ==========
INSERT INTO food_categories (name, slug, icon) VALUES ('Serealia & Produk','serealia','🌾'),('Umbi & Akar','umbi','🥔'),('Daging & Unggas','daging','🍗'),('Ikan & Seafood','ikan','🐟'),('Telur','telur','🥚'),('Susu & Produk','susu','🥛'),('Kacang-kacangan','kacang','🫘'),('Sayuran','sayur','🥬'),('Buah','buah','🍎'),('Minyak & Lemak','lemak','🫒'),('Gula & Manisan','gula','🍯'),('Bumbu & Rempah','bumbu','🧄'),('Minuman','minuman','🥤') ON CONFLICT (name) DO NOTHING;
INSERT INTO food_labels (name, slug, color) VALUES ('Halal','halal','#10b981'),('Rendah GI','rendah-gi','#06b6d4'),('Tinggi Serat','tinggi-serat','#84cc16'),('Tinggi Protein','tinggi-protein','#f59e0b'),('Rendah Natrium','rendah-natrium','#0ea5e9'),('Tinggi Kalium','tinggi-kalium','#8b5cf6'),('Lean Protein','lean-protein','#ec4899'),('Vegetarian','vegetarian','#22c55e'),('Vegan','vegan','#16a34a'),('Gluten Free','gluten-free','#06b6d4'),('Low Fat','low-fat','#0ea5e9'),('Low Carb','low-carb','#f59e0b'),('High Fiber','high-fiber','#84cc16') ON CONFLICT (name) DO NOTHING;
INSERT INTO price_sources (name, type, is_active) VALUES ('Pasar Tradisional','TRADITIONAL_MARKET',true),('Supermarket','SUPERMARKET',true),('Marketplace Online','MARKETPLACE',true),('Distributor','DISTRIBUTOR',true),('Supplier Grosir','SUPPLIER',true) ON CONFLICT DO NOTHING;

-- ========== 8. VERIFY (simple SELECT queries, no PL/pgSQL variables) ==========

-- Extensions count (expect 4+)
SELECT count(*) AS extensions_count FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp', 'pg_trgm', 'unaccent');

-- Enums count (expect 14+)
SELECT count(*) AS enums_count FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' AND t.typtype = 'e';

-- Tables count (expect 45+)
SELECT count(*) AS tables_count FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Foreign Keys count (expect 30+)
SELECT count(*) AS foreign_keys_count FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

-- Triggers count (expect 25+)
SELECT count(*) AS triggers_count FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Indexes count (expect 40+)
SELECT count(*) AS indexes_count FROM pg_indexes
WHERE schemaname = 'public';

-- RLS enabled tables (expect 45+)
SELECT count(*) AS rls_tables_count FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- RLS policies (expect 100+)
SELECT count(*) AS policies_count FROM pg_policies
WHERE schemaname = 'public';

-- Search vector (expect is_generated = 'ALWAYS')
SELECT column_name, is_generated FROM information_schema.columns
WHERE table_name = 'foods' AND column_name = 'search_vector';

-- Seed data counts
SELECT count(*) AS food_categories_count FROM food_categories;
SELECT count(*) AS food_labels_count FROM food_labels;
SELECT count(*) AS price_sources_count FROM price_sources;

-- Done. Check the results above.
-- If all counts match expectations, your database is ready!
