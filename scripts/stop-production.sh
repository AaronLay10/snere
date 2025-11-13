#!/bin/bash
# Sentient Engine - Stop Production Services

set -e

cd "$(dirname "$0")/.."

echo "Stopping Sentient Engine (Production)..."
echo ""

# Stop services
docker-compose down

echo ""
echo "Services stopped."
echo ""
echo "Data is preserved in volumes."
echo "To remove all data, run: docker-compose down -v"
echo ""