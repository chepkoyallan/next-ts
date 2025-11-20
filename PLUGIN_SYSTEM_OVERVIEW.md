# Plugin System Overview

**Location**: `packages/core/config/src/plugins/`
**Status**: ✅ Fully Implemented
**Architecture**: Singleton Pattern with Lifecycle Management

---

## 📋 Table of Contents

1. [Architecture](#architecture)
2. [Plugin Lifecycle](#plugin-lifecycle)
3. [Plugin Structure](#plugin-structure)
4. [Plugin Manager API](#plugin-manager-api)
5. [React Hooks](#react-hooks)
6. [Plugin Types](#plugin-types)
7. [Usage Examples](#usage-examples)
8. [Creating Plugins](#creating-plugins)

---

## 🏗️ Architecture

### Core Components

```
packages/core/config/src/plugins/
├── plugin-manager.ts      # Singleton manager for plugin lifecycle
├── use-plugins.ts         # React hooks for plugin access
├── index.ts              # Plugin system exports
└── examples/
    ├── analytics-plugin.tsx        # Example UI plugin
    └── custom-layout-plugin.tsx    # Example layout plugin
```

### Design Pattern

**Singleton Pattern**: The PluginManager uses a singleton pattern to ensure a single instance manages all plugins throughout the application lifecycle.

```typescript
class PluginManager {
  private static instance: PluginManager;

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }
}

// Exported singleton instance
export const pluginManager = PluginManager.getInstance();
```

---

## 🔄 Plugin Lifecycle

### Lifecycle States

```typescript
type PluginStatus = 'active' | 'inactive' | 'error' | 'loading';
```

### Lifecycle Flow

```
1. Registration     → Plugin added to config
2. Loading          → Plugin status: 'loading'
3. Initialization   → onInit hook executed
4. Active           → Plugin status: 'active'
5. Unloading        → Cleanup and removal
6. Disabled         → Plugin status: 'inactive'
```

### Lifecycle Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Plugin Lifecycle                    │
└─────────────────────────────────────────────────────┘

  Register Plugin
       ↓
  ┌─────────────────┐
  │   REGISTERED    │  (in config, enabled: true)
  └─────────────────┘
       ↓
  Load Plugin
       ↓
  ┌─────────────────┐
  │    LOADING      │  (status: 'loading')
  └─────────────────┘
       ↓
  Execute onInit Hook
       ↓
  ┌─────────────────┐
  │     ACTIVE      │  (status: 'active')
  └─────────────────┘
       ↓
  Config Change (enabled: false)
       ↓
  ┌─────────────────┐
  │   UNLOADING     │  (cleanup)
  └─────────────────┘
       ↓
  ┌─────────────────┐
  │    INACTIVE     │  (status: 'inactive')
  └─────────────────┘
```

### Lifecycle Hooks

```typescript
interface PluginHooks {
  onInit?: () => void | Promise<void>; // Plugin initialization
  onAuth?: (user: any) => void | Promise<void>; // User authentication
  onLogout?: () => void | Promise<void>; // User logout
  beforeRouteChange?: (to: string, from: string) => boolean | Promise<boolean>;
  onError?: (error: Error) => void; // Error handling
  onConfigChange?: (config: Partial<AppConfig>) => void; // Config updates
  onThemeChange?: (theme: ThemeMode) => void; // Theme changes
}
```

### Lifecycle Management Code

```typescript
// Initialization on PluginManager creation
private init() {
  if (typeof window === 'undefined') return;

  // Load plugins from config
  const configManager = getConfigManager();
  const config = configManager.getConfig();

  config.plugins.forEach((plugin) => {
    if (plugin.enabled) {
      this.loadPlugin(plugin);
    }
  });

  // Subscribe to config changes for dynamic loading/unloading
  configManager.subscribe((newConfig) => {
    this.syncPlugins(newConfig.plugins);
  });
}

// Load a plugin (executed during lifecycle)
private async loadPlugin(plugin: Plugin): Promise<void> {
  try {
    console.log(`[PluginManager] Loading plugin: ${plugin.name}`);

    // Update status to 'loading'
    this.updatePluginStatus(plugin.id, 'loading');

    // Execute onInit hook
    if (plugin.hooks?.onInit) {
      await plugin.hooks.onInit();
    }

    // Mark as 'active'
    this.loadedPlugins.set(plugin.id, {
      ...plugin,
      status: 'active',
    });

    console.log(`[PluginManager] Plugin loaded: ${plugin.name}`);
    this.notifySubscribers();
  } catch (error) {
    console.error(`[PluginManager] Error loading plugin ${plugin.name}:`, error);
    this.updatePluginStatus(plugin.id, 'error');
  }
}

// Unload a plugin (cleanup)
private unloadPlugin(pluginId: string): void {
  const plugin = this.loadedPlugins.get(pluginId);
  if (!plugin) return;

  console.log(`[PluginManager] Unloading plugin: ${plugin.name}`);

  // Clean up plugin instance
  this.pluginInstances.delete(pluginId);

  // Remove from loaded plugins
  this.loadedPlugins.delete(pluginId);

  this.notifySubscribers();
}

// Sync plugins with config changes (dynamic lifecycle)
private syncPlugins(plugins: Plugin[]) {
  // Disable removed plugins
  this.loadedPlugins.forEach((loadedPlugin, id) => {
    const exists = plugins.find((p) => p.id === id);
    if (!exists || !exists.enabled) {
      this.unloadPlugin(id);
    }
  });

  // Load new or enabled plugins
  plugins.forEach((plugin) => {
    if (plugin.enabled && !this.loadedPlugins.has(plugin.id)) {
      this.loadPlugin(plugin);
    }
  });

  this.notifySubscribers();
}
```

---

## 📦 Plugin Structure

### Plugin Interface

```typescript
interface Plugin {
  // Identity
  id: string; // Unique identifier
  name: string; // Display name
  version: string; // Semantic version
  description?: string; // Description
  author?: string; // Plugin author

  // State
  enabled: boolean; // Is plugin enabled?
  status?: PluginStatus; // Current status
  type: PluginType; // Plugin type

  // UI Components
  routes?: PluginRoute[]; // Custom routes
  navigation?: PluginNavItem[]; // Nav items
  components?: Record<string, React.ComponentType<any>>;
  layouts?: PluginLayout[]; // Custom layouts
  sections?: PluginSection[]; // UI sections

  // Functionality
  hooks?: PluginHooks; // Lifecycle hooks
  apis?: PluginAPI[]; // API endpoints

  // Configuration
  settings?: Record<string, any>;
  dependencies?: string[]; // Plugin dependencies
  configSchema?: Record<string, any>;

  // Metadata
  metadata?: PluginMetadata;
  installDate?: string;
  updateDate?: string;
  isSystem?: boolean; // Can't be deleted

  // Source
  source?: 'local' | 'npm' | 'url' | 'inline';
  sourceUrl?: string;
  entryPoint?: string;
}
```

### Plugin Types

```typescript
type PluginType =
  | 'ui' // UI components, routes, navigation
  | 'api' // API endpoints only
  | 'integration' // External service integration
  | 'theme' // Theme/styling customization
  | 'utility' // Helper functions, tools
  | 'full'; // Complete feature with UI + API
```

---

## 🎯 Plugin Manager API

### Registration & Management

```typescript
// Register a new plugin
pluginManager.registerPlugin(plugin: Plugin): void

// Unregister a plugin
pluginManager.unregisterPlugin(pluginId: string): void

// Enable a plugin
pluginManager.enablePlugin(pluginId: string): void

// Disable a plugin
pluginManager.disablePlugin(pluginId: string): void

// Update plugin settings
pluginManager.updatePluginSettings(pluginId: string, settings: Record<string, any>): void
```

### Query & Access

```typescript
// Get all loaded plugins
pluginManager.getLoadedPlugins(): Plugin[]

// Get plugin by ID
pluginManager.getPlugin(pluginId: string): Plugin | undefined

// Get plugins by type
pluginManager.getPluginsByType(type: PluginType): Plugin[]

// Get plugin component
pluginManager.getComponent(pluginId: string, componentName: string): React.ComponentType<any> | undefined
```

### Plugin Content Aggregation

```typescript
// Get all routes from plugins
pluginManager.getPluginRoutes(): PluginRoute[]

// Get all navigation items from plugins
pluginManager.getPluginNavItems(): PluginNavItem[]

// Get all layouts from plugins
pluginManager.getPluginLayouts(): PluginLayout[]

// Get all sections from plugins
pluginManager.getPluginSections(): PluginSection[]
```

### Hook Execution

```typescript
// Execute a hook across all plugins
pluginManager.executeHook<K extends keyof PluginHooks>(
  hookName: K,
  ...args: Parameters<NonNullable<PluginHooks[K]>>
): Promise<void>

// Example usage
await pluginManager.executeHook('onAuth', user);
await pluginManager.executeHook('onThemeChange', 'dark');
```

### Dependencies

```typescript
// Check plugin dependencies
pluginManager.checkDependencies(plugin: Plugin): {
  valid: boolean;
  missing: string[];
}
```

### Subscription

```typescript
// Subscribe to plugin changes
const unsubscribe = pluginManager.subscribe((plugins: Plugin[]) => {
  console.log('Plugins updated:', plugins);
});

// Unsubscribe
unsubscribe();
```

---

## ⚛️ React Hooks

### `usePlugins()`

Get all loaded plugins with real-time updates.

```typescript
function MyComponent() {
  const { plugins, loading } = usePlugins();

  return (
    <div>
      {plugins.map(plugin => (
        <div key={plugin.id}>{plugin.name}</div>
      ))}
    </div>
  );
}
```

### `usePlugin(pluginId: string)`

Get a specific plugin.

```typescript
function PluginDetail({ id }: { id: string }) {
  const plugin = usePlugin(id);

  if (!plugin) return <div>Plugin not found</div>;

  return <div>{plugin.name} - {plugin.version}</div>;
}
```

### `usePluginsByType(type: PluginType)`

Get plugins filtered by type.

```typescript
function UIPluginsList() {
  const uiPlugins = usePluginsByType('ui');

  return (
    <ul>
      {uiPlugins.map(plugin => (
        <li key={plugin.id}>{plugin.name}</li>
      ))}
    </ul>
  );
}
```

### `usePluginRoutes()`

Get all routes from plugins.

```typescript
function PluginRoutes() {
  const routes = usePluginRoutes();

  return (
    <>
      {routes.map(route => (
        <Route key={route.path} path={route.path} component={route.component} />
      ))}
    </>
  );
}
```

### `usePluginNavigation()`

Get all navigation items from plugins.

```typescript
function Navigation() {
  const navItems = usePluginNavigation();

  return (
    <nav>
      {navItems.map(item => (
        <NavLink key={item.id} to={item.path}>{item.title}</NavLink>
      ))}
    </nav>
  );
}
```

### `usePluginLayouts()`

Get all layouts from plugins.

```typescript
function LayoutSelector() {
  const layouts = usePluginLayouts();

  return (
    <select>
      {layouts.map(layout => (
        <option key={layout.id} value={layout.id}>{layout.name}</option>
      ))}
    </select>
  );
}
```

### `usePluginSections()`

Get all sections from plugins.

```typescript
function ConfigTabs() {
  const sections = usePluginSections();
  const configSections = sections.filter(s => s.configTab);

  return (
    <Tabs>
      {configSections.map(section => (
        <Tab key={section.id} label={section.name}>
          <section.component />
        </Tab>
      ))}
    </Tabs>
  );
}
```

### `usePluginComponent(pluginId: string, componentName: string)`

Get a specific component from a plugin.

```typescript
function DynamicComponent() {
  const Component = usePluginComponent('analytics-pro', 'Chart');

  if (!Component) return null;

  return <Component data={chartData} />;
}
```

### `usePluginDependencies(plugin: Plugin)`

Check plugin dependencies.

```typescript
function PluginInstaller({ plugin }: { plugin: Plugin }) {
  const { valid, missing } = usePluginDependencies(plugin);

  if (!valid) {
    return <div>Missing dependencies: {missing.join(', ')}</div>;
  }

  return <button>Install {plugin.name}</button>;
}
```

---

## 📝 Usage Examples

### Example 1: Adding a Plugin to Config

```typescript
import { pluginManager } from '@app/config';
import { analyticsPlugin } from '@app/config/plugins/examples/analytics-plugin';

// Register plugin
pluginManager.registerPlugin(analyticsPlugin);

// Enable plugin
pluginManager.enablePlugin('analytics-pro');

// The plugin will automatically load and execute onInit hook
```

### Example 2: Executing Hooks

```typescript
import { pluginManager } from '@app/config';

// After user authentication
await pluginManager.executeHook('onAuth', user);

// Before route change
const canNavigate = await pluginManager.executeHook(
  'beforeRouteChange',
  '/new-route',
  '/old-route'
);

// On theme change
await pluginManager.executeHook('onThemeChange', 'dark');

// On error
pluginManager.executeHook('onError', error);
```

### Example 3: Using Plugin Content in App

```typescript
// In your router
import { usePluginRoutes } from '@app/config';

function AppRouter() {
  const pluginRoutes = usePluginRoutes();

  return (
    <Routes>
      {/* Core routes */}
      <Route path="/" element={<Home />} />

      {/* Plugin routes */}
      {pluginRoutes.map(route => (
        <Route
          key={route.path}
          path={route.path}
          element={<route.component />}
        />
      ))}
    </Routes>
  );
}
```

```typescript
// In your navigation
import { usePluginNavigation } from '@app/config';

function Sidebar() {
  const pluginNavItems = usePluginNavigation();

  return (
    <nav>
      {/* Core nav */}
      <NavItem to="/" title="Dashboard" />

      {/* Plugin nav */}
      {pluginNavItems.map(item => (
        <NavItem
          key={item.id}
          to={item.path}
          title={item.title}
          icon={item.icon}
          badge={item.badge}
        />
      ))}
    </nav>
  );
}
```

### Example 4: Plugin Settings Management

```typescript
import { pluginManager } from '@app/config';

// Get plugin settings
const plugin = pluginManager.getPlugin('analytics-pro');
console.log(plugin?.settings); // { trackingEnabled: true, refreshInterval: 30000 }

// Update plugin settings
pluginManager.updatePluginSettings('analytics-pro', {
  refreshInterval: 60000,
  showCharts: false,
});
```

---

## 🔨 Creating Plugins

### Step 1: Define Plugin Structure

```typescript
import type { Plugin } from '@app/config/types';

export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  author: 'Me',
  enabled: false,
  type: 'ui',
  status: 'inactive',

  // ... plugin configuration
};
```

### Step 2: Add Routes (Optional)

```typescript
routes: [
  {
    path: '/my-feature',
    component: MyFeatureComponent,
    protected: true,
    layout: 'dashboard',
    meta: {
      title: 'My Feature',
      description: 'Description of my feature',
    },
  },
];
```

### Step 3: Add Navigation (Optional)

```typescript
navigation: [
  {
    id: 'my-feature-nav',
    title: 'My Feature',
    path: '/my-feature',
    icon: 'solar:widget-bold-duotone',
    section: 'features',
    order: 50,
  },
];
```

### Step 4: Add Lifecycle Hooks (Optional)

```typescript
hooks: {
  onInit: async () => {
    console.log('[My Plugin] Initializing...');
    // Initialize plugin resources
  },

  onAuth: async (user) => {
    console.log('[My Plugin] User logged in:', user.id);
    // Handle authentication
  },

  onError: (error) => {
    console.error('[My Plugin] Error:', error);
    // Handle errors
  },
}
```

### Step 5: Add Settings (Optional)

```typescript
settings: {
  feature1Enabled: true,
  apiTimeout: 5000,
  maxRetries: 3,
}
```

### Step 6: Specify Dependencies (Optional)

```typescript
dependencies: ['other-plugin-id'], // This plugin requires 'other-plugin-id' to be loaded
```

### Step 7: Register Plugin

```typescript
import { pluginManager } from '@app/config';
import { myPlugin } from './my-plugin';

pluginManager.registerPlugin(myPlugin);
pluginManager.enablePlugin('my-plugin');
```

---

## 🎨 Plugin Examples

### Example 1: Analytics Plugin (packages/core/config/src/plugins/examples/analytics-plugin.tsx)

**Features**:

- Custom route (`/analytics-pro`)
- Navigation item with badge
- Lifecycle hooks (onInit, onAuth, onError)
- Custom settings
- Component: Analytics Dashboard

**Type**: `ui`

### Example 2: Custom Layout Plugin (packages/core/config/src/plugins/examples/custom-layout-plugin.tsx)

**Features**:

- Custom layout component
- Configuration section
- Lifecycle hooks
- Settings for customization

**Type**: `ui`

---

## 🔐 Dependency Management

The plugin system includes dependency checking to ensure plugins are loaded in the correct order.

```typescript
// Check dependencies before loading
const result = pluginManager.checkDependencies(plugin);

if (!result.valid) {
  console.error(`Missing dependencies: ${result.missing.join(', ')}`);
  // Don't load plugin
}
```

**Automatic Dependency Resolution**: When a plugin is disabled, the PluginManager automatically checks if other plugins depend on it and can handle cascading disables.

---

## 📊 Plugin Lifecycle States

```
REGISTERED → Plugin exists in config with enabled: true/false
LOADING    → Plugin is being initialized
ACTIVE     → Plugin is loaded and running
INACTIVE   → Plugin is disabled or unloaded
ERROR      → Plugin failed to load
```

---

## 🚀 Integration with Config System

Plugins are part of the main `AppConfig`:

```typescript
interface AppConfig {
  // ... other config
  plugins: Plugin[];
}
```

**Storage**: Plugins are stored in the config and persisted like any other config value.

**Dynamic Loading**: When config changes (e.g., a plugin is enabled/disabled), the PluginManager automatically syncs and loads/unloads plugins.

---

## 📚 API Reference Summary

| Method                                     | Description                 |
| ------------------------------------------ | --------------------------- |
| `registerPlugin(plugin)`                   | Add plugin to config        |
| `unregisterPlugin(pluginId)`               | Remove plugin from config   |
| `enablePlugin(pluginId)`                   | Enable plugin (loads it)    |
| `disablePlugin(pluginId)`                  | Disable plugin (unloads it) |
| `getLoadedPlugins()`                       | Get all active plugins      |
| `getPlugin(pluginId)`                      | Get single plugin           |
| `getPluginsByType(type)`                   | Get plugins by type         |
| `getPluginRoutes()`                        | Get all plugin routes       |
| `getPluginNavItems()`                      | Get all plugin nav items    |
| `getPluginLayouts()`                       | Get all plugin layouts      |
| `getPluginSections()`                      | Get all plugin sections     |
| `getComponent(pluginId, name)`             | Get plugin component        |
| `executeHook(hookName, ...args)`           | Execute hook across plugins |
| `checkDependencies(plugin)`                | Check plugin dependencies   |
| `updatePluginSettings(pluginId, settings)` | Update plugin settings      |
| `subscribe(callback)`                      | Subscribe to plugin changes |

---

## ✅ Summary

The plugin system provides a **powerful, flexible architecture** for extending the application with:

- ✅ **Lifecycle Management**: Automatic loading/unloading with hooks
- ✅ **React Integration**: Custom hooks for easy access
- ✅ **Dynamic Loading**: Plugins can be enabled/disabled at runtime
- ✅ **Dependency Management**: Automatic dependency checking
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Extensibility**: Support for routes, nav, layouts, sections, APIs
- ✅ **Event System**: Lifecycle hooks for integration
- ✅ **Settings Management**: Per-plugin configuration
- ✅ **Subscription Model**: Real-time updates via observer pattern

**Location**: `packages/core/config/src/plugins/`
**Main Export**: `pluginManager` (singleton instance)
**Examples**: `packages/core/config/src/plugins/examples/`
