-- =====================================================================
-- 010_saved_meal_plan.sql
-- Purpose: Saved meal plans (full daily plan templates) + items
-- Dependencies: 003_food_database.sql, 004_patient_module.sql
-- =====================================================================

-- Saved Meal Plans (1 record per daily meal plan — parent)
CREATE TABLE IF NOT EXISTS saved_meal_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    notes           TEXT DEFAULT '',
    total_cal       DOUBLE PRECISION DEFAULT 0,
    total_protein   DOUBLE PRECISION DEFAULT 0,
    total_fat       DOUBLE PRECISION DEFAULT 0,
    total_carb      DOUBLE PRECISION DEFAULT 0,
    total_fiber     DOUBLE PRECISION DEFAULT 0,
    total_sodium    DOUBLE PRECISION DEFAULT 0,
    total_potassium DOUBLE PRECISION DEFAULT 0,
    version         INTEGER DEFAULT 1,
    last_used_at    TIMESTAMPTZ,
    use_count       INTEGER DEFAULT 0,
    created_by      TEXT DEFAULT 'system',
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_saved_meal_plan_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_saved_meal_plans_updated ON saved_meal_plans;
CREATE TRIGGER trg_saved_meal_plans_updated BEFORE UPDATE ON saved_meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Saved Meal Plan Items (child — items across all 6 slots)
CREATE TABLE IF NOT EXISTS saved_meal_plan_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_meal_plan_id  UUID NOT NULL,
    slot                TEXT NOT NULL,
    food_id             UUID NOT NULL,
    amount              DOUBLE PRECISION NOT NULL,
    cal                 DOUBLE PRECISION DEFAULT 0,
    protein             DOUBLE PRECISION DEFAULT 0,
    fat                 DOUBLE PRECISION DEFAULT 0,
    carb                DOUBLE PRECISION DEFAULT 0,
    fiber               DOUBLE PRECISION DEFAULT 0,
    sodium              DOUBLE PRECISION DEFAULT 0,
    potassium           DOUBLE PRECISION DEFAULT 0,
    food_name           TEXT NOT NULL,
    urt                 TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_smpi_plan FOREIGN KEY (saved_meal_plan_id)
        REFERENCES saved_meal_plans(id) ON DELETE CASCADE,
    CONSTRAINT fk_smpi_food FOREIGN KEY (food_id)
        REFERENCES foods(id),
    CONSTRAINT chk_smpi_amount CHECK (amount > 0)
);

-- Comparison History (meal plan vs food record comparisons)
CREATE TABLE IF NOT EXISTS comparison_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL,
    meal_plan_id        UUID,
    saved_menu_name     TEXT,
    food_record_date    TIMESTAMPTZ NOT NULL,
    compliance_score    DOUBLE PRECISION DEFAULT 0,
    results             JSONB,
    ai_insight          TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_comparison_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_comparison_meal_plan FOREIGN KEY (meal_plan_id)
        REFERENCES meal_plans(id) ON DELETE SET NULL
);
