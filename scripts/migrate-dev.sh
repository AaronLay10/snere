#!/bin/bash
# Run Database Migrations
# Applies pending migrations to the development database

set -e

echo "📦 Running database migrations..."

# Database connection
export DATABASE_URL="${DATABASE_URL:-postgresql://sentient_dev:${DB_PASSWORD}@localhost:5432/sentient_dev}"

cd "$(dirname "$0")/../services/api"

npm run migrate:up

echo "✅ Migrations complete!"
