# Plugin System API Reference

Complete API documentation for the registry and plugin system.

## Table of Contents

- [RouteRegistry](#routeregistry)
- [NavigationRegistry](#navigationregistry)
- [ComponentRegistry](#componentregistry)
- [ProviderRegistry](#providerregistry)
- [HookRegistry](#hookregistry)
- [PluginManager](#pluginmanager)
- [React Hooks](#react-hooks)
- [Type Definitions](#type-definitions)

---

## RouteRegistry

Manages dynamic route registration and access control.

### Methods

#### `registerRoute(route: RouteDefinition): void`

Register a new route.

```typescript
routeRegistry.registerRoute({
  id: 'my-route',
  path: '/my-page',
  layout: 'dashboard',
  pluginId: 'my-plugin',
  protected: true,
  roles: ['admin'],
  priority: 10,
  metadata: { title: 'My Page' }
});
```

**Parameters:**
- `route.id` (string, required): Unique route identifier
- `route.path` (string, required): URL path
- `route.layout` (string, optional): Layout component
- `route.pluginId` (string, required): Plugin that owns this route
- `route.protected` (boolean, optional): Requires authentication
- `route.roles` (string[], optional): Required user roles
- `route.priority` (number, optional): Route priority (default: 0)
- `route.metadata` (object, optional): Additional metadata

---

#### `unregisterRoute(routeId: string): void`

Remove a route by ID.

```typescript
routeRegistry.unregisterRoute('my-route');
```

---

#### `getRoute(routeId: string): RouteDefinition | undefined`

Get a single route by ID.

```typescript
const route = routeRegistry.getRoute('my-route');
```

---

#### `getRoutes(): RouteDefinition[]`

Get all registered routes.

```typescript
const routes = routeRegistry.getRoutes();
```

---

#### `getEnabledRoutes(): RouteDefinition[]`

Get all enabled routes, sorted by priority.

```typescript
const routes = routeRegistry.getEnabledRoutes();
```

---

#### `getRoutesByLayout(layout: string): RouteDefinition[]`

Get routes for a specific layout.

```typescript
const dashboardRoutes = routeRegistry.getRoutesByLayout('dashboard');
```

---

#### `getProtectedRoutes(): RouteDefinition[]`

Get all protected routes.

```typescript
const protectedRoutes = routeRegistry.getProtectedRoutes();
```

---

#### `hasAccess(routeId: string, userRoles: string[]): boolean`

Check if user has access to a route.

```typescript
const hasAccess = routeRegistry.hasAccess('admin-panel', ['admin']);
```

---

#### `getStats(): RouteStats`

Get registry statistics.

```typescript
const stats = routeRegistry.getStats();
// { totalRoutes, enabledRoutes, protectedRoutes, plugins }
```

---

## NavigationRegistry

Manages dynamic navigation menus with hierarchical structure.

### Methods

#### `registerItem(item: NavigationItem): void`

Register a navigation item.

```typescript
navigationRegistry.registerItem({
  id: 'my-nav',
  title: 'My Page',
  path: '/my-page',
  icon: 'home',
  pluginId: 'my-plugin',
  section: 'main',
  parent: null,
  order: 10,
  roles: ['user'],
  badge: { text: '3', color: 'red' }
});
```

**Parameters:**
- `item.id` (string, required): Unique identifier
- `item.title` (string, required): Display title
- `item.path` (string, optional): Navigation path
- `item.icon` (string, optional): Icon name
- `item.pluginId` (string, required): Owning plugin
- `item.section` (string, optional): Section grouping
- `item.parent` (string, optional): Parent item ID
- `item.order` (number, optional): Display order
- `item.roles` (string[], optional): Required roles
- `item.badge` (object, optional): Badge configuration

---

#### `registerSection(section: NavigationSection): void`

Register a navigation section.

```typescript
navigationRegistry.registerSection({
  id: 'tools',
  title: 'Tools',
  order: 10,
  icon: 'toolbox',
  collapsible: true
});
```

---

#### `unregisterItem(itemId: string): void`

Remove a navigation item.

```typescript
navigationRegistry.unregisterItem('my-nav');
```

---

#### `getItem(itemId: string): NavigationItem | undefined`

Get a single navigation item.

```typescript
const item = navigationRegistry.getItem('my-nav');
```

---

#### `getItems(): NavigationItem[]`

Get all navigation items.

```typescript
const items = navigationRegistry.getItems();
```

---

#### `getEnabledItems(): NavigationItem[]`

Get all enabled items, sorted by order.

```typescript
const items = navigationRegistry.getEnabledItems();
```

---

#### `buildTree(): NavigationItem[]`

Build hierarchical navigation tree.

```typescript
const tree = navigationRegistry.buildTree();
// Returns top-level items with nested children
```

---

#### `getNavigationBySection(): Map<string, NavigationItem[]>`

Get navigation items grouped by section.

```typescript
const sections = navigationRegistry.getNavigationBySection();
sections.forEach((items, sectionId) => {
  console.log(sectionId, items);
});
```

---

#### `getItemsForUser(userRoles: string[]): NavigationItem[]`

Get navigation items accessible to user.

```typescript
const userNav = navigationRegistry.getItemsForUser(['admin', 'user']);
```

---

#### `hasAccess(itemId: string, userRoles: string[]): boolean`

Check if user can access navigation item.

```typescript
const hasAccess = navigationRegistry.hasAccess('admin-nav', ['admin']);
```

---

#### `getStats(): NavigationStats`

Get registry statistics.

```typescript
const stats = navigationRegistry.getStats();
// { totalItems, enabledItems, sections, plugins }
```

---

## ComponentRegistry

Manages component discovery and override system.

### Methods

#### `registerComponent(component: ComponentDefinition): void`

Register a component.

```typescript
componentRegistry.registerComponent({
  id: 'my-widget',
  name: 'MyWidget',
  component: MyWidgetComponent,
  pluginId: 'my-plugin',
  category: 'widgets',
  tags: ['dashboard', 'analytics'],
  description: 'Analytics widget'
});
```

---

#### `registerOverride(override: ComponentOverride): void`

Override an existing component.

```typescript
componentRegistry.registerOverride({
  componentId: 'Button',
  component: CustomButton,
  pluginId: 'theme-plugin',
  priority: 10,
  condition: () => isDarkMode()
});
```

**Parameters:**
- `override.componentId` (string, required): Component to override
- `override.component` (ComponentType, required): Replacement component
- `override.pluginId` (string, required): Plugin providing override
- `override.priority` (number, optional): Priority (higher wins)
- `override.condition` (function, optional): Conditional override

---

#### `getComponent(componentId: string): React.ComponentType | undefined`

Get component with overrides applied.

```typescript
const Component = componentRegistry.getComponent('Button');
```

---

#### `getComponentDefinition(componentId: string): ComponentDefinition | undefined`

Get component definition (no overrides).

```typescript
const definition = componentRegistry.getComponentDefinition('Button');
```

---

#### `getComponents(): ComponentDefinition[]`

Get all components.

```typescript
const components = componentRegistry.getComponents();
```

---

#### `getEnabledComponents(): ComponentDefinition[]`

Get all enabled components.

```typescript
const components = componentRegistry.getEnabledComponents();
```

---

#### `getComponentsByCategory(category: string): ComponentDefinition[]`

Get components by category.

```typescript
const widgets = componentRegistry.getComponentsByCategory('widgets');
```

---

#### `getComponentsByTag(tag: string): ComponentDefinition[]`

Get components by tag.

```typescript
const dashboardComponents = componentRegistry.getComponentsByTag('dashboard');
```

---

#### `searchComponents(query: string): ComponentDefinition[]`

Search components by name, description, or tags.

```typescript
const results = componentRegistry.searchComponents('analytics');
```

---

#### `getCategories(): string[]`

Get all categories.

```typescript
const categories = componentRegistry.getCategories();
```

---

#### `getTags(): string[]`

Get all tags.

```typescript
const tags = componentRegistry.getTags();
```

---

#### `getStats(): ComponentStats`

Get registry statistics.

```typescript
const stats = componentRegistry.getStats();
// { totalComponents, enabledComponents, categories, tags, plugins }
```

---

## ProviderRegistry

Manages React context provider composition.

### Methods

#### `registerProvider(provider: ProviderDefinition): void`

Register a provider.

```typescript
providerRegistry.registerProvider({
  id: 'theme-provider',
  component: ThemeProvider,
  pluginId: 'theme-plugin',
  order: 5,
  dependencies: ['config-provider'],
  config: { theme: 'dark' }
});
```

**Parameters:**
- `provider.id` (string, required): Unique identifier
- `provider.component` (ComponentType, required): Provider component
- `provider.pluginId` (string, required): Owning plugin
- `provider.order` (number, optional): Priority (lower = outer)
- `provider.dependencies` (string[], optional): Required providers
- `provider.config` (object, optional): Provider configuration

---

#### `unregisterProvider(providerId: string): void`

Remove a provider.

```typescript
providerRegistry.unregisterProvider('theme-provider');
```

---

#### `getProvider(providerId: string): ProviderDefinition | undefined`

Get a provider definition.

```typescript
const provider = providerRegistry.getProvider('theme-provider');
```

---

#### `getProviders(): ProviderDefinition[]`

Get all providers.

```typescript
const providers = providerRegistry.getProviders();
```

---

#### `getEnabledProviders(): ProviderDefinition[]`

Get enabled providers, sorted by dependencies and order.

```typescript
const providers = providerRegistry.getEnabledProviders();
```

---

#### `composeProviders(children: ReactNode): ReactNode`

Compose providers into a tree.

```typescript
const wrapped = providerRegistry.composeProviders(<App />);
```

---

#### `getStats(): ProviderStats`

Get registry statistics.

```typescript
const stats = providerRegistry.getStats();
// { totalProviders, enabledProviders, plugins }
```

---

## HookRegistry

Event-driven communication system.

### Methods

#### `defineHook(name: string, pluginId: string, description?: string): void`

Define a new hook.

```typescript
hookRegistry.defineHook(
  'user.login',
  'auth-plugin',
  'Emitted when user logs in'
);
```

---

#### `subscribe<T>(hookName: string, callback: HookCallback<T>, pluginId: string, options?): string`

Subscribe to a hook.

```typescript
const subId = hookRegistry.subscribe(
  'user.login',
  async (user) => {
    console.log('User logged in:', user);
  },
  'analytics-plugin',
  {
    priority: 10,
    filter: (user) => user.role === 'admin',
    enabled: true
  }
);
```

**Parameters:**
- `hookName` (string, required): Hook to subscribe to
- `callback` (function, required): Handler function
- `pluginId` (string, required): Subscriber plugin
- `options.priority` (number, optional): Priority (higher first)
- `options.filter` (function, optional): Filter condition
- `options.enabled` (boolean, optional): Active state

**Returns:** Subscription ID (for unsubscribing)

---

#### `unsubscribe(subscriptionId: string): void`

Unsubscribe from a hook.

```typescript
hookRegistry.unsubscribe(subId);
```

---

#### `unsubscribePlugin(pluginId: string): void`

Unsubscribe all hooks for a plugin.

```typescript
hookRegistry.unsubscribePlugin('my-plugin');
```

---

#### `emit<T>(hookName: string, data: T): Promise<void>`

Emit a hook (parallel execution).

```typescript
await hookRegistry.emit('user.login', {
  userId: 123,
  email: 'user@example.com',
  timestamp: Date.now()
});
```

---

#### `emitSequential<T>(hookName: string, data: T): Promise<void>`

Emit a hook (sequential execution by priority).

```typescript
await hookRegistry.emitSequential('user.login', userData);
```

---

#### `emitReduce<T, R>(hookName: string, initialData: T, reducer: Function, initialAcc: R): Promise<R>`

Emit with data transformation.

```typescript
const processed = await hookRegistry.emitReduce(
  'data.transform',
  rawData,
  (acc, result) => ({ ...acc, ...result }),
  {}
);
```

---

#### `getHooks(): HookDefinition[]`

Get all defined hooks.

```typescript
const hooks = hookRegistry.getHooks();
```

---

#### `getHook(hookName: string): HookDefinition | undefined`

Get a specific hook.

```typescript
const hook = hookRegistry.getHook('user.login');
```

---

#### `getSubscriptions(hookName: string): HookSubscription[]`

Get subscriptions for a hook.

```typescript
const subs = hookRegistry.getSubscriptions('user.login');
```

---

#### `hasHook(hookName: string): boolean`

Check if hook exists.

```typescript
if (hookRegistry.hasHook('user.login')) {
  // Hook is defined
}
```

---

#### `getStats(): HookStats`

Get registry statistics.

```typescript
const stats = hookRegistry.getStats();
// { totalHooks, totalSubscriptions, activeSubscriptions, plugins }
```

---

## PluginManager

Manages plugin lifecycle.

### Methods

#### `getInstance(): PluginManager`

Get singleton instance.

```typescript
const pluginManager = PluginManager.getInstance();
```

---

#### `getLoadedPlugins(): Plugin[]`

Get all loaded plugins.

```typescript
const plugins = pluginManager.getLoadedPlugins();
```

---

#### `getPlugin(pluginId: string): Plugin | undefined`

Get a specific plugin.

```typescript
const plugin = pluginManager.getPlugin('my-plugin');
```

---

#### `subscribe(callback: Function): () => void`

Subscribe to plugin changes.

```typescript
const unsubscribe = pluginManager.subscribe((plugins) => {
  console.log('Plugins updated:', plugins);
});
```

---

## React Hooks

### Route Hooks

```typescript
// Get all routes
const routes = useRoutes();

// Get routes by layout
const dashboardRoutes = useRoutesByLayout('dashboard');

// Get protected routes
const protectedRoutes = useProtectedRoutes();

// Get single route
const route = useRoute('route-id');

// Check access
const hasAccess = useRouteAccess('route-id', ['admin']);

// Get statistics
const stats = useRouteStats();
```

---

### Navigation Hooks

```typescript
// Get all navigation items
const items = useNavigation();

// Get hierarchical tree
const tree = useNavigationTree();

// Get by section
const sections = useNavigationBySection();

// Get for user
const userNav = useNavigationForUser(['admin']);

// Get sections for user
const userSections = useNavigationSectionsForUser(['admin']);

// Get statistics
const stats = useNavigationStats();

// Get all sections
const sections = useNavigationSections();
```

---

### Component Hooks

```typescript
// Get component
const Component = useComponent('component-id');

// Get all components
const components = useComponents();

// Get by category
const widgets = useComponentsByCategory('widgets');

// Get by tag
const tagged = useComponentsByTag('dashboard');

// Search
const results = useComponentSearch('analytics');

// Get statistics
const stats = useComponentStats();

// Get categories
const categories = useComponentCategories();

// Get tags
const tags = useComponentTags();
```

---

### Hook System Hooks

```typescript
// Get all hooks
const hooks = useHooks();

// Get specific hook
const hook = useHook('hook-name');

// Subscribe to hook
useHookSubscription('hook-name', callback, 'plugin-id');

// Get emitter
const { emit, emitSequential } = useHookEmitter('hook-name');

// Get subscriptions
const subs = useHookSubscriptions('hook-name');

// Get plugin hooks
const pluginHooks = usePluginHooks('plugin-id');

// Get plugin subscriptions
const pluginSubs = usePluginSubscriptions('plugin-id');

// Check if hook exists
const exists = useHookExists('hook-name');

// Get statistics
const stats = useHookStats();

// Define hook
useHookDefinition('hook-name', 'plugin-id', 'description');

// Lifecycle hooks
useLifecycleHooks('component-id', {
  onMount: () => {},
  onUnmount: () => {},
  onUpdate: () => {},
  onError: (error) => {}
});
```

---

## Type Definitions

### RouteDefinition

```typescript
interface RouteDefinition {
  id: string;
  path: string;
  layout?: string;
  pluginId: string;
  protected?: boolean;
  roles?: string[];
  priority?: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
}
```

---

### NavigationItem

```typescript
interface NavigationItem {
  id: string;
  title: string;
  path?: string;
  icon?: string;
  pluginId: string;
  section?: string;
  parent?: string;
  order?: number;
  roles?: string[];
  enabled?: boolean;
  badge?: {
    text: string;
    color?: string;
  };
  children?: NavigationItem[];
}
```

---

### ComponentDefinition

```typescript
interface ComponentDefinition {
  id: string;
  name: string;
  component: React.ComponentType<any>;
  pluginId: string;
  category?: string;
  tags?: string[];
  description?: string;
  enabled?: boolean;
  metadata?: Record<string, any>;
}
```

---

### ComponentOverride

```typescript
interface ComponentOverride {
  componentId: string;
  component: React.ComponentType<any>;
  pluginId: string;
  priority: number;
  condition?: () => boolean;
}
```

---

### ProviderDefinition

```typescript
interface ProviderDefinition {
  id: string;
  component: React.ComponentType<{ children: React.ReactNode }>;
  pluginId: string;
  order?: number;
  enabled?: boolean;
  dependencies?: string[];
  config?: Record<string, any>;
}
```

---

### HookDefinition

```typescript
interface HookDefinition {
  name: string;
  description?: string;
  pluginId: string;
  subscriberCount: number;
  executionCount: number;
  lastExecuted?: number;
}
```

---

### HookSubscription

```typescript
interface HookSubscription {
  id: string;
  hookName: string;
  callback: HookCallback;
  pluginId: string;
  priority: number;
  filter?: HookFilter;
  enabled: boolean;
}

type HookCallback<T = any> = (data: T) => void | Promise<void>;
type HookFilter<T = any> = (data: T) => boolean;
```

---

### Plugin

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  description?: string;
  author?: string;
  priority?: number;
  status?: PluginStatus;

  routes?: RouteDefinition[];
  navigation?: NavigationItem[];
  components?: Record<string, React.ComponentType>;
  providers?: React.ComponentType[];

  hooks?: {
    definitions?: Array<{ name: string; description?: string }>;
    onInit?: () => void | Promise<void>;
    onLoad?: () => void | Promise<void>;
    onUnload?: () => void | Promise<void>;
    onDestroy?: () => void | Promise<void>;
    onError?: (error: Error) => void;
  };

  config?: Record<string, any>;
  metadata?: Record<string, any>;
}

type PluginStatus = 'idle' | 'loading' | 'active' | 'error';
```

---

### PluginManifest

```typescript
interface PluginManifest {
  // Identity
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: PluginAuthor | string;
  license?: string;
  homepage?: string;
  repository?: string;

  // Behavior
  enabled?: boolean;
  autoLoad?: boolean;
  priority?: number;

  // Dependencies
  dependencies?: PluginDependency[];
  peerDependencies?: PluginDependency[];

  // Permissions
  permissions?: PluginPermissions;

  // Resources
  routes?: Array<{ id: string; path: string; /* ... */ }>;
  navigation?: Array<{ id: string; title: string; /* ... */ }>;
  components?: Array<{ id: string; name: string; /* ... */ }>;
  providers?: Array<{ id: string; order?: number; /* ... */ }>;
  hooks?: Array<{ name: string; description?: string }>;

  // Lifecycle
  lifecycle?: {
    onInit?: string;
    onLoad?: string;
    onUnload?: string;
    onDestroy?: string;
    onError?: string;
  };

  // Configuration
  config?: Record<string, any>;
  features?: string[];
  minVersion?: string;
  maxVersion?: string;
  metadata?: Record<string, any>;
}
```

---

## Constants

### Default Values

```typescript
// Route defaults
DEFAULT_ROUTE_PRIORITY = 0;
DEFAULT_ROUTE_PROTECTED = false;
DEFAULT_ROUTE_ENABLED = true;

// Navigation defaults
DEFAULT_NAV_ORDER = 0;
DEFAULT_NAV_ENABLED = true;

// Component defaults
DEFAULT_COMPONENT_ENABLED = true;

// Provider defaults
DEFAULT_PROVIDER_ORDER = 0;
DEFAULT_PROVIDER_ENABLED = true;

// Hook defaults
DEFAULT_HOOK_PRIORITY = 0;
DEFAULT_HOOK_ENABLED = true;
```

---

## Error Handling

All registry methods handle errors gracefully and log warnings to console. Critical errors will throw exceptions.

```typescript
try {
  routeRegistry.registerRoute(route);
} catch (error) {
  console.error('Failed to register route:', error);
}
```

---

## Performance Considerations

- **Registries use Map**: O(1) lookups by ID
- **Subscriptions are cached**: No repeated calculations
- **React hooks auto-update**: Subscribe to changes automatically
- **Lazy evaluation**: Components loaded on-demand
- **Priority sorting**: Cached after registration

---

## Version Compatibility

This API is stable for version 1.x. Breaking changes will increment the major version.

**Current Version**: 1.0.0
**Minimum Next.js**: 14.0.4
**Minimum React**: 18.2.0
**TypeScript**: 5.0+
