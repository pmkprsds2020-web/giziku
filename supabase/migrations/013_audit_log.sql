-- =====================================================================
-- 013_audit_log.sql
-- Purpose: Audit logs table (centralized audit trail)
-- Dependencies: 002_functions.sql (log_audit_event function)
-- Note: The audit trigger function in 002_functions.sql references this table.
--       Create this table FIRST, then attach audit triggers to other tables.
-- =====================================================================

-- Audit Logs (centralized — all INSERT/UPDATE/DELETE events)
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity      TEXT NOT NULL,
    entity_id   UUID NOT NULL,
    action      TEXT NOT NULL,
    diff        JSONB,
    actor       TEXT DEFAULT 'system',
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- =====================================================================
-- Attach audit triggers to key tables (idempotent)
-- These auto-log all data changes without frontend involvement.
-- =====================================================================

-- Patients
DROP TRIGGER IF EXISTS trg_audit_patients ON patients;
CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Foods
DROP TRIGGER IF EXISTS trg_audit_foods ON foods;
CREATE TRIGGER trg_audit_foods
    AFTER INSERT OR UPDATE OR DELETE ON foods
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Meal Plans
DROP TRIGGER IF EXISTS trg_audit_meal_plans ON meal_plans;
CREATE TRIGGER trg_audit_meal_plans
    AFTER INSERT OR UPDATE OR DELETE ON meal_plans
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Food Records
DROP TRIGGER IF EXISTS trg_audit_food_records ON food_records;
CREATE TRIGGER trg_audit_food_records
    AFTER INSERT OR UPDATE OR DELETE ON food_records
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Weight Records
DROP TRIGGER IF EXISTS trg_audit_weight_records ON weight_records;
CREATE TRIGGER trg_audit_weight_records
    AFTER INSERT OR UPDATE OR DELETE ON weight_records
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Nutrition Assessments
DROP TRIGGER IF EXISTS trg_audit_nutrition_assessments ON nutrition_assessments;
CREATE TRIGGER trg_audit_nutrition_assessments
    AFTER INSERT OR UPDATE OR DELETE ON nutrition_assessments
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Nutrition Presets
DROP TRIGGER IF EXISTS trg_audit_nutrition_presets ON nutrition_presets;
CREATE TRIGGER trg_audit_nutrition_presets
    AFTER INSERT OR UPDATE OR DELETE ON nutrition_presets
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Shopping Lists
DROP TRIGGER IF EXISTS trg_audit_shopping_lists ON shopping_lists;
CREATE TRIGGER trg_audit_shopping_lists
    AFTER INSERT OR UPDATE OR DELETE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
