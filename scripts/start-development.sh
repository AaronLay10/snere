#!/usr/bin/env bash
# Sentient Engine - Start Development Services

set -e

cd "$(dirname "$0")/.."

echo "Starting Sentient Engine (Development)..."
echo ""

# Use local development environment
if [ -f .env.development ]; then
	export $(cat .env.development | grep -v '^#' | xargs)
fi

echo "Starting services in development mode..."
docker compose up -d

# Wait for services to start
echo ""
echo "Waiting for services to start..."
sleep 10

# Show status
echo ""
echo "Service status:"
docker compose ps

echo ""
echo "=========================================="
echo "Sentient Engine (Development) is running!"
echo "=========================================="
echo ""
echo "Access points:"
echo "  - Web UI: http://localhost:3002 (Vite HMR enabled)"
echo "  - API: http://localhost:3000"
echo "  - Scene Executor: http://localhost:3004"
echo "  - Device Monitor: http://localhost:3003"
echo "  - Grafana: http://localhost:3200"
echo "  - Prometheus: http://localhost:9090"
echo "  - PostgreSQL: localhost:5432"
echo "  - MQTT: localhost:1883"
echo ""
echo "Debug ports:"
echo "  - API Instance 1: 9229"
echo "  - API Instance 2: 9228"
echo "  - Scene Executor: 9230"
echo "  - Device Monitor: 9231"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose logs -f [service]"
echo "  - Stop: docker compose down"
echo "  - Rebuild: docker compose up -d --build"
echo ""
