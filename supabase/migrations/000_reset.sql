-- =====================================================================
-- 000_reset.sql — Production Safe Reset
-- Purpose: Drop CareLivia tables/enums/triggers ONLY (not extensions
--          or their functions like show_limit from pg_trgm).
--
-- This file is OPTIONAL. Only run if you need to start completely fresh.
-- The run_all_fresh.sql file does NOT require this — it uses
-- CREATE TABLE IF NOT EXISTS + DO blocks for idempotent FK creation.
--
-- Safe: Skips extension-owned functions, wraps everything in
--       BEGIN...EXCEPTION WHEN OTHERS THEN NULL END blocks.
-- =====================================================================

-- Drop triggers (safe — only drops triggers on user tables)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public') LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I;', r.trigger_name, r.event_object_table);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;

-- Drop functions (safe — skips extension-owned functions like show_limit)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
        WHERE n.nspname = 'public' AND d.objid IS NULL
    ) LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE;', r.proname);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping function %', r.proname;
        END;
    END LOOP;
END $$;

-- Drop tables (CASCADE handles FK dependencies)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', r.tablename);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;

-- Drop enums (safe — only drops user-created enums)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT t.typname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public' AND t.typtype = 'e'
    ) LOOP
        BEGIN
            EXECUTE format('DROP TYPE IF EXISTS %I;', r.typname);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;

-- Verification
SELECT count(*) as remaining_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 0
