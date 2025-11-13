#!/bin/bash
# Fix Observability Stack Permissions
# Run with: sudo ./scripts/fix-observability-permissions.sh

set -e

echo "===== Fixing Observability Stack Issues ====="
echo ""

# Fix Grafana permissions (runs as user 472)
echo "[1/3] Fixing Grafana permissions..."
chown -R 472:472 /opt/sentient/volumes/grafana-data/
echo "✓ Grafana permissions fixed (472:472)"
echo ""

# Fix Prometheus permissions (runs as user nobody = 65534)
echo "[2/3] Fixing Prometheus permissions..."
chown -R 65534:65534 /opt/sentient/volumes/prometheus-data/
echo "✓ Prometheus permissions fixed (65534:65534)"
echo ""

# Fix Loki permissions (runs as user 10001)
echo "[3/3] Fixing Loki permissions..."
chown -R 10001:10001 /opt/sentient/volumes/loki-data/
echo "✓ Loki permissions fixed (10001:10001)"
echo ""

echo "===== Permissions Fixed Successfully ====="
echo ""
echo "Next steps:"
echo "1. Update /opt/sentient/config/loki/loki-config.yml to remove deprecated 'shared_store' field"
echo "2. Run: docker compose up -d grafana prometheus loki"
echo ""