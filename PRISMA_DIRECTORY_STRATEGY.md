# 🗄️ Prisma Directory Strategy for Monorepo

**Date**: November 17, 2025
**Purpose**: Define where `prisma/` directory fits in the monorepo structure
**Status**: Architectural recommendation

---

## 📊 Current State

### `prisma/` Directory Structure

```
prisma/                          (624KB)
├── schema.prisma               # Main database schema
├── schema-extended.prisma      # Extended schema
├── migrations/                 # Database migrations
│   ├── [timestamp]_*.sql
│   └── backfill-organization-data.ts
├── migrations-data/            # Data migrations
│   └── migrate-avatar-to-photourl.ts
├── seeds/                      # Seed data modules
│   ├── feature-flags.ts
│   └── mapping-templates.ts
├── seed.ts                     # Main seed file
├── seed.production.ts          # Production seeding
├── seed.production.extended.ts # Extended production seed
├── seed.test.ts                # Test data seeding
├── seed-roles-permissions.ts   # Roles/permissions seed
├── seed.backup.ts              # Backup seed file
├── seed.js                     # JavaScript seed
├── dev.db                      # SQLite dev database
├── package.json                # Prisma package config
└── README.md                   # Documentation
```

**Purpose**: Database schema, migrations, and seeding
**Size**: 624KB
**Contains**: Schema definitions, migration files, seed scripts

---

## 🎯 Key Question: Where Should Prisma Live?

### Option 1: **Keep at Root** (Recommended) ✅

```
next-ts/
├── prisma/                     ✅ KEEP HERE
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── packages/
│   └── core/
│       └── database/           🆕 NEW - Client & utilities
│           └── src/
│               ├── index.ts
│               └── client.ts   (re-exports Prisma client)
└── src/
```

**Recommendation**: ✅ **Keep `prisma/` at project root**

---

## 📋 Detailed Strategy

### What to Keep in `prisma/` (Root)

**Keep at root** - This is standard Prisma convention:

1. **`schema.prisma`** ✅

   - Database schema definition
   - Single source of truth for database structure
   - Prisma CLI looks for it at root by default

2. **`migrations/`** ✅

   - Database migration files
   - Historical record of schema changes
   - Must stay with schema

3. **Seed files** ✅

   - `seed.ts`, `seed.production.ts`, etc.
   - Data initialization scripts
   - Referenced in package.json scripts

4. **`package.json`** ✅
   - Prisma-specific dependencies
   - Seed scripts configuration
   - CLI scripts

### What to Create: `@app/database` Package

**Create new package** for database client and utilities:

```
packages/core/database/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # Main exports
    ├── client.ts             # Prisma client (from src/lib/prisma.ts)
    ├── types.ts              # Database type utilities
    ├── queries/              # Reusable query utilities
    │   ├── users.ts
    │   ├── organizations.ts
    │   └── ...
    └── utils/                # Database utilities
        ├── pagination.ts
        ├── filters.ts
        └── transactions.ts
```

---

## 🏗️ Architecture Pattern

### Clear Separation

```
┌─────────────────────────────────────────────────────────┐
│  prisma/ (Root)                                         │
│  ├── schema.prisma        ← Schema definition          │
│  ├── migrations/          ← Migration files            │
│  └── seed.ts              ← Seeding scripts            │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Generates
                         ▼
┌─────────────────────────────────────────────────────────┐
│  @app/database (Package)                                │
│  ├── client.ts            ← Configured Prisma client   │
│  ├── queries/             ← Reusable queries           │
│  └── utils/               ← DB utilities               │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Used by
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Features & Application                                 │
│  ├── @app/user            ← Uses database queries      │
│  ├── @app/product         ← Uses database queries      │
│  └── src/app/api/         ← API routes use queries     │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Create `@app/database` Package

### Step 1: Package Structure

```bash
mkdir -p packages/core/database/src/{queries,utils}
```

### Step 2: Package Configuration

**`packages/core/database/package.json`**:

```json
{
  "name": "@app/database",
  "version": "1.0.0",
  "private": true,
  "description": "Database client, queries, and utilities",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./queries/*": "./src/queries/*.ts",
    "./utils/*": "./src/utils/*.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "@prisma/extension-accelerate": "^1.0.0"
  },
  "scripts": {
    "generate": "prisma generate --schema=../../../prisma/schema.prisma"
  }
}
```

### Step 3: Move Client Code

**`packages/core/database/src/client.ts`**:

```typescript
// Moved from src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;
let _initializationAttempted = false;

function getPrismaClient(): PrismaClient {
  if (_prisma) return _prisma as any;

  if (globalForPrisma.prisma) {
    _prisma = globalForPrisma.prisma;
    return _prisma as any;
  }

  if (_initializationAttempted) {
    throw new Error(
      'Prisma client initialization failed. Please ensure the database is accessible and "prisma generate" has been run.'
    );
  }

  _initializationAttempted = true;

  try {
    const basePrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });

    _prisma = basePrisma.$extends(withAccelerate()) as any;

    basePrisma.$connect().catch((error) => {
      console.error('Failed to connect to database:', error);
    });

    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma as any;
    }

    return _prisma as any;
  } catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    throw new Error(`Prisma initialization failed: ${(error as Error).message}`);
  }
}

// Export a proxy that lazily initializes the client
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { PrismaClient };
export default prisma;
```

**`packages/core/database/src/index.ts`**:

```typescript
export { prisma, PrismaClient } from './client';
export * from './types';
```

### Step 4: Add Query Utilities (Optional)

**`packages/core/database/src/queries/users.ts`**:

```typescript
import { prisma } from '../client';

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      organization: true,
      roles: true,
    },
  });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      organization: true,
      roles: true,
    },
  });
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  organizationId?: string;
}) {
  return prisma.user.create({
    data,
    include: {
      organization: true,
    },
  });
}

// More reusable user queries...
```

**`packages/core/database/src/utils/pagination.ts`**:

```typescript
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function calculatePagination(options: PaginationOptions) {
  const { page, pageSize } = options;
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, pageSize } = options;
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
```

---

## 🔧 Configuration Updates

### Update TypeScript Paths

**`tsconfig.json`**:

```json
{
  "compilerOptions": {
    "paths": {
      "@app/database": ["./packages/core/database/src"],
      "@app/database/*": ["./packages/core/database/src/*"]
    }
  }
}
```

### Update Prisma Generation Path

The `@prisma/client` is generated based on `schema.prisma` location. Since we're keeping schema at root, no changes needed for generation.

### Update Root package.json

**`package.json`** (root):

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

---

## 📋 Usage Examples

### Before (Old Pattern)

```typescript
// In API route or service
import { prisma } from 'src/lib/prisma';

export async function getUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
}
```

### After (New Pattern)

**Option 1: Direct client usage**

```typescript
import { prisma } from '@app/database';

export async function getUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
}
```

**Option 2: Use reusable queries** (Recommended)

```typescript
import { findUserByEmail } from '@app/database/queries/users';

export async function getUser(email: string) {
  return findUserByEmail(email);
}
```

---

## 🎯 Benefits of This Approach

### 1. Standard Prisma Conventions ✅

- `prisma/` at root is Prisma's default
- Works with Prisma CLI out of the box
- No configuration needed

### 2. Clear Separation ✅

```
prisma/              ← Schema definition (what)
@app/database        ← Client & queries (how)
Features             ← Business logic (why)
```

### 3. Reusable Query Layer ✅

- Common queries in one place
- DRY (Don't Repeat Yourself)
- Easier to maintain
- Testable in isolation

### 4. Type Safety ✅

- Generated types from schema
- Type-safe queries
- IntelliSense support

### 5. Migration Management ✅

- Migrations stay with schema
- Clear history
- Easy to version control

---

## 🚨 What NOT to Do

### ❌ Don't Move Prisma to Packages

**Bad**:

```
packages/core/database/
├── prisma/              ❌ NO - breaks Prisma CLI
│   ├── schema.prisma
│   └── migrations/
└── src/
    └── client.ts
```

**Why not**:

- Prisma CLI expects `prisma/` at root
- Breaks migration commands
- Requires custom configuration
- Non-standard structure

### ❌ Don't Duplicate Schema

**Bad**:

```
prisma/schema.prisma           ❌ One schema here
packages/database/schema.prisma ❌ Another here? NO!
```

**Why not**:

- Single source of truth
- Schema duplication causes drift
- Migration conflicts

### ❌ Don't Put Business Logic in Database Package

**Bad**:

```typescript
// @app/database/src/services/user-auth.ts  ❌ NO
export async function loginUser(email: string, password: string) {
  // Business logic doesn't belong in database package
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user.passwordHash);
  // ...
}
```

**Good**:

```typescript
// @app/database/src/queries/users.ts  ✅ YES
export async function findUserByEmail(email: string) {
  // Simple data access - no business logic
  return prisma.user.findUnique({
    where: { email },
    include: { organization: true },
  });
}

// src/auth/services/login.ts  ✅ YES - Business logic at app level
import { findUserByEmail } from '@app/database/queries/users';
export async function loginUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  // Business logic here
}
```

---

## 📋 Migration Checklist

### Phase 1: Create Database Package

- [ ] Create directory structure

  ```bash
  mkdir -p packages/core/database/src/{queries,utils}
  ```

- [ ] Create `package.json`
- [ ] Create `tsconfig.json`
- [ ] Create `README.md`

### Phase 2: Move Client Code

- [ ] Copy `src/lib/prisma.ts` → `packages/core/database/src/client.ts`
- [ ] Create `packages/core/database/src/index.ts` (exports)
- [ ] Update TypeScript paths in root `tsconfig.json`

### Phase 3: Update Imports

- [ ] Find all imports of `src/lib/prisma`

  ```bash
  grep -r "from 'src/lib/prisma'" src/ --include="*.ts" --include="*.tsx"
  ```

- [ ] Replace with `@app/database`
  ```bash
  find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    "s|from 'src/lib/prisma'|from '@app/database'|g" {} \;
  ```

### Phase 4: Add Query Utilities (Optional)

- [ ] Create `queries/users.ts`
- [ ] Create `queries/organizations.ts`
- [ ] Create `utils/pagination.ts`
- [ ] Create `utils/filters.ts`

### Phase 5: Testing

- [ ] Run `pnpm db:generate`
- [ ] Run `pnpm type-check`
- [ ] Test database queries
- [ ] Run `pnpm dev`

---

## 🎯 Final Structure

```
next-ts/
├── prisma/                           ✅ KEEP at root
│   ├── schema.prisma                 ✅ Schema definition
│   ├── migrations/                   ✅ Migration files
│   ├── seed.ts                       ✅ Seeding scripts
│   └── package.json                  ✅ Prisma config
│
├── packages/
│   └── core/
│       └── database/                 🆕 NEW package
│           ├── package.json
│           ├── tsconfig.json
│           └── src/
│               ├── index.ts          # Exports
│               ├── client.ts         # Prisma client
│               ├── types.ts          # Type utilities
│               ├── queries/          # Reusable queries
│               │   ├── users.ts
│               │   └── organizations.ts
│               └── utils/            # DB utilities
│                   ├── pagination.ts
│                   └── filters.ts
│
└── src/                              ✅ Application code
    ├── app/api/                      # API routes use @app/database
    └── lib/services/                 # Services use @app/database
```

---

## 💡 Quick Decision Guide

### Keep at Root: `prisma/`

- ✅ Schema files (`*.prisma`)
- ✅ Migrations (`migrations/`)
- ✅ Seed scripts (`seed*.ts`)
- ✅ Prisma package.json

### Move to Package: `@app/database`

- ✅ Database client (`src/lib/prisma.ts`)
- ✅ Reusable queries
- ✅ Database utilities
- ✅ Type helpers

### Keep in App: `src/`

- ✅ Business logic
- ✅ API routes
- ✅ Services
- ✅ Feature-specific logic

---

## 📚 Summary

**Recommended Action**:

1. ✅ **Keep `prisma/` at root** - Standard convention, works with Prisma CLI
2. 🆕 **Create `@app/database` package** - For client and utilities
3. 🔄 **Move `src/lib/prisma.ts`** → `packages/core/database/src/client.ts`
4. ⚡ **Add query layer** - Optional but recommended for reusability

**Benefits**:

- Standard Prisma structure
- Clear separation of concerns
- Reusable database layer
- Better testability
- Type safety maintained

**Estimated Effort**: 1-2 hours
**Risk**: Low (client code is isolated)
**Value**: High (reusable infrastructure)

---

**Strategy Date**: November 17, 2025
**Recommendation**: Keep `prisma/` at root + Create `@app/database` package
**Priority**: Medium (part of infrastructure cleanup)
**Dependencies**: Part of overall `src/lib/` migration
