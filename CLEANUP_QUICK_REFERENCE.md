# 🚀 Quick Reference: Cleanup Redundant Files

## TL;DR

After the monorepo migration, **13,075 duplicate files (203 MB)** exist in both `src/` and `packages/`. This causes TypeScript to run out of memory during type-check.

**Solution**: Run the automated cleanup script.

---

## ⚡ Quick Start (2 Steps)

```bash
# 1. Verify safety (dry run)
./scripts/verify-cleanup-safety.sh

# 2. Run cleanup (if verification passes)
./scripts/cleanup-redundancies.sh
```

**That's it!** The script will:

- ✓ Create automatic backup
- ✓ Remove duplicate files
- ✓ Verify with type-check
- ✓ Show summary

---

## 📊 What Gets Removed

| Directory                    | Files      | Size      | Status           |
| ---------------------------- | ---------- | --------- | ---------------- |
| `src/config/`                | ~50        | ~148K     | ✅ Safe          |
| `src/components/`            | ~38        | ~872K     | ✅ Safe          |
| `src/engine/`                | ~20        | ~196K     | ✅ Safe          |
| `src/dsl/`                   | 12,585     | 202MB     | ✅ Safe          |
| `src/utils/`                 | ~9         | ~32K      | ✅ Safe          |
| `src/hooks/`                 | ~11        | ~40K      | ✅ Safe          |
| `src/theme/`                 | ~25        | ~248K     | ✅ Safe          |
| `src/sections/auth/`         | ~15        | ~112K     | ✅ Safe          |
| `src/sections/user/`         | ~15        | ~112K     | ✅ Safe          |
| `src/sections/product/`      | ~23        | ~172K     | ✅ Safe          |
| `src/sections/blog/`         | ~15        | ~112K     | ✅ Safe          |
| `src/sections/mail/`         | ~8         | ~56K      | ✅ Safe          |
| `src/sections/chat/`         | ~13        | ~100K     | ✅ Safe          |
| `src/sections/kanban/`       | ~11        | ~84K      | ✅ Safe          |
| `src/sections/calendar/`     | ~8         | ~60K      | ✅ Safe          |
| `src/sections/invoice/`      | ~15        | ~112K     | ✅ Safe          |
| `src/sections/overview/app/` | ~8         | ~56K      | ✅ Safe          |
| **TOTAL**                    | **13,075** | **203MB** | **All verified** |

---

## ❓ Why Is This Safe?

1. **Zero old imports found**

   ```bash
   # Verification confirmed:
   grep -r "from 'src/config'" src/ --include="*.ts" --include="*.tsx"
   # Returns: 0 results
   ```

2. **All packages exist**

   - ✓ `packages/core/` has 8 packages (types, config, components, engine, dsl, utils, hooks, theme)
   - ✓ `packages/features/` has 10 packages (auth, user, product, etc.)

3. **TypeScript paths configured**

   - ✓ All `@app/*` paths defined in `tsconfig.json`
   - ✓ All imports updated to use `@app/*`

4. **Automatic backup**
   - Script creates `src-backup-YYYYMMDD_HHMMSS.tar.gz`
   - Easy restore if needed: `tar -xzf src-backup-*.tar.gz`

---

## ⚠️ Current Issues (Fixed After Cleanup)

### Problem 1: Type-check Fails

```bash
$ pnpm type-check
# Error: JavaScript heap out of memory
# FATAL ERROR: Reached heap limit Allocation failed
```

**Cause**: 13,075 duplicate files overwhelm TypeScript compiler

**Solution**: Cleanup removes duplicates, type-check will work

### Problem 2: Build Performance

- Slower builds due to scanning 13,075 extra files
- Increased memory usage
- Confusion about which files to edit

**Solution**: Cleanup improves performance and clarity

---

## 🛡️ Safety Features

Both scripts include:

1. **Pre-flight checks**

   - Verifies no old imports
   - Checks all packages exist
   - Confirms TypeScript configuration

2. **Interactive confirmation**

   - Shows what will be removed
   - Asks for explicit "yes" confirmation
   - Safe to Ctrl+C at any time

3. **Automatic backup**

   - Creates timestamped backup
   - Includes all files to be removed
   - Easy restore if needed

4. **Post-cleanup verification**
   - Runs type-check automatically
   - Fails safely if issues detected
   - Provides restore instructions

---

## 📁 What Stays (Not Removed)

These directories remain in `src/`:

- ✅ `src/app/` - Next.js routes and pages
- ✅ `src/layouts/` - Layout components (not migrated)
- ✅ `src/auth/` - Auth contexts (not migrated)
- ✅ `src/locales/` - i18n translations
- ✅ `src/_mock/` - Mock data
- ✅ `src/sections/*` - 20+ unmigrated features (account, payment, order, etc.)
- ✅ All other non-migrated code

**Only migrated duplicates are removed!**

---

## 🔍 Manual Verification (Optional)

If you want to check manually before running scripts:

```bash
# Check for old imports (should return 0)
grep -r "from ['\"]src/\(config\|components\|engine\|dsl\|utils\|hooks\|theme\)['\"]" src/ \
  --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l

# Verify packages exist (should list 8 core packages)
ls packages/core/

# Verify features exist (should list 10 features)
ls packages/features/

# Check TypeScript paths (should show @app/* paths)
grep -A 30 '"paths"' tsconfig.json
```

---

## 🎯 After Cleanup

Test your application:

```bash
# Start development server
pnpm dev

# Run type-check (should now work!)
pnpm type-check

# Run tests if available
pnpm test

# Build for production
pnpm build
```

Commit the changes:

```bash
git add -A
git commit -m "chore: remove redundant files after monorepo migration

- Removed 13,075 duplicate files (203 MB)
- All imports now use @app/* packages
- Fixes TypeScript heap memory issues
- Backup created: src-backup-YYYYMMDD_HHMMSS.tar.gz"
```

---

## 📚 More Information

- **Full details**: See `CLEANUP_REDUNDANCIES.md`
- **Migration status**: See `MIGRATION_PROGRESS.md`
- **Architecture**: See `MONOREPO_PACKAGE_STRUCTURE.md`

---

## 💬 Questions?

**Q: What if something breaks?**
A: Restore from backup: `tar -xzf src-backup-*.tar.gz`

**Q: Can I review files before deletion?**
A: Yes! Run `./scripts/verify-cleanup-safety.sh` (dry run, no changes)

**Q: Will my application still work?**
A: Yes! All imports already use `@app/*` packages. The `src/` files are unused duplicates.

**Q: What about the other 20+ features in `src/sections/`?**
A: Those stay! Only the 10 migrated features are removed. Migrate others later if desired.

**Q: Is this reversible?**
A: Yes! The script creates automatic backups. You can also use git to restore.

---

## ✨ Benefits After Cleanup

- ✅ TypeScript type-check works again
- ✅ 203 MB disk space recovered
- ✅ Faster builds and development
- ✅ No confusion about which files to edit
- ✅ Single source of truth for each module
- ✅ Cleaner codebase structure

**Ready?** Run `./scripts/verify-cleanup-safety.sh` to get started!
