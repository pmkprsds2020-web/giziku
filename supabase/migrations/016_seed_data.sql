-- =====================================================================
-- 016_seed_data.sql
-- Purpose: Seed essential reference data (food categories, labels, preset templates)
-- Dependencies: All migrations (003-015)
-- Notes: Idempotent — uses ON CONFLICT DO NOTHING for safe re-runs
-- =====================================================================

-- =====================================================================
-- FOOD CATEGORIES (13 Indonesian food categories)
-- =====================================================================

INSERT INTO food_categories (name, slug, icon) VALUES
    ('Serealia & Produk', 'serealia', '🌾'),
    ('Umbi & Akar', 'umbi', '🥔'),
    ('Daging & Unggas', 'daging', '🍗'),
    ('Ikan & Seafood', 'ikan', '🐟'),
    ('Telur', 'telur', '🥚'),
    ('Susu & Produk', 'susu', '🥛'),
    ('Kacang-kacangan', 'kacang', '🫘'),
    ('Sayuran', 'sayur', '🥬'),
    ('Buah', 'buah', '🍎'),
    ('Minyak & Lemak', 'lemak', '🫒'),
    ('Gula & Manisan', 'gula', '🍯'),
    ('Bumbu & Rempah', 'bumbu', '🧄'),
    ('Minuman', 'minuman', '🥤')
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- FOOD LABELS (diet labels)
-- =====================================================================

INSERT INTO food_labels (name, slug, color) VALUES
    ('Halal', 'halal', '#10b981'),
    ('Rendah GI', 'rendah-gi', '#06b6d4'),
    ('Tinggi Serat', 'tinggi-serat', '#84cc16'),
    ('Tinggi Protein', 'tinggi-protein', '#f59e0b'),
    ('Rendah Natrium', 'rendah-natrium', '#0ea5e9'),
    ('Tinggi Kalium', 'tinggi-kalium', '#8b5cf6'),
    ('Lean Protein', 'lean-protein', '#ec4899'),
    ('Vegetarian', 'vegetarian', '#22c55e'),
    ('Vegan', 'vegan', '#16a34a'),
    ('Gluten Free', 'gluten-free', '#06b6d4'),
    ('Low Fat', 'low-fat', '#0ea5e9'),
    ('Low Carb', 'low-carb', '#f59e0b'),
    ('High Fiber', 'high-fiber', '#84cc16')
ON CONFLICT (name) DO NOTHING;

-- =====================================================================
-- NUTRITION PRESET TEMPLATES (14 clinical diet templates)
-- =====================================================================

INSERT INTO nutrition_presets (name, description, color, is_template, total_cal, protein_pct, carb_pct, fat_pct, protein_g, carb_g, fat_g, fiber_g, sodium_mg, potassium_mg, goal, diagnoses) VALUES
    ('Diabetes 1500 kcal', 'PERKENI standar 1500 kcal', '#10b981', true, 1500, 20, 50, 30, 75, 188, 50, 25, 2300, 3500, 'DIABETES_DIET', 'DM'),
    ('Diabetes 1800 kcal', 'PERKENI standar 1800 kcal', '#10b981', true, 1800, 20, 50, 30, 90, 225, 60, 25, 2300, 3500, 'DIABETES_DIET', 'DM'),
    ('Diabetes 2000 kcal', 'PERKENI standar 2000 kcal', '#10b981', true, 2000, 20, 50, 30, 100, 250, 67, 25, 2300, 3500, 'DIABETES_DIET', 'DM'),
    ('Hipertensi (DASH)', 'DASH diet, natrium <1500mg', '#06b6d4', true, 2000, 18, 55, 27, 90, 275, 60, 30, 1500, 4700, 'HYPERTENSION_DIET', 'HT'),
    ('CKD Non-Dialisis', 'KDIGO protein 0.6 g/kg', '#8b5cf6', true, 2000, 12, 60, 28, 60, 300, 62, 20, 2000, 2000, 'CKD_DIET', 'CKD_ND'),
    ('CKD Dialisis (HD)', 'HD protein 1.2 g/kg', '#8b5cf6', true, 2200, 18, 50, 32, 99, 275, 78, 20, 2000, 2500, 'CKD_DIET', 'CKD_HD'),
    ('CHF (Gagal Jantung)', 'ESPEN: batasi natrium & cairan', '#ef4444', true, 1800, 20, 55, 25, 90, 248, 50, 25, 2000, 3500, 'GENERAL', 'CHF'),
    ('Obesitas (Defisit)', 'Defisit 500-750 kcal', '#f59e0b', true, 1500, 25, 45, 30, 94, 169, 50, 30, 2300, 3500, 'WEIGHT_LOSS', 'OBESITY'),
    ('Malnutrisi (Refeeding)', 'ESPEN: naikkan bertahap', '#f97316', true, 1800, 20, 55, 25, 90, 248, 50, 20, 2300, 3500, 'WEIGHT_GAIN', 'MALNUTRITION'),
    ('Paliatif', 'Nutrisi simtomatik', '#64748b', true, 1600, 18, 55, 27, 72, 220, 48, 20, 2300, 3000, 'GENERAL', 'OTHER'),
    ('Geriatrik', 'ESPEN Older: protein 1.2 g/kg', '#0ea5e9', true, 1800, 22, 50, 28, 99, 225, 56, 25, 2000, 3500, 'GENERAL', 'GERIATRIC'),
    ('Kehamilan T2-T3', 'WHO: +340-450 kcal', '#ec4899', true, 2200, 20, 55, 25, 110, 303, 61, 28, 2300, 4700, 'WEIGHT_GAIN', 'PREGNANCY'),
    ('Laktasi', 'WHO: +500 kcal', '#ec4899', true, 2500, 20, 55, 25, 125, 344, 69, 28, 2300, 4700, 'GENERAL', 'LACTATION'),
    ('Atlet', 'Tinggi karbo 60%', '#22c55e', true, 3000, 20, 60, 20, 150, 450, 67, 30, 2300, 4000, 'GENERAL', 'OTHER')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- PRICE SOURCES (default marketplace types)
-- =====================================================================

INSERT INTO price_sources (name, type, is_active) VALUES
    ('Pasar Tradisional', 'TRADITIONAL_MARKET', true),
    ('Supermarket', 'SUPERMARKET', true),
    ('Marketplace Online', 'MARKETPLACE', true),
    ('Distributor', 'DISTRIBUTOR', true),
    ('Supplier Grosir', 'SUPPLIER', true)
ON CONFLICT DO NOTHING;
