# 🔌 Plugin System - Complete Guide

## 🎯 Overview

A comprehensive plugin system that allows you to **dynamically extend** your application with:

- ✅ Custom routes and pages
- ✅ Navigation items
- ✅ Layouts and sections
- ✅ Components
- ✅ Lifecycle hooks
- ✅ API endpoints
- ✅ Configuration tabs

**Everything is configurable through the UI - no code changes required!**

---

## 🚀 Quick Start

### 1. Navigate to Plugin Management

```
http://localhost:8082/dashboard/configuration
→ Click "Plugins" tab
```

### 2. Add a Plugin

- Click "Add Plugin" button
- Fill in plugin details:
  - Name: "My Custom Plugin"
  - Description: "Adds custom analytics"
  - Version: "1.0.0"
  - Type: Select from: `ui | api | integration | theme | utility | full`
  - Author: Your name
  - Enabled: Toggle on/off

### 3. Configure Plugin

After creation, plugins can be programmatically enhanced with:

- Routes
- Components
- Hooks
- Navigation items
- Layouts

---

## 📚 Plugin Types

| Type            | Description               | Use Cases                       |
| --------------- | ------------------------- | ------------------------------- |
| **ui**          | User interface extensions | Custom pages, dashboards, forms |
| **api**         | Backend functionality     | REST endpoints, data processors |
| **integration** | Third-party integrations  | Stripe, Auth0, Analytics        |
| **theme**       | Visual customization      | Color schemes, fonts, layouts   |
| **utility**     | Helper functions          | Utils, validators, formatters   |
| **full**        | Complete feature module   | E-commerce, CRM, Blog           |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Configuration UI                       │
│                    (Plugins Tab)                         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   Plugin Manager                         │
│             (Singleton - Lifecycle Management)           │
└───────────────────────┬─────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ Plugin Routes  │ │ Plugin Nav │ │ Plugin Hooks │
└────────────────┘ └────────────┘ └──────────────┘
         │              │              │
         ↓              ↓              ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Runtime                     │
│        (Routes | Navigation | Components | APIs)         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Creating a Plugin

### Method 1: Using the UI

1. Go to Configuration → Plugins
2. Click "Add Plugin"
3. Fill form and save
4. Plugin is created with basic metadata

### Method 2: Programmatic Creation

```typescript
import type { Plugin } from 'src/config/types';

export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Custom Plugin',
  version: '1.0.0',
  description: 'Does amazing things',
  author: 'Your Name',
  enabled: true,
  type: 'ui',
  status: 'inactive',

  // Define routes
  routes: [
    {
      path: '/my-feature',
      component: MyFeatureComponent,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'My Feature',
        description: 'Custom feature page',
      },
    },
  ],

  // Add navigation
  navigation: [
    {
      id: 'my-feature',
      title: 'My Feature',
      path: '/my-feature',
      icon: 'solar:widget-2-bold-duotone',
      section: 'overview',
      order: 50,
    },
  ],

  // Lifecycle hooks
  hooks: {
    onInit: async () => {
      console.log('Plugin initialized!');
    },
    onAuth: async (user) => {
      console.log('User logged in:', user);
    },
  },

  // Settings
  settings: {
    apiKey: '',
    enabled: true,
  },

  // Dependencies
  dependencies: ['analytics-core'],

  // Metadata
  metadata: {
    repository: 'https://github.com/user/my-plugin',
    license: 'MIT',
    tags: ['analytics', 'dashboard'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
};
```

---

## 📦 Plugin Structure

### Full Plugin Interface

```typescript
interface Plugin {
  // Identity
  id: string; // Unique identifier
  name: string; // Display name
  version: string; // Semantic version
  description?: string; // Brief description
  author?: string; // Author name
  enabled: boolean; // Is active
  status?: PluginStatus; // active | inactive | error | loading
  type: PluginType; // ui | api | integration | theme | utility | full

  // UI Components
  routes?: PluginRoute[]; // Custom pages/routes
  navigation?: PluginNavItem[]; // Nav menu items
  components?: Record<string, React.ComponentType>; // Reusable components
  layouts?: PluginLayout[]; // Custom layouts
  sections?: PluginSection[]; // UI sections (e.g., config tabs)

  // Functionality
  hooks?: PluginHooks; // Lifecycle hooks
  apis?: PluginAPI[]; // API endpoints

  // Configuration
  settings?: Record<string, any>; // Plugin settings
  dependencies?: string[]; // Required plugins
  configSchema?: Record<string, any>; // JSON Schema for validation

  // Metadata
  metadata?: PluginMetadata; // Additional info
  installDate?: string; // Installation timestamp
  updateDate?: string; // Last update timestamp
  isSystem?: boolean; // System plugin (can't delete)

  // Source
  source?: 'local' | 'npm' | 'url' | 'inline';
  sourceUrl?: string; // Remote plugin URL
  entryPoint?: string; // Main file/module
}
```

---

## 🎣 Using Hooks

### Available Lifecycle Hooks

```typescript
interface PluginHooks {
  // Initialization
  onInit?: () => void | Promise<void>;

  // Authentication
  onAuth?: (user: any) => void | Promise<void>;
  onLogout?: () => void | Promise<void>;

  // Navigation
  beforeRouteChange?: (to: string, from: string) => boolean | Promise<boolean>;

  // Errors
  onError?: (error: Error) => void;

  // Configuration
  onConfigChange?: (config: Partial<AppConfig>) => void;

  // Theme
  onThemeChange?: (theme: ThemeMode) => void;
}
```

### Example: Analytics Tracking

```typescript
hooks: {
  onInit: async () => {
    // Initialize analytics SDK
    await analytics.initialize(pluginSettings.apiKey);
  },

  onAuth: async (user) => {
    // Track user login
    analytics.identify(user.id, {
      email: user.email,
      name: user.name,
    });
  },

  beforeRouteChange: async (to, from) => {
    // Track page view
    analytics.page(to);
    return true; // Allow navigation
  },

  onError: (error) => {
    // Log error to external service
    errorTracker.captureException(error);
  },
}
```

---

## 🛣️ Adding Routes

### Basic Route

```typescript
routes: [
  {
    path: '/analytics',
    component: AnalyticsDashboard,
    protected: true, // Requires authentication
    layout: 'dashboard', // Uses dashboard layout
    meta: {
      title: 'Analytics',
      description: 'View analytics',
    },
  },
];
```

### Dynamic Routes

```typescript
routes: [
  {
    path: '/reports/:reportId',
    component: ReportViewer,
    protected: true,
  },
];
```

### Public Routes

```typescript
routes: [
  {
    path: '/public/landing',
    component: LandingPage,
    protected: false, // Public access
    layout: 'minimal',
  },
];
```

---

## 🧭 Adding Navigation

### Simple Nav Item

```typescript
navigation: [
  {
    id: 'analytics',
    title: 'Analytics',
    path: '/analytics',
    icon: 'solar:chart-2-bold-duotone',
    section: 'overview', // Which section to add to
    order: 100, // Display order
  },
];
```

### Nav with Badge

```typescript
navigation: [
  {
    id: 'notifications',
    title: 'Notifications',
    path: '/notifications',
    icon: 'solar:bell-bold-duotone',
    section: 'overview',
    badge: 'NEW', // Show badge
    roles: ['admin'], // Role restriction
  },
];
```

### Nested Navigation

```typescript
navigation: [
  {
    id: 'reports',
    title: 'Reports',
    path: '/reports',
    icon: 'solar:document-text-bold-duotone',
    section: 'management',
    children: [
      {
        id: 'reports-sales',
        title: 'Sales Reports',
        path: '/reports/sales',
      },
      {
        id: 'reports-users',
        title: 'User Reports',
        path: '/reports/users',
      },
    ],
  },
];
```

---

## 🎨 Adding Layouts

### Custom Layout

```typescript
function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <MyHeader />
      <Box sx={{ p: 3 }}>{children}</Box>
      <MyFooter />
    </Box>
  );
}

// Register in plugin
layouts: [
  {
    id: 'my-layout',
    name: 'My Custom Layout',
    component: MyLayout,
    isDefault: false,          // Not default layout
  },
]
```

### Using Custom Layout in Route

```typescript
routes: [
  {
    path: '/custom-page',
    component: CustomPage,
    layout: 'custom', // Must match layout id
  },
];
```

---

## 📄 Adding Sections

### Configuration Tab Section

```typescript
function MyConfigSection() {
  return (
    <Box>
      <Typography variant="h6">My Plugin Settings</Typography>
      {/* Your settings UI */}
    </Box>
  );
}

// Register section
sections: [
  {
    id: 'my-settings',
    name: 'My Settings',
    component: MyConfigSection,
    configTab: true,           // Show in configuration dashboard
    order: 100,
  },
]
```

---

## 🔌 Plugin Manager API

### React Hooks

```typescript
import {
  usePlugins,
  usePlugin,
  usePluginRoutes,
  usePluginNavigation,
  usePluginLayouts,
  usePluginSections,
} from 'src/plugins';

// Get all plugins
const { plugins } = usePlugins();

// Get specific plugin
const analyticsPlugin = usePlugin('analytics-pro');

// Get all plugin routes
const pluginRoutes = usePluginRoutes();

// Get all plugin nav items
const pluginNavItems = usePluginNavigation();

// Get all plugin layouts
const pluginLayouts = usePluginLayouts();

// Get all plugin sections
const pluginSections = usePluginSections();
```

### Programmatic Management

```typescript
import { pluginManager } from 'src/plugins';

// Enable plugin
pluginManager.enablePlugin('my-plugin');

// Disable plugin
pluginManager.disablePlugin('my-plugin');

// Register new plugin
pluginManager.registerPlugin(myPlugin);

// Unregister plugin
pluginManager.unregisterPlugin('my-plugin');

// Update plugin settings
pluginManager.updatePluginSettings('my-plugin', {
  apiKey: 'new-key',
});

// Execute hook across all plugins
await pluginManager.executeHook('onAuth', user);

// Check dependencies
const { valid, missing } = pluginManager.checkDependencies(plugin);
```

---

## 📝 Example Plugins

### Example 1: Analytics Dashboard Plugin

See: `/src/plugins/examples/analytics-plugin.tsx`

**Features:**

- Custom route: `/analytics-pro`
- Navigation item in "Overview" section
- Lifecycle hooks (init, auth, error)
- Custom settings
- PRO badge

### Example 2: Custom Layout Plugin

See: `/src/plugins/examples/custom-layout-plugin.tsx`

**Features:**

- Custom layout component
- Configuration section
- Theme customization
- Settings panel

---

## 🎯 Use Cases

### 1. Add Third-Party Integration

```typescript
const stripePlugin: Plugin = {
  id: 'stripe-integration',
  name: 'Stripe Payments',
  type: 'integration',
  hooks: {
    onInit: async () => {
      await stripe.initialize(settings.apiKey);
    },
  },
  apis: [
    {
      endpoint: '/api/stripe/webhook',
      method: 'POST',
      handler: stripeWebhookHandler,
    },
  ],
};
```

### 2. Add Custom Dashboard

```typescript
const dashboardPlugin: Plugin = {
  id: 'custom-dashboard',
  name: 'Executive Dashboard',
  type: 'ui',
  routes: [
    {
      path: '/executive',
      component: ExecutiveDashboard,
      protected: true,
      layout: 'dashboard',
    },
  ],
  navigation: [
    {
      id: 'executive',
      title: 'Executive',
      path: '/executive',
      icon: 'solar:chart-2-bold-duotone',
      section: 'overview',
      roles: ['admin', 'executive'],
    },
  ],
};
```

### 3. Add Custom Theme

```typescript
const darkThemePlugin: Plugin = {
  id: 'dark-theme-pro',
  name: 'Dark Theme Pro',
  type: 'theme',
  hooks: {
    onInit: () => {
      registerCustomTheme('dark-pro', darkProTheme);
    },
  },
};
```

---

## 🔐 Security & Permissions

### Role-Based Access

```typescript
navigation: [
  {
    id: 'admin-panel',
    title: 'Admin Panel',
    path: '/admin',
    roles: ['admin', 'super-admin'], // Only visible to these roles
  },
];
```

### Route Protection

```typescript
routes: [
  {
    path: '/sensitive-data',
    component: SensitiveDataPage,
    protected: true, // Requires authentication
  },
];
```

### Hook-Based Validation

```typescript
hooks: {
  beforeRouteChange: async (to, from) => {
    // Custom validation logic
    if (to === '/admin' && !user.isAdmin) {
      return false; // Block navigation
    }
    return true; // Allow navigation
  },
}
```

---

## 🧪 Testing Plugins

### 1. Enable Plugin in UI

```
Configuration → Plugins → Toggle "Enabled"
```

### 2. Check Console

Look for initialization messages:

```
[PluginManager] Loading plugin: My Plugin
[PluginManager] Plugin loaded: My Plugin
```

### 3. Verify Route

Navigate to plugin route:

```
http://localhost:8082/my-feature
```

### 4. Check Navigation

Look for new nav items in sidebar

### 5. Test Hooks

Perform actions that trigger hooks:

- Login (onAuth)
- Navigate (beforeRouteChange)
- Cause error (onError)

---

## 📊 Plugin Status

| Status       | Description                  |
| ------------ | ---------------------------- |
| **active**   | Plugin is loaded and running |
| **inactive** | Plugin is disabled           |
| **loading**  | Plugin is being initialized  |
| **error**    | Plugin failed to load        |

---

## 🐛 Troubleshooting

### Plugin Not Loading

**Check:**

1. ✅ Plugin is enabled in UI
2. ✅ No missing dependencies
3. ✅ No errors in browser console
4. ✅ Component imports are valid

### Routes Not Working

**Check:**

1. ✅ Route path doesn't conflict with existing routes
2. ✅ Component is properly imported
3. ✅ Layout exists (if specified)
4. ✅ Plugin is enabled

### Navigation Not Showing

**Check:**

1. ✅ Section exists (overview, management, etc.)
2. ✅ User has required roles
3. ✅ Icon name is valid
4. ✅ Plugin is enabled

### Hooks Not Executing

**Check:**

1. ✅ Hook function is async if it performs async operations
2. ✅ No errors in hook code
3. ✅ Plugin is enabled and loaded
4. ✅ Console for hook execution logs

---

## 🚀 Best Practices

1. **Versioning**: Use semantic versioning (1.0.0)
2. **Dependencies**: Declare all plugin dependencies
3. **Error Handling**: Wrap hook code in try-catch
4. **Performance**: Lazy-load heavy components
5. **Documentation**: Add clear descriptions and metadata
6. **Testing**: Test thoroughly before enabling
7. **Settings**: Use configSchema for validation
8. **Security**: Validate user permissions in hooks

---

## 📖 API Reference

See TypeScript interfaces in `/src/config/types.ts`:

- `Plugin`
- `PluginRoute`
- `PluginNavItem`
- `PluginHooks`
- `PluginLayout`
- `PluginSection`
- `PluginAPI`

---

## 🎉 Summary

You now have a complete plugin system that allows:

✅ **Dynamic Extension** - Add features without code changes
✅ **UI Plugins** - Routes, navigation, layouts, sections
✅ **API Plugins** - Custom endpoints and integrations
✅ **Lifecycle Hooks** - React to app events
✅ **CRUD Management** - Full UI for plugin management
✅ **Hot Reload** - Enable/disable without restart
✅ **Type Safe** - Full TypeScript support
✅ **Examples Included** - Analytics and Layout plugins

**Start building your first plugin today!** 🚀
