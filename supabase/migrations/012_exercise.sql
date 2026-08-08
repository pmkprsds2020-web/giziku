-- =====================================================================
-- 012_exercise.sql
-- Purpose: Exercise plans + items
-- Dependencies: 004_patient_module.sql
-- =====================================================================

-- Exercise Plans
CREATE TABLE IF NOT EXISTS exercise_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    date            TIMESTAMPTZ DEFAULT now(),
    total_burned    DOUBLE PRECISION DEFAULT 0,
    target_burned   DOUBLE PRECISION DEFAULT 0,
    notes           TEXT,
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_exercise_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_exercise_plans_updated ON exercise_plans;
CREATE TRIGGER trg_exercise_plans_updated BEFORE UPDATE ON exercise_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Exercise Items
CREATE TABLE IF NOT EXISTS exercise_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_plan_id UUID NOT NULL,
    name            TEXT NOT NULL,
    type            exercise_type_enum NOT NULL,
    intensity       exercise_intensity_enum NOT NULL,
    duration        INTEGER NOT NULL,
    calories_burned DOUBLE PRECISION NOT NULL,
    met             DOUBLE PRECISION DEFAULT 3,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_exercise_item_plan FOREIGN KEY (exercise_plan_id)
        REFERENCES exercise_plans(id) ON DELETE CASCADE,
    CONSTRAINT chk_exercise_duration CHECK (duration > 0)
);
DROP TRIGGER IF EXISTS trg_exercise_items_updated ON exercise_items;
CREATE TRIGGER trg_exercise_items_updated BEFORE UPDATE ON exercise_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: AI Tables
-- =====================================================================

-- AI Requests (track all AI calls — meal plan, exercise, nutrition advice)
CREATE TABLE IF NOT EXISTS ai_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID,
    request_type    ai_request_type_enum NOT NULL,
    status          ai_request_status_enum DEFAULT 'PENDING',
    input_data      JSONB,
    output_data     JSONB,
    model           TEXT,
    tokens_used     INTEGER,
    duration_ms     INTEGER,
    error_message   TEXT,
    created_by      TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_ai_request_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_ai_requests_updated ON ai_requests;
CREATE TRIGGER trg_ai_requests_updated BEFORE UPDATE ON ai_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI Recommendations (structured AI-generated recommendations)
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    ai_request_id   UUID,
    category        TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    priority        TEXT DEFAULT 'MEDIUM',
    status          TEXT DEFAULT 'PENDING',
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_ai_rec_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_rec_request FOREIGN KEY (ai_request_id)
        REFERENCES ai_requests(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_ai_recommendations_updated ON ai_recommendations;
CREATE TRIGGER trg_ai_recommendations_updated BEFORE UPDATE ON ai_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI Logs (raw AI interaction logs for debugging/audit)
CREATE TABLE IF NOT EXISTS ai_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_request_id   UUID,
    level           TEXT DEFAULT 'INFO',
    message         TEXT,
    data            JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_ai_log_request FOREIGN KEY (ai_request_id)
        REFERENCES ai_requests(id) ON DELETE CASCADE
);
