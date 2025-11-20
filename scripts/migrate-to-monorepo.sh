#!/bin/bash
# Monorepo Migration Script
# Automates the transformation from monolith to monorepo
# ----------------------------------------------------------------------

set -e  # Exit on error

echo "🚀 Starting Monorepo Migration..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create workspace structure
echo -e "${BLUE}Step 1: Creating workspace structure...${NC}"

mkdir -p packages/core
mkdir -p packages/features
mkdir -p packages/integrations
mkdir -p apps/web

echo -e "${GREEN}✓ Workspace structure created${NC}"
echo ""

# Step 2: Initialize root package.json
echo -e "${BLUE}Step 2: Initializing root package.json...${NC}"

cat > package.json << 'EOF'
{
  "name": "next-ts-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "packages/core/*",
    "packages/features/*",
    "packages/integrations/*",
    "apps/*"
  ],
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
EOF

echo -e "${GREEN}✓ Root package.json created${NC}"
echo ""

# Step 3: Create pnpm-workspace.yaml
echo -e "${BLUE}Step 3: Creating pnpm-workspace.yaml...${NC}"

cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/core/*'
  - 'packages/features/*'
  - 'packages/integrations/*'
  - 'apps/*'
EOF

echo -e "${GREEN}✓ pnpm-workspace.yaml created${NC}"
echo ""

# Step 4: Create turbo.json
echo -e "${BLUE}Step 4: Creating turbo.json...${NC}"

cat > turbo.json << 'EOF'
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
EOF

echo -e "${GREEN}✓ turbo.json created${NC}"
echo ""

# Step 5: Create package template function
create_package() {
  local PACKAGE_NAME=$1
  local PACKAGE_PATH=$2
  local PACKAGE_DESCRIPTION=$3

  echo -e "${BLUE}Creating package: @app/${PACKAGE_NAME}...${NC}"

  mkdir -p "$PACKAGE_PATH/src"

  # Create package.json
  cat > "$PACKAGE_PATH/package.json" << EOF
{
  "name": "@app/${PACKAGE_NAME}",
  "version": "1.0.0",
  "private": true,
  "description": "${PACKAGE_DESCRIPTION}",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@app/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "keywords": ["${PACKAGE_NAME}"],
  "license": "MIT"
}
EOF

  # Create tsconfig.json
  cat > "$PACKAGE_PATH/tsconfig.json" << 'EOF'
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

  # Create index.ts
  cat > "$PACKAGE_PATH/src/index.ts" << EOF
// ${PACKAGE_NAME} package
export {};
EOF

  # Create README.md
  cat > "$PACKAGE_PATH/README.md" << EOF
# @app/${PACKAGE_NAME}

${PACKAGE_DESCRIPTION}

## Installation

This package is part of the monorepo and is automatically linked via workspace.

## Usage

\`\`\`typescript
import { } from '@app/${PACKAGE_NAME}';
\`\`\`

## License

MIT
EOF

  echo -e "${GREEN}✓ Package @app/${PACKAGE_NAME} created${NC}"
}

# Step 6: Create core packages
echo ""
echo -e "${BLUE}Step 6: Creating core packages...${NC}"

create_package "types" "packages/core/types" "Shared TypeScript types and interfaces"
create_package "config" "packages/core/config" "Configuration management system"
create_package "utils" "packages/core/utils" "Shared utility functions"
create_package "hooks" "packages/core/hooks" "Shared React hooks"
create_package "components" "packages/core/components" "Shared UI components"
create_package "theme" "packages/core/theme" "Theme and styling system"

echo -e "${GREEN}✓ Core packages created${NC}"
echo ""

# Step 7: Create feature packages (examples)
echo -e "${BLUE}Step 7: Creating feature packages...${NC}"

FEATURES=(
  "auth:Authentication and authorization"
  "dashboard:Main dashboard and overview"
  "user:User management"
  "product:Product management"
  "blog:Blog and content management"
  "mail:Email client"
  "chat:Real-time chat"
  "kanban:Kanban board"
  "calendar:Calendar and events"
  "invoice:Invoice management"
)

for feature in "${FEATURES[@]}"; do
  IFS=':' read -r name description <<< "$feature"
  create_package "$name" "packages/features/$name" "$description"
done

echo -e "${GREEN}✓ Feature packages created${NC}"
echo ""

# Step 8: Create plugin loader
echo -e "${BLUE}Step 8: Creating plugin loader...${NC}"

mkdir -p apps/web/src/lib

cat > apps/web/src/lib/plugin-loader.ts << 'EOF'
import { pluginManager } from '@app/config';

/**
 * Auto-discover and register all feature packages as plugins
 */
export async function loadPackages() {
  console.log('🔌 Loading packages...');

  // List of feature packages to load
  const features = [
    'auth',
    'dashboard',
    'user',
    'product',
    'blog',
    'mail',
    'chat',
    'kanban',
    'calendar',
    'invoice',
  ];

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
      console.warn(`⚠️  Failed to load @app/${feature}`);
    }
  }

  console.log('✅ All packages loaded');
}
EOF

echo -e "${GREEN}✓ Plugin loader created${NC}"
echo ""

# Step 9: Create example plugin
echo -e "${BLUE}Step 9: Creating example plugin...${NC}"

mkdir -p packages/features/auth/src

cat > packages/features/auth/src/plugin.ts << 'EOF'
import type { Plugin } from '@app/types';

export const authPlugin: Plugin = {
  id: 'auth',
  name: 'Authentication',
  version: '1.0.0',
  description: 'User authentication and session management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [],
  navigation: [],
  components: {},

  hooks: {
    onInit: async () => {
      console.log('[Auth Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['auth', 'security'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: true,
};

export default authPlugin;
EOF

cat > packages/features/auth/src/index.ts << 'EOF'
export { authPlugin } from './plugin';
export * from './plugin';
EOF

echo -e "${GREEN}✓ Example plugin created${NC}"
echo ""

# Step 10: Create migration guide
echo -e "${BLUE}Step 10: Creating migration guide...${NC}"

cat > MIGRATION_CHECKLIST.md << 'EOF'
# Migration Checklist

## Phase 1: Setup ✅
- [x] Create workspace structure
- [x] Setup Turborepo
- [x] Create pnpm-workspace.yaml
- [x] Initialize core packages

## Phase 2: Move Types
- [ ] Copy src/config/types.ts → packages/core/types/src/
- [ ] Update imports in all files
- [ ] Test type checking

## Phase 3: Move Config
- [ ] Copy src/config/* → packages/core/config/src/
- [ ] Copy src/plugins/* → packages/core/config/src/plugins/
- [ ] Update imports

## Phase 4: Move Components
- [ ] Copy src/components/* → packages/core/components/src/
- [ ] Update imports
- [ ] Test rendering

## Phase 5: Extract Features
- [ ] Auth: src/sections/auth → packages/features/auth
- [ ] Dashboard: src/sections/dashboard → packages/features/dashboard
- [ ] User: src/sections/user → packages/features/user
- [ ] Product: src/sections/product → packages/features/product
- [ ] (Continue for all features...)

## Phase 6: Update Routes
- [ ] Move src/app/(dashboard) routes to feature packages
- [ ] Update route imports
- [ ] Test routing

## Phase 7: Plugin Registration
- [ ] Create plugin.ts for each feature
- [ ] Register with plugin manager
- [ ] Test auto-discovery

## Phase 8: Testing
- [ ] Test all features work
- [ ] Test builds
- [ ] Test development mode
- [ ] Update CI/CD

## Phase 9: Documentation
- [ ] Update README
- [ ] Document package structure
- [ ] Create contribution guide

## Phase 10: Cleanup
- [ ] Remove old src/sections
- [ ] Remove old src/app routes
- [ ] Clean up unused files
EOF

echo -e "${GREEN}✓ Migration guide created${NC}"
echo ""

# Final message
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Monorepo structure initialized successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Install dependencies: pnpm install"
echo "2. Review MIGRATION_CHECKLIST.md"
echo "3. Start migrating files according to the checklist"
echo "4. Test with: pnpm dev"
echo ""
echo -e "${YELLOW}📦 Packages created:${NC}"
echo "  - 6 core packages (types, config, utils, hooks, components, theme)"
echo "  - 10 feature packages (auth, dashboard, user, etc.)"
echo "  - Plugin loader system"
echo "  - Example auth plugin"
echo ""
echo -e "${BLUE}Happy refactoring! 🚀${NC}"
