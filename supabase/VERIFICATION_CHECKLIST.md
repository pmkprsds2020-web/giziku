# CareLivia CNMS — Database Migration Verification Checklist

## How to Run Migrations

1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Run each migration file **in order** (000 → 017)
3. Each file is **idempotent** — safe to run multiple times
4. After all migrations, run the verification queries below

## Migration Order

| File | Purpose | Tables Created |
|------|---------|---------------|
| 000_extensions.sql | PostgreSQL extensions | — |
| 001_enums.sql | Enum types | — |
| 002_functions.sql | Helper functions | — |
| 003_food_database.sql | Food DB | food_categories, food_subcategories, food_labels, food_labels_junction, foods, food_price_history, food_change_logs |
| 004_patient_module.sql | Patient + recipes | patients, diagnoses, recipes, recipe_items |
| 005_nutrition_assessment.sql | Assessment + presets | anthropometry, nutrition_assessments, nutrition_presets, nutrition_preset_history, nutrition_goals, favorite_foods, food_preferences, food_allergies |
| 006_weight_tracking.sql | Weight + body comp | weight_records, body_compositions, weight_goals, weight_predictions |
| 007_meal_plan.sql | Meal plans | meal_plans, meal_plan_items, meal_plan_history, meal_plan_versions |
| 008_food_record.sql | Food records | food_records, food_record_history, food_record_photos, food_record_ai |
| 009_saved_menu.sql | Saved menus (per-slot) | saved_menus, saved_menu_items |
| 010_saved_meal_plan.sql | Saved meal plans (daily) | saved_meal_plans, saved_meal_plan_items, comparison_history |
| 011_shopping.sql | Shopping + market prices | shopping_lists, shopping_items, market_prices, shopping_history, price_sources |
| 012_exercise.sql | Exercise + AI | exercise_plans, exercise_items, ai_requests, ai_recommendations, ai_logs |
| 013_audit_log.sql | Audit trail | audit_logs + audit triggers |
| 014_indexes.sql | Performance indexes | 30+ indexes (GIN, trigram, composite, partial) |
| 015_rls.sql | Row Level Security | 180+ policies |
| 016_seed_data.sql | Seed reference data | 13 categories, 13 labels, 14 preset templates, 5 price sources |
| 017_bugfix.sql | Post-migration fixes | search_vector population, safety nets |

## Verification Queries

Run these in Supabase SQL Editor after all migrations:

### 1. Check Table Count (should be 45+)

```sql
SELECT count(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

### 2. Check All Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 3. Check Enum Types (should be 14)

```sql
SELECT count(*) as enum_count
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public' AND t.typtype = 'e';
```

### 4. Check Indexes (should be 40+)

```sql
SELECT count(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public';
```

### 5. Check RLS Enabled Tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
```

### 6. Check RLS Policies (should be 180+)

```sql
SELECT count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public';
```

### 7. Check Triggers

```sql
SELECT event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

### 8. Check Seed Data

```sql
-- Food categories (should be 13)
SELECT count(*) FROM food_categories;

-- Food labels (should be 13)
SELECT count(*) FROM food_labels;

-- Preset templates (should be 14)
SELECT count(*) FROM nutrition_presets WHERE is_template = true;

-- Price sources (should be 5)
SELECT count(*) FROM price_sources;
```

### 9. Test Food Search (trigram + full-text + generated column)

```sql
-- Verify search_vector is a GENERATED column
SELECT column_name, is_generated, generation_expression
FROM information_schema.columns
WHERE table_name = 'foods' AND column_name = 'search_vector';
-- Expected: is_generated = 'ALWAYS'

-- Trigram search (fast ILIKE)
SELECT name, energy FROM foods
WHERE name ILIKE '%beras%'
LIMIT 5;

-- Full-text search (uses generated search_vector)
SELECT name, energy FROM foods
WHERE search_vector @@ to_tsquery('simple', 'beras')
LIMIT 5;
```

### 10. Test RLS (requires authenticated user)

```sql
-- Should work with authenticated session
SELECT * FROM patients LIMIT 5;
SELECT * FROM foods LIMIT 5;
SELECT * FROM meal_plans LIMIT 5;
```

## Idempotency Test

Re-run ALL migration files. You should see **zero errors** — only "already exists" notices.
