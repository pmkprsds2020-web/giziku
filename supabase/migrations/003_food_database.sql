-- =====================================================================
-- 003_food_database.sql
-- Purpose: Food database tables (categories, subcategories, labels, foods, price history, change logs)
-- Dependencies: 000_extensions.sql, 001_enums.sql, 002_functions.sql
-- Tables: food_categories, food_subcategories, food_labels, foods,
--         food_labels_junction, food_price_history, food_change_logs
-- Ordering: food_labels_junction created AFTER foods (FK dependency)
-- =====================================================================

-- Food Categories
CREATE TABLE IF NOT EXISTS food_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT UNIQUE NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    icon        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_food_categories_updated ON food_categories;
CREATE TRIGGER trg_food_categories_updated BEFORE UPDATE ON food_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Food Subcategories
CREATE TABLE IF NOT EXISTS food_subcategories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    category_id UUID NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_food_subcategory_category FOREIGN KEY (category_id)
        REFERENCES food_categories(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_food_subcategories_updated ON food_subcategories;
CREATE TRIGGER trg_food_subcategories_updated BEFORE UPDATE ON food_subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Food Labels
CREATE TABLE IF NOT EXISTS food_labels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT UNIQUE NOT NULL,
    slug        TEXT UNIQUE NOT NULL,
    color       TEXT DEFAULT '#10b981',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_food_labels_updated ON food_labels;
CREATE TRIGGER trg_food_labels_updated BEFORE UPDATE ON food_labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Foods (main food database — 30+ nutrition fields per 100g)
-- Created BEFORE food_labels_junction (which has FK to foods)
CREATE TABLE IF NOT EXISTS foods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    english_name    TEXT,
    alias           TEXT,
    code            TEXT,
    category_id     UUID NOT NULL,
    subcategory_id  UUID,
    source          food_source_enum DEFAULT 'CUSTOM',
    description     TEXT,
    -- Nutrition per 100g (edible portion)
    energy          DOUBLE PRECISION NOT NULL DEFAULT 0,
    protein         DOUBLE PRECISION NOT NULL DEFAULT 0,
    fat             DOUBLE PRECISION NOT NULL DEFAULT 0,
    carb            DOUBLE PRECISION NOT NULL DEFAULT 0,
    fiber           DOUBLE PRECISION DEFAULT 0,
    water           DOUBLE PRECISION DEFAULT 0,
    ash             DOUBLE PRECISION DEFAULT 0,
    sodium          DOUBLE PRECISION DEFAULT 0,
    potassium       DOUBLE PRECISION DEFAULT 0,
    calcium         DOUBLE PRECISION DEFAULT 0,
    magnesium       DOUBLE PRECISION DEFAULT 0,
    iron            DOUBLE PRECISION DEFAULT 0,
    phosphorus      DOUBLE PRECISION DEFAULT 0,
    zinc            DOUBLE PRECISION DEFAULT 0,
    vit_a           DOUBLE PRECISION DEFAULT 0,
    vit_b1          DOUBLE PRECISION DEFAULT 0,
    vit_b2          DOUBLE PRECISION DEFAULT 0,
    vit_b6          DOUBLE PRECISION DEFAULT 0,
    vit_b12         DOUBLE PRECISION DEFAULT 0,
    vit_c           DOUBLE PRECISION DEFAULT 0,
    vit_d           DOUBLE PRECISION DEFAULT 0,
    vit_e           DOUBLE PRECISION DEFAULT 0,
    vit_k           DOUBLE PRECISION DEFAULT 0,
    cholesterol     DOUBLE PRECISION DEFAULT 0,
    gi              INTEGER DEFAULT 0,
    -- URT (Unit Rumah Tangga)
    urt             TEXT,
    urt_gram        DOUBLE PRECISION,
    bdd             DOUBLE PRECISION DEFAULT 100,
    -- Price
    price           DOUBLE PRECISION DEFAULT 0,
    price_unit      TEXT DEFAULT 'g',
    price_location  TEXT,
    price_source    TEXT,
    price_updated_at TIMESTAMPTZ,
    price_is_estimate BOOLEAN DEFAULT false,
    -- Meta
    unit            TEXT DEFAULT 'g',
    image_url       TEXT,
    tags            TEXT DEFAULT '',
    approved        BOOLEAN DEFAULT true,
    version         INTEGER DEFAULT 1,
    -- Soft delete
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    -- Constraints
    CONSTRAINT fk_food_category FOREIGN KEY (category_id)
        REFERENCES food_categories(id),
    CONSTRAINT fk_food_subcategory FOREIGN KEY (subcategory_id)
        REFERENCES food_subcategories(id) ON DELETE SET NULL,
    CONSTRAINT chk_food_energy_nonneg CHECK (energy >= 0),
    CONSTRAINT chk_food_protein_nonneg CHECK (protein >= 0)
);
DROP TRIGGER IF EXISTS trg_foods_updated ON foods;
CREATE TRIGGER trg_foods_updated BEFORE UPDATE ON foods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- FOOD SEARCH: Generated Column (no trigger, no function, no composite type)
-- PostgreSQL auto-computes search_vector on INSERT/UPDATE.
-- =====================================================================

-- Clean up any old trigger-based approach (idempotent)
DROP TRIGGER IF EXISTS trg_foods_search_vector ON foods;
-- Use DROP FUNCTION without argument type to avoid "type foods does not exist" error
DROP FUNCTION IF EXISTS update_food_search_vector();

-- If search_vector exists as a NON-generated column (from old migration), drop it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'foods'
          AND column_name = 'search_vector'
          AND is_generated = 'NEVER'
    ) THEN
        ALTER TABLE foods DROP COLUMN search_vector;
    END IF;
END $$;

-- Add search_vector as a GENERATED STORED column (idempotent)
-- Weight A = name (highest priority), B = english_name + alias, C = tags
ALTER TABLE foods ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(english_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(alias, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(tags, '')), 'C')
) STORED;

-- Food Labels Junction (many-to-many) — created AFTER foods table
CREATE TABLE IF NOT EXISTS food_labels_junction (
    food_id  UUID NOT NULL,
    label_id UUID NOT NULL,
    CONSTRAINT fk_flj_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
    CONSTRAINT fk_flj_label FOREIGN KEY (label_id) REFERENCES food_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (food_id, label_id)
);

-- Food Price History
CREATE TABLE IF NOT EXISTS food_price_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id         UUID NOT NULL,
    price           DOUBLE PRECISION NOT NULL,
    previous_price  DOUBLE PRECISION,
    unit            TEXT DEFAULT 'g',
    location        TEXT,
    source          TEXT,
    notes           TEXT,
    actor           TEXT DEFAULT 'system',
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_price_history_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE CASCADE,
    CONSTRAINT chk_price_nonneg CHECK (price >= 0)
);

-- Food Change Log (audit trail for food data changes)
CREATE TABLE IF NOT EXISTS food_change_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id     UUID NOT NULL,
    action      TEXT NOT NULL,
    changes     JSONB,
    actor       TEXT DEFAULT 'system',
    created_at  TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_change_log_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE CASCADE
);
