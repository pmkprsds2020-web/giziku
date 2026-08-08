-- =====================================================================
-- 026_assessment_v2_instruments.sql
-- Purpose: Extend nutrition_assessments with the additional click-only
--          instruments required by the "Asesmen Gizi & Fungsional
--          Komprehensif" spec: Karnofsky, Clinical Frailty Scale (CFS),
--          SARC-F / SARC-CalF (EWGSOP2), full Morse Fall Scale items,
--          and Timed Up and Go (TUG). No slider/scroll inputs — all
--          values below are the result of single-click selections.
-- Dependencies: 005_nutrition_assessment.sql
-- Idempotent.
-- =====================================================================

ALTER TABLE nutrition_assessments
    ADD COLUMN IF NOT EXISTS karnofsky          INTEGER,              -- 10-100 step 10
    ADD COLUMN IF NOT EXISTS cfs                INTEGER,              -- Clinical Frailty Scale 1-9
    ADD COLUMN IF NOT EXISTS sarcf_score         INTEGER,              -- SARC-F 0-10
    ADD COLUMN IF NOT EXISTS sarcf_positive       BOOLEAN,              -- score >= 4
    ADD COLUMN IF NOT EXISTS calf_category        TEXT,                 -- 'M_NORMAL' | 'M_LOW' | 'F_NORMAL' | 'F_LOW'
    ADD COLUMN IF NOT EXISTS sarc_calf_score       INTEGER,              -- SARC-F + calf adjustment, 0-20
    ADD COLUMN IF NOT EXISTS sarc_calf_positive     BOOLEAN,              -- score >= 11
    ADD COLUMN IF NOT EXISTS morse_history_fall     BOOLEAN,
    ADD COLUMN IF NOT EXISTS morse_secondary_dx      BOOLEAN,
    ADD COLUMN IF NOT EXISTS morse_ambulatory_aid     TEXT,                 -- 'NONE' | 'CRUTCH_CANE_WALKER' | 'FURNITURE'
    ADD COLUMN IF NOT EXISTS morse_iv_therapy         BOOLEAN,
    ADD COLUMN IF NOT EXISTS morse_gait               TEXT,                 -- 'NORMAL' | 'WEAK' | 'IMPAIRED'
    ADD COLUMN IF NOT EXISTS morse_mental_status       TEXT,                 -- 'ORIENTED' | 'OVERESTIMATES'
    ADD COLUMN IF NOT EXISTS morse_score               INTEGER,              -- 0-125
    ADD COLUMN IF NOT EXISTS tug_category              TEXT,                 -- '<10' | '10-19' | '20-29' | '>=30'
    ADD COLUMN IF NOT EXISTS barthel_items             JSONB;                -- per-item Barthel breakdown (10 items)

CREATE INDEX IF NOT EXISTS idx_nutrition_assessments_cfs ON nutrition_assessments(cfs);
