-- =====================================================================
-- 008_food_record.sql
-- Purpose: Food records + food record history (NEW) + food record photos (NEW) + food record AI (NEW)
-- Dependencies: 003_food_database.sql, 004_patient_module.sql
-- =====================================================================

-- Food Records (actual daily intake)
CREATE TABLE IF NOT EXISTS food_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id  UUID NOT NULL,
    date        TIMESTAMPTZ DEFAULT now(),
    slot        meal_slot_enum NOT NULL,
    food_id     UUID NOT NULL,
    amount      DOUBLE PRECISION NOT NULL,
    consumed    DOUBLE PRECISION DEFAULT 100,
    cal         DOUBLE PRECISION DEFAULT 0,
    protein     DOUBLE PRECISION DEFAULT 0,
    fat         DOUBLE PRECISION DEFAULT 0,
    carb        DOUBLE PRECISION DEFAULT 0,
    fiber       DOUBLE PRECISION DEFAULT 0,
    sodium      DOUBLE PRECISION DEFAULT 0,
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_food_record_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_record_food FOREIGN KEY (food_id)
        REFERENCES foods(id),
    CONSTRAINT chk_food_record_amount CHECK (amount > 0),
    CONSTRAINT chk_food_record_consumed CHECK (consumed >= 0 AND consumed <= 100)
);
DROP TRIGGER IF EXISTS trg_food_records_updated ON food_records;
CREATE TRIGGER trg_food_records_updated BEFORE UPDATE ON food_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Food Record History (tracks edits to food records)
-- =====================================================================
CREATE TABLE IF NOT EXISTS food_record_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_record_id  UUID NOT NULL,
    action          TEXT NOT NULL,
    changes         JSONB,
    actor           TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_fr_history_record FOREIGN KEY (food_record_id)
        REFERENCES food_records(id) ON DELETE CASCADE
);

-- =====================================================================
-- NEW MODULE: Food Record Photos (patient uploads photo of meal)
-- =====================================================================
CREATE TABLE IF NOT EXISTS food_record_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_record_id  UUID,
    patient_id      UUID NOT NULL,
    image_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    ai_analysis     JSONB,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_fr_photo_record FOREIGN KEY (food_record_id)
        REFERENCES food_records(id) ON DELETE SET NULL,
    CONSTRAINT fk_fr_photo_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);

-- =====================================================================
-- NEW MODULE: Food Record AI (AI analysis of food photos/records)
-- =====================================================================
CREATE TABLE IF NOT EXISTS food_record_ai (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_record_id  UUID,
    food_record_photo_id UUID,
    ai_model        TEXT,
    detected_foods  JSONB,
    estimated_calories DOUBLE PRECISION,
    estimated_protein  DOUBLE PRECISION,
    estimated_fat      DOUBLE PRECISION,
    estimated_carb     DOUBLE PRECISION,
    confidence_pct     DOUBLE PRECISION,
    raw_response       JSONB,
    created_at         TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_fr_ai_record FOREIGN KEY (food_record_id)
        REFERENCES food_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_fr_ai_photo FOREIGN KEY (food_record_photo_id)
        REFERENCES food_record_photos(id) ON DELETE CASCADE
);
