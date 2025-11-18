#!/bin/bash

# Compile all v2 controllers
# Shows progress and summary at the end

set +e  # Don't exit on errors, we want to continue through all controllers

echo "========================================"
echo "Compiling All V2 Controllers"
echo "========================================"
echo ""

SUCCESS_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0
SUCCESS_LIST=()
FAILED_LIST=()

# Find all v2 controller directories
for controller_dir in "Controller Code Teensy"/*_v2; do
  if [ ! -d "$controller_dir" ]; then
    continue
  fi
  
  controller_name=$(basename "$controller_dir")
  ino_file="$controller_dir/${controller_name}.ino"
  
  # Skip if .ino file doesn't exist
  if [ ! -f "$ino_file" ]; then
    echo "⊘ SKIP: $controller_name (no .ino file)"
    ((SKIPPED_COUNT++))
    continue
  fi
  
  echo "=== Compiling $controller_name ==="
  
  if ./compile_teensy.sh "$ino_file" 2>&1 | grep -q "Built:"; then
    echo "✓ SUCCESS: $controller_name"
    ((SUCCESS_COUNT++))
    SUCCESS_LIST+=("$controller_name")
  else
    echo "✗ FAILED: $controller_name"
    ((FAILED_COUNT++))
    FAILED_LIST+=("$controller_name")
  fi
  
  echo ""
done

echo "========================================"
echo "Compilation Summary"
echo "========================================"
echo "✓ Successful: $SUCCESS_COUNT"
echo "✗ Failed: $FAILED_COUNT"
echo "⊘ Skipped: $SKIPPED_COUNT"
echo ""

if [ ${#SUCCESS_LIST[@]} -gt 0 ]; then
  echo "Successfully compiled:"
  for controller in "${SUCCESS_LIST[@]}"; do
    echo "  ✓ $controller"
  done
  echo ""
fi

if [ ${#FAILED_LIST[@]} -gt 0 ]; then
  echo "Failed to compile:"
  for controller in "${FAILED_LIST[@]}"; do
    echo "  ✗ $controller"
  done
  echo ""
fi

echo "========================================"

# Exit with error code if any failed
if [ $FAILED_COUNT -gt 0 ]; then
  exit 1
else
  exit 0
fi
