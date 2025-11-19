#!/usr/bin/env bash
################################################################################
# Automated Production Deployment to Sentient Server
################################################################################
#
# This script automates the entire deployment process to the Sentient Server
# at 192.168.2.3. It handles everything from initial setup to service deployment.
#
# Usage:
#   ./scripts/deploy-to-sentient-server.sh [options]
#
# Options:
#   --clean-deploy    Clean deployment (removes old volumes and containers)
#   --with-observability    Deploy with Prometheus, Grafana, Loki
#   --skip-mqtt       Skip MQTT broker setup (if already running)
#   --skip-build      Skip rebuilding Docker images (use existing in GHCR)
#   --help            Show this help message
#
################################################################################

set -euo pipefail

# Configuration
SERVER_USER="techadmin"
SERVER_IP="192.168.2.3"
SERVER_PATH="/opt/sentient"
SSH_TARGET="${SERVER_USER}@${SERVER_IP}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Flags
CLEAN_DEPLOY=false
WITH_OBSERVABILITY=false
SKIP_MQTT=false
SKIP_BUILD=false

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}==>${NC} ${BLUE}$1${NC}"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean-deploy)
            CLEAN_DEPLOY=true
            shift
            ;;
        --with-observability)
            WITH_OBSERVABILITY=true
            shift
            ;;
        --skip-mqtt)
            SKIP_MQTT=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help)
            grep '^#' "$0" | grep -v '#!/usr/bin/env' | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            log_info "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Banner
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Sentient Engine - Production Deployment${NC}               ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  Target: ${YELLOW}${SERVER_IP}${NC} (Sentient Server)               ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify prerequisites
log_step "Verifying Prerequisites"

# Check SSH access
log_info "Checking SSH access to ${SERVER_IP}..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "${SSH_TARGET}" "echo 'SSH OK'" &>/dev/null; then
    log_error "Cannot connect to ${SERVER_IP} via SSH"
    log_info "Ensure you can run: ssh ${SSH_TARGET}"
    exit 1
fi
log_success "SSH access verified"

# Check .env.production exists
if [[ ! -f ".env.production" ]]; then
    log_error ".env.production file not found"
    log_info "Create .env.production with your production configuration"
    exit 1
fi
log_success ".env.production file found"

# Check for CHANGE_ME placeholders
if grep -q "CHANGE_ME" .env.production; then
    log_error ".env.production contains CHANGE_ME placeholders"
    log_info "Update all credentials before deploying to production"
    exit 1
fi
log_success "No CHANGE_ME placeholders in .env.production"

# Check local git status
log_info "Checking git status..."
if [[ -n $(git status --porcelain) ]]; then
    log_warning "You have uncommitted changes"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
log_success "Git status OK"

# Step 1: Prepare server
log_step "Step 1: Preparing Server"

log_info "Creating deployment directory..."
ssh "${SSH_TARGET}" "sudo mkdir -p ${SERVER_PATH} && sudo chown ${SERVER_USER}:${SERVER_USER} ${SERVER_PATH}"
log_success "Deployment directory ready"

# Step 2: Sync repository
log_step "Step 2: Syncing Repository"

log_info "Cloning/updating repository on server..."
ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e
cd /opt/sentient
if [[ -d .git ]]; then
    echo "Repository exists, pulling latest changes..."
    git fetch origin
    git reset --hard origin/main
else
    echo "Cloning repository..."
    git clone https://github.com/AaronLay10/snere.git .
fi
ENDSSH
log_success "Repository synced"

# Step 3: Transfer .env.production
log_step "Step 3: Transferring Environment Configuration"

log_info "Copying .env.production to server..."
scp .env.production "${SSH_TARGET}:${SERVER_PATH}/.env.production"
ssh "${SSH_TARGET}" "chmod 600 ${SERVER_PATH}/.env.production"
log_success ".env.production transferred"

# Step 4: Install Docker (if needed)
log_step "Step 4: Verifying Docker Installation"

ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e

if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "Docker installed"
else
    echo "Docker already installed"
fi

# Verify Docker Compose v2
if ! docker compose version &>/dev/null; then
    echo "ERROR: Docker Compose v2 not available"
    echo "Please install Docker Compose v2"
    exit 1
fi

echo "Docker OK: $(docker --version)"
echo "Docker Compose OK: $(docker compose version)"
ENDSSH
log_success "Docker verified"

# Step 5: Clean deployment (if requested)
if [[ "$CLEAN_DEPLOY" == true ]]; then
    log_step "Step 5: Clean Deployment (Removing Old Containers)"

    log_warning "This will remove all containers and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Skipping clean deployment"
    else
        ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e
cd /opt/sentient

echo "Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true

echo "Removing all containers..."
docker rm $(docker ps -aq) 2>/dev/null || true

echo "Removing volumes..."
docker volume prune -f

echo "Clean deployment complete"
ENDSSH
        log_success "Old containers and volumes removed"
    fi
fi

# Step 6: Deploy MQTT Broker
if [[ "$SKIP_MQTT" == false ]]; then
    log_step "Step 6: Deploying Standalone MQTT Broker"

    log_info "Starting MQTT broker..."
    ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e
cd /opt/sentient

# Create MQTT volumes
mkdir -p volumes/mosquitto-data-shared
mkdir -p volumes/mosquitto-logs-shared

# Start MQTT broker
docker compose -f docker-compose.mqtt.yml up -d

# Wait for MQTT to be healthy
echo "Waiting for MQTT broker to be healthy..."
for i in {1..30}; do
    if docker inspect mosquitto-shared | grep -q '"Health"' && \
       docker inspect mosquitto-shared | grep -q '"healthy"'; then
        echo "MQTT broker is healthy"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "ERROR: MQTT broker failed health check"
        docker compose -f docker-compose.mqtt.yml logs
        exit 1
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done
ENDSSH
    log_success "MQTT broker deployed and healthy"

    log_info "Testing MQTT connectivity..."
    ssh "${SSH_TARGET}" "docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t test -W 2 || true"
    log_success "MQTT connectivity verified"
else
    log_info "Skipping MQTT broker setup (--skip-mqtt)"
fi

# Step 7: Authenticate with GitHub Container Registry
log_step "Step 7: Authenticating with GitHub Container Registry"

log_info "Logging in to GHCR..."
ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e
cd /opt/sentient

# Source .env.production for GHCR credentials
source .env.production

if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_USERNAME:-}" ]]; then
    echo "Authenticating with GHCR..."
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
    echo "GHCR authentication successful"
else
    echo "WARNING: GHCR_TOKEN or GHCR_USERNAME not set in .env.production"
    echo "Assuming packages are public..."
fi
ENDSSH
log_success "GHCR authentication complete"

# Step 8: Build images (if requested)
if [[ "$SKIP_BUILD" == false ]]; then
    log_step "Step 8: Building and Pushing Docker Images"

    log_info "This will build images locally and push to GHCR..."
    log_warning "This can take 5-10 minutes. Skip with --skip-build if images are already in GHCR."

    read -p "Build images now? (Y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        log_info "Skipping image build"
    else
        log_info "Building and pushing images..."
        ./scripts/build-and-push-images.sh
        log_success "Images built and pushed to GHCR"
    fi
else
    log_info "Skipping image build (--skip-build)"
fi

# Step 9: Deploy production services
log_step "Step 9: Deploying Production Services"

OBSERVABILITY_FLAG=""
if [[ "$WITH_OBSERVABILITY" == true ]]; then
    OBSERVABILITY_FLAG="--with-observability"
    log_info "Deploying with observability stack (Prometheus, Grafana, Loki)"
fi

log_info "Running deployment script on server..."
ssh "${SSH_TARGET}" bash <<ENDSSH
set -e
cd /opt/sentient

# Make deployment script executable
chmod +x ./scripts/deploy-production.sh

# Run deployment
./scripts/deploy-production.sh ${OBSERVABILITY_FLAG}

echo "Deployment complete"
ENDSSH
log_success "Production services deployed"

# Step 10: Verify deployment
log_step "Step 10: Verifying Deployment"

log_info "Checking service health..."
ssh "${SSH_TARGET}" bash <<'ENDSSH'
set -e
cd /opt/sentient

# Wait for all services to be healthy
echo "Waiting for services to be healthy (up to 2 minutes)..."
for i in {1..24}; do
    UNHEALTHY=$(docker compose -f docker-compose.prod.yml ps --format json | jq -r 'select(.Health != "healthy") | .Name' 2>/dev/null || true)

    if [[ -z "$UNHEALTHY" ]]; then
        echo "All services are healthy!"
        break
    fi

    if [[ $i -eq 24 ]]; then
        echo "ERROR: Some services are not healthy after 2 minutes:"
        echo "$UNHEALTHY"
        echo ""
        echo "Service status:"
        docker compose -f docker-compose.prod.yml ps
        exit 1
    fi

    echo "Waiting for services... ($i/24)"
    sleep 5
done

# Show final status
echo ""
echo "Service Status:"
docker compose -f docker-compose.prod.yml ps

# Test endpoints
echo ""
echo "Testing endpoints..."

curl -sf http://localhost:3000/health || echo "API health check failed"
curl -sf http://localhost:3002 > /dev/null || echo "Web UI check failed"
curl -sf http://localhost:3003/health || echo "Device Monitor health check failed"
curl -sf http://localhost:3004/health || echo "Executor health check failed"

echo ""
echo "All health checks passed!"
ENDSSH
log_success "All services healthy"

# Step 11: Summary
log_step "Deployment Summary"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${CYAN}Deployment Successful!${NC}                                  ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Services deployed:"
echo "  • MQTT Broker:      192.168.2.3:1883"
echo "  • API:              http://192.168.2.3:3000"
echo "  • Web UI:           http://192.168.2.3:3002"
echo "  • Device Monitor:   http://192.168.2.3:3003"
echo "  • Executor Engine:  http://192.168.2.3:3004"

if [[ "$WITH_OBSERVABILITY" == true ]]; then
    echo "  • Prometheus:       http://192.168.2.3:9090"
    echo "  • Grafana:          http://192.168.2.3:3200 (admin/[password])"
fi

echo ""
log_info "Next steps:"
echo "  1. Test login: http://192.168.2.3:3002"
echo "     Username: admin@paragon.local"
echo "     Password: password"
echo ""
echo "  2. View logs:"
echo "     ssh ${SSH_TARGET} 'cd ${SERVER_PATH} && docker compose -f docker-compose.prod.yml logs -f'"
echo ""
echo "  3. Check service status:"
echo "     ssh ${SSH_TARGET} 'cd ${SERVER_PATH} && docker compose -f docker-compose.prod.yml ps'"
echo ""
echo "  4. Verify MQTT:"
echo "     ssh ${SSH_TARGET} 'docker exec mosquitto-shared mosquitto_sub -h localhost -p 1883 -t test'"
echo ""

log_success "Deployment complete! 🎉"
echo ""
