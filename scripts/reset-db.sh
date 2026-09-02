#!/usr/bin/env bash
# Drops and recreates the schema, then reseeds it.
# Usage: ./scripts/reset-db.sh
set -euo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=airline_user}"
: "${PGDATABASE:=airline_db}"
export PGPASSWORD="${PGPASSWORD:-airline_pass}"

echo "Applying schema to $PGDATABASE on $PGHOST:$PGPORT ..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f sql/01_schema.sql
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f sql/02_constraints_indexes.sql
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f sql/03_seed.sql

echo "Database reset and seeded."
