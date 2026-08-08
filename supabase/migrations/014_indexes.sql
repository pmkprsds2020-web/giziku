-- =====================================================================
-- 014_indexes.sql
-- Purpose: Performance optimization — GIN, trigram, composite, partial indexes
-- Dependencies: All table migrations (003-013)
-- Strategy: Optimize for CareLivia's most common query patterns:
--   - Food search (ILIKE + full-text)
--   - Patient lookup by MRN/name
--   - Meal plan by patient + date
--   - Food record by patient + date
--   - Weight records by patient + date range
--   - Shopping items by list
-- =====================================================================

-- =====================================================================
-- FOOD SEARCH INDEXES (critical for food picker autocomplete)
-- =====================================================================

-- Trigram index for ILIKE search on food name (fast "%beras%" queries)
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING GIN (name gin_trgm_ops);

-- Trigram index for english_name
CREATE INDEX IF NOT EXISTS idx_foods_english_name_trgm ON foods USING GIN (english_name gin_trgm_ops);

-- Trigram index for alias
CREATE INDEX IF NOT EXISTS idx_foods_alias_trgm ON foods USING GIN (alias gin_trgm_ops);

-- Full-text search index (search_vector column)
CREATE INDEX IF NOT EXISTS idx_foods_search_vector ON foods USING GIN (search_vector);

-- B-tree index for exact name lookup
CREATE INDEX IF NOT EXISTS idx_foods_name_bt ON foods (name);

-- =====================================================================
-- PATIENT INDEXES
-- =====================================================================

-- MRN lookup (already unique, but explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients (mrn);

-- Name search (trigram for ILIKE)
CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients USING GIN (name gin_trgm_ops);

-- Soft delete filter (partial index — only non-deleted patients)
CREATE INDEX IF NOT EXISTS idx_patients_active ON patients (created_at DESC)
    WHERE deleted_at IS NULL;

-- =====================================================================
-- MEAL PLAN INDEXES
-- =====================================================================

-- Patient + date (most common query: "get latest meal plan for patient")
CREATE INDEX IF NOT EXISTS idx_meal_plans_patient_date ON meal_plans (patient_id, date DESC);

-- Active plans only (partial index)
CREATE INDEX IF NOT EXISTS idx_meal_plans_active ON meal_plans (patient_id, date DESC)
    WHERE deleted_at IS NULL;

-- Meal plan items by meal plan
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_plan ON meal_plan_items (meal_plan_id);

-- Meal plan items by food (for "which plans use this food?")
CREATE INDEX IF NOT EXISTS idx_meal_plan_items_food ON meal_plan_items (food_id);

-- =====================================================================
-- FOOD RECORD INDEXES
-- =====================================================================

-- Patient + date (most common: "get today's food records for patient")
CREATE INDEX IF NOT EXISTS idx_food_records_patient_date ON food_records (patient_id, date DESC);

-- Food record by slot (for grouping by meal time)
CREATE INDEX IF NOT EXISTS idx_food_records_patient_slot ON food_records (patient_id, slot);

-- =====================================================================
-- WEIGHT RECORD INDEXES
-- =====================================================================

-- Patient + date (for weight trend chart)
CREATE INDEX IF NOT EXISTS idx_weight_records_patient_date ON weight_records (patient_id, date DESC);

-- =====================================================================
-- SHOPPING INDEXES
-- =====================================================================

-- Shopping items by list
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items (shopping_list_id);

-- Shopping items by food
CREATE INDEX IF NOT EXISTS idx_shopping_items_food ON shopping_items (food_id);

-- =====================================================================
-- SAVED MENU / MEAL PLAN INDEXES
-- =====================================================================

-- Saved menus by patient
CREATE INDEX IF NOT EXISTS idx_saved_menus_patient ON saved_menus (patient_id);

-- Saved menus by category (filter by slot)
CREATE INDEX IF NOT EXISTS idx_saved_menus_category ON saved_menus (category);

-- Saved meal plans by patient
CREATE INDEX IF NOT EXISTS idx_saved_meal_plans_patient ON saved_meal_plans (patient_id);

-- Saved meal plan items by plan
CREATE INDEX IF NOT EXISTS idx_saved_meal_plan_items_plan ON saved_meal_plan_items (saved_meal_plan_id);

-- =====================================================================
-- NUTRITION PRESET INDEXES
-- =====================================================================

-- Presets by patient
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_patient ON nutrition_presets (patient_id);

-- Template presets (filter is_template = true)
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_templates ON nutrition_presets (is_template)
    WHERE is_template = true;

-- Favorite presets (partial index)
CREATE INDEX IF NOT EXISTS idx_nutrition_presets_favorites ON nutrition_presets (patient_id)
    WHERE is_favorite = true AND deleted_at IS NULL;

-- =====================================================================
-- FOOD PRICE HISTORY INDEXES
-- =====================================================================

-- Price history by food (for price trend chart)
CREATE INDEX IF NOT EXISTS idx_food_price_history_food_date ON food_price_history (food_id, created_at DESC);

-- =====================================================================
-- COMPARISON HISTORY INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_comparison_history_patient ON comparison_history (patient_id);
CREATE INDEX IF NOT EXISTS idx_comparison_history_date ON comparison_history (food_record_date DESC);

-- =====================================================================
-- AI REQUEST INDEXES (NEW)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_ai_requests_patient ON ai_requests (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests (status)
    WHERE status IN ('PENDING', 'PROCESSING');

-- =====================================================================
-- BODY COMPOSITION INDEXES (NEW)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_body_compositions_patient ON body_compositions (patient_id, measured_at DESC);

-- =====================================================================
-- AUDIT LOG INDEXES
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor);

-- =====================================================================
-- MARKET PRICE INDEXES (NEW)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_market_prices_food ON market_prices (food_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices (province, city);
