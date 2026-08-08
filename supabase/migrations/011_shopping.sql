-- =====================================================================
-- 011_shopping.sql
-- Purpose: Shopping lists + items + market prices (NEW) + shopping history (NEW) + price sources (NEW)
-- Dependencies: 003_food_database.sql, 004_patient_module.sql, 007_meal_plan.sql
-- =====================================================================

-- Shopping Lists
CREATE TABLE IF NOT EXISTS shopping_lists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    meal_plan_id    UUID UNIQUE,
    period          shopping_period_enum DEFAULT 'WEEKLY',
    multiplier      DOUBLE PRECISION DEFAULT 7,
    total_estimate  DOUBLE PRECISION DEFAULT 0,
    currency        TEXT DEFAULT 'IDR',
    checked_count   INTEGER DEFAULT 0,
    deleted_at      TIMESTAMPTZ,
    deleted_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_shopping_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_shopping_meal_plan FOREIGN KEY (meal_plan_id)
        REFERENCES meal_plans(id) ON DELETE SET NULL
);
DROP TRIGGER IF EXISTS trg_shopping_lists_updated ON shopping_lists;
CREATE TRIGGER trg_shopping_lists_updated BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Shopping Items
CREATE TABLE IF NOT EXISTS shopping_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shopping_list_id UUID NOT NULL,
    food_id         UUID NOT NULL,
    amount          DOUBLE PRECISION NOT NULL,
    unit            TEXT DEFAULT 'g',
    est_price       DOUBLE PRECISION DEFAULT 0,
    checked         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_shopping_item_list FOREIGN KEY (shopping_list_id)
        REFERENCES shopping_lists(id) ON DELETE CASCADE,
    CONSTRAINT fk_shopping_item_food FOREIGN KEY (food_id)
        REFERENCES foods(id),
    CONSTRAINT chk_shopping_amount CHECK (amount > 0)
);
DROP TRIGGER IF EXISTS trg_shopping_items_updated ON shopping_items;
CREATE TRIGGER trg_shopping_items_updated BEFORE UPDATE ON shopping_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- NEW MODULE: Market Prices (location-based price tracking)
-- =====================================================================
CREATE TABLE IF NOT EXISTS market_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id         UUID NOT NULL,
    price           DOUBLE PRECISION NOT NULL,
    unit            TEXT DEFAULT 'g',
    province        TEXT,
    city            TEXT,
    district        TEXT,
    source_type     TEXT,
    source_name     TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_market_price_food FOREIGN KEY (food_id)
        REFERENCES foods(id) ON DELETE CASCADE,
    CONSTRAINT chk_market_price CHECK (price >= 0)
);

-- =====================================================================
-- NEW MODULE: Shopping History (track past shopping lists)
-- =====================================================================
CREATE TABLE IF NOT EXISTS shopping_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL,
    shopping_list_id UUID,
    total_items     INTEGER,
    total_estimate  DOUBLE PRECISION,
    actual_total    DOUBLE PRECISION,
    shopped_at      TIMESTAMPTZ DEFAULT now(),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_shopping_history_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_shopping_history_list FOREIGN KEY (shopping_list_id)
        REFERENCES shopping_lists(id) ON DELETE SET NULL
);

-- =====================================================================
-- NEW MODULE: Price Sources (marketplace/supermarket/supplier directory)
-- =====================================================================
CREATE TABLE IF NOT EXISTS price_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    location        TEXT,
    website         TEXT,
    contact         TEXT,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_price_sources_updated ON price_sources;
CREATE TRIGGER trg_price_sources_updated BEFORE UPDATE ON price_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
