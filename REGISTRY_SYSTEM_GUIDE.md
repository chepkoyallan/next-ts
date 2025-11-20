# Registry System Usage Guide

**Version**: 1.0.0
**Date**: 2025-11-19
**Status**: ✅ Implemented

## Overview

The Registry System provides a dynamic, plugin-based architecture for managing routes, navigation, components, and providers. This enables true modularity where features can be added, removed, or updated at runtime without code changes.

---

## Architecture

### Core Registries

1. **RouteRegistry** - Dynamic route management
2. **NavigationRegistry** - Dynamic menu system
3. **ComponentRegistry** - Component discovery & overrides
4. **ProviderRegistry** - Composable React providers

### Integration

All registries are automatically integrated with the **PluginManager**. When a plugin is loaded/unloaded, its resources are automatically registered/unregistered across all registries.

---

## 1. RouteRegistry

### Purpose
Manage routes dynamically without hardcoded path definitions.

### Features
- ✅ Dynamic route registration/unregistration
- ✅ Route grouping and prioritization
- ✅ Protected routes with role-based access
- ✅ Nested route support
- ✅ Metadata for SEO

### Usage

```typescript
import { routeRegistry } from '@app/config';

// Register a route
routeRegistry.registerRoute({
  id: 'user-profile',
  path: '/user/:id',
  component: UserProfilePage,
  pluginId: 'user-management',
  layout: 'dashboard',
  protected: true,
  roles: ['user', 'admin'],
  meta: {
    title: 'User Profile',
    description: 'View and edit user profile',
  },
  priority: 10,
});

// Get all enabled routes
const routes = routeRegistry.getEnabledRoutes();

// Get routes for a specific layout
const dashboardRoutes = routeRegistry.getRoutesByLayout('dashboard');

// Check user access
const hasAccess = routeRegistry.hasAccess('user-profile', ['user']);

// Get route stats
const stats = routeRegistry.getStats();
// => { totalRoutes: 25, enabledRoutes: 20, protectedRoutes: 15, ... }
```

### Plugin Integration

Plugins automatically register routes:

```typescript
// In plugin definition
export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  routes: [
    {
      path: '/my-feature',
      component: MyFeaturePage,
      protected: true,
      layout: 'dashboard',
    },
  ],
};
```

---

## 2. NavigationRegistry

### Purpose
Build dynamic navigation menus that adapt to plugins and user permissions.

### Features
- ✅ Hierarchical menu structure
- ✅ Section/group organization
- ✅ Role-based visibility
- ✅ Icons and badges
- ✅ External links support

### Usage

```typescript
import { navigationRegistry } from '@app/config';

// Register navigation item
navigationRegistry.registerItem({
  id: 'users',
  title: 'Users',
  path: '/users',
  icon: 'solar:users-group-rounded-bold-duotone',
  pluginId: 'user-management',
  section: 'management',
  order: 10,
  roles: ['admin'],
  badge: {
    label: '5',
    color: 'error',
  },
});

// Build navigation tree
const navTree = navigationRegistry.buildTree();

// Get navigation by section
const sections = navigationRegistry.getNavigationBySection();

// Filter for current user
const userNav = navigationRegistry.getItemsForUser(['user', 'moderator']);

// Register custom section
navigationRegistry.registerSection({
  id: 'custom',
  title: 'Custom Section',
  order: 5,
});
```

### Plugin Integration

```typescript
export const myPlugin: Plugin = {
  id: 'my-plugin',
  navigation: [
    {
      id: 'my-feature',
      title: 'My Feature',
      path: '/my-feature',
      icon: 'solar:widget-bold-duotone',
      section: 'overview',
      order: 15,
    },
  ],
};
```

---

## 3. ComponentRegistry

### Purpose
Discover, register, and override components dynamically.

### Features
- ✅ Component discovery by category/tag
- ✅ Component overrides (theming, A/B testing)
- ✅ Conditional overrides
- ✅ Component versioning
- ✅ Props schema documentation

### Usage

```typescript
import { componentRegistry } from '@app/config';

// Register component
componentRegistry.registerComponent({
  id: 'user-card',
  name: 'UserCard',
  component: UserCardComponent,
  pluginId: 'user-management',
  category: 'user',
  tags: ['card', 'profile', 'ui'],
  description: 'Display user information in a card',
  version: '2.0.0',
});

// Get component (with override support)
const UserCard = componentRegistry.getComponent('user-card');

// Register override (e.g., for theming)
componentRegistry.registerOverride({
  componentId: 'user-card',
  component: PremiumUserCard,
  source: 'theme-premium',
  priority: 10,
  condition: () => userHasPremium(),
});

// Search components
const results = componentRegistry.searchComponents('profile');

// Get by category
const userComponents = componentRegistry.getComponentsByCategory('user');

// Get by tag
const cardComponents = componentRegistry.getComponentsByTag('card');
```

### Component Overrides Example

```typescript
// Base component
const Button = () => <button>Click</button>;

// Register base
componentRegistry.registerComponent({
  id: 'button',
  name: 'Button',
  component: Button,
  pluginId: 'core',
});

// Override for A/B test
componentRegistry.registerOverride({
  componentId: 'button',
  component: NewButton,
  source: 'ab-test-variant-b',
  priority: 5,
  condition: () => isInABTest('variant-b'),
});

// Usage - automatically uses override when condition is true
const ButtonComponent = componentRegistry.getComponent('button');
```

---

## 4. ProviderRegistry

### Purpose
Compose React providers dynamically with dependency management.

### Features
- ✅ Automatic provider composition
- ✅ Dependency resolution (topological sort)
- ✅ Circular dependency detection
- ✅ Provider ordering

### Usage

```typescript
import { providerRegistry } from '@app/config';

// Register provider
providerRegistry.registerProvider({
  id: 'theme-provider',
  component: ThemeProvider,
  pluginId: 'theme',
  order: 1,
  dependencies: [],
});

providerRegistry.registerProvider({
  id: 'user-provider',
  component: UserProvider,
  pluginId: 'auth',
  order: 2,
  dependencies: ['theme-provider'], // Will load after theme
});

// Compose all providers into app
const AppWithProviders = ({ children }) => {
  return providerRegistry.composeProviders(children);
};

// Result: <ThemeProvider><UserProvider>{children}</UserProvider></ThemeProvider>
```

---

## Registry Integration with PluginManager

The PluginManager automatically handles all registry operations:

### On Plugin Load
```typescript
// Automatically registers:
// - Routes → RouteRegistry
// - Navigation → NavigationRegistry
// - Components → ComponentRegistry
// - Providers → ProviderRegistry
```

### On Plugin Unload
```typescript
// Automatically unregisters all plugin resources
routeRegistry.unregisterPluginRoutes(pluginId);
navigationRegistry.unregisterPluginItems(pluginId);
componentRegistry.unregisterPluginComponents(pluginId);
providerRegistry.unregisterPluginProviders(pluginId);
```

---

## Benefits

### 1. **True Modularity**
- Features are completely independent
- Can be enabled/disabled at runtime
- No hardcoded dependencies

### 2. **Multi-Tenancy Ready**
```typescript
// Per-tenant plugin configuration
const config = {
  tenant: 'acme-corp',
  plugins: [
    { id: 'file-manager', enabled: true },
    { id: 'advanced-analytics', enabled: true }, // Premium feature
    { id: 'checkout', enabled: false },
  ],
};
```

### 3. **A/B Testing**
```typescript
// Override components for experiments
componentRegistry.registerOverride({
  componentId: 'checkout-button',
  component: NewCheckoutButton,
  source: 'experiment-checkout-v2',
  condition: () => experiments.isInGroup('checkout-v2'),
});
```

### 4. **Theme System**
```typescript
// Override components per theme
componentRegistry.registerOverride({
  componentId: 'button',
  component: MaterialButton,
  source: 'theme-material',
  priority: 10,
});
```

### 5. **Plugin Marketplace**
```typescript
// Install plugin from registry
await pluginLoader.install('https://plugins.com/analytics.js');
// Routes, navigation, components automatically registered
```

---

## Migration Path

### Phase 1: Use Registries (✅ Done)
- RouteRegistry created
- NavigationRegistry created
- ComponentRegistry created
- ProviderRegistry created
- PluginManager integrated

### Phase 2: Migrate Existing Code
```typescript
// Before: Hardcoded routes in src/routes/paths.ts
export const paths = {
  dashboard: '/dashboard',
  users: '/users',
};

// After: Dynamic registration
routeRegistry.registerRoute({
  id: 'dashboard',
  path: '/dashboard',
  component: DashboardPage,
  pluginId: 'core',
});
```

### Phase 3: Component Discovery
```typescript
// Before: Direct imports
import { UserCard } from '@app/components/user-card';

// After: Registry lookup
const UserCard = componentRegistry.getComponent('user-card');
```

---

## API Reference

### RouteRegistry

| Method | Description |
|--------|-------------|
| `registerRoute(route)` | Register a route |
| `unregisterRoute(id)` | Unregister a route |
| `getRoute(id)` | Get route by ID |
| `getRouteByPath(path)` | Find route by path |
| `getEnabledRoutes()` | Get all enabled routes |
| `getRoutesByLayout(layout)` | Filter by layout |
| `hasAccess(id, roles)` | Check user access |
| `subscribe(callback)` | Listen to changes |

### NavigationRegistry

| Method | Description |
|--------|-------------|
| `registerItem(item)` | Register nav item |
| `unregisterItem(id)` | Unregister item |
| `buildTree()` | Build hierarchical tree |
| `getNavigationBySection()` | Group by section |
| `getItemsForUser(roles)` | Filter by roles |
| `subscribe(callback)` | Listen to changes |

### ComponentRegistry

| Method | Description |
|--------|-------------|
| `registerComponent(comp)` | Register component |
| `getComponent(id)` | Get with overrides |
| `registerOverride(override)` | Add override |
| `searchComponents(query)` | Search by name/tag |
| `getComponentsByCategory(cat)` | Filter by category |
| `subscribe(callback)` | Listen to changes |

### ProviderRegistry

| Method | Description |
|--------|-------------|
| `registerProvider(provider)` | Register provider |
| `composeProviders(children)` | Compose tree |
| `getEnabledProviders()` | Get sorted list |
| `subscribe(callback)` | Listen to changes |

---

## Examples

### Example 1: Creating a Feature Plugin with All Registries

```typescript
// packages/features/analytics/src/plugin.tsx
import { Plugin } from '@app/config/types';
import { AnalyticsDashboard } from './analytics-dashboard';
import { AnalyticsProvider } from './analytics-provider';
import { AnalyticsWidget } from './analytics-widget';

export const analyticsPlugin: Plugin = {
  id: 'analytics',
  name: 'Analytics',
  version: '1.0.0',
  description: 'Advanced analytics and reporting',

  // Routes
  routes: [
    {
      path: '/analytics',
      component: AnalyticsDashboard,
      protected: true,
      roles: ['admin', 'analyst'],
      layout: 'dashboard',
    },
  ],

  // Navigation
  navigation: [
    {
      id: 'analytics',
      title: 'Analytics',
      path: '/analytics',
      icon: 'solar:chart-bold-duotone',
      section: 'management',
      order: 20,
    },
  ],

  // Components
  components: {
    AnalyticsWidget,
    AnalyticsDashboard,
  },

  // Providers
  providers: [AnalyticsProvider],

  // Hooks
  hooks: {
    onInit: async () => {
      console.log('[Analytics] Initialized');
    },
  },
};
```

### Example 2: Dynamic Component Override

```typescript
// Override checkout for holiday promotion
componentRegistry.registerOverride({
  componentId: 'checkout-summary',
  component: HolidayCheckoutSummary,
  source: 'holiday-promo-2024',
  priority: 100,
  condition: () => {
    const now = new Date();
    const start = new Date('2024-12-01');
    const end = new Date('2025-01-02');
    return now >= start && now <= end;
  },
});
```

---

## Next Steps

1. **Migrate src/routes/paths.ts** to use RouteRegistry
2. **Migrate src/layouts/dashboard/nav-vertical.tsx** to use NavigationRegistry
3. **Create Plugin Manifest System** (plugin.json)
4. **Add Hook Registry** for cross-plugin communication
5. **Implement Remote Plugin Loading** via URL

---

## Support

- 📚 [Full Technical Analysis](./MODULARITY_ANALYSIS_FULL.md)
- 🚀 [Quick Start Guide](./MODULARITY_QUICK_START.md)
- 📊 [Architecture Summary](./ANALYSIS_SUMMARY.txt)

---

**Status**: ✅ Core registries implemented and integrated with PluginManager
**Next**: Test with dev server and create usage examples
