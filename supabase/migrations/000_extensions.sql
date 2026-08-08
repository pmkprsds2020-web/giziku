-- =====================================================================
-- 000_extensions.sql
-- Purpose: Enable required PostgreSQL extensions for CareLivia CNMS
-- Dependencies: None (run first)
-- =====================================================================

-- pgcrypto: provides gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp: alternative UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm: trigram-based search (fast ILIKE for food/patient search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent: accent-insensitive search (Indonesian food names)
CREATE EXTENSION IF NOT EXISTS unaccent;
