-- =====================================================================
-- 002_functions.sql
-- Purpose: Universal helper functions (updated_at trigger + audit log trigger)
-- Dependencies: 001_enums.sql
-- Notes: Uses CREATE OR REPLACE for idempotency. Single universal function.
-- =====================================================================

-- Universal updated_at function — used by ALL tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit log function — auto-logs INSERT/UPDATE/DELETE to audit_logs table
-- Simplified version: logs entity, entity_id, action, actor only (no JSON diff)
-- This avoids PL/pgSQL parsing issues with complex JSON aggregation in triggers
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_entity TEXT := TG_TABLE_NAME;
    v_entity_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action := 'DELETE';
        v_entity_id := (OLD.id)::UUID;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'UPDATE';
        v_entity_id := (NEW.id)::UUID;
    ELSIF TG_OP = 'INSERT' THEN
        v_action := 'CREATE';
        v_entity_id := (NEW.id)::UUID;
    END IF;

    -- Only log if audit_logs table exists (avoids errors during initial creation)
    BEGIN
        INSERT INTO audit_logs (entity, entity_id, action, actor, created_at)
        VALUES (
            v_entity,
            v_entity_id,
            v_action,
            COALESCE(current_setting('app.current_user', true), 'system'),
            now()
        );
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: check if user is authenticated (for RLS policies)
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: food search_vector is implemented as a GENERATED COLUMN in 003_food_database.sql
-- This avoids dependency on the `foods` composite type and is faster + simpler.
-- No function needed — PostgreSQL auto-computes the tsvector on INSERT/UPDATE.
