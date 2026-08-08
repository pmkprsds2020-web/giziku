-- =====================================================================
-- 007_meal_plan.sql
-- Purpose: Meal plans, meal plan items, meal plan history (NEW), meal plan versions (NEW)
-- Dependencies: 003_food_database.sql, 004_patient_module.sql, 005_nutrition_assessment.sql
-- =====================================================================

-- Meal Plans
CREATE TABLE IF NOT EXISTS meal_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    preset_id       UUID,
    date            TIMESTAMPTZ DEFAULT now(),
    target_cal      DOUBLE PRECISION NOT NULL,
    target_protein  DOUBLE PRECISION NOT NULL,
    target_fat      DOUBLE PRECISION NOT NULL,
    target_carb     DOUBLE PRECISION NOT NULL,
    target_fiber    DOUBLE PRECISION NOT NULL,
    target_sodium   DOUBLE PRECISION NOT NULL,
    total_cal       DOUBLE PRECISION DEFAULT 0,
    total_protein   DOUBLE PRECISION DEFAULT 0,
    total_fat       DOUBLE PRECISION DEFAULT 0,
    total_carb      DOUBLE PRECISION DEFAULT 0,
    total_fiber     DOUBLE PRECISION DEFAULT 0,
    total_sodium    DOUBLE PRECISION DEFAULT 0,
    compliance      DOUBLE PRECISION DEFAULT 0,
    status          TEXT DEFAULT 'DRAFT',
    ai_model        TEXT,
    ai_reasoning    TEXT,
    notes           TEXT,
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_meal_plan_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_plan_preset FOREIGN KEY (preset_id)
        REFERENCES nutrition_presets(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_meal_plans_updated ON meal_plans;
CREATE TRIGGER trg_meal_plans_updated BEFORE UPDATE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Meal Plan Items
CREATE TABLE IF NOT EXISTS meal_plan_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id UUID NOT NULL,
    slot        meal_slot_enum NOT NULL,
    food_id     UUID NOT NULL,
    amount      DOUBLE PRECISION NOT NULL,
    cal         DOUBLE PRECISION DEFAULT 0,
    protein     DOUBLE PRECISION DEFAULT 0,
    fat         DOUBLE PRECISION DEFAULT 0,
    carb        DOUBLE PRECISION DEFAULT 0,
    fiber       DOUBLE PRECISION DEFAULT 0,
    sodium      DOUBLE PRECISION DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_meal_item_plan FOREIGN KEY (meal_plan_id)
        REFERENCES meal_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_item_food FOREIGN KEY (food_id)
        REFERENCES foods(id),
    CONSTRAINT chk_meal_item_amount CHECK (amount > 0)
);
DROP TRIGGER IF EXISTS trg_meal_plan_items_updated ON meal_plan_items;
CREATE TRIGGER trg_meal_plan_items_updated BEFORE UPDATE ON meal_plan_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Meal Plan History (tracks all changes to meal plans)
-- =====================================================================
CREATE TABLE IF NOT EXISTS meal_plan_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id    UUID NOT NULL,
    action          TEXT NOT NULL,
    changes         JSONB,
    snapshot        JSONB,
    actor           TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_meal_plan_history_plan FOREIGN KEY (meal_plan_id)
        REFERENCES meal_plans(id) ON DELETE CASCADE
);

-- =====================================================================
-- NEW MODULE: Meal Plan Versions (versioned meal plan snapshots)
-- =====================================================================
CREATE TABLE IF NOT EXISTS meal_plan_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_plan_id    UUID NOT NULL,
    version         INTEGER NOT NULL,
    snapshot        JSONB NOT NULL,
    reason          TEXT,
    created_by      TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_meal_plan_version_plan FOREIGN KEY (meal_plan_id)
        REFERENCES meal_plans(id) ON DELETE CASCADE
);
