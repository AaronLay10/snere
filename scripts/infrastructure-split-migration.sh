#!/bin/bash
################################################################################
# Sentient Engine - Infrastructure Separation Migration Script
# Date: 2025-11-13
# Purpose: Split shared postgres/mosquitto into separate prod/dev instances
################################################################################

set -e  # Exit on any error

echo "🚨 SENTIENT INFRASTRUCTURE SEPARATION MIGRATION"
echo "==============================================="
echo ""
echo "This script will:"
echo "  1. Stop all services (PRODUCTION DOWNTIME BEGINS)"
echo "  2. Backup current production data"
echo "  3. Rename config/volumes to -prod suffix"
echo "  4. Create new dev config/volumes"
echo "  5. Update docker-compose.yml"
echo "  6. Start separated infrastructure"
echo ""
echo "⏱️  Estimated time: 1-2 hours"
echo "⚠️  Production will be DOWN during this process"
echo ""

read -p "Are you ready to proceed? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 1
fi

BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/opt/sentient/backups/infrastructure-split-$BACKUP_DATE"

echo ""
echo "📦 Step 1/7: Creating backup directory..."
mkdir -p "$BACKUP_DIR"

echo ""
echo "💾 Step 2/7: Backing up current production data..."
echo "  - Backing up docker-compose.yml..."
cp /opt/sentient/docker-compose.yml "$BACKUP_DIR/docker-compose.yml.backup"

echo "  - Backing up .env file..."
cp /opt/sentient/.env "$BACKUP_DIR/.env.backup"

echo "  - Backing up postgres data..."
sudo tar czf "$BACKUP_DIR/postgres-data.tar.gz" -C /opt/sentient/volumes postgres-data

echo "  - Backing up mosquitto data..."
sudo tar czf "$BACKUP_DIR/mosquitto-data.tar.gz" -C /opt/sentient/volumes mosquitto-data

echo "  - Backing up configs..."
sudo tar czf "$BACKUP_DIR/configs.tar.gz" -C /opt/sentient/config postgres mosquitto

echo "✅ Backup complete: $BACKUP_DIR"

echo ""
echo "🛑 Step 3/7: Stopping all services..."
cd /opt/sentient
docker compose down
echo "✅ All services stopped"

echo ""
echo "📁 Step 4/7: Renaming existing infrastructure to -prod..."

# Rename config directories
if [ -d "/opt/sentient/config/postgres" ]; then
    echo "  - Renaming config/postgres to config/postgres-prod..."
    sudo mv /opt/sentient/config/postgres /opt/sentient/config/postgres-prod
fi

if [ -d "/opt/sentient/config/mosquitto" ]; then
    echo "  - Renaming config/mosquitto to config/mosquitto-prod..."
    sudo mv /opt/sentient/config/mosquitto /opt/sentient/config/mosquitto-prod
fi

# Rename volume directories
if [ -d "/opt/sentient/volumes/postgres-data" ]; then
    echo "  - Renaming volumes/postgres-data to volumes/postgres-data-prod..."
    sudo mv /opt/sentient/volumes/postgres-data /opt/sentient/volumes/postgres-data-prod
fi

if [ -d "/opt/sentient/volumes/mosquitto-data" ]; then
    echo "  - Renaming volumes/mosquitto-data to volumes/mosquitto-data-prod..."
    sudo mv /opt/sentient/volumes/mosquitto-data /opt/sentient/volumes/mosquitto-data-prod
fi

echo "✅ Production infrastructure renamed"

echo ""
echo "🆕 Step 5/7: Creating development infrastructure..."

# Copy production configs for development
echo "  - Creating config/postgres-dev (copy of prod)..."
sudo cp -r /opt/sentient/config/postgres-prod /opt/sentient/config/postgres-dev

echo "  - Creating config/mosquitto-dev (copy of prod)..."
sudo cp -r /opt/sentient/config/mosquitto-prod /opt/sentient/config/mosquitto-dev

# Create empty dev volumes (will be initialized on first start)
echo "  - Creating volumes/postgres-data-dev (empty)..."
sudo mkdir -p /opt/sentient/volumes/postgres-data-dev
sudo chown -R 999:999 /opt/sentient/volumes/postgres-data-dev  # postgres UID

echo "  - Creating volumes/mosquitto-data-dev (empty)..."
sudo mkdir -p /opt/sentient/volumes/mosquitto-data-dev
sudo chown -R 1883:1883 /opt/sentient/volumes/mosquitto-data-dev  # mosquitto UID

echo "✅ Development infrastructure created"

echo ""
echo "⚠️  Step 6/7: Updating docker-compose.yml..."
echo "  This requires manual editing. Pausing for your review."
echo ""
echo "  Changes needed:"
echo "    1. Split postgres service into postgres-prod and postgres-dev"
echo "    2. Split mosquitto service into mosquitto-prod and mosquitto-dev"
echo "    3. Update all service environment variables to point to correct brokers"
echo "    4. Add profiles to new infrastructure services"
echo ""
echo "  Press ENTER when you've completed the docker-compose.yml changes..."
read

echo ""
echo "🚀 Step 7/7: Starting production services (dev will remain stopped)..."
docker compose --profile prod up -d

echo ""
echo "⏳ Waiting 30 seconds for services to stabilize..."
sleep 30

echo ""
echo "🏥 Health check..."
docker compose --profile prod ps

echo ""
echo "✅ MIGRATION COMPLETE!"
echo ""
echo "Next steps:"
echo "  1. Verify production is working: curl https://sentientengine.ai/health"
echo "  2. Check logs: docker compose --profile prod logs -f"
echo "  3. When ready, test dev: docker compose --profile dev up -d"
echo ""
echo "Backup location: $BACKUP_DIR"
echo ""
echo "To rollback if needed:"
echo "  docker compose down"
echo "  sudo mv /opt/sentient/config/postgres-prod /opt/sentient/config/postgres"
echo "  sudo mv /opt/sentient/config/mosquitto-prod /opt/sentient/config/mosquitto"
echo "  sudo mv /opt/sentient/volumes/postgres-data-prod /opt/sentient/volumes/postgres-data"
echo "  sudo mv /opt/sentient/volumes/mosquitto-data-prod /opt/sentient/volumes/mosquitto-data"
echo "  cp $BACKUP_DIR/docker-compose.yml.backup /opt/sentient/docker-compose.yml"
echo "  docker compose --profile prod up -d"
