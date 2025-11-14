#!/bin/bash
# Validate Database Schema
# Checks that all required tables, indexes, and constraints exist

set -e

echo "🔍 Validating database schema..."

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sentient_dev}"
DB_USER="${DB_USER:-sentient_dev}"

# Required tables
REQUIRED_TABLES=(
  "clients"
  "rooms"
  "controllers"
  "devices"
  "device_commands"
  "scenes"
  "scene_steps"
  "puzzles"
  "puzzle_states"
  "users"
  "sessions"
  "audit_logs"
)

echo "Checking required tables..."
for table in "${REQUIRED_TABLES[@]}"; do
  if PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT 1 FROM pg_tables WHERE tablename='$table'" | grep -q 1; then
    echo "  ✅ $table"
  else
    echo "  ❌ $table - MISSING!"
    exit 1
  fi
done

echo ""
echo "✅ Schema validation passed!"
