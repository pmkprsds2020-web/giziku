-- =====================================================================
-- 009_saved_menu.sql
-- Purpose: Saved menus (per-slot templates) + saved menu items
-- Dependencies: 003_food_database.sql, 004_patient_module.sql
-- =====================================================================

-- Saved Menus (per-slot templates — e.g., "Sarapan Diabetes")
CREATE TABLE IF NOT EXISTS saved_menus (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
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
    CONSTRAINT fk_saved_menu_patient FOREIGN KEY (patient_id)
        REFERENCES patients(id) ON DELETE CASCADE
);
DROP TRIGGER IF EXISTS trg_saved_menus_updated ON saved_menus;
CREATE TRIGGER trg_saved_menus_updated BEFORE UPDATE ON saved_menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Saved Menu Items
CREATE TABLE IF NOT EXISTS saved_menu_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    saved_menu_id   UUID NOT NULL,
    food_id         UUID NOT NULL,
    amount          DOUBLE PRECISION NOT NULL,
    cal             DOUBLE PRECISION DEFAULT 0,
    protein         DOUBLE PRECISION DEFAULT 0,
    fat             DOUBLE PRECISION DEFAULT 0,
    carb            DOUBLE PRECISION DEFAULT 0,
    fiber           DOUBLE PRECISION DEFAULT 0,
    sodium          DOUBLE PRECISION DEFAULT 0,
    potassium       DOUBLE PRECISION DEFAULT 0,
    food_name       TEXT NOT NULL,
    urt             TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT fk_saved_menu_item_menu FOREIGN KEY (saved_menu_id)
        REFERENCES saved_menus(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_menu_item_food FOREIGN KEY (food_id)
        REFERENCES foods(id)
);
DROP TRIGGER IF EXISTS trg_saved_menu_items_updated ON saved_menu_items;
CREATE TRIGGER trg_saved_menu_items_updated BEFORE UPDATE ON saved_menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
