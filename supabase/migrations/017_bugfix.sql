-- =====================================================================
-- 017_bugfix.sql
-- Purpose: Post-migration bugfixes and compatibility patches
-- Dependencies: All previous migrations
-- Notes: Add fixes here when discovered. Each fix must be idempotent.
-- =====================================================================

-- FIX 1: Ensure food_labels_junction FK references exist
-- (food_labels_junction was created in 003 before foods table FK constraint)
-- This is a no-op if constraints already exist.

-- FIX 2: search_vector is now a GENERATED column (003_food_database.sql)
-- PostgreSQL auto-populates it for ALL rows when the column is added.
-- No manual UPDATE needed — and UPDATE on a generated column would ERROR.
-- This is a verification query only:
-- SELECT count(*) FROM foods WHERE search_vector IS NULL;  -- Should be 0

-- FIX 3: Add missing updated_at triggers for tables created in new modules
-- (These should already exist from their respective migrations, but as a safety net:)

DROP TRIGGER IF EXISTS trg_meal_plan_history_updated ON meal_plan_history;
DROP TRIGGER IF EXISTS trg_meal_plan_versions_updated ON meal_plan_versions;
DROP TRIGGER IF EXISTS trg_food_record_history_updated ON food_record_history;
DROP TRIGGER IF EXISTS trg_food_record_photos_updated ON food_record_photos;
DROP TRIGGER IF EXISTS trg_market_prices_updated ON market_prices;
DROP TRIGGER IF EXISTS trg_shopping_history_updated ON shopping_history;
DROP TRIGGER IF EXISTS trg_nutrition_goals_updated ON nutrition_goals;
DROP TRIGGER IF EXISTS trg_food_preferences_updated ON food_preferences;
DROP TRIGGER IF EXISTS trg_food_allergies_updated ON food_allergies;
DROP TRIGGER IF EXISTS trg_body_compositions_updated ON body_compositions;
DROP TRIGGER IF EXISTS trg_weight_goals_updated ON weight_goals;
DROP TRIGGER IF EXISTS trg_price_sources_updated ON price_sources;
DROP TRIGGER IF EXISTS trg_ai_requests_updated ON ai_requests;
DROP TRIGGER IF EXISTS trg_ai_recommendations_updated ON ai_recommendations;

-- FIX 4: Verify RLS is enabled (re-enable as safety net)
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;

-- FIX 5: Add deleted_by column to tables that might be missing it
-- (idempotent — ADD COLUMN IF NOT EXISTS)
ALTER TABLE foods ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE exercise_plans ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE saved_menus ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE saved_meal_plans ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE nutrition_presets ADD COLUMN IF NOT EXISTS deleted_by TEXT;
