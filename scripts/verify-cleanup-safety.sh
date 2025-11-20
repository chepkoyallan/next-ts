#!/bin/bash

# Verify Cleanup Safety - Check before removing redundant files
# This script performs all safety checks WITHOUT removing any files

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Cleanup Safety Verification (Dry Run)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${BLUE}▸ $1${NC}"; }

SAFE_TO_CLEAN=true

# Check 1: Old imports
print_info "Check 1: Scanning for old import statements..."
OLD_IMPORTS=$(grep -r "from ['\"]src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)['\"]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
if [ -z "$OLD_IMPORTS" ]; then
    print_success "No old imports found"
else
    print_error "Found old import statements:"
    echo "$OLD_IMPORTS" | head -10
    SAFE_TO_CLEAN=false
fi

# Check 2: Verify packages exist
print_info "Check 2: Verifying packages exist..."
MISSING_PACKAGES=()

for pkg in types config components engine dsl utils hooks theme; do
    if [ ! -d "packages/core/$pkg" ]; then
        MISSING_PACKAGES+=("@app/$pkg")
    fi
done

if [ ${#MISSING_PACKAGES[@]} -eq 0 ]; then
    print_success "All core packages exist"
else
    print_error "Missing packages: ${MISSING_PACKAGES[*]}"
    SAFE_TO_CLEAN=false
fi

# Check 3: Verify feature packages exist
print_info "Check 3: Verifying feature packages..."
MISSING_FEATURES=()

for feature in auth user product blog mail chat kanban calendar invoice dashboard; do
    if [ ! -d "packages/features/$feature" ]; then
        MISSING_FEATURES+=("@app/$feature")
    fi
done

if [ ${#MISSING_FEATURES[@]} -eq 0 ]; then
    print_success "All feature packages exist"
else
    print_error "Missing features: ${MISSING_FEATURES[*]}"
    SAFE_TO_CLEAN=false
fi

# Check 4: Verify TypeScript paths
print_info "Check 4: Checking TypeScript path mappings..."
if grep -q '"@app/config"' tsconfig.json && \
   grep -q '"@app/components"' tsconfig.json && \
   grep -q '"@app/engine"' tsconfig.json && \
   grep -q '"@app/dsl"' tsconfig.json && \
   grep -q '"@app/utils"' tsconfig.json && \
   grep -q '"@app/hooks"' tsconfig.json && \
   grep -q '"@app/theme"' tsconfig.json; then
    print_success "TypeScript paths configured"
else
    print_error "TypeScript paths missing or incomplete"
    SAFE_TO_CLEAN=false
fi

# Check 5: Count files to be removed
print_info "Check 5: Analyzing redundant files..."
echo ""

CORE_FILES=$(find src/{config,components,engine,utils,hooks,theme} -type f 2>/dev/null | wc -l | tr -d ' ')
DSL_FILES=$(find src/dsl -type f 2>/dev/null | wc -l | tr -d ' ')
FEATURE_FILES=$(find src/sections/{auth,user,product,blog,mail,chat,kanban,calendar,invoice} src/sections/overview/app -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_FILES=$((CORE_FILES + DSL_FILES + FEATURE_FILES))

echo "  Files to be removed:"
echo "    Core packages:    $CORE_FILES files"
echo "    DSL package:      $DSL_FILES files"
echo "    Feature packages: $FEATURE_FILES files"
echo "    ────────────────────────────────"
echo "    Total:            $TOTAL_FILES files"
echo ""

# Check 6: Disk space
print_info "Check 6: Calculating disk space recovery..."
CORE_SIZE=$(du -sh src/{config,components,engine,utils,hooks,theme} 2>/dev/null | awk '{sum+=$1} END {print sum"K"}')
DSL_SIZE=$(du -sh src/dsl 2>/dev/null | awk '{print $1}')
FEATURE_SIZE=$(du -sh src/sections/{auth,user,product,blog,mail,chat,kanban,calendar,invoice} src/sections/overview/app 2>/dev/null | awk '{sum+=$1} END {print sum"K"}')

echo "  Disk space to be freed:"
echo "    Core packages:    ${CORE_SIZE}"
echo "    DSL package:      ${DSL_SIZE}"
echo "    Feature packages: ${FEATURE_SIZE}"
echo ""

# Check 7: Directories to remove
print_info "Check 7: Directories to be removed..."
echo ""
echo "  Core directories:"
for dir in config components engine dsl utils hooks theme; do
    if [ -d "src/$dir" ]; then
        echo "    ✓ src/$dir"
    else
        echo "    ✗ src/$dir (already removed)"
    fi
done

echo ""
echo "  Feature directories:"
for dir in auth user product blog mail chat kanban calendar invoice; do
    if [ -d "src/sections/$dir" ]; then
        echo "    ✓ src/sections/$dir"
    else
        echo "    ✗ src/sections/$dir (already removed)"
    fi
done

if [ -d "src/sections/overview/app" ]; then
    echo "    ✓ src/sections/overview/app"
else
    echo "    ✗ src/sections/overview/app (already removed)"
fi

# Check 8: Git status
echo ""
print_info "Check 8: Git repository status..."
if [ -d ".git" ]; then
    if git diff-index --quiet HEAD -- 2>/dev/null; then
        print_success "No uncommitted changes"
    else
        print_warning "You have uncommitted changes"
        echo "  Consider committing before cleanup"
    fi
else
    print_warning "Not a git repository"
fi

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [ "$SAFE_TO_CLEAN" = true ]; then
    print_success "SAFE TO PROCEED WITH CLEANUP"
    echo ""
    echo "  All checks passed. You can safely run:"
    echo "    ./scripts/cleanup-redundancies.sh"
else
    print_error "NOT SAFE TO CLEAN"
    echo ""
    echo "  Please fix the issues above before running cleanup."
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
