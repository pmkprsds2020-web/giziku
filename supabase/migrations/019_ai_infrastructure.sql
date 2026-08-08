-- =====================================================================
-- CareLivia — AI Infrastructure Migration
-- Adds: ai_usage_logs, ai_cache, nutrition_analysis, food_record_analysis
-- Run after 018_verify.sql. Idempotent (IF NOT EXISTS everywhere).
-- =====================================================================

-- ---------------------------------------------------------------------
-- AI Usage Logs — response time, token usage, cost, per feature/model
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  feature TEXT NOT NULL,               -- 'meal-plan-reasoning' | 'chat' | 'nutrition-analysis' | ...
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd DOUBLE PRECISION DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  cache_hit BOOLEAN DEFAULT false,
  error_message TEXT,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON ai_usage_logs(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_patient ON ai_usage_logs(patient_id);

-- ---------------------------------------------------------------------
-- AI Cache — reuse identical AI requests instead of re-calling OpenAI
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature ON ai_cache(feature);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_cache(expires_at);

-- ---------------------------------------------------------------------
-- Nutrition Analysis results (AI-generated, persisted for history)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_analysis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  strengths JSONB DEFAULT '[]'::jsonb,
  concerns JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  risk_level TEXT DEFAULT 'LOW',
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nutrition_analysis_patient ON nutrition_analysis(patient_id);

-- ---------------------------------------------------------------------
-- Food Record Analysis results (AI-generated adherence analysis)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_record_analysis (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT now(),
  adherence_summary TEXT NOT NULL,
  deviations JSONB DEFAULT '[]'::jsonb,
  positive_patterns JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  ai_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_record_analysis_patient ON food_record_analysis(patient_id);

-- ---------------------------------------------------------------------
-- RLS — enable and allow authenticated users (mirrors 015_rls.sql pattern)
-- ---------------------------------------------------------------------
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_record_analysis ENABLE ROW LEVEL SECURITY;

-- ai_usage_logs / ai_cache: written ONLY via lib/supabase/service.ts
-- (SUPABASE_SERVICE_ROLE_KEY, bypasses RLS anyway) — policy is effectively
-- a safety net + lets you inspect them from the Supabase SQL editor.
-- nutrition_analysis / food_record_analysis: written via the normal
-- cookie-authenticated client, same as every other patient-data table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage_logs' AND policyname = 'service_role_all_ai_usage_logs') THEN
    CREATE POLICY service_role_all_ai_usage_logs ON ai_usage_logs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_cache' AND policyname = 'service_role_all_ai_cache') THEN
    CREATE POLICY service_role_all_ai_cache ON ai_cache FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nutrition_analysis' AND policyname = 'authenticated_all_nutrition_analysis') THEN
    CREATE POLICY authenticated_all_nutrition_analysis ON nutrition_analysis FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'food_record_analysis' AND policyname = 'authenticated_all_food_record_analysis') THEN
    CREATE POLICY authenticated_all_food_record_analysis ON food_record_analysis FOR ALL USING (auth.role() IN ('authenticated', 'service_role')) WITH CHECK (auth.role() IN ('authenticated', 'service_role'));
  END IF;
END $$;
