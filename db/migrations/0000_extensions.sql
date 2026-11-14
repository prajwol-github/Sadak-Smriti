-- 0000 extensions (custom migration, ADR 0005)
--
-- PostGIS, pg_trgm and unaccent need a superuser to install, so infra/db/init-roles.sh installs
-- them when the database is created (and the production runbook does the same, P0-14).
-- This migration only fails fast, with a clear message, if one is missing.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(name, ', ') INTO missing
  FROM unnest(ARRAY['postgis', 'pg_trgm', 'unaccent']) AS name
  WHERE NOT EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname = name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing extensions: %. A superuser must run CREATE EXTENSION (see infra/db/init-roles.sh).', missing;
  END IF;
END
$$;
