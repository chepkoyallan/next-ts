# Complete Configuration System Guide

## 🎉 Overview

Your Next.js application now has a **comprehensive, enterprise-grade configuration system** that makes it highly configurable and extensible. This system provides centralized control over all aspects of your application.

## 📁 File Structure

```
src/config/
├── types.ts                          # TypeScript type definitions
├── default-config.ts                 # Default configuration values
├── config-manager.ts                 # Core configuration manager
├── index.ts                          # Main exports
├── README.md                         # Detailed documentation
│
├── hooks/
│   └── use-config.ts                 # React hooks for configuration
│
├── plugins/
│   └── plugin-registry.ts            # Plugin system
│
├── navigation/
│   └── navigation-builder.ts         # Dynamic navigation builder
│
├── theme/
│   └── theme-builder.ts              # Theme customization
│
├── tenant/
│   └── tenant-manager.ts             # Multi-tenant support
│
└── api/
    └── api-config-manager.ts         # API configuration & caching

src/sections/admin/config-panel/
├── config-panel-view.tsx             # Main configuration UI
└── tabs/
    ├── config-general-tab.tsx        # General info tab
    ├── config-features-tab.tsx       # Feature flags tab
    ├── config-modules-tab.tsx        # Module configuration tab
    ├── config-ui-tab.tsx             # UI/Theme configuration tab
    ├── config-auth-tab.tsx           # Authentication settings
    ├── config-branding-tab.tsx       # Branding settings
    ├── config-api-tab.tsx            # API settings
    └── config-advanced-tab.tsx       # Advanced settings
```

## 🚀 Quick Start

### 1. Access the Configuration Panel

Create a page to access the admin panel:

```typescript
// src/app/dashboard/config/page.tsx
import ConfigPanelView from 'src/sections/admin/config-panel/config-panel-view';

export default function ConfigPage() {
  return <ConfigPanelView />;
}
```

### 2. Use Configuration in Components

```typescript
'use client';

import { useConfig, useFeature } from 'src/config';

export function MyComponent() {
  // Access entire config
  const { config, updateConfig } = useConfig();

  // Check specific feature
  const chatEnabled = useFeature('enableChat');

  return (
    <div>
      <h1>{config.branding.appName}</h1>
      {chatEnabled && <ChatWidget />}
    </div>
  );
}
```

### 3. Configure Features via Environment Variables

Update your `.env` file:

```bash
# Features
NEXT_PUBLIC_FEATURE_CHAT=true
NEXT_PUBLIC_FEATURE_MAIL=false
NEXT_PUBLIC_FEATURE_ANALYTICS=true

# Branding
NEXT_PUBLIC_APP_NAME="My Custom App"
NEXT_PUBLIC_COMPANY_NAME="My Company"

# API
NEXT_PUBLIC_HOST_API=https://api.myapp.com

# Performance
NEXT_PUBLIC_MAX_FILE_UPLOAD_SIZE=52428800  # 50MB
```

## 💡 Key Features

### 1. Feature Flags ✨

Control features without code deployment:

```typescript
// Enable/disable features
configManager.setValue('features.enableChat', true);

// In components
const chatEnabled = useFeature('enableChat');
```

**Use Cases:**

- A/B testing
- Gradual rollouts
- Emergency feature disable
- Beta features

### 2. Module Configuration 📦

Fine-grained control over modules:

```typescript
// Configure module
configManager.updateConfig({
  modules: {
    invoice: {
      enabled: true,
      permissions: ['admin', 'accountant'],
      hidden: false,
      badge: 'NEW',
    },
  },
});

// Check access
const hasAccess = useModulePermission('invoice', userRoles);
```

**Use Cases:**

- Role-based access control
- Module-specific permissions
- Hide modules from navigation
- Display badges/notifications

### 3. Dynamic Navigation 🧭

Navigation adapts to configuration:

```typescript
import { getNavigationBuilder } from 'src/config';

const navBuilder = getNavigationBuilder();

// Build nav for user's roles
const navigation = navBuilder.build(['admin', 'manager']);

// Add custom items
navBuilder.addItem('custom', {
  id: 'reports',
  title: 'Reports',
  path: '/reports',
  icon: 'ic_reports',
});
```

**Features:**

- Permission-based filtering
- Dynamic menu items
- Plugin-contributed items
- Custom sections

### 4. Plugin System 🔌

Extend functionality without modifying core:

```typescript
import { Plugin, getPluginRegistry } from 'src/config';

// Create plugin
const myPlugin: Plugin = {
  id: 'custom-reports',
  name: 'Custom Reports',
  version: '1.0.0',
  enabled: true,

  // Add routes
  routes: [
    {
      path: '/reports/custom',
      component: CustomReportsComponent,
    },
  ],

  // Add navigation
  navigation: [
    {
      id: 'custom-reports',
      title: 'Custom Reports',
      path: '/reports/custom',
    },
  ],

  // Lifecycle hooks
  hooks: {
    onInit: async () => {
      console.log('Plugin initialized');
    },
  },
};

// Register
getPluginRegistry().register(myPlugin);
```

**Benefits:**

- Modular architecture
- Easy maintenance
- Third-party extensions
- A/B testing features

### 5. Theme Builder 🎨

Dynamic theme customization:

```typescript
import { getThemeBuilder } from 'src/config';

const themeBuilder = getThemeBuilder();

// Create theme
themeBuilder.createPreset('corporate', '#003366', '#FF6B35', {
  typography: {
    fontFamily: '"Open Sans", sans-serif',
  },
  spacing: 10,
  shadows: 'heavy',
});

// Apply theme
themeBuilder.applyTheme('corporate');

// Export/import themes
const json = themeBuilder.exportTheme('corporate');
themeBuilder.importTheme('new-theme', jsonString);
```

**Features:**

- Multiple color presets
- Custom fonts
- Shadow variations
- Export/import themes

### 6. Multi-Tenant Support 🏢

Manage multiple tenants:

```typescript
import { getTenantManager } from 'src/config';

const tenantManager = getTenantManager();

// Register tenant
tenantManager.registerTenant({
  tenantId: 'company-a',
  tenantName: 'Company A',
  subdomain: 'companya',
  branding: {
    appName: 'Company A Dashboard',
    primaryColor: '#FF5733',
    logo: '/logos/companya.png',
  },
  features: {
    enableChat: true,
    enableInvoice: false,
  },
});

// Auto-detect from URL
tenantManager.autoDetectTenant(hostname);

// Switch tenant
tenantManager.switchTenant('company-a');
```

**Use Cases:**

- SaaS applications
- White-label solutions
- Per-client customization
- Isolated environments

### 7. API Configuration Manager 🌐

Centralized API management:

```typescript
import { getAPIConfigManager } from 'src/config';

const apiManager = getAPIConfigManager();

// Register endpoints
apiManager.registerEndpoint('users.list', {
  url: '/api/users',
  method: 'GET',
  cache: true,
  cacheDuration: 5,
});

// Make requests
const users = await apiManager.request('users.list');

// Add interceptors
apiManager.addRequestInterceptor((config) => {
  config.headers['X-Tenant-ID'] = tenantId;
  return config;
});
```

**Features:**

- Endpoint registry
- Automatic caching
- Retry logic
- Request/response interceptors
- Performance monitoring

## 🎯 Common Use Cases

### Use Case 1: Feature Rollout

```typescript
// Phase 1: Enable for internal users only
if (user.isInternal) {
  configManager.addOverride({
    priority: 100,
    features: { enableNewDashboard: true },
  });
}

// Phase 2: Enable for 10% of users
if (Math.random() < 0.1) {
  configManager.setValue('features.enableNewDashboard', true);
}

// Phase 3: Enable for everyone
configManager.setValue('features.enableNewDashboard', true);
```

### Use Case 2: White-Label Application

```typescript
// Detect tenant from domain
const hostname = window.location.hostname;
tenantManager.autoDetectTenant(hostname);

const tenant = tenantManager.getCurrentTenant();

// Application automatically shows:
// - Tenant's logo
// - Tenant's colors
// - Tenant's features
// - Tenant's branding
```

### Use Case 3: Role-Based Features

```typescript
// Admin sees everything
const navigation = navBuilder.build(['admin']);

// Manager sees limited features
const navigation = navBuilder.build(['manager']);

// User sees basic features
const navigation = navBuilder.build(['user']);
```

### Use Case 4: A/B Testing

```typescript
// Variant A
const variantA = {
  ui: { defaultTheme: 'light' },
  features: { enableNewFeature: false },
};

// Variant B
const variantB = {
  ui: { defaultTheme: 'dark' },
  features: { enableNewFeature: true },
};

// Apply based on user segment
const variant = user.segment === 'A' ? variantA : variantB;
configManager.updateConfig(variant);
```

### Use Case 5: Emergency Disable

```typescript
// Disable problematic feature immediately
configManager.setValue('features.enableProblematicFeature', false);

// Or disable entire module
configManager.setValue('modules.problematicModule.enabled', false);
```

## 🛠️ Integration Examples

### Integrate with Existing Auth

```typescript
// src/app/layout.tsx
'use client';

import { useEffect } from 'react';
import { useAuthContext } from 'src/auth/hooks';
import { getConfigManager } from 'src/config';

export function ConfigInitializer() {
  const { user } = useAuthContext();
  const configManager = getConfigManager();

  useEffect(() => {
    if (user) {
      // Apply user-specific overrides
      if (user.roles.includes('admin')) {
        configManager.addOverride({
          priority: 50,
          features: { enablePermissions: true },
        });
      }
    }
  }, [user]);

  return null;
}
```

### Integrate with Existing Navigation

```typescript
// src/layouts/dashboard/config-navigation.tsx
import { useMemo } from 'react';
import { getNavigationBuilder } from 'src/config';
import { useAuthContext } from 'src/auth/hooks';

export function useNavData() {
  const { user } = useAuthContext();
  const navBuilder = getNavigationBuilder();

  const data = useMemo(() => {
    return navBuilder.build(user?.roles || []);
  }, [user?.roles]);

  return data;
}
```

### Integrate with Existing Theme

```typescript
// src/theme/index.tsx
import { useMemo } from 'react';
import { useConfig } from 'src/config';
import { getThemeBuilder } from 'src/config';

export default function ThemeProvider({ children }) {
  const { config } = useConfig();
  const themeBuilder = getThemeBuilder();

  const themeOptions = useMemo(() => {
    return themeBuilder.buildThemeOptions();
  }, [config.branding]);

  const theme = createTheme(themeOptions);

  return (
    <MuiThemeProvider theme={theme}>
      {children}
    </MuiThemeProvider>
  );
}
```

## 📊 Configuration Panel

Access the configuration panel at `/dashboard/config`:

### Features Tab

- Toggle features on/off
- See feature descriptions
- Instant apply

### Modules Tab

- Enable/disable modules
- Set permissions
- Control visibility
- Add badges

### UI Tab

- Change default layout
- Select theme mode
- Choose color presets
- Configure contrast

### Import/Export

- Export configuration as JSON
- Import from file
- Share configurations
- Version control

## 🔐 Security Considerations

1. **Restrict Access**

   ```typescript
   // Only admins can access config panel
   if (!user.roles.includes('admin')) {
     return <Forbidden />;
   }
   ```

2. **Validate Changes**

   ```typescript
   const { valid, errors } = configManager.validateConfig();
   if (!valid) {
     throw new Error(errors.join(', '));
   }
   ```

3. **Audit Changes**
   ```typescript
   configManager.subscribe((config) => {
     logAuditEvent('config_changed', { config, user });
   });
   ```

## 🚀 Performance Tips

1. **Use Feature Flags for Code Splitting**

   ```typescript
   const ChatModule = lazy(() =>
     configManager.isFeatureEnabled('enableChat')
       ? import('./ChatModule')
       : Promise.resolve({ default: () => null })
   );
   ```

2. **Cache API Responses**

   ```typescript
   apiManager.registerEndpoint('users.list', {
     url: '/api/users',
     cache: true,
     cacheDuration: 10, // minutes
   });
   ```

3. **Optimize Navigation Building**
   ```typescript
   const navigation = useMemo(() => navBuilder.build(userRoles), [userRoles]);
   ```

## 📝 Migration Guide

### From Hardcoded Features

**Before:**

```typescript
const ENABLE_CHAT = true;

if (ENABLE_CHAT) {
  return <Chat />;
}
```

**After:**

```typescript
const chatEnabled = useFeature('enableChat');

if (chatEnabled) {
  return <Chat />;
}
```

### From Environment Variables

**Before:**

```typescript
if (process.env.NEXT_PUBLIC_ENABLE_CHAT === 'true') {
  return <Chat />;
}
```

**After:**

```typescript
// In default-config.ts (already done)
enableChat: process.env.NEXT_PUBLIC_FEATURE_CHAT === 'true' ?? true,

// In component
const chatEnabled = useFeature('enableChat');
```

## 🎓 Next Steps

1. **Create Admin Route**

   - Add `/dashboard/config` page
   - Restrict to admins only

2. **Customize Configuration**

   - Add your own feature flags
   - Configure modules for your needs
   - Set up tenant configs if multi-tenant

3. **Create Plugins**

   - Build modular features
   - Share plugins across projects
   - Enable/disable as needed

4. **Set Up Themes**

   - Create brand themes
   - Allow users to customize
   - Support dark mode

5. **Configure API**
   - Register your endpoints
   - Set up caching strategy
   - Add interceptors

## 🐛 Troubleshooting

**Problem:** Configuration changes not persisting

**Solution:** Check localStorage permissions and browser console

---

**Problem:** Features not appearing after enabling

**Solution:** Hard refresh the page or clear localStorage

---

**Problem:** Tenant not detected automatically

**Solution:** Verify subdomain/domain configuration matches

---

**Problem:** Plugins not loading

**Solution:** Ensure plugins are registered before `initializeAll()`

## 📚 Additional Resources

- [Full API Documentation](./src/config/README.md)
- [TypeScript Types](./src/config/types.ts)
- [Default Configuration](./src/config/default-config.ts)

## 🤝 Contributing

To add new configuration options:

1. Update types in `src/config/types.ts`
2. Add defaults in `src/config/default-config.ts`
3. Create UI in admin panel tabs
4. Update documentation

---

**Congratulations!** Your application is now highly configurable with enterprise-grade features. 🎉
