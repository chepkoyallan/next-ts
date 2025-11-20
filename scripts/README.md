# Scripts Directory

This directory contains automation scripts for managing the monorepo migration and cleanup.

## Available Scripts

### 1. `verify-cleanup-safety.sh` ✨ Start Here

**Purpose**: Dry-run verification before cleanup (no changes made)

**Usage**:

```bash
./scripts/verify-cleanup-safety.sh
```

**What it does**:

- ✓ Checks for old import statements
- ✓ Verifies all packages exist
- ✓ Confirms TypeScript path mappings
- ✓ Calculates files and disk space to be freed
- ✓ Lists directories to be removed
- ✓ Checks git repository status
- ✓ Determines if cleanup is safe to proceed

**Output**:

- Green checkmarks ✓ = passed
- Red X ✗ = failed
- Final verdict: "SAFE TO PROCEED" or "NOT SAFE"

**Safe to run**: Yes, makes no changes

---

### 2. `cleanup-redundancies.sh` 🧹 Main Cleanup

**Purpose**: Remove duplicate files after monorepo migration

**Usage**:

```bash
./scripts/cleanup-redundancies.sh
```

**What it does**:

1. **Pre-flight checks**: Verifies no old imports exist
2. **Creates backup**: Automatic timestamped backup (src-backup-YYYYMMDD_HHMMSS.tar.gz)
3. **Removes duplicates**: Safely removes 13,075 duplicate files (203 MB)
4. **Verification**: Runs type-check to ensure no breakage
5. **Summary**: Reports what was removed and next steps

**Interactive**: Yes, asks for confirmation before deletion

**Removes**:

- `src/config/` (now in `packages/core/config/`)
- `src/components/` (now in `packages/core/components/`)
- `src/engine/` (now in `packages/core/engine/`)
- `src/dsl/` (now in `packages/core/dsl/`)
- `src/utils/` (now in `packages/core/utils/`)
- `src/hooks/` (now in `packages/core/hooks/`)
- `src/theme/` (now in `packages/core/theme/`)
- `src/sections/auth/` (now in `packages/features/auth/`)
- `src/sections/user/` (now in `packages/features/user/`)
- `src/sections/product/` (now in `packages/features/product/`)
- `src/sections/blog/` (now in `packages/features/blog/`)
- `src/sections/mail/` (now in `packages/features/mail/`)
- `src/sections/chat/` (now in `packages/features/chat/`)
- `src/sections/kanban/` (now in `packages/features/kanban/`)
- `src/sections/calendar/` (now in `packages/features/calendar/`)
- `src/sections/invoice/` (now in `packages/features/invoice/`)
- `src/sections/overview/app/` (now in `packages/features/dashboard/`)

**Keeps**:

- All other `src/` directories
- Unmigrated features in `src/sections/`
- Next.js app directory, layouts, auth contexts, etc.

**Backup**: Creates automatic backup before any changes

**Safe to run**: Yes, with backup and verification

---

### 3. `migrate-to-monorepo.sh` 🚀 Original Migration

**Purpose**: Initial monorepo migration script (already completed)

**Status**: ✅ Migration completed (Phases 1-7)

**Note**: This script was used to perform the initial migration. It's kept for reference but doesn't need to be run again.

---

## Quick Start Workflow

### Recommended: 2-Step Process

```bash
# Step 1: Verify (dry run, no changes)
./scripts/verify-cleanup-safety.sh

# Step 2: Cleanup (if verification passes)
./scripts/cleanup-redundancies.sh

# Step 3: Test your application
pnpm dev
```

---

## Why Cleanup Is Needed

After the monorepo migration:

- ✅ All code copied to `packages/`
- ✅ All imports updated to `@app/*`
- ❌ Original files in `src/` still exist (duplicates!)

**Result**: 13,075 duplicate files (203 MB)

**Problem**: TypeScript runs out of memory during type-check

**Solution**: Remove the duplicates with cleanup script

---

## Safety Features

All scripts include:

1. **Pre-flight checks**

   - Verify prerequisites before making changes
   - Check for old imports that haven't been updated
   - Confirm packages exist

2. **Automatic backup**

   - Timestamped backup of all files
   - Easy restore: `tar -xzf src-backup-*.tar.gz`

3. **Interactive confirmation**

   - Shows exactly what will be removed
   - Requires explicit "yes" confirmation
   - Safe to Ctrl+C at any time

4. **Post-cleanup verification**
   - Runs type-check to ensure success
   - Provides rollback instructions if needed

---

## Restore from Backup

If something goes wrong:

```bash
# List backups
ls -lh src-backup-*.tar.gz

# Restore from backup
tar -xzf src-backup-YYYYMMDD_HHMMSS.tar.gz

# Or use git
git checkout HEAD -- src/
```

---

## Script Requirements

- **Bash**: All scripts are bash shell scripts
- **pnpm**: Required for type-check verification
- **tar**: For creating backups (standard on macOS/Linux)
- **grep**: For checking imports (standard)

---

## Troubleshooting

### Script won't run (permission denied)

```bash
chmod +x scripts/*.sh
```

### Type-check fails with heap memory error

This is expected before cleanup! The cleanup fixes this issue.

### Verification fails (old imports found)

Update the imports to use `@app/*` before running cleanup:

```bash
# Find old imports
grep -r "from 'src/config'" src/ --include="*.ts" --include="*.tsx"

# Update them to use @app/* paths
```

### Want to see what will be removed without running cleanup

```bash
./scripts/verify-cleanup-safety.sh
```

---

## Documentation

- **Quick reference**: `../CLEANUP_QUICK_REFERENCE.md`
- **Full details**: `../CLEANUP_REDUNDANCIES.md`
- **Migration progress**: `../MIGRATION_PROGRESS.md`
- **Architecture**: `../MONOREPO_PACKAGE_STRUCTURE.md`

---

## Support

If you encounter issues:

1. Check the documentation files listed above
2. Run verification script to identify problems
3. Review backup location before cleanup
4. Test with `pnpm dev` after cleanup

---

## Script Outputs

### verify-cleanup-safety.sh

- Colored output (green ✓, red ✗, yellow ⚠)
- Summary of what will be removed
- Final verdict on safety
- No files modified

### cleanup-redundancies.sh

- Progress indicators for each phase
- Backup location confirmation
- Removal confirmation for each directory
- Type-check verification results
- Summary with next steps
- Backup file location

---

**Ready to clean up?** Start with `./scripts/verify-cleanup-safety.sh`
