-- =====================================================================
-- 021_exercise_plan_library.sql
-- Purpose: Evidence-based exercise program reference library (knowledge
--          base) used to GROUND the AI exercise plan generator
--          (/api/ai/exercise-plan). This is reference data, analogous to
--          the `foods` table — not per-patient data.
-- Dependencies: 001_enums.sql (diagnosis_type_enum), 002_functions.sql
--               (update_updated_at), 012_exercise.sql (exercise_plans)
-- =====================================================================

create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Lookup: exercise_categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_categories (
    id          TEXT PRIMARY KEY,             -- e.g. 'metabolic'
    name_en     TEXT NOT NULL,
    name_id     TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO exercise_categories (id, name_en, name_id, sort_order) VALUES
    ('metabolic',       'Metabolic Disease',       'Penyakit Metabolik',      1),
    ('cardiovascular',  'Cardiovascular Disease',  'Penyakit Kardiovaskular', 2),
    ('renal',           'Kidney Disease',          'Penyakit Ginjal',         3),
    ('respiratory',     'Respiratory Disease',     'Penyakit Respirasi',      4),
    ('musculoskeletal', 'Musculoskeletal',         'Muskuloskeletal',         5),
    ('neurology',       'Neurology',               'Neurologi',               6),
    ('geriatric',       'Geriatrics',              'Geriatri',                7),
    ('women',           'Women''s Health',         'Kesehatan Wanita',        8),
    ('pediatric',       'Pediatrics',              'Anak',                    9)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Master table: exercise_programs
-- One row per diagnosis-specific program. `linked_diagnosis_types` maps
-- each program to the app's existing diagnosis_type_enum so patients can
-- be matched via a simple array-overlap query against their active
-- diagnoses — no separate mapping table needed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercise_programs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             TEXT NOT NULL REFERENCES exercise_categories(id),
    diagnosis_code          TEXT NOT NULL,                 -- fine-grained slug, e.g. 'dm_type2'
    linked_diagnosis_types  diagnosis_type_enum[] NOT NULL DEFAULT '{}',
    diagnosis_name_en       TEXT NOT NULL,
    diagnosis_name_id       TEXT NOT NULL,
    program_name            TEXT NOT NULL,
    difficulty_level        TEXT NOT NULL CHECK (difficulty_level IN ('pemula','menengah','lanjut')),
    target_patient          TEXT NOT NULL,

    goals                   JSONB NOT NULL DEFAULT '[]'::jsonb,
    fitt                    JSONB NOT NULL DEFAULT '{}'::jsonb,
    warmup                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    core_exercise           JSONB NOT NULL DEFAULT '{}'::jsonb,
    cooldown                JSONB NOT NULL DEFAULT '{}'::jsonb,
    stretching              JSONB NOT NULL DEFAULT '{}'::jsonb,
    media_references        JSONB NOT NULL DEFAULT '[]'::jsonb,
    modifications           JSONB NOT NULL DEFAULT '{}'::jsonb,
    red_flags               JSONB NOT NULL DEFAULT '[]'::jsonb,
    contraindications       JSONB NOT NULL DEFAULT '{}'::jsonb,
    monitoring_targets      JSONB NOT NULL DEFAULT '[]'::jsonb,
    progression_rule        JSONB NOT NULL DEFAULT '{}'::jsonb,
    patient_education       TEXT,
    motivation_quote        TEXT,
    daily_target_schedule   JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_references     TEXT[] NOT NULL DEFAULT '{}',

    version                 INTEGER NOT NULL DEFAULT 1,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_by              TEXT DEFAULT 'system',
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now(),

    UNIQUE (diagnosis_code, version)
);

DROP TRIGGER IF EXISTS trg_exercise_programs_updated ON exercise_programs;
CREATE TRIGGER trg_exercise_programs_updated BEFORE UPDATE ON exercise_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_exercise_programs_category ON exercise_programs (category_id);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_diagnosis_code ON exercise_programs (diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_active ON exercise_programs (is_active);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_linked_types ON exercise_programs USING gin (linked_diagnosis_types);
CREATE INDEX IF NOT EXISTS idx_exercise_programs_name_trgm ON exercise_programs USING gin (diagnosis_name_id gin_trgm_ops);

-- keep only one active version per diagnosis_code
CREATE UNIQUE INDEX IF NOT EXISTS uq_exercise_programs_active_diagnosis
    ON exercise_programs (diagnosis_code) WHERE is_active = true;

-- ---------------------------------------------------------------------
-- Traceability: link a generated exercise_plans row back to the
-- library program(s) that grounded the AI generation (nullable, additive).
-- ---------------------------------------------------------------------
ALTER TABLE exercise_plans ADD COLUMN IF NOT EXISTS source_program_ids UUID[] DEFAULT '{}';

-- ---------------------------------------------------------------------
-- RLS — same strategy as 015_rls.sql: anon read-only (reference data,
-- like `foods`), authenticated full CRUD.
-- ---------------------------------------------------------------------
ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercise_categories_anon_select ON exercise_categories;
CREATE POLICY exercise_categories_anon_select ON exercise_categories
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS exercise_programs_anon_select ON exercise_programs;
CREATE POLICY exercise_programs_anon_select ON exercise_programs
    FOR SELECT TO anon USING (is_active = true);

DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY['exercise_categories', 'exercise_programs'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_select', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);', tbl || '_auth_select', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_insert', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);', tbl || '_auth_insert', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_update', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', tbl || '_auth_update', tbl);

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_auth_delete', tbl);
        EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);', tbl || '_auth_delete', tbl);
    END LOOP;
END $$;
