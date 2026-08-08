-- =====================================================================
-- 001_enums.sql
-- Purpose: Create all PostgreSQL enum types (idempotent)
-- Dependencies: 000_extensions.sql
-- =====================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
    CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blood_type_enum') THEN
    CREATE TYPE blood_type_enum AS ENUM ('A', 'B', 'AB', 'O', 'UNKNOWN');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'religion_enum') THEN
    CREATE TYPE religion_enum AS ENUM ('ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDDHA', 'KONGHUCU', 'OTHER');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diagnosis_type_enum') THEN
    CREATE TYPE diagnosis_type_enum AS ENUM (
      'DM','HT','CHF','CKD','CKD_ND','CKD_HD','CKD_PD','LIVER','CANCER',
      'DYSLIPIDEMIA','GOUT','GERD','PUD','IBD','OBESITY','MALNUTRITION',
      'SARCOPENIA','POST_OP','PREGNANCY','LACTATION','PEDIATRIC','GERIATRIC',
      'STROKE','COPD','OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_level_enum') THEN
    CREATE TYPE activity_level_enum AS ENUM ('BED_REST','VERY_LIGHT','LIGHT','MODERATE','HEAVY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stress_level_enum') THEN
    CREATE TYPE stress_level_enum AS ENUM ('NONE','MILD','MODERATE','SEVERE','VERY_SEVERE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_slot_enum') THEN
    CREATE TYPE meal_slot_enum AS ENUM ('BREAKFAST','MORNING_SNACK','LUNCH','AFTERNOON_SNACK','DINNER','EVENING_SNACK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'food_source_enum') THEN
    CREATE TYPE food_source_enum AS ENUM ('TKPI','DKBM','USDA','CUSTOM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shopping_period_enum') THEN
    CREATE TYPE shopping_period_enum AS ENUM ('DAILY','WEEKLY','MONTHLY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_type_enum') THEN
    CREATE TYPE exercise_type_enum AS ENUM ('AEROBIC','RESISTANCE','FLEXIBILITY','BALANCE','FUNCTIONAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exercise_intensity_enum') THEN
    CREATE TYPE exercise_intensity_enum AS ENUM ('LOW','MODERATE','HIGH');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preset_goal_enum') THEN
    CREATE TYPE preset_goal_enum AS ENUM (
      'WEIGHT_LOSS','WEIGHT_MAINTAIN','WEIGHT_GAIN','HIGH_PROTEIN',
      'LOW_CARB','LOW_FAT','CKD_DIET','DIABETES_DIET','HYPERTENSION_DIET','GENERAL'
    );
  END IF;
END $$;

-- New enums for AI module
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_request_status_enum') THEN
    CREATE TYPE ai_request_status_enum AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_request_type_enum') THEN
    CREATE TYPE ai_request_type_enum AS ENUM ('MEAL_PLAN','EXERCISE_PLAN','NUTRITION_ADVICE','FOOD_RECOMMENDATION','COMPLIANCE_ANALYSIS');
  END IF;
END $$;

-- New enum for body composition
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'body_comp_method_enum') THEN
    CREATE TYPE body_comp_method_enum AS ENUM ('BIA','SKINFOLD','DEXA','BOD_POD','ESTIMATE');
  END IF;
END $$;
