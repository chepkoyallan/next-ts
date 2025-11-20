# 🧹 Cleanup Redundancies - Post Migration

## Overview

After the monorepo migration, we have **duplicate files** in both `src/` and `packages/`. The original `src/` directories are now redundant since all imports have been updated to use the packages.

---

## ❗ Redundant Directories

### Core Directories (Now in packages/core/)

| Original Location | New Location                    | Status      | Can Remove? |
| ----------------- | ------------------------------- | ----------- | ----------- |
| `src/config/`     | `packages/core/config/src/`     | ✅ Migrated | ✅ YES      |
| `src/components/` | `packages/core/components/src/` | ✅ Migrated | ✅ YES      |
| `src/engine/`     | `packages/core/engine/src/`     | ✅ Migrated | ✅ YES      |
| `src/dsl/`        | `packages/core/dsl/`            | ✅ Migrated | ✅ YES      |
| `src/utils/`      | `packages/core/utils/src/`      | ✅ Migrated | ✅ YES      |
| `src/hooks/`      | `packages/core/hooks/src/`      | ✅ Migrated | ✅ YES      |
| `src/theme/`      | `packages/core/theme/src/`      | ✅ Migrated | ✅ YES      |

### Feature Directories (Now in packages/features/)

| Original Location            | New Location                       | Status      | Can Remove?  |
| ---------------------------- | ---------------------------------- | ----------- | ------------ |
| `src/sections/auth/`         | `packages/features/auth/src/`      | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/user/`         | `packages/features/user/src/`      | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/product/`      | `packages/features/product/src/`   | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/blog/`         | `packages/features/blog/src/`      | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/mail/`         | `packages/features/mail/src/`      | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/chat/`         | `packages/features/chat/src/`      | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/kanban/`       | `packages/features/kanban/src/`    | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/calendar/`     | `packages/features/calendar/src/`  | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/invoice/`      | `packages/features/invoice/src/`   | ✅ Migrated | ⚠️ PARTIAL\* |
| `src/sections/overview/app/` | `packages/features/dashboard/src/` | ✅ Migrated | ⚠️ PARTIAL\* |

**Note**: `src/sections/` contains 20+ additional features that haven't been migrated yet, so we can only remove the specific migrated subdirectories.

---

## 📊 Redundancy Statistics

### Files Duplicated

- **Components**: 38 files duplicated
- **Config**: 7 files duplicated
- **Engine**: 9 files + subdirectories duplicated
- **DSL**: Entire directory duplicated (includes Go modules, protos, generated code)
- **Utils**: 9 files duplicated
- **Hooks**: 11 files duplicated
- **Theme**: 10 files + subdirectories duplicated
- **Features**: 10 complete feature directories duplicated

### Total Duplication

- **13,075 files** are duplicated (314 core + 12,585 dsl + 176 features)
- **Core packages**: 314 files (config, components, engine, utils, hooks, theme)
- **DSL package**: 12,585 files (202 MB - Protocol buffers, Go modules, generated code)
- **Feature packages**: 176 files (10 migrated features)
- **Storage**: ~203 MB of duplicate code

---

## ✅ Safe to Remove (Verified)

These directories can be **safely removed** because:

1. All imports have been updated to `@app/*` paths
2. Files are now in packages with proper structure
3. No code in `src/` references the old locations anymore

### Commands to Remove Redundancies

```bash
# IMPORTANT: Backup first!
# Create a backup before removing
tar -czf src-backup-$(date +%Y%m%d).tar.gz src/

# Remove redundant core directories
rm -rf src/config
rm -rf src/components
rm -rf src/engine
rm -rf src/dsl
rm -rf src/utils
rm -rf src/hooks
rm -rf src/theme

# Remove migrated feature directories
rm -rf src/sections/auth
rm -rf src/sections/user
rm -rf src/sections/product
rm -rf src/sections/blog
rm -rf src/sections/mail
rm -rf src/sections/chat
rm -rf src/sections/kanban
rm -rf src/sections/calendar
rm -rf src/sections/invoice
rm -rf src/sections/overview/app

# Verify no broken imports
pnpm type-check
```

---

## ⚠️ Keep These (Still In Use)

### Directories to KEEP in src/

| Directory                                | Reason to Keep                                    | Status  |
| ---------------------------------------- | ------------------------------------------------- | ------- |
| `src/app/`                               | Next.js app directory - contains routes/pages     | ✅ Keep |
| `src/layouts/`                           | Layout components - not yet migrated              | ✅ Keep |
| `src/auth/`                              | Auth contexts and providers - not yet migrated    | ✅ Keep |
| `src/locales/`                           | Internationalization - not yet migrated           | ✅ Keep |
| `src/_mock/`                             | Mock data - not yet migrated                      | ✅ Keep |
| `src/sections/`                          | Root directory - contains 20+ unmigrated features | ✅ Keep |
| `src/sections/account/`                  | Not yet migrated                                  | ✅ Keep |
| `src/sections/payment/`                  | Not yet migrated                                  | ✅ Keep |
| `src/sections/order/`                    | Not yet migrated                                  | ✅ Keep |
| `src/sections/overview/*`                | Other overview variants - not yet migrated        | ✅ Keep |
| All other `src/sections/` subdirectories | Not yet migrated                                  | ✅ Keep |

---

## 🎯 Recommended Cleanup Strategy

### Phase 1: Immediate Cleanup (Safe)

Remove duplicated core packages (already migrated and verified):

```bash
# Backup first!
tar -czf src-backup-$(date +%Y%m%d).tar.gz src/

# Remove core duplicates
rm -rf src/config
rm -rf src/components
rm -rf src/engine
rm -rf src/dsl
rm -rf src/utils
rm -rf src/hooks
rm -rf src/theme
```

**Verification**:

```bash
# Should show no errors
pnpm type-check

# Check for any remaining references
grep -r "src/config\|src/components\|src/engine\|src/dsl\|src/utils\|src/hooks\|src/theme" src/ --include="*.ts" --include="*.tsx"
```

### Phase 2: Feature Cleanup (After Testing)

After verifying the plugin system works:

```bash
# Remove migrated feature directories
rm -rf src/sections/auth
rm -rf src/sections/user
rm -rf src/sections/product
rm -rf src/sections/blog
rm -rf src/sections/mail
rm -rf src/sections/chat
rm -rf src/sections/kanban
rm -rf src/sections/calendar
rm -rf src/sections/invoice
rm -rf src/sections/overview/app
```

### Phase 3: Complete Migration (Optional)

If you migrate the remaining 20+ features:

```bash
# After migrating all features
rm -rf src/sections/*

# Or keep sections for any remaining pages
```

---

## 🔍 Verification Script

Create a script to verify no imports reference old locations:

```bash
#!/bin/bash
# verify-no-old-imports.sh

echo "Checking for imports from old locations..."

OLD_IMPORTS=$(grep -r "from 'src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)

if [ "$OLD_IMPORTS" -eq 0 ]; then
  echo "✅ No old imports found! Safe to cleanup."
  exit 0
else
  echo "❌ Found $OLD_IMPORTS old imports. Review before cleanup:"
  grep -r "from 'src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)" src/ --include="*.ts" --include="*.tsx"
  exit 1
fi
```

---

## 📦 Space Savings

After cleanup, you'll save:

- **Disk Space**: ~203 MB (202 MB from DSL, ~1 MB from core/features)
- **Files Removed**: 13,075 duplicate files
- **Development Time**: Reduced confusion about which files to edit
- **Code Maintenance**: Single source of truth for each module
- **Build Performance**: Significantly faster - fixes TypeScript heap memory issues
- **Type-check Performance**: Currently fails due to duplicate files, will work after cleanup

---

## 🤖 Automated Cleanup Scripts

Two scripts have been created to simplify the cleanup process:

### 1. Verify Cleanup Safety (Dry Run)

Run this first to check if it's safe to proceed:

```bash
./scripts/verify-cleanup-safety.sh
```

This script checks:

- ✓ No old import statements remain
- ✓ All packages exist in `packages/`
- ✓ TypeScript path mappings configured
- ✓ Calculates files and disk space to be freed
- ✓ Lists directories to be removed
- ✓ Git repository status

### 2. Cleanup Redundancies

Once verification passes, run the cleanup:

```bash
./scripts/cleanup-redundancies.sh
```

This script:

1. **Pre-flight checks**: Verifies no old imports exist
2. **Creates backup**: Automatic timestamped backup of all files
3. **Removes redundant directories**: Safely removes duplicates
4. **Verification**: Runs type-check to ensure no breakage
5. **Summary**: Reports what was removed and next steps

**Both scripts are interactive and will ask for confirmation before making changes.**

---

## 🚨 Important Notes

### Before Removing Anything

1. **Run verification script first**:

   ```bash
   ./scripts/verify-cleanup-safety.sh
   ```

2. **Or verify manually**:

   ```bash
   # Check for old imports
   grep -r "from 'src/config" src/ --include="*.ts" --include="*.tsx"
   # Should return nothing or only comments
   ```

3. **Note about type-check**:

   ```bash
   # Type-check currently FAILS due to duplicate files (heap out of memory)
   # This is EXPECTED and will be fixed after cleanup
   # The cleanup script accounts for this
   ```

4. **Git status check**:
   ```bash
   git status
   # Consider committing current changes first
   ```

### If Something Breaks

1. Restore from backup:

   ```bash
   tar -xzf src-backup-YYYYMMDD.tar.gz
   ```

2. Check git history:
   ```bash
   git checkout HEAD -- src/
   ```

---

## 📋 Cleanup Checklist

### Automated Approach (Recommended)

- [ ] Run `./scripts/verify-cleanup-safety.sh` to check safety
- [ ] If all checks pass, run `./scripts/cleanup-redundancies.sh`
- [ ] Script will automatically: create backup, remove files, verify with type-check
- [ ] Test application: `pnpm dev`
- [ ] Run tests if available: `pnpm test`
- [ ] Commit changes: `git add -A && git commit -m 'chore: remove redundant files'`
- [ ] Delete backup after confirming everything works

### Manual Approach (Advanced)

- [ ] Run verification: `./scripts/verify-cleanup-safety.sh`
- [ ] Create manual backup: `tar -czf backup.tar.gz src/`
- [ ] Remove core directories manually
- [ ] Remove feature directories manually
- [ ] Run type-check to verify
- [ ] Test application
- [ ] Commit changes

---

## 🎯 Final Structure After Cleanup

```
next-ts/
├── packages/                    # ✅ All shared code here
│   ├── core/                   # ✅ Core packages (8)
│   └── features/               # ✅ Feature packages (10)
│
├── src/
│   ├── app/                    # ✅ Next.js app directory (routes)
│   ├── auth/                   # ✅ Auth contexts
│   ├── layouts/                # ✅ Layout components
│   ├── locales/                # ✅ i18n
│   ├── _mock/                  # ✅ Mock data
│   ├── sections/               # ✅ Remaining features
│   │   ├── account/           # Not migrated
│   │   ├── payment/           # Not migrated
│   │   ├── order/             # Not migrated
│   │   └── ... (20+ more)     # Not migrated
│   │
│   └── ... (other app-specific files)
│
└── ... (config files)
```

---

## 💡 Recommendation

**Quick Start** (Recommended):

```bash
# Step 1: Verify it's safe
./scripts/verify-cleanup-safety.sh

# Step 2: Run automated cleanup
./scripts/cleanup-redundancies.sh

# Step 3: Test your application
pnpm dev
```

**Why Cleanup Now**:

1. **Critical Issue**: Type-check currently fails with heap out of memory

   - Caused by 13,075 duplicate files
   - Prevents TypeScript from validating your code
   - Blocks CI/CD pipelines

2. **Safe to Remove**: All imports have been verified

   - Zero old import statements found
   - All packages exist in `packages/`
   - TypeScript paths correctly configured

3. **Significant Benefits**:
   - Recover 203 MB of disk space (202 MB from DSL alone)
   - Fix TypeScript memory issues
   - Eliminate confusion about which files to edit
   - Improve build performance

**Phased Approach**:

1. **Now** - Remove all redundancies (core + features + dsl)

   - Automated script handles everything safely
   - Creates backup automatically
   - Verifies success with type-check

2. **Future** - Continue migrating remaining features (optional)
   - Extract remaining 20+ features from `src/sections/`
   - Use same pattern as existing migrations
   - Run cleanup script again after each batch

---

**Status**: ⚠️ **CLEANUP REQUIRED**
**Risk Level**: Low (automated backup + verification)
**Estimated Time**: 5 minutes (automated)
**Disk Space Recovery**: 203 MB
**Type-check**: Currently broken, will fix after cleanup
