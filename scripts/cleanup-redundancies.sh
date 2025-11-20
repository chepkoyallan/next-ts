#!/bin/bash

# Cleanup Redundant Files After Monorepo Migration
# This script removes duplicate files that have been migrated to packages/

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Monorepo Cleanup: Remove Redundant Files${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}▸ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

print_success "Running from project root"

# Phase 1: Pre-flight checks
print_header "Phase 1: Pre-flight Checks"

# Check for uncommitted changes
if [ -d ".git" ]; then
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        print_warning "You have uncommitted changes. Consider committing first."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "No uncommitted changes"
    fi
fi

# Check for old imports
print_header "Checking for old import statements..."
OLD_IMPORTS=$(grep -r "from ['\"]src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)['\"]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
OLD_IMPORTS=$(echo "$OLD_IMPORTS" | tr -d ' ')

if [ "$OLD_IMPORTS" -gt 0 ]; then
    print_error "Found $OLD_IMPORTS old import statements!"
    echo "Please update these imports to use @app/* paths before cleanup:"
    grep -r "from ['\"]src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)['\"]" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
    exit 1
else
    print_success "No old imports found - safe to proceed"
fi

# Phase 2: Create backup
print_header "Phase 2: Creating Backup"

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="src-backup-${BACKUP_DATE}.tar.gz"

echo "Creating backup: $BACKUP_FILE"
tar -czf "$BACKUP_FILE" \
    src/config \
    src/components \
    src/engine \
    src/dsl \
    src/utils \
    src/hooks \
    src/theme \
    src/sections/auth \
    src/sections/user \
    src/sections/product \
    src/sections/blog \
    src/sections/mail \
    src/sections/chat \
    src/sections/kanban \
    src/sections/calendar \
    src/sections/invoice \
    src/sections/overview/app 2>/dev/null

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    print_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
else
    print_error "Failed to create backup!"
    exit 1
fi

# Phase 3: Calculate redundancy
print_header "Phase 3: Redundancy Analysis"

echo "Analyzing duplicate files..."
CORE_FILES=$(find src/config src/components src/engine src/utils src/hooks src/theme -type f 2>/dev/null | wc -l | tr -d ' ')
DSL_FILES=$(find src/dsl -type f 2>/dev/null | wc -l | tr -d ' ')
FEATURE_FILES=$(find src/sections/auth src/sections/user src/sections/product src/sections/blog src/sections/mail src/sections/chat src/sections/kanban src/sections/calendar src/sections/invoice src/sections/overview/app -type f 2>/dev/null | wc -l | tr -d ' ')
TOTAL_FILES=$((CORE_FILES + DSL_FILES + FEATURE_FILES))

CORE_SIZE=$(du -sh src/{config,components,engine,utils,hooks,theme} 2>/dev/null | awk '{sum+=$1} END {print sum}')
DSL_SIZE=$(du -sh src/dsl 2>/dev/null | awk '{print $1}')
FEATURE_SIZE=$(du -sh src/sections/{auth,user,product,blog,mail,chat,kanban,calendar,invoice} src/sections/overview/app 2>/dev/null | awk '{sum+=$1} END {print sum}')

echo ""
echo "  Core packages:    $CORE_FILES files"
echo "  DSL package:      $DSL_FILES files (${DSL_SIZE})"
echo "  Feature packages: $FEATURE_FILES files"
echo "  ────────────────────────────────"
echo "  Total:            $TOTAL_FILES files"
echo ""

print_warning "These files will be permanently deleted!"

# Phase 4: Confirmation
print_header "Phase 4: Confirmation"

echo ""
echo "Ready to remove:"
echo "  • src/config/"
echo "  • src/components/"
echo "  • src/engine/"
echo "  • src/dsl/ (${DSL_SIZE})"
echo "  • src/utils/"
echo "  • src/hooks/"
echo "  • src/theme/"
echo "  • src/sections/auth/"
echo "  • src/sections/user/"
echo "  • src/sections/product/"
echo "  • src/sections/blog/"
echo "  • src/sections/mail/"
echo "  • src/sections/chat/"
echo "  • src/sections/kanban/"
echo "  • src/sections/calendar/"
echo "  • src/sections/invoice/"
echo "  • src/sections/overview/app/"
echo ""
echo "Backup saved to: $BACKUP_FILE"
echo ""

read -p "Are you sure you want to continue? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    print_warning "Cleanup cancelled"
    exit 0
fi

# Phase 5: Remove redundant directories
print_header "Phase 5: Removing Redundant Files"

remove_dir() {
    local dir=$1
    if [ -d "$dir" ]; then
        rm -rf "$dir"
        print_success "Removed: $dir"
    else
        print_warning "Not found: $dir"
    fi
}

echo ""
echo "Removing core packages..."
remove_dir "src/config"
remove_dir "src/components"
remove_dir "src/engine"
remove_dir "src/dsl"
remove_dir "src/utils"
remove_dir "src/hooks"
remove_dir "src/theme"

echo ""
echo "Removing migrated features..."
remove_dir "src/sections/auth"
remove_dir "src/sections/user"
remove_dir "src/sections/product"
remove_dir "src/sections/blog"
remove_dir "src/sections/mail"
remove_dir "src/sections/chat"
remove_dir "src/sections/kanban"
remove_dir "src/sections/calendar"
remove_dir "src/sections/invoice"
remove_dir "src/sections/overview/app"

# Phase 6: Verification
print_header "Phase 6: Verification"

echo ""
echo "Verifying cleanup..."

# Check if directories are gone
REMAINING_DIRS=$(ls -d src/{config,components,engine,dsl,utils,hooks,theme} 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMAINING_DIRS" -eq 0 ]; then
    print_success "All core directories removed"
else
    print_warning "Some directories still exist"
fi

# Check TypeScript compilation
echo ""
echo "Running TypeScript type-check..."
if pnpm type-check > /tmp/type-check.log 2>&1; then
    print_success "Type-check passed!"
else
    print_error "Type-check failed!"
    echo "See /tmp/type-check.log for details"
    echo ""
    print_warning "You can restore from backup:"
    echo "  tar -xzf $BACKUP_FILE"
    exit 1
fi

# Phase 7: Summary
print_header "Phase 7: Cleanup Summary"

echo ""
print_success "Cleanup completed successfully!"
echo ""
echo "  • Removed $TOTAL_FILES duplicate files"
echo "  • Backup saved: $BACKUP_FILE"
echo "  • Type-check: PASSED"
echo ""
echo "Next steps:"
echo "  1. Test your application: pnpm dev"
echo "  2. Run tests if you have any: pnpm test"
echo "  3. If everything works, you can delete the backup"
echo "  4. Commit the changes: git add -A && git commit -m 'chore: remove redundant files after monorepo migration'"
echo ""
print_success "Done!"
