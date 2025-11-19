#!/usr/bin/env bash
################################################################################
# Manual Docker Image Build and Push Script
################################################################################
#
# This script manually builds and pushes Docker images to GHCR
# Use this if GitHub Actions is not working or for local testing
#
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

REGISTRY="ghcr.io"
REPO="aaronlay10/snere"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if logged in to GHCR
check_login() {
    log_info "Checking GHCR authentication..."
    if ! docker info 2>/dev/null | grep -q "ghcr.io"; then
        log_error "Not logged in to GHCR"
        log_info "Please run: echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
        exit 1
    fi
    log_success "GHCR authentication OK"
}

# Build and push a service
build_and_push() {
    local service_name=$1
    local context=$2
    local dockerfile=$3
    local image_name="${REGISTRY}/${REPO}-${service_name}:latest"
    
    log_info "Building ${service_name}..."
    
    docker build \
        -t "${image_name}" \
        -f "${context}/${dockerfile}" \
        "${context}" || {
        log_error "Failed to build ${service_name}"
        return 1
    }
    
    log_info "Pushing ${image_name}..."
    docker push "${image_name}" || {
        log_error "Failed to push ${service_name}"
        return 1
    }
    
    log_success "${service_name} built and pushed"
}

main() {
    echo ""
    log_info "=========================================="
    log_info "Manual Docker Image Build & Push"
    log_info "=========================================="
    echo ""
    
    check_login
    
    # Build and push all services
    build_and_push "api" "./services/api" "Dockerfile"
    build_and_push "executor-engine" "./services/executor-engine" "Dockerfile"
    build_and_push "device-monitor" "./services/device-monitor" "Dockerfile"
    build_and_push "web" "./services/sentient-web" "Dockerfile.production"
    
    echo ""
    log_success "=========================================="
    log_success "All images built and pushed successfully!"
    log_success "=========================================="
    echo ""
    log_info "Images available:"
    log_info "  - ${REGISTRY}/${REPO}-api:latest"
    log_info "  - ${REGISTRY}/${REPO}-executor-engine:latest"
    log_info "  - ${REGISTRY}/${REPO}-device-monitor:latest"
    log_info "  - ${REGISTRY}/${REPO}-web:latest"
    echo ""
}

main "$@"
