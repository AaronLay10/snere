#!/bin/bash
# Sentient Engine - Health Check Script

cd "$(dirname "$0")/.."

echo "=========================================="
echo "Sentient Engine - Health Check"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running"
    exit 1
fi

echo "Container Status:"
echo "-------------------"
docker-compose ps

echo ""
echo "Service Health:"
echo "-------------------"

# Check each service
services=("sentient-api-1" "sentient-api-2" "scene-executor" "device-monitor" "sentient-web" "postgres" "mosquitto" "nginx")

for service in "${services[@]}"; do
    status=$(docker-compose ps -q $service | xargs docker inspect -f '{{.State.Health.Status}}' 2>/dev/null || echo "no health check")
    if [ "$status" == "healthy" ]; then
        echo "✓ $service: healthy"
    elif [ "$status" == "no health check" ]; then
        running=$(docker-compose ps -q $service | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null || echo "false")
        if [ "$running" == "true" ]; then
            echo "○ $service: running (no health check)"
        else
            echo "✗ $service: not running"
        fi
    else
        echo "✗ $service: $status"
    fi
done

echo ""
echo "Disk Usage:"
echo "-------------------"
df -h /opt/sentient/volumes

echo ""
echo "Docker Volume Usage:"
echo "-------------------"
docker system df -v | grep sentient || true

echo ""
echo "Recent Errors (last 10 lines):"
echo "-------------------"
docker-compose logs --tail=10 | grep -i error || echo "No recent errors found"

echo ""
echo "Health check complete!"