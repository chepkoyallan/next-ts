# Complete Plugin System Guide

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Registry System](#registry-system)
4. [Creating Plugins](#creating-plugins)
5. [Plugin Manifest](#plugin-manifest)
6. [Hook System (Events)](#hook-system-events)
7. [React Hooks API](#react-hooks-api)
8. [Examples](#examples)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This plugin system enables you to build a fully modular Next.js application where features can be:

- ✅ Loaded/unloaded at runtime
- ✅ Configured via JSON manifests
- ✅ Communicate through events
- ✅ Register routes, navigation, components dynamically
- ✅ Manage dependencies between plugins
- ✅ Override components from other plugins

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Your Application                         │
│         (Uses React hooks to access registries)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Registry System                           │
│  • RouteRegistry      - Dynamic routes                   │
│  • NavigationRegistry - Dynamic menus                    │
│  • ComponentRegistry  - Component discovery              │
│  • ProviderRegistry   - Context provider composition     │
│  • HookRegistry       - Event-driven communication       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Plugin Manager                              │
│  • Loads plugins from packages/features/                 │
│  • Parses plugin.json manifests                          │
│  • Registers resources to registries                     │
│  • Manages plugin lifecycle                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Feature Plugins                          │
│         (packages/features/your-plugin/)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Create a New Plugin

Create a new directory in `packages/features/`:

```bash
mkdir -p packages/features/my-awesome-plugin
cd packages/features/my-awesome-plugin
```

### 2. Create plugin.json

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "Does awesome things",
  "enabled": true,
  "autoLoad": true,
  "routes": [
    {
      "id": "awesome-dashboard",
      "path": "/awesome",
      "layout": "dashboard",
      "protected": true
    }
  ],
  "navigation": [
    {
      "id": "awesome-nav",
      "title": "Awesome",
      "path": "/awesome",
      "icon": "star"
    }
  ],
  "hooks": [
    {
      "name": "awesome.action",
      "description": "Emitted when something awesome happens"
    }
  ]
}
```

### 3. Create Plugin Code

Create `packages/features/my-awesome-plugin/index.ts`:

```typescript
import type { Plugin } from '@app/config/types';
import { hookRegistry } from '@app/config/registry';

export const myAwesomePlugin: Plugin = {
  id: 'my-awesome-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    // Define hooks this plugin provides
    definitions: [
      { name: 'awesome.action', description: 'Something awesome happened' }
    ],

    // Called when plugin loads
    onInit: async () => {
      console.log('[MyAwesomePlugin] Initializing...');

      // Subscribe to other plugins' events
      hookRegistry.subscribe('user.login', (data) => {
        console.log('User logged in:', data);
      }, 'my-awesome-plugin');
    },

    // Called when plugin unloads
    onDestroy: () => {
      console.log('[MyAwesomePlugin] Cleaning up...');
    }
  }
};
```

### 4. Register Your Plugin

Add to `packages/core/config/src/config-manager.ts`:

```typescript
import { myAwesomePlugin } from '@features/my-awesome-plugin';

const defaultConfig: AppConfig = {
  plugins: [
    myAwesomePlugin,
    // ... other plugins
  ]
};
```

### 5. Create a Page

Create `src/app/awesome/page.tsx`:

```typescript
'use client';

import { hookRegistry } from '@app/config/registry';

export default function AwesomePage() {
  const handleAction = async () => {
    await hookRegistry.emit('awesome.action', {
      message: 'Something awesome happened!',
      timestamp: Date.now()
    });
  };

  return (
    <div>
      <h1>Awesome Plugin Page</h1>
      <button onClick={handleAction}>Do Something Awesome</button>
    </div>
  );
}
```

That's it! Your plugin is now active.

---

## Registry System

The registry system provides five core registries for managing different aspects of your application.

### RouteRegistry

Manages dynamic routes with role-based access control.

```typescript
import { routeRegistry } from '@app/config/registry';

// Register a route
routeRegistry.registerRoute({
  id: 'my-route',
  path: '/my-page',
  layout: 'dashboard',
  pluginId: 'my-plugin',
  protected: true,
  roles: ['admin', 'user'],
  priority: 10,
  metadata: {
    title: 'My Page',
    description: 'This is my page'
  }
});

// Get all enabled routes
const routes = routeRegistry.getEnabledRoutes();

// Check access
const hasAccess = routeRegistry.hasAccess('my-route', ['admin']);

// Get routes by layout
const dashboardRoutes = routeRegistry.getRoutesByLayout('dashboard');
```

### NavigationRegistry

Manages dynamic navigation menus with hierarchical structure.

```typescript
import { navigationRegistry } from '@app/config/registry';

// Register a navigation item
navigationRegistry.registerItem({
  id: 'my-nav',
  title: 'My Page',
  path: '/my-page',
  icon: 'home',
  pluginId: 'my-plugin',
  section: 'main',
  order: 10,
  roles: ['admin'],
  badge: { text: 'New', color: 'blue' }
});

// Build navigation tree
const tree = navigationRegistry.buildTree();

// Get navigation by section
const sections = navigationRegistry.getNavigationBySection();

// Get items for user
const userNav = navigationRegistry.getItemsForUser(['admin']);
```

### ComponentRegistry

Manages component discovery and override system.

```typescript
import { componentRegistry } from '@app/config/registry';
import MyComponent from './MyComponent';

// Register a component
componentRegistry.registerComponent({
  id: 'my-component',
  name: 'MyComponent',
  component: MyComponent,
  pluginId: 'my-plugin',
  category: 'widgets',
  tags: ['dashboard', 'analytics'],
  description: 'My awesome component'
});

// Get component (with overrides applied)
const Component = componentRegistry.getComponent('my-component');

// Override a component
componentRegistry.registerOverride({
  componentId: 'existing-component',
  component: MyBetterComponent,
  pluginId: 'my-plugin',
  priority: 10,
  condition: () => true // Optional condition
});

// Search components
const results = componentRegistry.searchComponents('analytics');

// Get by category
const widgets = componentRegistry.getComponentsByCategory('widgets');
```

### ProviderRegistry

Manages React context provider composition with dependency resolution.

```typescript
import { providerRegistry } from '@app/config/registry';
import MyProvider from './MyProvider';

// Register a provider
providerRegistry.registerProvider({
  id: 'my-provider',
  component: MyProvider,
  pluginId: 'my-plugin',
  order: 5,
  dependencies: ['theme-provider', 'auth-provider']
});

// Get composed provider tree
const providers = providerRegistry.composeProviders(children);

// Get enabled providers (sorted by dependencies)
const enabledProviders = providerRegistry.getEnabledProviders();
```

### HookRegistry

Event-driven communication system for cross-plugin interaction.

```typescript
import { hookRegistry } from '@app/config/registry';

// Define a hook
hookRegistry.defineHook('user.login', 'auth-plugin', 'User logged in');

// Subscribe to a hook
const subscriptionId = hookRegistry.subscribe(
  'user.login',
  async (data) => {
    console.log('User logged in:', data);
  },
  'my-plugin',
  { priority: 10 }
);

// Emit a hook (parallel execution)
await hookRegistry.emit('user.login', {
  userId: 123,
  email: 'user@example.com'
});

// Emit sequential (runs subscribers in priority order)
await hookRegistry.emitSequential('user.login', data);

// Unsubscribe
hookRegistry.unsubscribe(subscriptionId);
```

---

## Creating Plugins

### Plugin Structure

```
packages/features/my-plugin/
├── plugin.json          # Plugin manifest
├── index.ts            # Main plugin file
├── components/         # React components
│   └── MyComponent.tsx
├── hooks/              # React hooks
│   └── useMyFeature.ts
├── utils/              # Utility functions
│   └── helpers.ts
├── types/              # TypeScript types
│   └── index.ts
├── package.json        # Package dependencies
└── README.md          # Documentation
```

### Plugin Interface

```typescript
import type { Plugin } from '@app/config/types';

export interface Plugin {
  // Required
  id: string;
  name: string;
  version: string;
  enabled: boolean;

  // Optional
  description?: string;
  author?: string;
  priority?: number;

  // Resources
  routes?: RouteDefinition[];
  navigation?: NavigationItem[];
  components?: Record<string, React.ComponentType>;
  providers?: React.ComponentType[];

  // Lifecycle hooks
  hooks?: {
    definitions?: Array<{ name: string; description?: string }>;
    onInit?: () => void | Promise<void>;
    onLoad?: () => void | Promise<void>;
    onUnload?: () => void | Promise<void>;
    onDestroy?: () => void | Promise<void>;
    onError?: (error: Error) => void;
  };

  // Configuration
  config?: Record<string, any>;
  metadata?: Record<string, any>;
}
```

### Example Plugin

```typescript
import type { Plugin } from '@app/config/types';
import { hookRegistry } from '@app/config/registry';
import AnalyticsWidget from './components/AnalyticsWidget';
import AnalyticsProvider from './providers/AnalyticsProvider';

export const analyticsPlugin: Plugin = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  enabled: true,
  description: 'Tracks user analytics',
  priority: 10,

  routes: [
    {
      id: 'analytics-dashboard',
      path: '/analytics',
      layout: 'dashboard',
      pluginId: 'analytics',
      protected: true,
      roles: ['admin', 'analyst']
    }
  ],

  navigation: [
    {
      id: 'analytics-nav',
      title: 'Analytics',
      path: '/analytics',
      icon: 'chart',
      pluginId: 'analytics',
      section: 'tools',
      order: 10,
      roles: ['admin', 'analyst']
    }
  ],

  components: {
    AnalyticsWidget,
  },

  providers: [AnalyticsProvider],

  hooks: {
    definitions: [
      { name: 'analytics.pageview', description: 'Page viewed' },
      { name: 'analytics.event', description: 'Event tracked' }
    ],

    onInit: async () => {
      console.log('[Analytics] Initializing...');

      // Subscribe to app events
      hookRegistry.subscribe('app.ready', async () => {
        console.log('[Analytics] App is ready, starting tracking');
      }, 'analytics');

      hookRegistry.subscribe('user.login', async (user) => {
        await hookRegistry.emit('analytics.event', {
          category: 'auth',
          action: 'login',
          userId: user.id
        });
      }, 'analytics');
    },

    onDestroy: () => {
      console.log('[Analytics] Cleaning up...');
    }
  },

  config: {
    trackingId: 'UA-XXXXX-Y',
    sampleRate: 100
  }
};
```

---

## Plugin Manifest

The `plugin.json` file provides declarative configuration for your plugin.

### Full Example

```json
{
  "id": "analytics-plugin",
  "name": "Analytics Plugin",
  "version": "1.0.0",
  "description": "Comprehensive analytics tracking",
  "author": {
    "name": "Your Team",
    "email": "team@example.com",
    "url": "https://example.com"
  },
  "license": "MIT",
  "homepage": "https://example.com/plugins/analytics",
  "repository": "https://github.com/example/analytics-plugin",

  "enabled": true,
  "autoLoad": true,
  "priority": 10,

  "dependencies": [
    {
      "id": "auth-plugin",
      "version": "1.0.0",
      "optional": false
    }
  ],

  "permissions": {
    "userData": true,
    "navigation": true,
    "routes": true,
    "components": true,
    "hooks": true,
    "custom": ["analytics.track", "analytics.report"]
  },

  "routes": [
    {
      "id": "analytics-dashboard",
      "path": "/analytics",
      "layout": "dashboard",
      "protected": true,
      "roles": ["admin", "analyst"],
      "priority": 5
    }
  ],

  "navigation": [
    {
      "id": "analytics-nav",
      "title": "Analytics",
      "path": "/analytics",
      "icon": "analytics",
      "section": "tools",
      "order": 10,
      "roles": ["admin", "analyst"]
    }
  ],

  "components": [
    {
      "id": "analytics-widget",
      "name": "AnalyticsWidget",
      "category": "widgets",
      "tags": ["analytics", "dashboard"]
    }
  ],

  "providers": [
    {
      "id": "analytics-provider",
      "order": 5,
      "dependencies": ["theme-provider"]
    }
  ],

  "hooks": [
    {
      "name": "analytics.pageview",
      "description": "Emitted when page is viewed"
    },
    {
      "name": "analytics.event",
      "description": "Emitted when event is tracked"
    }
  ],

  "lifecycle": {
    "onInit": "initAnalytics",
    "onLoad": "loadAnalytics",
    "onUnload": "unloadAnalytics",
    "onDestroy": "destroyAnalytics"
  },

  "features": [
    "real-time-analytics",
    "custom-events",
    "report-generation"
  ],

  "minVersion": "1.0.0",
  "maxVersion": "2.0.0",

  "config": {
    "trackingId": "UA-XXXXX-Y",
    "sampleRate": 100,
    "enableDebug": false
  },

  "metadata": {
    "category": "analytics",
    "tags": ["analytics", "tracking"],
    "featured": true
  }
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique plugin identifier |
| `name` | string | ✅ | Display name |
| `version` | string | ✅ | Semver version |
| `description` | string | ❌ | Short description |
| `author` | string/object | ❌ | Author information |
| `enabled` | boolean | ❌ | Enable/disable plugin (default: true) |
| `autoLoad` | boolean | ❌ | Load on startup (default: true) |
| `priority` | number | ❌ | Loading priority (higher = earlier) |
| `dependencies` | array | ❌ | Plugin dependencies |
| `permissions` | object | ❌ | Required permissions |
| `routes` | array | ❌ | Route definitions |
| `navigation` | array | ❌ | Navigation items |
| `components` | array | ❌ | Component registrations |
| `providers` | array | ❌ | Provider registrations |
| `hooks` | array | ❌ | Hook definitions |
| `config` | object | ❌ | Default configuration |

---

## Hook System (Events)

The hook system enables event-driven communication between plugins.

### Defining Hooks

```typescript
import { hookRegistry } from '@app/config/registry';

// Define a hook in your plugin
hookRegistry.defineHook(
  'myPlugin.event',
  'my-plugin',
  'Description of the event'
);
```

### Subscribing to Hooks

```typescript
// Basic subscription
const subId = hookRegistry.subscribe(
  'myPlugin.event',
  (data) => {
    console.log('Event received:', data);
  },
  'subscriber-plugin'
);

// With options
const subId = hookRegistry.subscribe(
  'myPlugin.event',
  async (data) => {
    // Handle async operations
    await processEvent(data);
  },
  'subscriber-plugin',
  {
    priority: 10,              // Higher priority = runs first
    filter: (data) => data.type === 'important', // Conditional
    enabled: true              // Can be toggled
  }
);

// Unsubscribe
hookRegistry.unsubscribe(subId);

// Unsubscribe all for a plugin
hookRegistry.unsubscribePlugin('my-plugin');
```

### Emitting Events

```typescript
// Parallel execution (all subscribers run at once)
await hookRegistry.emit('myPlugin.event', {
  userId: 123,
  action: 'login',
  timestamp: Date.now()
});

// Sequential execution (runs in priority order)
await hookRegistry.emitSequential('myPlugin.event', data);

// Reduce pattern (transform data through subscribers)
const result = await hookRegistry.emitReduce(
  'data.transform',
  initialData,
  (acc, result) => ({ ...acc, ...result }),
  {}
);
```

### Common Hook Patterns

#### Plugin Lifecycle

```typescript
// System hooks (automatically emitted)
hookRegistry.subscribe('plugin.loaded', (data) => {
  console.log(`Plugin ${data.pluginId} loaded`);
}, 'my-plugin');

hookRegistry.subscribe('plugin.unloading', (data) => {
  console.log(`Plugin ${data.pluginId} unloading`);
}, 'my-plugin');
```

#### User Actions

```typescript
// Auth plugin defines hooks
hookRegistry.defineHook('user.login', 'auth-plugin');
hookRegistry.defineHook('user.logout', 'auth-plugin');

// Other plugins subscribe
hookRegistry.subscribe('user.login', async (user) => {
  // Start tracking user session
  await analytics.track('user.login', user);
}, 'analytics-plugin');

hookRegistry.subscribe('user.logout', async (user) => {
  // End tracking session
  await analytics.track('user.logout', user);
}, 'analytics-plugin');
```

#### Data Transformation

```typescript
// Allow plugins to transform data
const processedData = await hookRegistry.emitReduce(
  'data.process',
  rawData,
  (acc, result) => result || acc,
  rawData
);
```

---

## React Hooks API

Use React hooks to access registries in your components.

### Route Hooks

```typescript
import {
  useRoutes,
  useRoutesByLayout,
  useProtectedRoutes,
  useRoute,
  useRouteAccess,
  useRouteStats
} from '@app/config/registry';

function MyComponent() {
  // Get all routes
  const routes = useRoutes();

  // Get dashboard routes
  const dashboardRoutes = useRoutesByLayout('dashboard');

  // Get protected routes
  const protectedRoutes = useProtectedRoutes();

  // Get single route
  const route = useRoute('my-route');

  // Check access
  const hasAccess = useRouteAccess('my-route', ['admin']);

  // Get statistics
  const stats = useRouteStats();
  // { totalRoutes, enabledRoutes, protectedRoutes, plugins }
}
```

### Navigation Hooks

```typescript
import {
  useNavigation,
  useNavigationTree,
  useNavigationBySection,
  useNavigationForUser,
  useNavigationStats
} from '@app/config/registry';

function NavigationMenu() {
  // Get all navigation items
  const items = useNavigation();

  // Get hierarchical tree
  const tree = useNavigationTree();

  // Get by section
  const sections = useNavigationBySection();

  // Get for current user
  const userNav = useNavigationForUser(['admin', 'user']);

  // Get statistics
  const stats = useNavigationStats();
}
```

### Component Hooks

```typescript
import {
  useComponent,
  useComponents,
  useComponentsByCategory,
  useComponentsByTag,
  useComponentSearch,
  useComponentStats
} from '@app/config/registry';

function ComponentBrowser() {
  // Get single component
  const Component = useComponent('my-component');

  // Get all components
  const components = useComponents();

  // Get by category
  const widgets = useComponentsByCategory('widgets');

  // Get by tag
  const dashboardComponents = useComponentsByTag('dashboard');

  // Search
  const results = useComponentSearch('analytics');

  // Get statistics
  const stats = useComponentStats();
}
```

### Hook System Hooks

```typescript
import {
  useHooks,
  useHook,
  useHookSubscription,
  useHookEmitter,
  useHookSubscriptions,
  useHookStats,
  useLifecycleHooks
} from '@app/config/registry';

function EventMonitor() {
  // Get all hooks
  const hooks = useHooks();

  // Get specific hook
  const hook = useHook('user.login');

  // Subscribe to a hook
  useHookSubscription(
    'user.login',
    (data) => console.log('User logged in:', data),
    'my-component'
  );

  // Get emitter
  const { emit, emitSequential } = useHookEmitter('my.event');

  // Get subscriptions
  const subscriptions = useHookSubscriptions('user.login');

  // Get statistics
  const stats = useHookStats();

  // Use lifecycle hooks
  useLifecycleHooks('my-component', {
    onMount: () => console.log('Mounted'),
    onUnmount: () => console.log('Unmounted')
  });
}
```

---

## Examples

### Example 1: Simple Plugin

```typescript
// packages/features/hello-world/index.ts
import type { Plugin } from '@app/config/types';

export const helloWorldPlugin: Plugin = {
  id: 'hello-world',
  name: 'Hello World',
  version: '1.0.0',
  enabled: true,

  routes: [
    {
      id: 'hello',
      path: '/hello',
      layout: 'default',
      pluginId: 'hello-world'
    }
  ],

  navigation: [
    {
      id: 'hello-nav',
      title: 'Hello',
      path: '/hello',
      icon: 'hand',
      pluginId: 'hello-world'
    }
  ],

  hooks: {
    onInit: () => {
      console.log('Hello World Plugin Loaded!');
    }
  }
};
```

### Example 2: Analytics Plugin with Events

```typescript
// packages/features/analytics/index.ts
import type { Plugin } from '@app/config/types';
import { hookRegistry } from '@app/config/registry';

export const analyticsPlugin: Plugin = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  enabled: true,

  hooks: {
    definitions: [
      { name: 'analytics.track', description: 'Track an event' },
      { name: 'analytics.pageview', description: 'Track a page view' }
    ],

    onInit: async () => {
      // Subscribe to user events
      hookRegistry.subscribe('user.login', async (user) => {
        await hookRegistry.emit('analytics.track', {
          event: 'user_login',
          userId: user.id,
          timestamp: Date.now()
        });
      }, 'analytics', { priority: 5 });

      hookRegistry.subscribe('user.logout', async (user) => {
        await hookRegistry.emit('analytics.track', {
          event: 'user_logout',
          userId: user.id,
          timestamp: Date.now()
        });
      }, 'analytics', { priority: 5 });

      // Subscribe to page navigation
      hookRegistry.subscribe('router.navigate', async (data) => {
        await hookRegistry.emit('analytics.pageview', {
          path: data.path,
          timestamp: Date.now()
        });
      }, 'analytics');
    }
  }
};
```

### Example 3: Component Override

```typescript
// packages/features/custom-theme/index.ts
import type { Plugin } from '@app/config/types';
import { componentRegistry } from '@app/config/registry';
import CustomButton from './components/CustomButton';

export const customThemePlugin: Plugin = {
  id: 'custom-theme',
  name: 'Custom Theme',
  version: '1.0.0',
  enabled: true,

  hooks: {
    onInit: () => {
      // Override the default Button component
      componentRegistry.registerOverride({
        componentId: 'Button',
        component: CustomButton,
        pluginId: 'custom-theme',
        priority: 10,
        condition: () => {
          // Only override in certain conditions
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
      });
    }
  }
};
```

### Example 4: Using Hooks in Components

```typescript
// src/app/dashboard/page.tsx
'use client';

import { useRoutes, useNavigation, useHookEmitter } from '@app/config/registry';

export default function DashboardPage() {
  const routes = useRoutes();
  const navigation = useNavigation();
  const { emit } = useHookEmitter('dashboard.viewed');

  useEffect(() => {
    emit({ timestamp: Date.now() });
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <nav>
        {navigation.map(item => (
          <a key={item.id} href={item.path}>{item.title}</a>
        ))}
      </nav>
      <div>
        {routes.map(route => (
          <div key={route.id}>{route.path}</div>
        ))}
      </div>
    </div>
  );
}
```

---

## Best Practices

### Plugin Design

1. **Single Responsibility**: Each plugin should focus on one feature
2. **Clear Dependencies**: Declare all dependencies in manifest
3. **Graceful Degradation**: Handle missing dependencies gracefully
4. **Clean Lifecycle**: Always clean up in `onDestroy`
5. **Type Safety**: Use TypeScript for better DX

### Event Naming

Use namespaced event names:

```typescript
// Good
'analytics.track'
'user.login'
'data.updated'

// Bad
'track'
'login'
'updated'
```

### Performance

1. **Lazy Load**: Use dynamic imports for large components
2. **Conditional Subscriptions**: Use filters to reduce unnecessary executions
3. **Priorities**: Use priorities to control execution order
4. **Unsubscribe**: Always clean up subscriptions

```typescript
useEffect(() => {
  const subId = hookRegistry.subscribe('event', handler, 'plugin');
  return () => hookRegistry.unsubscribe(subId);
}, []);
```

### Security

1. **Validate Permissions**: Check permissions before sensitive operations
2. **Role-Based Access**: Use roles for routes and navigation
3. **Input Validation**: Validate data in event handlers
4. **Error Boundaries**: Wrap plugin components in error boundaries

### Testing

```typescript
// Test plugin loading
describe('MyPlugin', () => {
  it('should register routes', () => {
    const routes = routeRegistry.getPluginRoutes('my-plugin');
    expect(routes).toHaveLength(2);
  });

  it('should emit events', async () => {
    const handler = jest.fn();
    hookRegistry.subscribe('my.event', handler, 'test');
    await hookRegistry.emit('my.event', { data: 'test' });
    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });
});
```

---

## Troubleshooting

### Plugin Not Loading

**Problem**: Plugin doesn't appear in the app

**Solutions**:
1. Check `enabled: true` in plugin.json or plugin definition
2. Verify plugin is registered in config-manager
3. Check browser console for errors
4. Verify `autoLoad: true` in manifest

### Events Not Firing

**Problem**: Hook subscribers not receiving events

**Solutions**:
1. Verify hook is defined: `hookRegistry.hasHook('hook.name')`
2. Check subscription is active: `hookRegistry.getSubscriptions('hook.name')`
3. Ensure await on emit: `await hookRegistry.emit(...)`
4. Check filter conditions in subscription

### Component Not Overriding

**Problem**: Component override not working

**Solutions**:
1. Check override priority (higher = takes precedence)
2. Verify condition function returns true
3. Ensure componentId matches exactly
4. Check component is enabled

### Circular Dependencies

**Problem**: Plugins fail to load due to circular dependencies

**Solutions**:
1. Review dependency tree
2. Use optional dependencies
3. Refactor to remove circular deps
4. Check console warnings

### TypeScript Errors

**Problem**: Type errors when using registries

**Solutions**:
1. Import types: `import type { Plugin } from '@app/config/types'`
2. Check registry exports: `import { routeRegistry } from '@app/config/registry'`
3. Update tsconfig paths if needed

### Debugging

Enable debug logging:

```typescript
// In plugin hooks.onInit
console.log('[MyPlugin] Debug info:', {
  routes: routeRegistry.getPluginRoutes('my-plugin'),
  navigation: navigationRegistry.getPluginItems('my-plugin'),
  hooks: hookRegistry.getPluginHooks('my-plugin')
});
```

Check registry stats:

```typescript
console.log('Registry Stats:', {
  routes: routeRegistry.getStats(),
  navigation: navigationRegistry.getStats(),
  components: componentRegistry.getStats(),
  hooks: hookRegistry.getStats()
});
```

---

## Additional Resources

- **Live Examples**:
  - `/registry-test` - Route, Navigation, Component registries
  - `/registry-phase3-test` - Hook registry and events

- **Example Plugins**:
  - `packages/features/example-analytics/` - Full-featured example

- **API Reference**: See type definitions in `packages/core/config/src/`

- **Source Code**:
  - Registries: `packages/core/config/src/registry/`
  - Plugin Manager: `packages/core/config/src/plugins/`
  - React Hooks: `packages/core/config/src/registry/hooks/`

---

## Contributing

When creating plugins for this system:

1. Follow the plugin structure guidelines
2. Document your hooks and APIs
3. Include examples in README
4. Add tests for critical functionality
5. Use semantic versioning
6. Declare dependencies explicitly

---

## Support

For issues or questions:
1. Check this documentation
2. Review example plugins
3. Check browser console for errors
4. Review registry statistics for debugging
