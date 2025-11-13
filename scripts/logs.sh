#!/bin/bash
# Sentient Engine - Quick Log Viewer

cd "$(dirname "$0")/.."

SERVICE="${1:-}"

if [ -z "$SERVICE" ]; then
    echo "Available services:"
    docker-compose ps --services
    echo ""
    echo "Usage: $0 <service_name>"
    echo "Example: $0 sentient-api-1"
    exit 1
fi

# Follow logs for specified service
docker-compose logs -f --tail=100 "$SERVICE"