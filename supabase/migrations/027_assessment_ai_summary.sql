-- =====================================================================
-- 027_assessment_ai_summary.sql
-- Purpose: Ringkasan Interpretasi AI Otomatis — persisted focused AI
--          interpretation generated right after a nutrition/functional
--          assessment (nutrition_assessments row) is saved.
-- Dependencies: 005_nutrition_assessment.sql
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS assessment_ai_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL,
  patient_id      UUID NOT NULL,
  kesimpulan_nutrisi TEXT NOT NULL,            -- NORMAL | AT_RISK | MALNUTRITION | GLIM_COMPATIBLE
  payload         JSONB NOT NULL,              -- full AssessmentSummaryOutput
  ai_model        TEXT,
  prompt_tokens   INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_assessment_summary_assessment FOREIGN KEY (assessment_id)
      REFERENCES nutrition_assessments(id) ON DELETE CASCADE,
  CONSTRAINT fk_assessment_summary_patient FOREIGN KEY (patient_id)
      REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_ai_summaries_assessment ON assessment_ai_summaries(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_ai_summaries_patient ON assessment_ai_summaries(patient_id, created_at DESC);

ALTER TABLE assessment_ai_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'assessment_ai_summaries' AND policyname = 'authenticated_all_assessment_ai_summaries') THEN
    CREATE POLICY authenticated_all_assessment_ai_summaries ON assessment_ai_summaries FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;
