# Plugin CLI Guide

Complete guide for the plugin generator CLI tool.

## Overview

The Plugin CLI (`create-plugin`) is a command-line tool that generates complete plugin starter templates with best practices built-in.

## Installation

The CLI is already included in your project at `scripts/create-plugin.js`.

Add to `package.json`:

```json
{
  "scripts": {
    "create-plugin": "node scripts/create-plugin.js"
  }
}
```

## Usage

### Basic Usage

```bash
# Interactive mode
npm run create-plugin
# or
pnpm create-plugin

# With plugin name
npm run create-plugin my-awesome-plugin
# or
pnpm create-plugin my-awesome-plugin
```

### Interactive Prompts

The CLI will ask you:

1. **Plugin ID** - Unique identifier (e.g., `my-awesome-plugin`)
2. **Plugin Name** - Display name (e.g., `My Awesome Plugin`)
3. **Description** - Brief description
4. **Author** - Your name or team
5. **Features**:
   - Page routes? (y/n)
   - API routes? (y/n)
   - Navigation items? (y/n)
   - Components? (y/n)
   - React hooks? (y/n)
   - Event system? (y/n)

### Example Session

```bash
$ pnpm create-plugin

🚀 Plugin Generator

Plugin ID (e.g., my-awesome-plugin): analytics
Plugin Name (Analytics Plugin): Analytics Dashboard
Description: Real-time analytics and reporting
Author: Your Team

📦 Select features to include:
Include page routes? (y/n): y
Include API routes? (y/n): y
Include navigation items? (y/n): y
Include components? (y/n): y
Include React hooks? (y/n): y
Include event system? (y/n): y

✨ Creating plugin at: /packages/features/analytics

✅ Plugin created successfully!

📁 Files created:
   /packages/features/analytics/plugin.json
   /packages/features/analytics/index.ts
   /packages/features/analytics/package.json
   /packages/features/analytics/tsconfig.json
   /packages/features/analytics/README.md
   /packages/features/analytics/components/ExampleComponent.tsx
   /packages/features/analytics/hooks/useAnalytics.ts
   /packages/features/analytics/api/handlers.ts
   /packages/features/analytics/types/index.ts

🎯 Next steps:

1. Review and customize: /packages/features/analytics
2. Register plugin in: packages/core/config/src/config-manager.ts
3. Create page routes in: src/app/analytics/
4. Create API routes in: src/app/api/analytics/
5. Install dependencies: pnpm install
6. Start dev server: pnpm dev

📚 Documentation: docs/PLUGIN_SYSTEM_GUIDE.md
```

## Generated Structure

### Full Feature Plugin

When all features are enabled, the CLI generates:

```
packages/features/my-plugin/
├── plugin.json              # Plugin manifest
├── index.ts                 # Main plugin file
├── package.json             # Package config
├── tsconfig.json            # TypeScript config
├── README.md                # Documentation
├── components/
│   └── ExampleComponent.tsx # Example component
├── hooks/
│   └── useMyPlugin.ts       # Custom React hook
├── api/
│   └── handlers.ts          # API route handlers
├── types/
│   └── index.ts             # TypeScript types
└── utils/                   # Utility functions (empty)
```

### Minimal Plugin

With no features selected:

```
packages/features/my-plugin/
├── plugin.json
├── index.ts
├── package.json
├── tsconfig.json
├── README.md
└── types/
    └── index.ts
```

## Generated Files

### plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My plugin functionality",
  "author": "Your Team",
  "license": "MIT",
  "enabled": true,
  "autoLoad": true,
  "priority": 0,
  "routes": [...],
  "navigation": [...],
  "components": [...],
  "hooks": [...],
  "config": {
    "enabled": true,
    "debug": false
  }
}
```

### index.ts

```typescript
import type { Plugin } from '@app/config/types';
import { apiRegistry, hookRegistry } from '@app/config/registry';
import ExampleComponent from './components/ExampleComponent';
import { registerApiRoutes } from './api/handlers';

export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  routes: [...],
  navigation: [...],
  components: { ExampleComponent },

  hooks: {
    definitions: [...],

    onInit: async () => {
      console.log('[My Plugin] Initializing...');
      registerApiRoutes('my-plugin');
      hookRegistry.subscribe('app.ready', () => {
        console.log('[My Plugin] App is ready');
      }, 'my-plugin');
    },

    onLoad: async () => {
      console.log('[My Plugin] Loaded');
    },

    onUnload: () => {
      console.log('[My Plugin] Unloading...');
      apiRegistry.unregisterPluginRoutes('my-plugin');
    },

    onDestroy: () => {
      console.log('[My Plugin] Destroyed');
    },

    onError: (error: Error) => {
      console.error('[My Plugin] Error:', error);
    }
  }
};

export default myPlugin;
```

### components/ExampleComponent.tsx

```typescript
'use client';

export default function ExampleComponent() {
  return (
    <div style={{ padding: '20px', border: '1px solid #ddd' }}>
      <h3>My Plugin Component</h3>
      <p>This is an example component.</p>
      <button onClick={() => alert('Hello!')}>
        Click Me
      </button>
    </div>
  );
}
```

### hooks/useMyPlugin.ts

```typescript
'use client';

import { useState, useEffect } from 'react';

export function useMyPlugin() {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    setData('Hello from my-plugin!');
  }, []);

  return data;
}

export default useMyPlugin;
```

### api/handlers.ts

```typescript
import { apiRegistry } from '@app/config/registry';

export function registerApiRoutes(pluginId: string) {
  // GET endpoint
  apiRegistry.registerRoute({
    id: `${pluginId}.get`,
    path: `/api/${pluginId}`,
    method: 'GET',
    handler: async (req, res) => {
      res.status(200).json({
        message: 'Hello from API',
        timestamp: Date.now()
      });
    },
    pluginId,
    tags: [pluginId]
  });

  // POST endpoint
  apiRegistry.registerRoute({
    id: `${pluginId}.create`,
    path: `/api/${pluginId}`,
    method: 'POST',
    handler: async (req, res) => {
      const body = await req.json();
      res.status(201).json({ data: body });
    },
    pluginId,
    tags: [pluginId]
  });
}
```

### types/index.ts

```typescript
export interface MyPluginConfig {
  enabled: boolean;
  debug?: boolean;
}

export interface MyPluginData {
  id: string;
  name: string;
  createdAt: Date;
}
```

### README.md

Complete documentation with:
- Features list
- Installation instructions
- Configuration guide
- Usage examples
- API endpoints
- Development commands

## After Generation

### 1. Register the Plugin

Edit `packages/core/config/src/config-manager.ts`:

```typescript
import { myPlugin } from '@features/my-plugin';

const defaultConfig: AppConfig = {
  plugins: [
    myPlugin,
    // ... other plugins
  ]
};
```

### 2. Create Page Routes (if enabled)

Create `src/app/my-plugin/page.tsx`:

```typescript
export default function MyPluginPage() {
  return (
    <div>
      <h1>My Plugin</h1>
      <p>Welcome to my plugin!</p>
    </div>
  );
}
```

### 3. Create API Routes (if enabled)

Create `src/app/api/my-plugin/route.ts`:

```typescript
import { apiRegistry } from '@app/config/registry';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const route = apiRegistry.getRouteByPath('/api/my-plugin', 'GET');
  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => NextResponse.json(data, { status: code })
    })
  };

  return await route.handler(request, mockRes);
}

export async function POST(request: NextRequest) {
  const route = apiRegistry.getRouteByPath('/api/my-plugin', 'POST');
  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => NextResponse.json(data, { status: code })
    })
  };

  return await route.handler(request, mockRes);
}
```

### 4. Install and Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Visit your plugin
# Page: http://localhost:3000/my-plugin
# API: http://localhost:3000/api/my-plugin
```

## CLI Options

### Plugin ID Rules

- Must contain only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Examples: `my-plugin`, `analytics-dashboard`, `user-management`

### Feature Selection

Each feature adds specific files and configuration:

| Feature | Adds |
|---------|------|
| Page routes | Route config in plugin.json, route definition in index.ts |
| API routes | `api/handlers.ts`, API route registrations |
| Navigation | Navigation config in plugin.json, nav items in index.ts |
| Components | `components/ExampleComponent.tsx`, component registration |
| React hooks | `hooks/usePluginName.ts`, custom hook examples |
| Event system | Hook definitions, event subscriptions in index.ts |

## Best Practices

### 1. Use Descriptive Names

```bash
# Good
analytics-dashboard
user-management
payment-processing

# Bad
plugin1
my-plugin
test
```

### 2. Enable Only Needed Features

Don't include features you won't use - keep it lean.

### 3. Customize After Generation

The generated code is a starting point. Customize it for your needs:
- Update descriptions
- Add more components
- Implement real logic
- Add tests

### 4. Follow Naming Conventions

The CLI follows these conventions:
- Plugin ID: `kebab-case`
- Plugin variable: `camelCase` (e.g., `myPlugin`)
- Component names: `PascalCase` (e.g., `ExampleComponent`)
- Hook names: `camelCase` with `use` prefix (e.g., `useMyPlugin`)

### 5. Update Documentation

Always update the generated README.md with:
- Real usage examples
- Configuration options
- API documentation
- Development notes

## Troubleshooting

### Plugin Already Exists

```
❌ Plugin "my-plugin" already exists at /packages/features/my-plugin
```

**Solution**: Choose a different plugin ID or remove the existing plugin.

### Invalid Plugin ID

```
❌ Plugin ID must contain only lowercase letters, numbers, and hyphens
```

**Solution**: Use only `a-z`, `0-9`, and `-` characters.

### Permission Denied

```
❌ Permission denied
```

**Solution**: Make script executable:
```bash
chmod +x scripts/create-plugin.js
```

## Advanced Usage

### Programmatic Usage

Use the CLI in your own scripts:

```javascript
const { execSync } = require('child_process');

// Generate plugin programmatically
execSync('node scripts/create-plugin.js my-new-plugin', {
  stdio: 'inherit'
});
```

### Custom Templates

To customize templates, edit `scripts/create-plugin.js`:

- `generatePluginJson()` - Modify plugin.json template
- `generateIndexTs()` - Modify index.ts template
- `generateExampleComponent()` - Modify component template
- Add new generators for additional files

## Examples

### Analytics Plugin

```bash
$ pnpm create-plugin analytics

Plugin ID: analytics
Plugin Name: Analytics Plugin
Description: Real-time analytics and reporting
Author: Analytics Team

Include page routes? y
Include API routes? y
Include navigation items? y
Include components? y
Include React hooks? y
Include event system? y
```

### API-Only Plugin

```bash
$ pnpm create-plugin weather-api

Plugin ID: weather-api
Plugin Name: Weather API
Description: Weather data API endpoints
Author: API Team

Include page routes? n
Include API routes? y
Include navigation items? n
Include components? n
Include React hooks? n
Include event system? n
```

### Component Library Plugin

```bash
$ pnpm create-plugin ui-components

Plugin ID: ui-components
Plugin Name: UI Components
Description: Reusable UI component library
Author: Design Team

Include page routes? n
Include API routes? n
Include navigation items? n
Include components? y
Include React hooks? y
Include event system? n
```

## Summary

The Plugin CLI provides:

- ✅ **Interactive generation** - Guided prompts
- ✅ **Feature selection** - Choose what you need
- ✅ **Best practices** - Pre-configured structure
- ✅ **Complete templates** - Ready to customize
- ✅ **TypeScript support** - Full type safety
- ✅ **Documentation** - Auto-generated README

Create plugins in seconds, not hours! 🚀

## Next Steps

1. **Generate a plugin**: `pnpm create-plugin`
2. **Customize it**: Edit generated files
3. **Register it**: Add to config-manager
4. **Build features**: Implement your logic
5. **Ship it**: Deploy with confidence

Happy coding! 🎉
