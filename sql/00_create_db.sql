-- =========================================================
-- 00_create_db.sql
-- Run this once as a Postgres superuser (e.g. `postgres`)
-- to create the role and database used by the app.
-- Example: psql -U postgres -f sql/00_create_db.sql
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'airline_user') THEN
        CREATE ROLE airline_user LOGIN PASSWORD 'airline_pass';
    END IF;
END
$$;

SELECT 'CREATE DATABASE airline_db OWNER airline_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'airline_db')\gexec

GRANT ALL PRIVILEGES ON DATABASE airline_db TO airline_user;
