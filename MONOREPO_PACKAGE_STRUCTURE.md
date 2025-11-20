# 📦 Monorepo Package Structure

## 🎯 Package Architecture Design

Transform the project into a **monorepo with self-contained packages** where each feature is a standalone Node module.

---

## 📊 Proposed Structure

```
next-ts/
├── packages/                           # All feature packages
│   ├── core/                          # Core packages (required)
│   │   ├── types/                     # @app/types
│   │   ├── config/                    # @app/config
│   │   ├── utils/                     # @app/utils
│   │   ├── hooks/                     # @app/hooks
│   │   ├── components/                # @app/components
│   │   └── theme/                     # @app/theme
│   │
│   ├── features/                      # Feature packages (plugins)
│   │   ├── auth/                      # @app/auth
│   │   ├── dashboard/                 # @app/dashboard
│   │   ├── user/                      # @app/user
│   │   ├── product/                   # @app/product
│   │   ├── blog/                      # @app/blog
│   │   ├── mail/                      # @app/mail
│   │   ├── chat/                      # @app/chat
│   │   ├── kanban/                    # @app/kanban
│   │   ├── calendar/                  # @app/calendar
│   │   ├── file-manager/              # @app/file-manager
│   │   ├── invoice/                   # @app/invoice
│   │   ├── job/                       # @app/job
│   │   ├── tour/                      # @app/tour
│   │   ├── analytics/                 # @app/analytics
│   │   ├── ecommerce/                 # @app/ecommerce
│   │   ├── banking/                   # @app/banking
│   │   └── booking/                   # @app/booking
│   │
│   └── integrations/                  # Integration packages
│       ├── stripe/                    # @app/stripe
│       ├── auth0/                     # @app/auth0
│       ├── firebase/                  # @app/firebase
│       └── supabase/                  # @app/supabase
│
├── apps/                              # Applications
│   └── web/                           # Main Next.js app
│       ├── src/
│       │   ├── app/                   # App Router (minimal)
│       │   └── plugin-loader.ts       # Auto-loads packages
│       └── package.json
│
├── package.json                       # Root package.json
├── turbo.json                         # Turborepo config
└── pnpm-workspace.yaml               # Workspace config
```

---

## 📦 Package Template

### Standard Package Structure

```
packages/features/auth/
├── src/
│   ├── index.ts                      # Main export
│   ├── plugin.ts                     # Plugin definition
│   ├── routes/                       # Route components
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── components/                   # Feature components
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   └── auth-guard.tsx
│   ├── hooks/                        # Feature hooks
│   │   ├── use-auth.ts
│   │   └── use-session.ts
│   ├── api/                          # API endpoints
│   │   ├── login.ts
│   │   ├── register.ts
│   │   └── logout.ts
│   ├── types/                        # TypeScript types
│   │   └── index.ts
│   └── utils/                        # Utilities
│       └── validation.ts
│
├── package.json                      # Package manifest
├── tsconfig.json                     # TypeScript config
└── README.md                         # Package documentation
```

---

## 📋 Package.json Template

```json
{
  "name": "@app/auth",
  "version": "1.0.0",
  "private": true,
  "description": "Authentication feature package",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./plugin": "./src/plugin.ts",
    "./components": "./src/components/index.ts",
    "./hooks": "./src/hooks/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@app/types": "workspace:*",
    "@app/config": "workspace:*",
    "@app/components": "workspace:*",
    "react": "^18.2.0",
    "next": "^14.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  },
  "keywords": ["auth", "authentication", "login", "plugin"],
  "author": "Your Name",
  "license": "MIT"
}
```

---

## 🔌 Plugin Definition Template

```typescript
// packages/features/auth/src/plugin.ts

import type { Plugin } from '@app/types';

// Import route components
import LoginPage from './routes/login';
import RegisterPage from './routes/register';
import ForgotPasswordPage from './routes/forgot-password';

// Import components
import * as components from './components';

// Import hooks
import * as hooks from './hooks';

export const authPlugin: Plugin = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  description: 'User authentication and session management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  // Routes
  routes: [
    {
      path: '/auth/login',
      component: LoginPage,
      protected: false,
      layout: 'auth',
      meta: {
        title: 'Sign In',
        description: 'Sign in to your account',
      },
    },
    {
      path: '/auth/register',
      component: RegisterPage,
      protected: false,
      layout: 'auth',
      meta: {
        title: 'Sign Up',
        description: 'Create a new account',
      },
    },
    {
      path: '/auth/forgot-password',
      component: ForgotPasswordPage,
      protected: false,
      layout: 'auth',
      meta: {
        title: 'Forgot Password',
        description: 'Reset your password',
      },
    },
  ],

  // Navigation (if any)
  navigation: [],

  // Components
  components,

  // Lifecycle hooks
  hooks: {
    onInit: async () => {
      console.log('[Auth Plugin] Initialized');
    },
    onAuth: async (user) => {
      console.log('[Auth Plugin] User authenticated:', user.id);
    },
    onLogout: async () => {
      console.log('[Auth Plugin] User logged out');
    },
  },

  // API endpoints
  apis: [
    {
      endpoint: '/api/auth/login',
      method: 'POST',
      handler: async (req, res) => {
        // Handle login
      },
      auth: false,
    },
  ],

  // Settings
  settings: {
    sessionTimeout: 3600,
    allowRegistration: true,
    requireEmailVerification: false,
  },

  // Dependencies
  dependencies: ['@app/types', '@app/config'],

  // Metadata
  metadata: {
    repository: 'https://github.com/yourusername/next-ts',
    license: 'MIT',
    tags: ['auth', 'authentication', 'security'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: true, // Core system plugin
};
```

---

## 🚀 Package Auto-Discovery

### Plugin Loader (`apps/web/src/plugin-loader.ts`)

```typescript
import { pluginManager } from '@app/config';
import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * Auto-discover and register all packages as plugins
 */
export async function loadPackages() {
  const packagesDir = join(process.cwd(), '../../packages/features');

  try {
    const features = readdirSync(packagesDir);

    for (const feature of features) {
      try {
        // Dynamic import of plugin definition
        const pluginModule = await import(`@app/${feature}/plugin`);

        if (pluginModule.default || pluginModule[`${feature}Plugin`]) {
          const plugin = pluginModule.default || pluginModule[`${feature}Plugin`];

          // Register plugin
          pluginManager.registerPlugin(plugin);

          console.log(`✅ Loaded package: @app/${feature}`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load @app/${feature}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Failed to load packages:', error);
  }
}
```

---

## 🔧 Root Configuration

### `package.json`

```json
{
  "name": "next-ts-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/core/*", "packages/features/*", "packages/integrations/*", "apps/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/core/*'
  - 'packages/features/*'
  - 'packages/integrations/*'
  - 'apps/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^type-check"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 📚 Core Packages

### @app/types

```typescript
// packages/core/types/src/index.ts

export * from './config';
export * from './plugin';
export * from './user';
export * from './api';
// ... all shared types
```

### @app/config

```typescript
// packages/core/config/src/index.ts

export { ConfigManager } from './config-manager';
export { pluginManager } from './plugin-manager';
export * from './default-config';
export * from './hooks';
```

### @app/components

```typescript
// packages/core/components/src/index.ts

export { Iconify } from './iconify';
export { Logo } from './logo';
export { ScrollBar } from './scrollbar';
// ... all shared components
```

---

## 🎯 Feature Package Examples

### @app/dashboard

```typescript
// packages/features/dashboard/src/plugin.ts

export const dashboardPlugin: Plugin = {
  id: 'dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  type: 'ui',
  routes: [
    {
      path: '/dashboard',
      component: DashboardPage,
      protected: true,
    },
  ],
  navigation: [
    {
      id: 'dashboard',
      title: 'Dashboard',
      path: '/dashboard',
      icon: 'solar:home-2-bold-duotone',
      section: 'overview',
      order: 1,
    },
  ],
};
```

### @app/user

```typescript
// packages/features/user/src/plugin.ts

export const userPlugin: Plugin = {
  id: 'user',
  name: 'User Management',
  version: '1.0.0',
  type: 'full',
  routes: [
    {
      path: '/user/list',
      component: UserListPage,
      protected: true,
    },
    {
      path: '/user/:id',
      component: UserDetailPage,
      protected: true,
    },
  ],
  navigation: [
    {
      id: 'user',
      title: 'Users',
      path: '/user/list',
      icon: 'solar:users-group-rounded-bold-duotone',
      section: 'management',
      roles: ['admin'],
    },
  ],
  apis: [
    {
      endpoint: '/api/v1/users',
      method: 'GET',
      handler: listUsers,
    },
  ],
};
```

---

## 🔄 Migration Strategy

### Phase 1: Setup Monorepo (Week 1)

1. ✅ Create workspace structure
2. ✅ Setup Turborepo
3. ✅ Create core packages (@app/types, @app/config)
4. ✅ Update tsconfig paths

### Phase 2: Extract Core (Week 2)

1. ✅ Move types to @app/types
2. ✅ Move config to @app/config
3. ✅ Move utils to @app/utils
4. ✅ Move components to @app/components

### Phase 3: Extract Features (Weeks 3-5)

1. ✅ Extract @app/auth
2. ✅ Extract @app/dashboard
3. ✅ Extract @app/user
4. ✅ Extract @app/product
5. ✅ Extract remaining features (15+)

### Phase 4: Auto-Discovery (Week 6)

1. ✅ Implement plugin loader
2. ✅ Auto-register packages
3. ✅ Dynamic route registration
4. ✅ Test all features

### Phase 5: Polish (Week 7)

1. ✅ Documentation
2. ✅ Examples
3. ✅ CI/CD updates
4. ✅ Performance optimization

---

## 📊 Benefits

### Before (Monolith)

```
src/
├── sections/
│   ├── auth/
│   ├── dashboard/
│   ├── user/
│   └── ... (everything mixed)
└── app/
    └── ... (all routes together)
```

### After (Monorepo)

```
packages/
├── core/
│   ├── types/
│   ├── config/
│   └── components/
└── features/
    ├── auth/          # Self-contained
    ├── dashboard/     # Self-contained
    └── user/          # Self-contained
```

**Benefits:**

- ✅ **Modularity** - Each feature is independent
- ✅ **Testability** - Test packages in isolation
- ✅ **Scalability** - Add/remove features easily
- ✅ **Team Collaboration** - Teams own packages
- ✅ **Build Performance** - Parallel builds with Turbo
- ✅ **Code Reuse** - Shared packages
- ✅ **Plugin Architecture** - Already integrated!

---

## 🎓 Next Steps

1. **Read this document** - Understand the structure
2. **Review MONOREPO_RECOMMENDATIONS.md** - Implementation plan
3. **Setup Turborepo locally** - Initialize workspace
4. **Start with Phase 1** - Create structure
5. **Extract one feature** - Test the pattern

**Ready to transform your monolith into a modular monorepo!** 🚀
