# 📚 API & Lib Strategy for Monorepo

**Date**: November 17, 2025
**Purpose**: Define strategy for `src/api/` and `src/lib/` in the monorepo structure
**Status**: Architectural recommendation

---

## 📊 Current State

### `src/api/` - Data Fetching Hooks (6 files, 36KB)

```
src/api/
├── blog.ts         # Blog post data fetching hooks
├── calendar.ts     # Calendar event hooks
├── chat.ts         # Chat message hooks
├── kanban.ts       # Kanban board hooks
├── mail.ts         # Mail data hooks
└── product.ts      # Product data hooks
```

**Purpose**: SWR-based data fetching hooks for frontend
**Pattern**: `useGetPosts()`, `useGetPost(id)`, etc.
**Dependencies**: Uses `@app/utils/axios`, imports from `src/types/`

### `src/lib/` - Backend Infrastructure (11 files, 96KB)

```
src/lib/
├── prisma.ts                    # Database client (Prisma)
├── email/
│   ├── email-manager.ts         # Email service orchestrator
│   ├── mailgun-service.ts       # Mailgun API client
│   └── templates.ts             # Email templates
├── redis/
│   ├── client.ts                # Redis client
│   ├── index.ts                 # Redis exports
│   ├── session-store.ts         # Session management
│   └── token-blacklist.ts       # JWT blacklist
├── oauth/
│   └── state-manager.ts         # OAuth state management
├── security/
│   └── account-lockout.ts       # Security features
└── services/
    └── usage-tracking-service.ts # Usage metrics
```

**Purpose**: Backend infrastructure and external service integrations
**Pattern**: Singleton clients, service managers, infrastructure utilities

---

## 🎯 Recommended Structure

### Strategy: Split by Purpose & Reusability

| Directory            | Action               | New Location          | Reasoning                    |
| -------------------- | -------------------- | --------------------- | ---------------------------- |
| `src/api/`           | **Move to Features** | Feature packages      | Feature-specific data hooks  |
| `src/lib/prisma.ts`  | **Create Package**   | `@app/database`       | Shared database client       |
| `src/lib/email/*`    | **Create Package**   | `@app/email`          | Reusable email service       |
| `src/lib/redis/*`    | **Create Package**   | `@app/cache`          | Reusable cache/session layer |
| `src/lib/oauth/*`    | **Keep or Package**  | `@app/auth-providers` | Auth-related utilities       |
| `src/lib/security/*` | **Create Package**   | `@app/security`       | Reusable security utilities  |
| `src/lib/services/*` | **Keep in src/**     | `src/lib/services/`   | App-specific services        |

---

## 📦 Detailed Migration Plan

### 1. `src/api/` → Move to Feature Packages

**Current Problem**:

- API hooks for features are separate from feature code
- Creates artificial coupling
- Harder to understand feature boundaries

**Solution**: Move data hooks into their feature packages

#### Migration Pattern

```bash
# Blog API → Blog Feature
mv src/api/blog.ts packages/features/blog/src/api.ts

# Calendar API → Calendar Feature
mv src/api/calendar.ts packages/features/calendar/src/api.ts

# Chat API → Chat Feature
mv src/api/chat.ts packages/features/chat/src/api.ts

# Kanban API → Kanban Feature
mv src/api/kanban.ts packages/features/kanban/src/api.ts

# Mail API → Mail Feature
mv src/api/mail.ts packages/features/mail/src/api.ts

# Product API → Product Feature
mv src/api/product.ts packages/features/product/src/api.ts
```

#### Update Package Exports

```json
// packages/features/blog/package.json
{
  "name": "@app/blog",
  "exports": {
    ".": "./src/index.ts",
    "./api": "./src/api.ts", // ✅ Export API hooks
    "./types": "./src/types.ts"
  }
}
```

#### Update Imports

**Before**:

```typescript
import { useGetPosts } from 'src/api/blog';
```

**After**:

```typescript
import { useGetPosts } from '@app/blog/api';
```

**Benefits**:

- ✅ Feature code stays together
- ✅ Clear feature boundaries
- ✅ Easier to understand data flow
- ✅ Can version features independently

---

### 2. `src/lib/prisma.ts` → `@app/database`

**Create**: Database package for shared database access

#### Structure

```
packages/core/database/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # Re-export client
    ├── client.ts             # Prisma client (from src/lib/prisma.ts)
    └── types.ts              # Database type utilities
```

#### Package Configuration

```json
{
  "name": "@app/database",
  "version": "1.0.0",
  "private": true,
  "description": "Database client and utilities",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "@prisma/extension-accelerate": "^1.0.0"
  }
}
```

#### Usage

```typescript
// Before
import { prisma } from 'src/lib/prisma';

// After
import { prisma } from '@app/database';
```

**Benefits**:

- ✅ Centralized database access
- ✅ Can add query utilities
- ✅ Single source of truth
- ✅ Easier to mock in tests

---

### 3. `src/lib/email/*` → `@app/email`

**Create**: Email service package

#### Structure

```
packages/core/email/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                  # Main exports
    ├── manager.ts                # Email manager (from email-manager.ts)
    ├── providers/
    │   └── mailgun.ts            # Mailgun service
    ├── templates/
    │   ├── index.ts
    │   ├── welcome.ts
    │   ├── password-reset.ts
    │   ├── payment.ts
    │   └── security.ts
    └── types.ts                  # Email types
```

#### Package Configuration

```json
{
  "name": "@app/email",
  "version": "1.0.0",
  "private": true,
  "description": "Email service and templates",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./templates": "./src/templates/index.ts"
  },
  "dependencies": {
    "mailgun.js": "^10.0.0"
  }
}
```

#### Usage

```typescript
// Before
import { sendWelcomeEmail } from 'src/lib/email/email-manager';

// After
import { sendWelcomeEmail } from '@app/email';
```

**Benefits**:

- ✅ Reusable across projects
- ✅ Easy to swap providers
- ✅ Testable email templates
- ✅ Clear email API

---

### 4. `src/lib/redis/*` → `@app/cache`

**Create**: Cache and session management package

#### Structure

```
packages/core/cache/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                  # Main exports
    ├── client.ts                 # Redis client
    ├── session-store.ts          # Session management
    ├── token-blacklist.ts        # JWT blacklist
    ├── rate-limiter.ts           # Rate limiting (future)
    └── types.ts                  # Cache types
```

#### Package Configuration

```json
{
  "name": "@app/cache",
  "version": "1.0.0",
  "private": true,
  "description": "Caching, sessions, and Redis utilities",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./session": "./src/session-store.ts",
    "./blacklist": "./src/token-blacklist.ts"
  },
  "dependencies": {
    "redis": "^4.6.0"
  }
}
```

#### Usage

```typescript
// Before
import { redisClient } from 'src/lib/redis/client';
import { sessionStore } from 'src/lib/redis/session-store';

// After
import { redisClient } from '@app/cache';
import { sessionStore } from '@app/cache/session';
```

**Benefits**:

- ✅ Abstraction over Redis
- ✅ Can switch cache providers
- ✅ Reusable session logic
- ✅ Single cache configuration

---

### 5. `src/lib/security/*` → `@app/security`

**Create**: Security utilities package

#### Structure

```
packages/core/security/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                  # Main exports
    ├── account-lockout.ts        # Account lockout logic
    ├── rate-limiting.ts          # Rate limiting (future)
    ├── encryption.ts             # Encryption utilities (future)
    └── types.ts                  # Security types
```

#### Package Configuration

```json
{
  "name": "@app/security",
  "version": "1.0.0",
  "private": true,
  "description": "Security utilities and middleware",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./lockout": "./src/account-lockout.ts"
  }
}
```

#### Usage

```typescript
// Before
import { checkAccountLockout } from 'src/lib/security/account-lockout';

// After
import { checkAccountLockout } from '@app/security/lockout';
```

**Benefits**:

- ✅ Centralized security logic
- ✅ Reusable across features
- ✅ Easier to audit
- ✅ Can add more security features

---

### 6. `src/lib/oauth/*` → Options

**Option A**: Keep in `src/auth/` (Recommended)

- OAuth is auth-specific
- Already have `src/auth/` directory
- Move `oauth/` → `src/auth/oauth/`

**Option B**: Create `@app/auth-providers`

- If you want to reuse across apps
- More complex, may be overkill

**Recommendation**: **Keep in `src/auth/oauth/`**

```bash
mv src/lib/oauth src/auth/oauth
```

---

### 7. `src/lib/services/*` → Keep in `src/lib/`

**Keep**: Application-specific services

**Reason**:

- `usage-tracking-service.ts` is app-specific business logic
- Not reusable infrastructure
- Belongs at application level

**Action**: None - keep as-is

---

## 🏗️ Final Monorepo Structure

### After Migration

```
next-ts/
├── packages/
│   ├── core/
│   │   ├── types/              ✅ Exists
│   │   ├── config/             ✅ Exists
│   │   ├── components/         ✅ Exists
│   │   ├── engine/             ✅ Exists
│   │   ├── dsl/                ✅ Exists
│   │   ├── utils/              ✅ Exists
│   │   ├── hooks/              ✅ Exists
│   │   ├── theme/              ✅ Exists
│   │   ├── database/           🆕 NEW - Prisma client
│   │   ├── email/              🆕 NEW - Email service
│   │   ├── cache/              🆕 NEW - Redis/cache
│   │   └── security/           🆕 NEW - Security utilities
│   │
│   └── features/
│       ├── auth/               ✅ Exists
│       ├── dashboard/          ✅ Exists
│       ├── user/               ✅ Exists (add api.ts)
│       ├── product/            ✅ Exists (add api.ts)
│       ├── blog/               ✅ Exists (add api.ts)
│       ├── mail/               ✅ Exists (add api.ts)
│       ├── chat/               ✅ Exists (add api.ts)
│       ├── kanban/             ✅ Exists (add api.ts)
│       ├── calendar/           ✅ Exists (add api.ts)
│       └── invoice/            ✅ Exists
│
└── src/
    ├── app/                    ✅ Next.js routes
    ├── auth/                   ✅ Auth contexts
    │   └── oauth/              🔄 MOVED from lib/oauth/
    ├── layouts/                ✅ Layouts
    ├── locales/                ✅ i18n
    ├── routes/                 ✅ Routing
    ├── types/                  ✅ Unmigrated feature types
    ├── sections/               ✅ Unmigrated features
    ├── lib/
    │   └── services/           ✅ App-specific services
    └── ... (other app files)
```

---

## 📋 Migration Checklist

### Phase 1: Infrastructure Packages (Priority)

- [ ] Create `@app/database` package

  - [ ] Move `src/lib/prisma.ts` → `packages/core/database/src/client.ts`
  - [ ] Update package.json
  - [ ] Update all imports

- [ ] Create `@app/cache` package

  - [ ] Move `src/lib/redis/*` → `packages/core/cache/src/`
  - [ ] Update package.json
  - [ ] Update all imports

- [ ] Create `@app/email` package

  - [ ] Move `src/lib/email/*` → `packages/core/email/src/`
  - [ ] Update package.json
  - [ ] Update all imports

- [ ] Create `@app/security` package

  - [ ] Move `src/lib/security/*` → `packages/core/security/src/`
  - [ ] Update package.json
  - [ ] Update all imports

- [ ] Move OAuth
  - [ ] Move `src/lib/oauth/*` → `src/auth/oauth/`
  - [ ] Update imports

### Phase 2: Feature APIs (Lower Priority)

- [ ] Move `src/api/blog.ts` → `packages/features/blog/src/api.ts`
- [ ] Move `src/api/calendar.ts` → `packages/features/calendar/src/api.ts`
- [ ] Move `src/api/chat.ts` → `packages/features/chat/src/api.ts`
- [ ] Move `src/api/kanban.ts` → `packages/features/kanban/src/api.ts`
- [ ] Move `src/api/mail.ts` → `packages/features/mail/src/api.ts`
- [ ] Move `src/api/product.ts` → `packages/features/product/src/api.ts`

- [ ] Update feature package.json files to export `./api`
- [ ] Update all imports from `src/api/*` to `@app/*/api`

### Phase 3: Cleanup

- [ ] Remove empty `src/api/` directory
- [ ] Remove `src/lib/` (only if empty - keep `services/`)
- [ ] Run type-check: `pnpm type-check`
- [ ] Test application: `pnpm dev`
- [ ] Commit changes

---

## 🎯 Benefits of This Structure

### Clear Separation

```
Infrastructure (Packages)         Application Logic (src/)
├── @app/database                ├── src/app/          (routes)
├── @app/cache                   ├── src/auth/         (auth flow)
├── @app/email                   ├── src/layouts/      (page layouts)
├── @app/security                ├── src/lib/services/ (app services)
└── Features with APIs           └── src/sections/     (pages)
    └── @app/blog/api
```

### Reusability

- **Infrastructure packages** can be used across multiple apps
- **Feature packages** include their data layer
- **App-specific code** stays in `src/`

### Maintainability

- Clear boundaries between infrastructure and application
- Easy to find related code (feature + API together)
- Single source of truth for each concern

### Testing

- Can test infrastructure packages independently
- Can mock infrastructure in feature tests
- Clear dependency graph

---

## 🚀 Quick Start Commands

### Create Infrastructure Packages

```bash
# Create database package
mkdir -p packages/core/database/src
# ... (create files)

# Create cache package
mkdir -p packages/core/cache/src
# ... (create files)

# Create email package
mkdir -p packages/core/email/src
# ... (create files)

# Create security package
mkdir -p packages/core/security/src
# ... (create files)
```

### Move API Files to Features

```bash
# Move each API file to its feature
for feature in blog calendar chat kanban mail product; do
  mv "src/api/${feature}.ts" "packages/features/${feature}/src/api.ts"
done
```

### Update TypeScript Paths

```json
// tsconfig.json
{
  "paths": {
    "@app/database": ["./packages/core/database/src"],
    "@app/cache": ["./packages/core/cache/src"],
    "@app/cache/*": ["./packages/core/cache/src/*"],
    "@app/email": ["./packages/core/email/src"],
    "@app/email/*": ["./packages/core/email/src/*"],
    "@app/security": ["./packages/core/security/src"],
    "@app/security/*": ["./packages/core/security/src/*"]
  }
}
```

---

## ⚡ Recommended Approach

### Option 1: Do It All (Recommended for Long-term)

**Pros**:

- Clean structure
- Clear boundaries
- Full benefits

**Cons**:

- More upfront work
- More imports to update

**Timeline**: 4-6 hours

### Option 2: Infrastructure Only (Quick Win)

**Do**: Create `@app/database`, `@app/cache`, `@app/email`, `@app/security`
**Skip**: Moving API files to features

**Pros**:

- Reusable infrastructure
- Smaller change set
- Quick impact

**Cons**:

- API files still separate from features

**Timeline**: 2-3 hours

### Option 3: Do Nothing (Also Valid)

**Keep**: Everything in `src/api/` and `src/lib/`

**Pros**:

- Zero work
- No risk
- Works fine

**Cons**:

- Less reusable
- Harder to understand feature boundaries

**When to choose**: If current structure is working well

---

## 💡 My Recommendation

**Do Infrastructure Packages (Option 2)** first:

1. ✅ Create `@app/database` - Most reusable, used everywhere
2. ✅ Create `@app/cache` - Session/Redis is infrastructure
3. ✅ Create `@app/email` - Reusable email service
4. ✅ Create `@app/security` - Reusable security utilities
5. ✅ Move OAuth to `src/auth/oauth/` - Logical location

**Later** (when you have time): 6. 🔄 Move API files to feature packages - Nice to have, but lower priority

**Why this order**:

- Infrastructure is most reusable
- Lower risk (fewer import changes)
- Immediate value (clear infrastructure layer)
- Can do API migration incrementally

---

## 📚 References

- Current structure: `CLEANUP_COMPLETED.md`
- Remaining directories: `REMAINING_DIRECTORIES_ANALYSIS.md`
- Migration pattern: `MIGRATION_PROGRESS.md`

---

**Strategy Date**: November 17, 2025
**Priority**: Infrastructure packages first, API files later
**Estimated Effort**: 2-6 hours depending on scope
**Risk**: Low (infrastructure is well-isolated)
**Value**: High (clear separation, reusability)
