# Plugin System Documentation

Complete documentation for the modular plugin architecture.

## 📚 Documentation Index

### Getting Started

- **[Quick Start Guide](./QUICK_START.md)** - Get your first plugin running in 5 minutes
- **[Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)** - Comprehensive guide with examples
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation

### Overview

This plugin system transforms your Next.js application into a fully modular platform where features can be:

- ✅ **Dynamically loaded** at runtime
- ✅ **Configured** via JSON manifests
- ✅ **Communicate** through events
- ✅ **Extended** by other plugins
- ✅ **Managed** with dependencies

## 🎯 Core Features

### 1. Registry System

Five core registries manage different aspects of your application:

| Registry | Purpose | Key Features |
|----------|---------|--------------|
| **RouteRegistry** | Dynamic routes | Role-based access, layouts, priorities |
| **NavigationRegistry** | Dynamic menus | Hierarchical structure, sections, badges |
| **ComponentRegistry** | Component discovery | Categories, tags, override system |
| **ProviderRegistry** | Provider composition | Dependency resolution, auto-ordering |
| **HookRegistry** | Event system | Cross-plugin communication, priorities |

### 2. Plugin Architecture

```
packages/features/
├── my-plugin/
│   ├── plugin.json          # Declarative configuration
│   ├── index.ts             # Plugin implementation
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   └── README.md           # Documentation
```

### 3. Event-Driven Communication

Plugins communicate through a powerful event system:

```typescript
// Plugin A defines a hook
hookRegistry.defineHook('user.login', 'auth-plugin');

// Plugin B subscribes
hookRegistry.subscribe('user.login', (user) => {
  console.log('User logged in:', user);
}, 'analytics-plugin');

// Plugin A emits the event
await hookRegistry.emit('user.login', userData);
```

### 4. React Hooks Integration

Access registries easily in React components:

```typescript
import { useRoutes, useNavigation, useComponents, useHooks } from '@app/config/registry';

function MyComponent() {
  const routes = useRoutes();
  const navigation = useNavigation();
  const components = useComponents();
  const hooks = useHooks();

  // Use them in your component
}
```

## 🚀 Quick Example

### Create a Plugin

```typescript
// packages/features/my-plugin/index.ts
import type { Plugin } from '@app/config/types';

export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  routes: [
    {
      id: 'my-page',
      path: '/my-page',
      layout: 'dashboard'
    }
  ],

  navigation: [
    {
      id: 'my-nav',
      title: 'My Page',
      path: '/my-page',
      icon: 'star'
    }
  ],

  hooks: {
    onInit: () => console.log('Plugin loaded!')
  }
};
```

### Register It

```typescript
// packages/core/config/src/config-manager.ts
import { myPlugin } from '@features/my-plugin';

const defaultConfig: AppConfig = {
  plugins: [myPlugin]
};
```

### Use It

```typescript
// src/app/my-page/page.tsx
export default function MyPage() {
  return <h1>My Plugin Page</h1>;
}
```

That's it! Your plugin is now active with:
- ✅ A new route at `/my-page`
- ✅ A navigation item
- ✅ Lifecycle hooks

## 📖 Documentation

### For Beginners

1. Start with **[Quick Start Guide](./QUICK_START.md)**
2. Build your first plugin in 5 minutes
3. Explore examples in `packages/features/example-analytics/`

### For Plugin Developers

1. Read **[Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)**
2. Learn about registries, hooks, and manifests
3. Study best practices and patterns
4. Check out **[API Reference](./API_REFERENCE.md)**

### For Advanced Users

1. Deep dive into registry implementations
2. Create custom override systems
3. Build plugin marketplaces
4. Implement remote plugin loading

## 🎓 Learning Path

### Level 1: Basic Plugin (30 min)
- Create plugin directory
- Define plugin.json
- Register routes and navigation
- See it work!

📘 **Resource**: [Quick Start Guide](./QUICK_START.md)

### Level 2: Event Communication (1 hour)
- Define custom hooks
- Subscribe to events
- Emit events from components
- Handle async operations

📘 **Resource**: [Plugin System Guide - Hook System](./PLUGIN_SYSTEM_GUIDE.md#hook-system-events)

### Level 3: Component System (1 hour)
- Register reusable components
- Create component overrides
- Use categories and tags
- Build component browser

📘 **Resource**: [Plugin System Guide - Component Registry](./PLUGIN_SYSTEM_GUIDE.md#componentregistry)

### Level 4: Advanced Features (2 hours)
- Manage plugin dependencies
- Create provider composition
- Implement conditional logic
- Build plugin management UI

📘 **Resource**: [API Reference](./API_REFERENCE.md)

## 🛠️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                     │
│         (React components using registry hooks)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Registry System                         │
│  ┌──────────────┬──────────────┬────────────────────┐  │
│  │ Route        │ Navigation   │ Component          │  │
│  │ Registry     │ Registry     │ Registry           │  │
│  ├──────────────┼──────────────┼────────────────────┤  │
│  │ Provider     │ Hook         │                    │  │
│  │ Registry     │ Registry     │   (5 registries)   │  │
│  └──────────────┴──────────────┴────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 Plugin Manager                           │
│  • Load/Unload Plugins                                  │
│  • Parse plugin.json manifests                          │
│  • Manage dependencies                                  │
│  • Register resources                                   │
│  • Handle lifecycle                                     │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                Feature Plugins                           │
│     (Modular features in packages/features/)             │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Use Cases

### 1. Multi-Tenant SaaS

Build tenant-specific features as plugins:

```typescript
const tenantPlugin: Plugin = {
  id: `tenant-${tenantId}`,
  enabled: tenant.subscription.active,
  routes: tenant.customRoutes,
  components: tenant.brandingComponents
};
```

### 2. Feature Flags

Enable/disable features dynamically:

```typescript
const experimentalPlugin: Plugin = {
  id: 'experimental',
  enabled: featureFlags.experimentalFeatures,
  // ... features
};
```

### 3. Marketplace

Build a plugin marketplace:

```typescript
// Load plugin from remote source
const remotePlugin = await loadPluginManifest(
  'https://marketplace.app.com/plugins/analytics/plugin.json'
);
```

### 4. White Label

Customize app per customer:

```typescript
const customerTheme: Plugin = {
  id: 'customer-theme',
  components: {
    Logo: CustomerLogo,
    Button: CustomerButton
  }
};
```

### 5. Micro-Frontends

Build independent teams' features:

```typescript
// Team A
const teamAPlugin: Plugin = {
  id: 'team-a-features',
  routes: teamARoutes,
  navigation: teamANavigation
};

// Team B
const teamBPlugin: Plugin = {
  id: 'team-b-features',
  routes: teamBRoutes,
  navigation: teamBNavigation
};
```

## 📊 Live Examples

Access live demonstrations:

### 1. Registry Test Page
**URL**: `http://localhost:3000/registry-test`

Demonstrates:
- Route registry with multiple routes
- Navigation registry with sections
- Component registry with categories
- Real-time statistics

### 2. Hook System Test Page
**URL**: `http://localhost:3000/registry-phase3-test`

Demonstrates:
- Hook definitions
- Event subscriptions
- Event emission (parallel & sequential)
- Live event log
- Subscription priorities

### 3. Example Analytics Plugin
**Location**: `packages/features/example-analytics/`

Full-featured example showing:
- Complete plugin.json manifest
- Hook definitions and usage
- Route and navigation setup
- Component registration
- Documentation

## 🔧 Development Workflow

### 1. Create Plugin

```bash
mkdir -p packages/features/my-plugin
cd packages/features/my-plugin
touch plugin.json index.ts README.md
```

### 2. Define Manifest

Create `plugin.json` with your plugin configuration.

### 3. Implement Plugin

Create `index.ts` with your plugin code.

### 4. Register Plugin

Add to config-manager.

### 5. Test

```bash
pnpm dev
# Visit http://localhost:3000/your-route
```

### 6. Document

Update README.md with usage instructions.

## 🧪 Testing

### Test Plugin Loading

```typescript
describe('MyPlugin', () => {
  it('should register routes', () => {
    const routes = routeRegistry.getPluginRoutes('my-plugin');
    expect(routes).toHaveLength(2);
  });

  it('should emit events', async () => {
    const handler = jest.fn();
    hookRegistry.subscribe('my.event', handler, 'test');
    await hookRegistry.emit('my.event', { data: 'test' });
    expect(handler).toHaveBeenCalled();
  });
});
```

## 🐛 Debugging

### Enable Debug Mode

```typescript
// In plugin hooks.onInit
if (typeof window !== 'undefined') {
  (window as any).DEBUG_PLUGIN = {
    routes: routeRegistry.getStats(),
    navigation: navigationRegistry.getStats(),
    components: componentRegistry.getStats(),
    hooks: hookRegistry.getStats()
  };
}
```

### Check Console

All registries log important events:
- `[PluginManager] Loading plugin: ...`
- `[RouteRegistry] Registered route: ...`
- `[HookRegistry] Emitted hook: ...`

### Use React DevTools

Inspect component props and state using registry hooks.

## 📈 Performance

The system is optimized for performance:

- **Map-based storage**: O(1) lookups
- **Lazy loading**: Components loaded on-demand
- **Cached sorting**: Priorities cached after registration
- **Efficient subscriptions**: Only active subscriptions executed
- **React optimization**: Hooks use proper memoization

## 🔒 Security

### Route Protection

```typescript
{
  "routes": [{
    "protected": true,
    "roles": ["admin"]
  }]
}
```

### Permission System

```typescript
{
  "permissions": {
    "userData": true,
    "navigation": true,
    "routes": true
  }
}
```

### Input Validation

Always validate event data in subscribers:

```typescript
hookRegistry.subscribe('user.update', (data) => {
  if (!data.userId || !data.email) {
    throw new Error('Invalid user data');
  }
  // Process valid data
}, 'my-plugin');
```

## 🤝 Contributing

Guidelines for plugin developers:

1. **Follow Structure**: Use standard plugin structure
2. **Document Everything**: Include README and JSDoc
3. **Test Thoroughly**: Test all plugin features
4. **Declare Dependencies**: List all dependencies
5. **Version Properly**: Use semantic versioning
6. **Handle Errors**: Graceful error handling
7. **Clean Up**: Always clean up in onDestroy

## 📝 Best Practices

### Do's ✅

- Use TypeScript for type safety
- Declare all dependencies
- Clean up subscriptions in onDestroy
- Use namespaced event names
- Document your hooks and APIs
- Test plugin loading/unloading
- Handle errors gracefully

### Don'ts ❌

- Don't modify global state directly
- Don't create circular dependencies
- Don't skip error handling
- Don't use generic event names
- Don't forget to unsubscribe
- Don't skip documentation
- Don't ignore TypeScript errors

## 🗺️ Roadmap

Future enhancements planned:

- [ ] Remote plugin loading (HTTP/NPM)
- [ ] Plugin marketplace UI
- [ ] Hot reload for plugins
- [ ] Plugin sandboxing
- [ ] Performance monitoring
- [ ] Plugin CLI tool
- [ ] Visual plugin builder
- [ ] Plugin templates
- [ ] Migration tools

## 📞 Support

- **Documentation**: Check `docs/` directory
- **Examples**: See `packages/features/example-analytics/`
- **Test Pages**: `/registry-test`, `/registry-phase3-test`
- **Console**: Check browser console for logs

## 📄 License

See main project LICENSE file.

## 🎉 Congratulations!

You now have access to a powerful, modular plugin system. Build amazing features!

### Next Steps

1. ✅ Read [Quick Start Guide](./QUICK_START.md)
2. ✅ Build your first plugin
3. ✅ Study [Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)
4. ✅ Explore [API Reference](./API_REFERENCE.md)
5. ✅ Create awesome plugins!

Happy coding! 🚀
