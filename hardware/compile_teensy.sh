#!/usr/bin/env bash
#
# Compile Teensy 4.1 Firmware
# Usage: ./compile_teensy.sh <path_to_ino_file>
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Check if arduino-cli is installed
if ! command -v arduino-cli &> /dev/null; then
    echo -e "${RED}Error: arduino-cli not found${NC}"
    echo "Install with: brew install arduino-cli"
    exit 1
fi

# Check if input file provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <path_to_ino_file>"
    echo "Example: $0 'Controller Code Teensy/main_lighting_v2/main_lighting_v2.ino'"
    exit 1
fi

INO_FILE="$1"
INO_PATH="${PROJECT_ROOT}/hardware/${INO_FILE}"

# Check if file exists
if [ ! -f "${INO_PATH}" ]; then
    echo -e "${RED}Error: File not found: ${INO_PATH}${NC}"
    exit 1
fi

# Extract controller name from path
CONTROLLER_DIR=$(dirname "${INO_PATH}")
CONTROLLER_NAME=$(basename "${CONTROLLER_DIR}")
OUTPUT_DIR="${CONTROLLER_DIR}/build"

# Version bump logic
VERSION_FILE="$(dirname "${INO_PATH}")/version.h"
if [ -f "${VERSION_FILE}" ]; then
    # Read current version
    CURRENT_VERSION=$(grep '#define FIRMWARE_VERSION' "${VERSION_FILE}" | sed 's/.*"\(.*\)".*/\1/')
    
    # Parse version components (e.g., "2.0.1" -> 2 0 1)
    IFS='.' read -ra VERSION_PARTS <<< "${CURRENT_VERSION}"
    MAJOR="${VERSION_PARTS[0]}"
    MINOR="${VERSION_PARTS[1]}"
    PATCH="${VERSION_PARTS[2]}"
    
    # Increment patch version
    PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
    
    # Update version.h
    sed -i.bak "s/#define FIRMWARE_VERSION \".*\"/#define FIRMWARE_VERSION \"${NEW_VERSION}\"/" "${VERSION_FILE}"
    rm "${VERSION_FILE}.bak"
    
    echo -e "${YELLOW}Version bumped: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"
else
    echo -e "${YELLOW}Warning: version.h not found at ${VERSION_FILE}${NC}"
    NEW_VERSION="unknown"
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Compiling Teensy 4.1 Firmware${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Controller: ${CONTROLLER_NAME}"
echo "Version: ${NEW_VERSION}"
echo "Source: ${INO_FILE}"
echo "Output: ${OUTPUT_DIR}"
echo ""

# Create output directory
mkdir -p "${OUTPUT_DIR}"

# Initialize arduino-cli config if needed
if [ ! -f ~/Library/Arduino15/arduino-cli.yaml ]; then
    echo -e "${YELLOW}Initializing arduino-cli...${NC}"
    arduino-cli config init
fi

# Add Teensy board URL if not already added
if ! arduino-cli config dump | grep -q "https://www.pjrc.com/teensy/package_teensy_index.json"; then
    echo -e "${YELLOW}Adding Teensy board manager URL...${NC}"
    arduino-cli config add board_manager.additional_urls https://www.pjrc.com/teensy/package_teensy_index.json
fi

# Update board index
echo -e "${YELLOW}Updating board index...${NC}"
arduino-cli core update-index || echo -e "${YELLOW}Warning: Some indexes could not be updated (continuing anyway)${NC}"

# Install Teensy platform if not installed
if ! arduino-cli core list | grep -q "teensy:avr"; then
    echo -e "${YELLOW}Installing Teensy platform...${NC}"
    arduino-cli core install teensy:avr
fi

# Compile
echo -e "${YELLOW}Compiling...${NC}"
arduino-cli compile \
    --fqbn teensy:avr:teensy41:speed=600,opt=o2std,usb=serial,keys=en-us \
    --libraries "${PROJECT_ROOT}/hardware/Custom Libraries" \
    --output-dir "${OUTPUT_DIR}" \
    "${INO_PATH}"

# Check if compilation succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Compilation successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo "Output files:"
    ls -lh "${OUTPUT_DIR}"/*.hex 2>/dev/null || echo "No .hex file found"
    echo ""
    echo "To upload, use Teensy Loader or:"
    echo "  teensy_loader_cli --mcu=TEENSY41 -w ${OUTPUT_DIR}/${CONTROLLER_NAME}.ino.hex"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Compilation failed${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
