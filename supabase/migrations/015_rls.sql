-- =====================================================================
-- 015_rls.sql
-- Purpose: Row Level Security — enable + create all policies (idempotent)
-- Dependencies: All table migrations (003-013)
-- Strategy:
--   - Authenticated users (doctors/nutritionists/admin): Full CRUD on all tables
--   - Anonymous users: Read-only on food database (public data)
--   - All policies use DROP IF EXISTS + CREATE for idempotency
-- =====================================================================

-- =====================================================================
-- ENABLE RLS ON ALL TABLES
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
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_record_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_record_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_record_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ANON POLICIES (public read-only on food database)
-- =====================================================================

DROP POLICY IF EXISTS foods_anon_select ON foods;
CREATE POLICY foods_anon_select ON foods
    FOR SELECT TO anon USING (deleted_at IS NULL AND approved = true);

DROP POLICY IF EXISTS food_categories_anon_select ON food_categories;
CREATE POLICY food_categories_anon_select ON food_categories
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS food_subcategories_anon_select ON food_subcategories;
CREATE POLICY food_subcategories_anon_select ON food_subcategories
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS food_labels_anon_select ON food_labels;
CREATE POLICY food_labels_anon_select ON food_labels
    FOR SELECT TO anon USING (true);

-- =====================================================================
-- AUTHENTICATED POLICIES (full CRUD on all tables)
-- Uses dynamic DO block for efficiency — generates 4 policies per table
-- =====================================================================

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
        -- SELECT
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_select', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', tbl || '_auth_select', tbl);

        -- INSERT
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_insert', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', tbl || '_auth_insert', tbl);

        -- UPDATE
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_update', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl || '_auth_update', tbl);

        -- DELETE
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_delete', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', tbl || '_auth_delete', tbl);
    END LOOP;
END $$;
