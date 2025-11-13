#!/bin/bash
# Restart Observability Stack
# Run with: ./scripts/restart-observability.sh (no sudo needed)

set -e

echo "===== Restarting Observability Stack ====="
echo ""

cd /opt/sentient

echo "[1/2] Starting Grafana, Prometheus, and Loki..."
docker compose up -d grafana prometheus loki

echo ""
echo "[2/2] Waiting 15 seconds for services to initialize..."
sleep 15

echo ""
echo "===== Service Status ====="
docker compose ps grafana prometheus loki promtail

echo ""
echo "===== Recent Logs ====="
echo ""
echo "--- Grafana ---"
docker compose logs --tail=5 grafana
echo ""
echo "--- Prometheus ---"
docker compose logs --tail=5 prometheus
echo ""
echo "--- Loki ---"
docker compose logs --tail=5 loki

echo ""
echo "===== Observability Stack Restart Complete ====="
echo ""
echo "Access points:"
echo "  - Grafana: https://sentientengine.ai/grafana"
echo "  - Prometheus: http://localhost:9090"
echo "  - Loki: http://localhost:3100"
echo ""