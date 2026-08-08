# CareLivia CNMS — Supabase Database Migration Guide

## Overview

This directory contains **production-safe, idempotent database migration files** for the CareLivia Clinical Nutrition Management System. Each file can be safely re-run multiple times without errors.

- **45 tables** (all UUID primary keys + foreign keys)
- **14 enum types**
- **40+ indexes** (GIN trigram, full-text, composite, partial)
- **180+ RLS policies** (authenticated full CRUD, anon read-only on food DB)
- **25+ triggers** (updated_at + audit trail)
- **Full-text + trigram search** on food database (Generated Column — no trigger needed)
- **Production Safe**: No `DROP` statements, no extension function drops, no data loss
- **Idempotent**: `CREATE TABLE IF NOT EXISTS`, `DO $$ IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS + CREATE`

## ⚡ Quick Start

### Option A: Single File (Recommended)

Run **`run_all_fresh.sql`** in Supabase SQL Editor:
1. Copy the entire contents of `supabase/run_all_fresh.sql`
2. Paste into Supabase Dashboard → SQL Editor → New Query
3. Click **Run**
4. Verification output shows ✓ for each component

This file is **production safe** — it uses `CREATE TABLE IF NOT EXISTS` and `DO $$ IF NOT EXISTS` for all FK constraints, so it won't error on existing tables or drop any data.

### Option B: Individual Migration Files

Run each file in order (000 → 018) in Supabase SQL Editor. Each file must complete without error before proceeding to the next.

| # | File | Purpose | Dependencies |
|---|------|---------|-------------|
| 000 | `000_extensions.sql` | PostgreSQL extensions (pgcrypto, pg_trgm, etc.) | None |
| 001 | `001_enums.sql` | 14 enum types (idempotent DO blocks) | 000 |
| 002 | `002_functions.sql` | Universal updated_at + audit trigger + auth helper | 000 |
| 003 | `003_food_database.sql` | 7 food tables + Generated Column search_vector | 000, 001, 002 |
| 004 | `004_patient_module.sql` | patients, diagnoses, recipes | 003 |
| 005 | `005_nutrition_assessment.sql` | Assessment + presets + goals + allergies | 004 |
| 006 | `006_weight_tracking.sql` | Weight + body composition + predictions | 004 |
| 007 | `007_meal_plan.sql` | Meal plans + history + versions | 003, 004, 005 |
| 008 | `008_food_record.sql` | Food records + photos + AI analysis | 003, 004 |
| 009 | `009_saved_menu.sql` | Per-slot menu templates | 003, 004 |
| 010 | `010_saved_meal_plan.sql` | Daily plan templates + comparison | 003, 004, 007 |
| 011 | `011_shopping.sql` | Shopping + market prices + sources | 003, 004, 007 |
| 012 | `012_exercise.sql` | Exercise + AI module (requests, recommendations, logs) | 004 |
| 013 | `013_audit_log.sql` | audit_logs table + audit triggers on 8 key tables | 002, all tables |
| 014 | `014_indexes.sql` | 40+ performance indexes | All tables |
| 015 | `015_rls.sql` | RLS enabled + 180+ policies on all 45 tables | All tables |
| 016 | `016_seed_data.sql` | Seed data (categories, labels, templates, sources) | All tables |
| 017 | `017_bugfix.sql` | Post-migration fixes (safety nets) | All above |
| 018 | `018_verify.sql` | Comprehensive verification (outputs ✓/✗ for each component) | All above |

---

## Dependency Graph

```
000_extensions
    ↓
001_enums
    ↓
002_functions (update_updated_at, log_audit_event, is_authenticated)
    ↓
003_food_database (food_categories → food_subcategories → food_labels → foods → food_labels_junction → food_price_history → food_change_logs)
    ↓                    ↓
004_patient_module     [foods available for FK]
  (patients, diagnoses,
   recipes, recipe_items)
    ↓
005_nutrition_assessment    006_weight_tracking    007_meal_plan
  (anthropometry,             (weight_records,        (meal_plans,
   nutrition_assessments,      body_compositions,      meal_plan_items,
   nutrition_presets,          weight_goals,           meal_plan_history,
   nutrition_goals,            weight_predictions)     meal_plan_versions)
   favorite_foods,
   food_preferences,
   food_allergies)
         ↓                        ↓                       ↓
008_food_record            009_saved_menu          010_saved_meal_plan
  (food_records,             (saved_menus,            (saved_meal_plans,
   food_record_history,       saved_menu_items)        saved_meal_plan_items,
   food_record_photos,                                 comparison_history)
   food_record_ai)
         ↓                        ↓                       ↓
011_shopping               012_exercise + AI
  (shopping_lists,           (exercise_plans,
   shopping_items,            exercise_items,
   market_prices,              ai_requests,
   shopping_history,           ai_recommendations,
   price_sources)              ai_logs)
         ↓                        ↓
013_audit_log (audit_logs + triggers on key tables)
    ↓
014_indexes (GIN, trigram, composite, partial — 40+ indexes)
    ↓
015_rls (enable RLS + 180+ policies on all 45 tables)
    ↓
016_seed_data (13 categories, 13 labels, 14 templates, 5 sources)
    ↓
017_bugfix (safety nets — add missing columns, verify triggers)
    ↓
018_verify (comprehensive verification — outputs ✓/✗ for each component)
```

---

## Installation

### Option A: Fresh Database (Recommended)

1. **Go to Supabase Dashboard → SQL Editor → New Query**

2. **Run each file IN ORDER** (000 → 018):
   - Copy the contents of each file
   - Paste into the SQL Editor
   - Click **Run**
   - **Wait for each file to complete without error before proceeding to the next file**
   - Some migrations depend on objects created by previous files

3. **Run `018_verify.sql` last** — it outputs:
   ```
   ✓ Extensions OK
   ✓ Enums OK
   ✓ Tables OK
   ✓ Foreign Keys OK
   ✓ Triggers OK
   ✓ Indexes OK
   ✓ Policies OK
   ✓ Search OK
   ✅ Database Ready — All checks passed!
   ```

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref ycuehkpxrpmtyapfayjh

# Run migrations in order
for f in supabase/migrations/*.sql; do
    echo "Running $f..."
    supabase db execute --file "$f"
done
```

### Option C: Single Combined File

If you prefer to run everything at once, concatenate all files:
```bash
cat supabase/migrations/*.sql > supabase/run_all.sql
```
Then paste `run_all.sql` into Supabase SQL Editor and run once.

---

## Upgrading an Existing Database

All migrations are **idempotent** — safe to re-run on an existing database.

1. **Run all files in order** (000 → 018)
2. Existing tables/columns/indexes will be skipped (`IF NOT EXISTS`)
3. Existing triggers will be dropped and recreated (`DROP IF EXISTS` + `CREATE`)
4. Existing policies will be dropped and recreated (`DROP IF EXISTS` + `CREATE`)
5. Existing enums will be skipped (`DO $$ IF NOT EXISTS`)
6. Seed data uses `ON CONFLICT DO NOTHING` — won't duplicate

**No data loss** — all migrations use soft delete (`deleted_at`), never `DROP TABLE`.

---

## Rollback

### Rollback a Single Table (Soft Delete Approach)

CareLivia uses soft delete. To "remove" a table's data without dropping it:
```sql
UPDATE foods SET deleted_at = now() WHERE name = 'Test Food';
```

### Hard Rollback (Drop Specific Table)

**WARNING: This will lose data. Use with caution.**

```sql
-- Drop in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS ai_logs CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS ai_requests CASCADE;
-- ... continue for each table
```

### Full Reset (Drop Everything)

```sql
-- Drop all tables in the public schema
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Drop all enums
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname);
    END LOOP;
END $$;

-- Drop all functions
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || '() CASCADE';
    END LOOP;
END $$;
```

After a full reset, re-run all migrations from 000.

---

## Seed Data

Seed data is included in `016_seed_data.sql`:

| Data | Count | Details |
|------|-------|---------|
| Food Categories | 13 | Serealia, Umbi, Daging, Ikan, Telur, Susu, Kacang, Sayuran, Buah, Lemak, Gula, Bumbu, Minuman |
| Food Labels | 13 | Halal, Rendah GI, Tinggi Serat, Tinggi Protein, Rendah Natrium, dll |
| Preset Templates | 14 | Diabetes 1500/1800/2000, Hipertensi DASH, CKD ND/HD, CHF, Obesitas, Malnutrisi, Paliatif, Geriatrik, Kehamilan, Laktasi, Atlet |
| Price Sources | 5 | Pasar Tradisional, Supermarket, Marketplace, Distributor, Supplier |

All seed data uses `ON CONFLICT DO NOTHING` — safe to re-run.

### Adding Food Data

Run the food seeder script:
```bash
bun run scripts/seed-foods.ts
```
This adds 73 Indonesian foods (TKPI/DKBM) to the database.

---

## Verification

Run `018_verify.sql` in Supabase SQL Editor. It checks:

1. Extensions (4)
2. Enums (14)
3. Tables (45+)
4. Foreign Keys (30+)
5. Triggers (25+)
6. Indexes (40+)
7. RLS Enabled (45+ tables)
8. RLS Policies (100+)
9. Functions (3+)
10. Search (generated column + GIN + trigram indexes)
11. Seed Data (categories, labels, templates, sources)

Output:
```
✓ Extensions OK (4)
✓ Enums OK (14)
✓ Tables OK (45)
✓ Foreign Keys OK (35)
✓ Triggers OK (30)
✓ Indexes OK (45)
✓ RLS Enabled OK (45)
✓ Policies OK (180)
✓ Functions OK (3)
✓ Search OK (search_vector is GENERATED column)
✓ Search GIN Index OK
✓ Trigram Index OK
✓ Seed: Food Categories OK (13)
✓ Seed: Food Labels OK (13)
✓ Seed: Preset Templates OK (14)
✓ Seed: Price Sources OK (5)

✅ Database Ready — All checks passed!
```

---

## Idempotency Guarantees

Every statement in every file is safe to re-run:

| Object Type | Pattern Used |
|-------------|-------------|
| Tables | `CREATE TABLE IF NOT EXISTS` |
| Indexes | `CREATE INDEX IF NOT EXISTS` |
| Enums | `DO $$ BEGIN IF NOT EXISTS ... END $$` |
| Functions | `CREATE OR REPLACE FUNCTION` |
| Triggers | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` |
| Policies | `DROP POLICY IF EXISTS` + `CREATE POLICY` |
| Extensions | `CREATE EXTENSION IF NOT EXISTS` |
| Seed Data | `INSERT ... ON CONFLICT DO NOTHING` |
| Generated Columns | `ALTER TABLE ADD COLUMN IF NOT EXISTS` + DO block to drop old non-generated version |

**Re-running all 19 files should produce zero errors.**

---

## Search Architecture

Food search uses **Generated Column** (no trigger, no function dependency):

```sql
ALTER TABLE foods ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(english_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(alias, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(tags, '')), 'C')
) STORED;
```

**Indexes for search:**
- `idx_foods_search_vector` — GIN index on `search_vector` (full-text search)
- `idx_foods_name_trgm` — GIN trigram index on `name` (fast ILIKE)
- `idx_foods_english_name_trgm` — GIN trigram on `english_name`
- `idx_foods_alias_trgm` — GIN trigram on `alias`

**Query examples:**
```sql
-- Full-text search (weighted, fast)
SELECT * FROM foods WHERE search_vector @@ to_tsquery('simple', 'beras');

-- Trigram ILIKE (autocomplete)
SELECT * FROM foods WHERE name ILIKE '%beras%' LIMIT 10;
```

---

## Compatibility

These migrations are compatible with all CareLivia modules:
- ✅ Meal Plan AI (meal_plans, meal_plan_items, meal_plan_history, meal_plan_versions)
- ✅ Food Record (food_records, food_record_history, food_record_photos, food_record_ai)
- ✅ Anthropometry (anthropometry, weight_records, body_compositions, weight_goals)
- ✅ Nutrition Assessment (nutrition_assessments — MUST, NRS-2002, SGA, MNA, ECOG, Barthel, FRAIL)
- ✅ Shopping (shopping_lists, shopping_items, market_prices, shopping_history, price_sources)
- ✅ Exercise (exercise_plans, exercise_items)
- ✅ Saved Menu (saved_menus, saved_menu_items, saved_meal_plans, saved_meal_plan_items)
- ✅ AI Nutrition Engine (ai_requests, ai_recommendations, ai_logs)
- ✅ Weight Trend (weight_records, body_compositions, weight_predictions)
- ✅ Audit Log (audit_logs + auto-triggers on 8 key tables)
- ✅ Nutrition Presets (nutrition_presets, nutrition_preset_history)
- ✅ Food Database (foods with 30+ nutrition fields, food_price_history, food_change_logs)
