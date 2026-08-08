-- =====================================================================
-- CareLivia CNMS — Supabase Database Schema (Complete)
-- Project: Clinical Nutrition Engine (ycuehkpxrpmtyapfayjh)
-- Run in: Supabase Dashboard > SQL Editor > New Query > Paste > Run
-- Creates: 28 tables, 30+ indexes, 100+ RLS policies, 12 enum types
-- =====================================================================

-- 1. ENUM TYPES
CREATE TYPE gender_enum AS ENUM ('MALE','FEMALE');
CREATE TYPE blood_type_enum AS ENUM ('A','B','AB','O','UNKNOWN');
CREATE TYPE religion_enum AS ENUM ('ISLAM','KRISTEN','KATOLIK','HINDU','BUDDHA','KONGHUCU','OTHER');
CREATE TYPE diagnosis_type_enum AS ENUM ('DM','HT','CHF','CKD','CKD_ND','CKD_HD','CKD_PD','LIVER','CANCER','DYSLIPIDEMIA','GOUT','GERD','PUD','IBD','OBESITY','MALNUTRITION','SARCOPENIA','POST_OP','PREGNANCY','LACTATION','PEDIATRIC','GERIATRIC','STROKE','COPD','OTHER');
CREATE TYPE activity_level_enum AS ENUM ('BED_REST','VERY_LIGHT','LIGHT','MODERATE','HEAVY');
CREATE TYPE stress_level_enum AS ENUM ('NONE','MILD','MODERATE','SEVERE','VERY_SEVERE');
CREATE TYPE meal_slot_enum AS ENUM ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK');
CREATE TYPE food_source_enum AS ENUM ('TKPI','DKBM','USDA','CUSTOM');
CREATE TYPE shopping_period_enum AS ENUM ('DAILY','WEEKLY','MONTHLY');
CREATE TYPE exercise_type_enum AS ENUM ('AEROBIC','RESISTANCE','FLEXIBILITY','BALANCE','FUNCTIONAL');
CREATE TYPE exercise_intensity_enum AS ENUM ('LOW','MODERATE','HIGH');
CREATE TYPE preset_goal_enum AS ENUM ('WEIGHT_LOSS','WEIGHT_MAINTAIN','WEIGHT_GAIN','HIGH_PROTEIN','LOW_CARB','LOW_FAT','CKD_DIET','DIABETES_DIET','HYPERTENSION_DIET','GENERAL');

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$ language 'plpgsql';

-- 3. FOOD DATABASE TABLES
CREATE TABLE food_categories (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_food_categories BEFORE UPDATE ON food_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE food_subcategories (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, name TEXT NOT NULL, slug TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES food_categories(id) ON DELETE CASCADE, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_food_subcategories BEFORE UPDATE ON food_subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_food_subcategories_category_id ON food_subcategories(category_id);

CREATE TABLE food_labels (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, name TEXT UNIQUE NOT NULL, slug TEXT UNIQUE NOT NULL, color TEXT DEFAULT '#10b981', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_food_labels BEFORE UPDATE ON food_labels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE food_labels_junction (food_id TEXT NOT NULL, label_id TEXT NOT NULL, PRIMARY KEY (food_id, label_id));

CREATE TABLE foods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL, english_name TEXT, alias TEXT, code TEXT,
  category_id TEXT NOT NULL REFERENCES food_categories(id),
  subcategory_id TEXT REFERENCES food_subcategories(id),
  source food_source_enum DEFAULT 'CUSTOM', description TEXT,
  energy DOUBLE PRECISION NOT NULL DEFAULT 0, protein DOUBLE PRECISION NOT NULL DEFAULT 0,
  fat DOUBLE PRECISION NOT NULL DEFAULT 0, carb DOUBLE PRECISION NOT NULL DEFAULT 0,
  fiber DOUBLE PRECISION DEFAULT 0, water DOUBLE PRECISION DEFAULT 0, ash DOUBLE PRECISION DEFAULT 0,
  sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, calcium DOUBLE PRECISION DEFAULT 0,
  magnesium DOUBLE PRECISION DEFAULT 0, iron DOUBLE PRECISION DEFAULT 0, phosphorus DOUBLE PRECISION DEFAULT 0,
  zinc DOUBLE PRECISION DEFAULT 0, vit_a DOUBLE PRECISION DEFAULT 0, vit_b1 DOUBLE PRECISION DEFAULT 0,
  vit_b2 DOUBLE PRECISION DEFAULT 0, vit_b6 DOUBLE PRECISION DEFAULT 0, vit_b12 DOUBLE PRECISION DEFAULT 0,
  vit_c DOUBLE PRECISION DEFAULT 0, vit_d DOUBLE PRECISION DEFAULT 0, vit_e DOUBLE PRECISION DEFAULT 0,
  vit_k DOUBLE PRECISION DEFAULT 0, cholesterol DOUBLE PRECISION DEFAULT 0, gi INTEGER DEFAULT 0,
  urt TEXT, urt_gram DOUBLE PRECISION, bdd DOUBLE PRECISION DEFAULT 100,
  price DOUBLE PRECISION DEFAULT 0, price_unit TEXT DEFAULT 'g', price_location TEXT, price_source TEXT,
  price_updated_at TIMESTAMPTZ, price_is_estimate BOOLEAN DEFAULT false,
  unit TEXT DEFAULT 'g', image_url TEXT, tags TEXT DEFAULT '', approved BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1, deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER set_updated_at_foods BEFORE UPDATE ON foods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_foods_category_id ON foods(category_id);
CREATE INDEX idx_foods_subcategory_id ON foods(subcategory_id);
CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_deleted_at ON foods(deleted_at);

CREATE TABLE food_price_history (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE, price DOUBLE PRECISION NOT NULL, previous_price DOUBLE PRECISION, unit TEXT DEFAULT 'g', location TEXT, source TEXT, notes TEXT, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_food_price_history_food_id ON food_price_history(food_id);
CREATE INDEX idx_food_price_history_created_at ON food_price_history(created_at);

CREATE TABLE food_change_logs (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, food_id TEXT NOT NULL REFERENCES foods(id) ON DELETE CASCADE, action TEXT NOT NULL, changes JSONB, actor TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_food_change_logs_food_id ON food_change_logs(food_id);
CREATE INDEX idx_food_change_logs_created_at ON food_change_logs(created_at);

-- 4. RECIPE TABLES
CREATE TABLE recipes (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, name TEXT NOT NULL, description TEXT, servings INTEGER DEFAULT 1, method TEXT, image_url TEXT, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_recipes BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE recipe_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_recipe_items BEFORE UPDATE ON recipe_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_recipe_items_recipe_id ON recipe_items(recipe_id);
CREATE INDEX idx_recipe_items_food_id ON recipe_items(food_id);

-- 5. PATIENT TABLES
CREATE TABLE patients (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, mrn TEXT UNIQUE NOT NULL, name TEXT NOT NULL, gender gender_enum NOT NULL, birth_date TIMESTAMPTZ NOT NULL, phone TEXT DEFAULT '', address TEXT DEFAULT '', religion religion_enum DEFAULT 'ISLAM', blood_type blood_type_enum DEFAULT 'UNKNOWN', allergy TEXT DEFAULT '', height DOUBLE PRECISION, weight DOUBLE PRECISION, is_pregnant BOOLEAN DEFAULT false, pregnancy_trimester INTEGER DEFAULT 0, is_lactating BOOLEAN DEFAULT false, lactation_month INTEGER DEFAULT 0, notes TEXT, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_patients BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_patients_deleted_at ON patients(deleted_at);

CREATE TABLE diagnoses (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, type diagnosis_type_enum NOT NULL, icd TEXT, severity TEXT, notes TEXT, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_diagnoses BEFORE UPDATE ON diagnoses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_diagnoses_patient_id ON diagnoses(patient_id);

CREATE TABLE anthropometry (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, recorded_at TIMESTAMPTZ DEFAULT now(), weight DOUBLE PRECISION NOT NULL, height DOUBLE PRECISION NOT NULL, bmi DOUBLE PRECISION NOT NULL, bmi_category TEXT, waist DOUBLE PRECISION, hip DOUBLE PRECISION, whr DOUBLE PRECISION, muac DOUBLE PRECISION, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_anthropometry BEFORE UPDATE ON anthropometry FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_anthropometry_patient_id ON anthropometry(patient_id);

CREATE TABLE nutrition_assessments (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, recorded_at TIMESTAMPTZ DEFAULT now(), must TEXT, must_score DOUBLE PRECISION, sga TEXT, nrs2002 TEXT, nrs_score DOUBLE PRECISION, mna TEXT, mna_score DOUBLE PRECISION, pps TEXT, ecog TEXT, barthel INTEGER, frailty TEXT, frailty_score INTEGER, fall_risk TEXT, hand_grip DOUBLE PRECISION, calf_circ DOUBLE PRECISION, activity activity_level_enum DEFAULT 'BED_REST', stress stress_level_enum DEFAULT 'NONE', notes TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_nutrition_assessments BEFORE UPDATE ON nutrition_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_nutrition_assessments_patient_id ON nutrition_assessments(patient_id);

CREATE TABLE weight_records (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, date TIMESTAMPTZ DEFAULT now(), weight DOUBLE PRECISION NOT NULL, height DOUBLE PRECISION, bmi DOUBLE PRECISION, bmi_category TEXT, weight_change DOUBLE PRECISION, weight_change_pct DOUBLE PRECISION, note TEXT, created_by TEXT DEFAULT 'system', created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_weight_records BEFORE UPDATE ON weight_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_weight_records_patient_id ON weight_records(patient_id);
CREATE INDEX idx_weight_records_date ON weight_records(date);

-- 6. NUTRITION PRESETS
CREATE TABLE nutrition_presets (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', color TEXT DEFAULT '#10b981', icon TEXT DEFAULT 'utensils', is_template BOOLEAN DEFAULT false, is_favorite BOOLEAN DEFAULT false, total_cal DOUBLE PRECISION NOT NULL, target_weight DOUBLE PRECISION, bmr DOUBLE PRECISION, tdee DOUBLE PRECISION, protein_pct DOUBLE PRECISION NOT NULL, carb_pct DOUBLE PRECISION NOT NULL, fat_pct DOUBLE PRECISION NOT NULL, protein_g DOUBLE PRECISION NOT NULL, carb_g DOUBLE PRECISION NOT NULL, fat_g DOUBLE PRECISION NOT NULL, fiber_g DOUBLE PRECISION DEFAULT 25, sodium_mg DOUBLE PRECISION DEFAULT 2300, potassium_mg DOUBLE PRECISION, fluid_ml DOUBLE PRECISION, goal preset_goal_enum DEFAULT 'GENERAL', diagnoses TEXT DEFAULT '', version INTEGER DEFAULT 1, created_by TEXT DEFAULT 'system', updated_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_nutrition_presets BEFORE UPDATE ON nutrition_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_nutrition_presets_patient_id ON nutrition_presets(patient_id);
CREATE INDEX idx_nutrition_presets_is_template ON nutrition_presets(is_template);

CREATE TABLE nutrition_preset_history (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, preset_id TEXT NOT NULL REFERENCES nutrition_presets(id) ON DELETE CASCADE, changes JSONB NOT NULL, version INTEGER NOT NULL, actor TEXT DEFAULT 'system', reason TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_nutrition_preset_history_preset_id ON nutrition_preset_history(preset_id);

-- 7. MEAL PLAN
CREATE TABLE meal_plans (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, preset_id TEXT REFERENCES nutrition_presets(id) ON DELETE SET NULL, date TIMESTAMPTZ DEFAULT now(), target_cal DOUBLE PRECISION NOT NULL, target_protein DOUBLE PRECISION NOT NULL, target_fat DOUBLE PRECISION NOT NULL, target_carb DOUBLE PRECISION NOT NULL, target_fiber DOUBLE PRECISION NOT NULL, target_sodium DOUBLE PRECISION NOT NULL, total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, compliance DOUBLE PRECISION DEFAULT 0, status TEXT DEFAULT 'DRAFT', ai_model TEXT, ai_reasoning TEXT, notes TEXT, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_meal_plans BEFORE UPDATE ON meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_meal_plans_patient_id ON meal_plans(patient_id);
CREATE INDEX idx_meal_plans_preset_id ON meal_plans(preset_id);
CREATE INDEX idx_meal_plans_date ON meal_plans(date);

CREATE TABLE meal_plan_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, meal_plan_id TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE, slot meal_slot_enum NOT NULL, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_meal_plan_items BEFORE UPDATE ON meal_plan_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_meal_plan_items_meal_plan_id ON meal_plan_items(meal_plan_id);
CREATE INDEX idx_meal_plan_items_food_id ON meal_plan_items(food_id);

-- 8. EXERCISE
CREATE TABLE exercise_plans (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, date TIMESTAMPTZ DEFAULT now(), total_burned DOUBLE PRECISION DEFAULT 0, target_burned DOUBLE PRECISION DEFAULT 0, notes TEXT, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_exercise_plans BEFORE UPDATE ON exercise_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_exercise_plans_patient_id ON exercise_plans(patient_id);

CREATE TABLE exercise_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, exercise_plan_id TEXT NOT NULL REFERENCES exercise_plans(id) ON DELETE CASCADE, name TEXT NOT NULL, type exercise_type_enum NOT NULL, intensity exercise_intensity_enum NOT NULL, duration INTEGER NOT NULL, calories_burned DOUBLE PRECISION NOT NULL, met DOUBLE PRECISION DEFAULT 3, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_exercise_items BEFORE UPDATE ON exercise_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_exercise_items_exercise_plan_id ON exercise_items(exercise_plan_id);

-- 9. FOOD RECORD
CREATE TABLE food_records (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, date TIMESTAMPTZ DEFAULT now(), slot meal_slot_enum NOT NULL, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, consumed DOUBLE PRECISION DEFAULT 100, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_food_records BEFORE UPDATE ON food_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_food_records_patient_id ON food_records(patient_id);
CREATE INDEX idx_food_records_date ON food_records(date);

-- 10. SHOPPING
CREATE TABLE shopping_lists (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, meal_plan_id TEXT UNIQUE REFERENCES meal_plans(id), period shopping_period_enum DEFAULT 'WEEKLY', multiplier DOUBLE PRECISION DEFAULT 7, total_estimate DOUBLE PRECISION DEFAULT 0, currency TEXT DEFAULT 'IDR', checked_count INTEGER DEFAULT 0, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_shopping_lists BEFORE UPDATE ON shopping_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_shopping_lists_patient_id ON shopping_lists(patient_id);

CREATE TABLE shopping_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, shopping_list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, unit TEXT DEFAULT 'g', est_price DOUBLE PRECISION DEFAULT 0, checked BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_shopping_items BEFORE UPDATE ON shopping_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_shopping_items_shopping_list_id ON shopping_items(shopping_list_id);
CREATE INDEX idx_shopping_items_food_id ON shopping_items(food_id);

-- 11. SAVED MENUS (per-slot)
CREATE TABLE saved_menus (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE, name TEXT NOT NULL, category TEXT NOT NULL, notes TEXT DEFAULT '', total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, total_potassium DOUBLE PRECISION DEFAULT 0, version INTEGER DEFAULT 1, last_used_at TIMESTAMPTZ, use_count INTEGER DEFAULT 0, created_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_saved_menus BEFORE UPDATE ON saved_menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_saved_menus_patient_id ON saved_menus(patient_id);
CREATE INDEX idx_saved_menus_category ON saved_menus(category);

CREATE TABLE saved_menu_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, saved_menu_id TEXT NOT NULL REFERENCES saved_menus(id) ON DELETE CASCADE, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, food_name TEXT NOT NULL, urt TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_saved_menu_items BEFORE UPDATE ON saved_menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_saved_menu_items_saved_menu_id ON saved_menu_items(saved_menu_id);
CREATE INDEX idx_saved_menu_items_food_id ON saved_menu_items(food_id);

-- 12. SAVED MEAL PLANS (full daily)
CREATE TABLE saved_meal_plans (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT DEFAULT '', notes TEXT DEFAULT '', total_cal DOUBLE PRECISION DEFAULT 0, total_protein DOUBLE PRECISION DEFAULT 0, total_fat DOUBLE PRECISION DEFAULT 0, total_carb DOUBLE PRECISION DEFAULT 0, total_fiber DOUBLE PRECISION DEFAULT 0, total_sodium DOUBLE PRECISION DEFAULT 0, total_potassium DOUBLE PRECISION DEFAULT 0, version INTEGER DEFAULT 1, last_used_at TIMESTAMPTZ, use_count INTEGER DEFAULT 0, created_by TEXT DEFAULT 'system', deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TRIGGER set_updated_at_saved_meal_plans BEFORE UPDATE ON saved_meal_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE INDEX idx_saved_meal_plans_patient_id ON saved_meal_plans(patient_id);

CREATE TABLE saved_meal_plan_items (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, saved_meal_plan_id TEXT NOT NULL REFERENCES saved_meal_plans(id) ON DELETE CASCADE, slot TEXT NOT NULL, food_id TEXT NOT NULL REFERENCES foods(id), amount DOUBLE PRECISION NOT NULL, cal DOUBLE PRECISION DEFAULT 0, protein DOUBLE PRECISION DEFAULT 0, fat DOUBLE PRECISION DEFAULT 0, carb DOUBLE PRECISION DEFAULT 0, fiber DOUBLE PRECISION DEFAULT 0, sodium DOUBLE PRECISION DEFAULT 0, potassium DOUBLE PRECISION DEFAULT 0, food_name TEXT NOT NULL, urt TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_saved_meal_plan_items_saved_meal_plan_id ON saved_meal_plan_items(saved_meal_plan_id);
CREATE INDEX idx_saved_meal_plan_items_food_id ON saved_meal_plan_items(food_id);

-- 13. COMPARISON HISTORY
CREATE TABLE comparison_history (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE, meal_plan_id TEXT, saved_menu_name TEXT, food_record_date TIMESTAMPTZ NOT NULL, compliance_score DOUBLE PRECISION DEFAULT 0, results JSONB, ai_insight TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_comparison_history_patient_id ON comparison_history(patient_id);
CREATE INDEX idx_comparison_history_food_record_date ON comparison_history(food_record_date);

-- 14. AUDIT LOG
CREATE TABLE audit_logs (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, entity TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor TEXT DEFAULT 'system', diff JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);

-- =====================================================================
-- 15. RLS — Enable on ALL tables
-- =====================================================================
ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_labels_junction ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE anthropometry ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_preset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 16. RLS POLICIES — Authenticated users get full CRUD on all tables
-- =====================================================================

-- Master food database (public read for anon, full CRUD for authenticated)
CREATE POLICY foods_anon_select ON foods FOR SELECT TO anon USING (deleted_at IS NULL AND approved = true);
CREATE POLICY food_categories_anon_select ON food_categories FOR SELECT TO anon USING (true);
CREATE POLICY food_labels_anon_select ON food_labels FOR SELECT TO anon USING (true);

-- Apply full CRUD policies for authenticated users on all tables
-- Using a DO block to generate policies dynamically
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['food_categories','food_subcategories','food_labels','food_labels_junction','foods','food_price_history','food_change_logs','recipes','recipe_items','patients','diagnoses','anthropometry','nutrition_assessments','weight_records','nutrition_presets','nutrition_preset_history','meal_plans','meal_plan_items','exercise_plans','exercise_items','food_records','shopping_lists','shopping_items','saved_menus','saved_menu_items','saved_meal_plans','saved_meal_plan_items','comparison_history','audit_logs'])
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', tbl || '_select', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', tbl || '_insert', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl || '_update', tbl);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', tbl || '_delete', tbl);
  END LOOP;
END $$;

-- =====================================================================
-- DONE! 28 tables, 30+ indexes, 100+ RLS policies, 12 enum types created.
-- =====================================================================
