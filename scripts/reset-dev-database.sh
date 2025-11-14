#!/bin/bash
# Reset Development Database
# Drops and recreates the development database, runs migrations, and seeds data

set -e

echo "🔄 Resetting development database..."

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sentient_dev}"
DB_USER="${DB_USER:-sentient_dev}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo "⚠️  This will DELETE all data in $DB_NAME!"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Drop existing database
echo "🗑️  Dropping database $DB_NAME..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$POSTGRES_USER" -d postgres << EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME OWNER $DB_USER;
EOF

echo "✅ Database dropped and recreated"

# Run migrations
echo "📦 Running migrations..."
cd "$(dirname "$0")/../services/api"
npm run migrate:up

echo "✅ Migrations complete"

# Seed data
echo "🌱 Seeding data..."
cd "$(dirname "$0")/.."
./scripts/seed-dev-database.sh

echo ""
echo "✅ Development database reset complete!"
echo "🚀 Ready to develop!"
