#!/bin/bash
# Sentient Engine - Production Setup Script
# This script initializes the Docker environment for production deployment

set -e

echo "=========================================="
echo "Sentient Engine - Production Setup"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root or with sudo"
   exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to script directory
cd "$(dirname "$0")/.."

echo "Step 1: Checking prerequisites..."
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker is installed${NC}"
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Installing...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose is installed${NC}"
fi

echo ""
echo "Step 2: Setting up directory structure..."
echo ""

# Create necessary directories
mkdir -p volumes/{postgres-data,mosquitto-data,prometheus-data,grafana-data,loki-data,nginx-logs}
mkdir -p backups
mkdir -p config/nginx/ssl

echo -e "${GREEN}Directories created${NC}"

echo ""
echo "Step 3: Checking environment file..."
echo ""

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${YELLOW}Warning: .env.production not found${NC}"
    echo "Please create .env.production with your production credentials"
    echo "See .env.development for reference"
    exit 1
else
    echo -e "${GREEN}.env.production exists${NC}"
fi

echo ""
echo "Step 4: Setting up MQTT passwords..."
echo ""

# Source environment variables
source .env.production

# Create MQTT password file
if [ ! -f config/mosquitto/mosquitto_passwd ]; then
    echo "Creating MQTT password file..."
    docker run --rm -v $(pwd)/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
        mosquitto_passwd -c -b /mosquitto/config/mosquitto_passwd admin "${MQTT_PASSWORD}"

    docker run --rm -v $(pwd)/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
        mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_api "${MQTT_PASSWORD}"

    docker run --rm -v $(pwd)/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
        mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_executor "${MQTT_PASSWORD}"

    docker run --rm -v $(pwd)/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
        mosquitto_passwd -b /mosquitto/config/mosquitto_passwd sentient_monitor "${MQTT_PASSWORD}"

    docker run --rm -v $(pwd)/config/mosquitto:/mosquitto/config eclipse-mosquitto:2 \
        mosquitto_passwd -b /mosquitto/config/mosquitto_passwd paragon_devices "${MQTT_PASSWORD}"

    chmod 600 config/mosquitto/mosquitto_passwd
    echo -e "${GREEN}MQTT passwords configured${NC}"
else
    echo -e "${YELLOW}MQTT password file already exists (skipping)${NC}"
fi

echo ""
echo "Step 5: Checking SSL certificates..."
echo ""

if [ ! -f config/nginx/ssl/fullchain.pem ] || [ ! -f config/nginx/ssl/privkey.pem ]; then
    echo -e "${YELLOW}Warning: SSL certificates not found${NC}"
    echo "You need to set up SSL certificates for production"
    echo ""
    echo "Option 1: Use Let's Encrypt (recommended for production)"
    echo "  See config/nginx/ssl/README.md for instructions"
    echo ""
    echo "Option 2: Use self-signed certificate for testing"
    read -p "Generate self-signed certificate for testing? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout config/nginx/ssl/privkey.pem \
            -out config/nginx/ssl/fullchain.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        echo -e "${GREEN}Self-signed certificate generated${NC}"
    fi
else
    echo -e "${GREEN}SSL certificates found${NC}"
fi

echo ""
echo "Step 6: Setting permissions..."
echo ""

# Set proper ownership for volume directories
chown -R 1001:1001 volumes/postgres-data 2>/dev/null || true
chown -R 1883:1883 volumes/mosquitto-data 2>/dev/null || true
chown -R nobody:nobody volumes/prometheus-data 2>/dev/null || true
chown -R 472:472 volumes/grafana-data 2>/dev/null || true

echo -e "${GREEN}Permissions set${NC}"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Review and update .env.production with your credentials"
echo "2. Set up SSL certificates (see config/nginx/ssl/README.md)"
echo "3. Copy your database schema to config/postgres/init/"
echo "4. Start services: ./scripts/start-production.sh"
echo ""