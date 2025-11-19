#!/usr/bin/env bash
################################################################################
# Production Deployment Script for Sentient Engine
################################################################################
#
# This script deploys Sentient Engine v1.2.0 to production
#
# Prerequisites:
# - .env.production file with secure credentials
# - MQTT broker running at mqtt.sentientengine.ai
# - Docker and Docker Compose installed
# - Network access to GitHub Container Registry
#
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check .env.production
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        log_error ".env.production file not found"
        log_info "Please create .env.production with secure credentials"
        exit 1
    fi
    
    # Check for placeholder passwords
    if grep -q "CHANGE_ME" "$PROJECT_ROOT/.env.production"; then
        log_error ".env.production contains placeholder passwords"
        log_info "Please update all CHANGE_ME values with secure credentials"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Backup database
backup_database() {
    log_info "Creating database backup..."
    
    if docker ps --format '{{.Names}}' | grep -q "sentient-postgres-prod"; then
        BACKUP_FILE="$PROJECT_ROOT/backups/sentient_prod_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p "$PROJECT_ROOT/backups"
        
        docker exec sentient-postgres-prod pg_dump -U sentient_prod sentient_prod > "$BACKUP_FILE" 2>/dev/null || {
            log_warning "Could not create backup (database might not exist yet)"
            return 0
        }
        
        log_success "Database backed up to: $BACKUP_FILE"
    else
        log_warning "PostgreSQL container not running, skipping backup"
    fi
}

# Pull latest images
pull_images() {
    log_info "Pulling latest Docker images from GHCR..."
    
    cd "$PROJECT_ROOT"
    
    # Source GHCR credentials from .env.production if not already set
    if [ -z "${GHCR_TOKEN:-}" ] && [ -f "$PROJECT_ROOT/.env.production" ]; then
        source <(grep -E '^GHCR_(TOKEN|USERNAME)=' "$PROJECT_ROOT/.env.production" | sed 's/^/export /')
    fi
    
    # Check if we need to login to GHCR (for private images)
    if [ -n "${GHCR_TOKEN:-}" ]; then
        log_info "Logging in to GitHub Container Registry..."
        echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USERNAME:-$USER}" --password-stdin > /dev/null 2>&1 || {
            log_warning "Failed to login to GHCR, attempting pull without auth..."
        }
    fi
    
    docker compose -f docker-compose.prod.yml --env-file .env.production pull
    
    log_success "Images pulled successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying production services..."
    
    cd "$PROJECT_ROOT"
    
    # Stop old containers
    log_info "Stopping old containers..."
    docker compose -f docker-compose.prod.yml --env-file .env.production down || true
    
    # Start new containers
    log_info "Starting new containers..."
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d
    
    log_success "Services deployed"
}

# Deploy with observability
deploy_with_observability() {
    log_info "Deploying production services with observability stack..."
    
    cd "$PROJECT_ROOT"
    
    # Stop old containers
    log_info "Stopping old containers..."
    docker compose -f docker-compose.prod.yml --env-file .env.production --profile observability down || true
    
    # Start new containers
    log_info "Starting new containers..."
    docker compose -f docker-compose.prod.yml --env-file .env.production --profile observability up -d
    
    log_success "Services deployed with observability"
}

# Wait for services
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose -f "$PROJECT_ROOT/docker-compose.prod.yml" --env-file "$PROJECT_ROOT/.env.production" ps | grep -q "healthy"; then
            log_success "Services are healthy"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    log_warning "Timeout waiting for services to be healthy"
}

# Show service status
show_status() {
    log_info "Service Status:"
    echo ""
    docker compose -f "$PROJECT_ROOT/docker-compose.prod.yml" --env-file "$PROJECT_ROOT/.env.production" ps
    echo ""
}

# Main deployment function
main() {
    echo ""
    log_info "=========================================="
    log_info "Sentient Engine Production Deployment"
    log_info "Version: 1.2.0"
    log_info "=========================================="
    echo ""
    
    # Parse arguments
    WITH_OBSERVABILITY=false
    SKIP_BACKUP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --with-observability)
                WITH_OBSERVABILITY=true
                shift
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --with-observability    Deploy with Prometheus, Grafana, and Loki"
                echo "  --skip-backup          Skip database backup"
                echo "  --help                 Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    
    if [ "$SKIP_BACKUP" = false ]; then
        backup_database
    fi
    
    pull_images
    
    if [ "$WITH_OBSERVABILITY" = true ]; then
        deploy_with_observability
    else
        deploy_services
    fi
    
    wait_for_services
    show_status
    
    echo ""
    log_success "=========================================="
    log_success "Deployment completed successfully!"
    log_success "=========================================="
    echo ""
    log_info "Access your services at:"
    log_info "  - API: http://localhost:3000"
    log_info "  - Web: http://localhost:3002"
    log_info "  - Executor: http://localhost:3004"
    log_info "  - Monitor: http://localhost:3003"
    
    if [ "$WITH_OBSERVABILITY" = true ]; then
        echo ""
        log_info "Observability services:"
        log_info "  - Grafana: http://localhost:3200"
        log_info "  - Prometheus: http://localhost:9090"
    fi
    
    echo ""
    log_info "To view logs: docker compose -f docker-compose.prod.yml --env-file .env.production logs -f"
    log_info "To stop services: docker compose -f docker-compose.prod.yml --env-file .env.production down"
    echo ""
}

main "$@"
