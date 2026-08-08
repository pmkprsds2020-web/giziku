-- =====================================================================
-- 023_exercise_plan_ai_details.sql
-- Purpose: Persist the enriched AI exercise-plan output (warmup/cooldown
--          instructions, red flags, monitoring targets, patient
--          education, weekly progression, per-item how-to) that was
--          previously discarded after generation.
-- Dependencies: 012_exercise.sql, 021_exercise_plan_library.sql
-- =====================================================================

ALTER TABLE exercise_plans ADD COLUMN IF NOT EXISTS plan_details JSONB DEFAULT '{}'::jsonb;
-- Shape: { "warmup": string, "cooldown": string, "red_flags": string[],
--          "monitoring_targets": string[], "patient_education": string,
--          "weekly_progression": string }

ALTER TABLE exercise_items ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE exercise_items ADD COLUMN IF NOT EXISTS sets_reps TEXT;
