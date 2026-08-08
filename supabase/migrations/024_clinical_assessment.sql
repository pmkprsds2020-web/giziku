-- =====================================================================
-- CareLivia — Clinical Assessment (AI Evaluation / CDSS) Migration
-- Adds: clinical_assessments — persisted output of the comprehensive
-- AI Clinical Decision Support System evaluation (Master Prompt V3.0).
-- Run after 023_exercise_plan_ai_details.sql. Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS clinical_assessments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  overall_risk_level TEXT DEFAULT 'LOW',       -- LOW | MODERATE | HIGH | CRITICAL
  summary TEXT NOT NULL,                       -- kesimpulan_ai, for quick listing
  payload JSONB NOT NULL,                      -- full ClinicalAssessmentOutput
  ai_model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_assessments_patient ON clinical_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_assessments_created_at ON clinical_assessments(created_at DESC);

ALTER TABLE clinical_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinical_assessments' AND policyname = 'authenticated_all_clinical_assessments') THEN
    CREATE POLICY authenticated_all_clinical_assessments ON clinical_assessments FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;
