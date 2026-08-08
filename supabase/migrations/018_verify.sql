-- =====================================================================
-- 018_verify.sql
-- Purpose: Comprehensive verification of all database objects after migration
-- Run this LAST to confirm everything was created correctly.
-- All queries use RAISE NOTICE — safe to run, produces no data changes.
-- =====================================================================

DO $$
DECLARE
    v_count INTEGER;
    v_passed BOOLEAN := true;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE ' CareLivia CNMS — Database Verification';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =====================================================================
    -- 1. EXTENSIONS
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM pg_extension
    WHERE extname IN ('pgcrypto', 'uuid-ossp', 'pg_trgm', 'unaccent');

    IF v_count >= 4 THEN
        RAISE NOTICE '✓ Extensions OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Extensions FAILED (%) — expected 4', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 2. ENUMS
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typtype = 'e';

    IF v_count >= 14 THEN
        RAISE NOTICE '✓ Enums OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Enums FAILED (%) — expected 14', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 3. TABLES
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

    IF v_count >= 45 THEN
        RAISE NOTICE '✓ Tables OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Tables FAILED (%) — expected 45+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 4. FOREIGN KEYS
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';

    IF v_count >= 30 THEN
        RAISE NOTICE '✓ Foreign Keys OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Foreign Keys FAILED (%) — expected 30+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 5. TRIGGERS
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';

    IF v_count >= 25 THEN
        RAISE NOTICE '✓ Triggers OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Triggers FAILED (%) — expected 25+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 6. INDEXES
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM pg_indexes
    WHERE schemaname = 'public';

    IF v_count >= 40 THEN
        RAISE NOTICE '✓ Indexes OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Indexes FAILED (%) — expected 40+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 7. RLS ENABLED TABLES
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true;

    IF v_count >= 45 THEN
        RAISE NOTICE '✓ RLS Enabled OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ RLS Enabled FAILED (%) — expected 45+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 8. RLS POLICIES
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public';

    IF v_count >= 100 THEN
        RAISE NOTICE '✓ Policies OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Policies FAILED (%) — expected 100+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 9. FUNCTIONS
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';

    IF v_count >= 3 THEN
        RAISE NOTICE '✓ Functions OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Functions FAILED (%) — expected 3+', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 10. SEARCH (generated column + GIN index)
    -- =====================================================================
    SELECT count(*) INTO v_count
    FROM information_schema.columns
    WHERE table_name = 'foods' AND column_name = 'search_vector' AND is_generated = 'ALWAYS';

    IF v_count = 1 THEN
        RAISE NOTICE '✓ Search OK (search_vector is GENERATED column)';
    ELSE
        RAISE NOTICE '✗ Search FAILED — search_vector not found as generated column';
        v_passed := false;
    END IF;

    -- Check GIN index on search_vector
    SELECT count(*) INTO v_count
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'foods' AND indexdef LIKE '%search_vector%';

    IF v_count >= 1 THEN
        RAISE NOTICE '✓ Search GIN Index OK';
    ELSE
        RAISE NOTICE '✗ Search GIN Index FAILED';
        v_passed := false;
    END IF;

    -- Check trigram index on name
    SELECT count(*) INTO v_count
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'foods' AND indexdef LIKE '%gin_trgm%';

    IF v_count >= 1 THEN
        RAISE NOTICE '✓ Trigram Index OK';
    ELSE
        RAISE NOTICE '✗ Trigram Index FAILED';
        v_passed := false;
    END IF;

    -- =====================================================================
    -- 11. SEED DATA
    -- =====================================================================
    SELECT count(*) INTO v_count FROM food_categories;
    IF v_count >= 13 THEN
        RAISE NOTICE '✓ Seed: Food Categories OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Seed: Food Categories FAILED (%) — expected 13', v_count;
        v_passed := false;
    END IF;

    SELECT count(*) INTO v_count FROM food_labels;
    IF v_count >= 13 THEN
        RAISE NOTICE '✓ Seed: Food Labels OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Seed: Food Labels FAILED (%) — expected 13', v_count;
        v_passed := false;
    END IF;

    SELECT count(*) INTO v_count FROM nutrition_presets WHERE is_template = true;
    IF v_count >= 14 THEN
        RAISE NOTICE '✓ Seed: Preset Templates OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Seed: Preset Templates FAILED (%) — expected 14', v_count;
        v_passed := false;
    END IF;

    SELECT count(*) INTO v_count FROM price_sources;
    IF v_count >= 5 THEN
        RAISE NOTICE '✓ Seed: Price Sources OK (%)', v_count;
    ELSE
        RAISE NOTICE '✗ Seed: Price Sources FAILED (%) — expected 5', v_count;
        v_passed := false;
    END IF;

    -- =====================================================================
    -- RESULT
    -- =====================================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    IF v_passed THEN
        RAISE NOTICE ' ✅ Database Ready — All checks passed!';
    ELSE
        RAISE NOTICE ' ❌ Database NOT Ready — Some checks failed. Review above.';
    END IF;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
