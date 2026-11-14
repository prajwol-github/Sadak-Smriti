#!/bin/sh
# Runs once, when the database volume is first created (docker-entrypoint-initdb.d).
# Creates the three roles from SPEC 12.3 and the extensions, which need a superuser.
#
#   migrator  owns the schema and runs migrations (DDL)
#   app       what the website connects as: read and write data, no DDL;
#             audit_log is INSERT only (granted in a migration)
#   readonly  exports and the public API (later)
set -eu

DB_NAME="${POSTGRES_DB:-sadak}"

psql -v ON_ERROR_STOP=1 --username postgres --dbname "$DB_NAME" \
  -v dbname="$DB_NAME" -v migrator_pw="$MIGRATOR_PASSWORD" -v app_pw="$APP_PASSWORD" -v readonly_pw="$READONLY_PASSWORD" <<'SQL'
CREATE ROLE migrator LOGIN PASSWORD :'migrator_pw';
CREATE ROLE app      LOGIN PASSWORD :'app_pw';
CREATE ROLE readonly LOGIN PASSWORD :'readonly_pw';

ALTER DATABASE :"dbname" OWNER TO migrator;
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname" TO migrator, app, readonly;

-- Extensions need a superuser; migrations only check they exist.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER SCHEMA public OWNER TO migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app, readonly;

-- Tables created later by migrator are usable by app (read/write) and readonly (read).
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly;
SQL
