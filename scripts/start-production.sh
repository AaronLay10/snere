#!/bin/bash
# Sentient Engine - Start Production Services

set -e

cd "$(dirname "$0")/.."

echo "Starting Sentient Engine (Production)..."
echo ""

# Use production environment
export $(cat .env.production | grep -v '^#' | xargs)

# Pull latest images
echo "Pulling latest images..."
docker-compose pull

# Build services
echo "Building services..."
docker-compose build --no-cache

# Start services
echo "Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "Waiting for services to start..."
sleep 10

# Show status
echo ""
echo "Service status:"
docker-compose ps

# Show logs
echo ""
echo "Recent logs:"
docker-compose logs --tail=20

echo ""
echo "=========================================="
echo "Sentient Engine is running!"
echo "=========================================="
echo ""
echo "Access points:"
echo "  - Web UI: https://sentientengine.ai"
echo "  - API: https://sentientengine.ai/api"
echo "  - Grafana: https://sentientengine.ai/grafana"
echo "  - Prometheus: http://localhost:9090"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f [service]"
echo "  - Stop: ./scripts/stop-production.sh"
echo "  - Restart: docker-compose restart [service]"
echo ""