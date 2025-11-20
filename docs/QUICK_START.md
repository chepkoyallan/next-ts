# Quick Start Guide

Get up and running with the plugin system in 5 minutes.

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Basic React and TypeScript knowledge

## Installation

The plugin system is already integrated into your Next.js application. No installation needed!

## Your First Plugin in 5 Steps

### Step 1: Create Plugin Directory

```bash
mkdir -p packages/features/hello-world
cd packages/features/hello-world
```

### Step 2: Create plugin.json

```json
{
  "id": "hello-world",
  "name": "Hello World Plugin",
  "version": "1.0.0",
  "description": "My first plugin",
  "enabled": true,
  "routes": [
    {
      "id": "hello",
      "path": "/hello",
      "layout": "default"
    }
  ],
  "navigation": [
    {
      "id": "hello-nav",
      "title": "Hello World",
      "path": "/hello",
      "icon": "👋"
    }
  ]
}
```

### Step 3: Create index.ts

```typescript
import type { Plugin } from '@app/config/types';

export const helloWorldPlugin: Plugin = {
  id: 'hello-world',
  name: 'Hello World Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    onInit: () => {
      console.log('✅ Hello World Plugin loaded!');
    }
  }
};
```

### Step 4: Register Plugin

Edit `packages/core/config/src/config-manager.ts`:

```typescript
import { helloWorldPlugin } from '@features/hello-world';

const defaultConfig: AppConfig = {
  // ... other config
  plugins: [
    helloWorldPlugin,
    // ... other plugins
  ]
};
```

### Step 5: Create Page

Create `src/app/hello/page.tsx`:

```typescript
export default function HelloPage() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>🎉 Hello World!</h1>
      <p>Your first plugin is working!</p>
    </div>
  );
}
```

### Test It!

1. Start dev server: `pnpm dev`
2. Visit: `http://localhost:3000/hello`
3. See "Hello World!" page
4. Check console for "Hello World Plugin loaded!"

## What's Next?

### Add Event Communication

Update your plugin to emit events:

```typescript
import { hookRegistry } from '@app/config/registry';

export const helloWorldPlugin: Plugin = {
  id: 'hello-world',
  name: 'Hello World Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    definitions: [
      { name: 'hello.greeting', description: 'Someone said hello' }
    ],

    onInit: () => {
      console.log('✅ Hello World Plugin loaded!');

      // Subscribe to events from other plugins
      hookRegistry.subscribe('user.login', (user) => {
        console.log(`Hello, ${user.name}!`);
      }, 'hello-world');
    }
  }
};
```

Update your page to emit events:

```typescript
'use client';

import { hookRegistry } from '@app/config/registry';

export default function HelloPage() {
  const sayHello = async () => {
    await hookRegistry.emit('hello.greeting', {
      message: 'Hello!',
      timestamp: Date.now()
    });
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h1>🎉 Hello World!</h1>
      <button onClick={sayHello}>Say Hello</button>
    </div>
  );
}
```

### Use React Hooks

Access registries easily in React components:

```typescript
'use client';

import { useRoutes, useNavigation, useHooks } from '@app/config/registry';

export default function DashboardPage() {
  const routes = useRoutes();
  const navigation = useNavigation();
  const hooks = useHooks();

  return (
    <div>
      <h2>Routes: {routes.length}</h2>
      <h2>Navigation Items: {navigation.length}</h2>
      <h2>Available Hooks: {hooks.length}</h2>
    </div>
  );
}
```

### Add Components

Register reusable components:

```typescript
// components/HelloWidget.tsx
export function HelloWidget() {
  return <div>Hello Widget!</div>;
}

// index.ts
import { HelloWidget } from './components/HelloWidget';

export const helloWorldPlugin: Plugin = {
  // ... other config
  components: {
    HelloWidget
  }
};
```

Use them anywhere:

```typescript
import { useComponent } from '@app/config/registry';

function MyPage() {
  const HelloWidget = useComponent('hello-world.HelloWidget');

  return HelloWidget ? <HelloWidget /> : null;
}
```

## Common Patterns

### 1. Protected Route

```json
{
  "routes": [
    {
      "id": "admin-panel",
      "path": "/admin",
      "protected": true,
      "roles": ["admin"]
    }
  ]
}
```

### 2. Nested Navigation

```json
{
  "navigation": [
    {
      "id": "settings",
      "title": "Settings",
      "icon": "⚙️"
    },
    {
      "id": "profile-settings",
      "title": "Profile",
      "path": "/settings/profile",
      "parent": "settings"
    }
  ]
}
```

### 3. Component Override

```typescript
import { componentRegistry } from '@app/config/registry';
import MyCustomButton from './MyCustomButton';

export const themePlugin: Plugin = {
  // ... config
  hooks: {
    onInit: () => {
      componentRegistry.registerOverride({
        componentId: 'Button',
        component: MyCustomButton,
        pluginId: 'theme-plugin',
        priority: 10
      });
    }
  }
};
```

### 4. Subscribe to Events

```typescript
export const analyticsPlugin: Plugin = {
  // ... config
  hooks: {
    onInit: () => {
      // Track all page views
      hookRegistry.subscribe('router.navigate', (data) => {
        console.log('Page view:', data.path);
      }, 'analytics-plugin');

      // Track user actions
      hookRegistry.subscribe('user.login', (user) => {
        console.log('User logged in:', user);
      }, 'analytics-plugin');
    }
  }
};
```

### 5. Plugin Dependencies

```json
{
  "dependencies": [
    {
      "id": "auth-plugin",
      "version": "1.0.0",
      "optional": false
    },
    {
      "id": "theme-plugin",
      "optional": true
    }
  ]
}
```

## Examples to Learn From

### 1. View Live Examples

- **Route Registry**: http://localhost:3000/registry-test
- **Hook System**: http://localhost:3000/registry-phase3-test

### 2. Study Example Plugin

Check out `packages/features/example-analytics/`:
- Complete plugin.json manifest
- Hook definitions and subscriptions
- Component registration
- README with examples

### 3. Explore Existing Plugins

Look at existing feature packages:
```bash
ls packages/features/
```

Each package is a plugin you can learn from.

## CLI Commands

```bash
# Start dev server
pnpm dev

# Type check
pnpm type-check

# Build for production
pnpm build

# Run tests (if configured)
pnpm test
```

## Debugging Tips

### 1. Check Plugin Loaded

```typescript
import { pluginManager } from '@app/config/plugins';

const plugins = pluginManager.getLoadedPlugins();
console.log('Loaded plugins:', plugins);
```

### 2. Check Registry Stats

```typescript
import {
  routeRegistry,
  navigationRegistry,
  componentRegistry,
  hookRegistry
} from '@app/config/registry';

console.log('Stats:', {
  routes: routeRegistry.getStats(),
  navigation: navigationRegistry.getStats(),
  components: componentRegistry.getStats(),
  hooks: hookRegistry.getStats()
});
```

### 3. List Available Hooks

```typescript
const hooks = hookRegistry.getHooks();
console.log('Available hooks:', hooks);
```

### 4. Check Subscriptions

```typescript
const subs = hookRegistry.getSubscriptions('hook-name');
console.log('Subscribers:', subs);
```

## Common Issues

### Plugin Not Loading

**Problem**: Plugin doesn't appear

**Solution**:
1. Check `enabled: true` in plugin definition
2. Verify plugin is in config-manager
3. Check console for errors
4. Restart dev server

### Route Not Working

**Problem**: Route gives 404

**Solution**:
1. Verify route path matches file in `src/app/`
2. Check route is enabled
3. If protected, check user has required roles
4. Clear `.next` cache and restart

### Events Not Firing

**Problem**: Hook subscribers not called

**Solution**:
1. Verify hook is defined: `hookRegistry.hasHook('hook-name')`
2. Check subscriptions: `hookRegistry.getSubscriptions('hook-name')`
3. Use `await` when emitting: `await hookRegistry.emit(...)`
4. Check filter conditions if used

## Next Steps

1. **Read Full Guide**: [docs/PLUGIN_SYSTEM_GUIDE.md](./PLUGIN_SYSTEM_GUIDE.md)
2. **API Reference**: [docs/API_REFERENCE.md](./API_REFERENCE.md)
3. **Example Plugin**: `packages/features/example-analytics/`
4. **Build Your Plugin**: Start adding features!

## Get Help

- Check documentation in `docs/`
- Review example plugins in `packages/features/`
- Look at test pages: `/registry-test`, `/registry-phase3-test`
- Check browser console for debug logs

## Congratulations!

You've created your first plugin! 🎉

The plugin system gives you:
- ✅ Dynamic route registration
- ✅ Dynamic navigation menus
- ✅ Component discovery and override
- ✅ Event-driven communication
- ✅ Provider composition
- ✅ JSON-based configuration
- ✅ Dependency management
- ✅ React hooks for easy access

Start building modular, maintainable features today!
