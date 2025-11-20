# Plugin Auto-Discovery System

## Overview

The plugin system now features **automatic plugin discovery** - plugins are loaded automatically from the `packages/features/` directory without manual registration!

## How It Works

### 1. Plugin Discovery

The system automatically scans `packages/features/` for plugins:

```
packages/features/
├── auth/
│   ├── plugin.json    ← Discovered automatically
│   ├── index.ts
│   └── ...
├── dashboard/
│   ├── plugin.json    ← Discovered automatically
│   ├── index.ts
│   └── ...
└── payment/
    ├── plugin.json    ← Discovered automatically
    ├── index.ts
    └── ...
```

### 2. Automatic Loading

**Before (Manual Registration):**
```typescript
// ❌ Old Way - Manual imports required
import { authPlugin } from '@app/auth';
import { dashboardPlugin } from '@app/dashboard';

export const defaultConfig = {
  plugins: [authPlugin, dashboardPlugin, ...], // Had to list all
};
```

**After (Auto-Discovery):**
```typescript
// ✅ New Way - Automatic!
export const defaultConfig = {
  plugins: [], // Empty! Populated automatically at runtime
};
```

### 3. Build-Time Discovery

Run the discovery command to generate the plugin manifest:

```bash
pnpm discover-plugins
```

This generates:
- `packages/core/config/src/plugins/discovered-plugins.json` - Plugin metadata
- `packages/core/config/src/plugins/auto-discovered-plugins.ts` - TypeScript exports

## Usage

### Creating a New Plugin

1. **Generate Plugin:**
   ```bash
   pnpm create-plugin my-new-feature
   ```

2. **Discover Plugins:**
   ```bash
   pnpm discover-plugins
   ```

3. **That's It!**
   - Your plugin is automatically loaded
   - No manual registration needed
   - Just restart your dev server

### Plugin Requirements

For auto-discovery to work, plugins MUST have:

1. **plugin.json** - Manifest file with metadata
2. **index.ts** - Main export file
3. **Valid manifest** - Must pass validation

### Enabling/Disabling Plugins

**Method 1: CLI (Recommended)**
```bash
# Disable a plugin
pnpm disable-plugin auth

# Enable it back
pnpm enable-plugin auth

# Rediscover to update
pnpm discover-plugins
```

**Method 2: Manifest File**
```json
{
  "id": "auth",
  "name": "Authentication",
  "enabled": false  // ← Set to false to disable
}
```

Then run:
```bash
pnpm discover-plugins  # Regenerate
pnpm dev               # Restart
```

## Discovery Commands

### discover-plugins
Scans and generates plugin manifest:

```bash
pnpm discover-plugins
```

Output:
```
🚀 Plugin Discovery

🔍 Discovering plugins...

✅ Address (address) v1.0.0
✅ Authentication (auth) v1.0.0
✅ Blog (blog) v1.0.0
...

📊 Summary:
   Total: 19 plugins
   Enabled: 19
   Disabled: 0

📄 Generated: packages/core/config/src/plugins/discovered-plugins.json
📄 Generated: packages/core/config/src/plugins/auto-discovered-plugins.ts

✅ Plugin discovery complete!
```

### list-plugins
View all discovered plugins:

```bash
pnpm list-plugins
```

### validate-plugins
Ensure all plugins are valid:

```bash
pnpm validate-plugins
```

## Development Workflow

### Adding a New Plugin

```bash
# 1. Create plugin
pnpm create-plugin analytics

# 2. Develop your plugin
cd packages/features/analytics
# ... add your code ...

# 3. Discover and test
pnpm discover-plugins
pnpm dev
```

### Updating Plugins

```bash
# 1. Make changes to plugin
# ...

# 2. If you changed plugin.json, rediscover
pnpm discover-plugins

# 3. Restart dev server
pnpm dev
```

### Removing a Plugin

```bash
# Option 1: Disable (keeps the code)
pnpm disable-plugin old-feature
pnpm discover-plugins

# Option 2: Delete (removes everything)
rm -rf packages/features/old-feature
pnpm discover-plugins
```

## Technical Details

### Auto-Discovery Flow

```
1. Developer adds plugin to packages/features/
2. Developer runs: pnpm discover-plugins
3. Script scans packages/features/ directory
4. Script reads all plugin.json files
5. Script validates each manifest
6. Script generates:
   - discovered-plugins.json (metadata)
   - auto-discovered-plugins.ts (types)
7. ConfigManager loads plugins at runtime
8. PluginManager registers with registries
```

### Runtime Loading

```typescript
// ConfigManager automatically loads plugins
class ConfigManager {
  private async initializePlugins() {
    // Import plugin loader
    const { initializePluginDiscovery } = await import('./plugins/plugin-loader');

    // Discover and load all plugins
    const discoveredPlugins = await initializePluginDiscovery();

    // Update config
    this.config.plugins = discoveredPlugins;
  }
}
```

### Generated Files

**discovered-plugins.json:**
```json
{
  "generated": "2025-11-20T03:43:04.118Z",
  "total": 19,
  "enabled": 19,
  "disabled": 0,
  "plugins": [
    {
      "id": "auth",
      "name": "Authentication",
      "version": "1.0.0",
      "enabled": true,
      "path": "packages/features/auth"
    }
  ]
}
```

**auto-discovered-plugins.ts:**
```typescript
export const discoveredPluginIds = [
  'auth',
  'dashboard',
  // ...
] as const;

export const pluginMetadata = [
  {
    id: 'auth',
    name: 'Authentication',
    version: '1.0.0',
    enabled: true,
  },
  // ...
];
```

## CI/CD Integration

### Pre-Build Hook

Add to your CI/CD pipeline:

```yaml
# .github/workflows/build.yml
- name: Discover Plugins
  run: pnpm discover-plugins

- name: Validate Plugins
  run: pnpm validate-plugins

- name: Build
  run: pnpm build
```

### Package.json Scripts

```json
{
  "scripts": {
    "prebuild": "pnpm discover-plugins && pnpm validate-plugins",
    "build": "turbo run build",
    "predev": "pnpm discover-plugins"
  }
}
```

## Benefits

### Before Auto-Discovery
❌ Manual imports for every plugin
❌ Update default-config.ts for each plugin
❌ Prone to forgetting plugins
❌ Circular dependency issues

### After Auto-Discovery
✅ Drop plugin in folder - it works
✅ No manual registration needed
✅ All plugins discovered automatically
✅ Clean separation of concerns
✅ True plug-and-play architecture

## Troubleshooting

### Plugin Not Discovered

**Problem:** Plugin not showing in `pnpm list-plugins`

**Solutions:**
1. Check `plugin.json` exists
2. Check `index.ts` exists
3. Run `pnpm validate-plugins` to see errors
4. Run `pnpm discover-plugins` to regenerate

### Plugin Not Loading

**Problem:** Plugin discovered but not loading

**Solutions:**
1. Check `enabled: true` in plugin.json
2. Check for errors in browser console
3. Check plugin exports match expected format
4. Restart dev server

### Discovery Script Fails

**Problem:** `pnpm discover-plugins` errors

**Solutions:**
1. Check JSON syntax in plugin.json files
2. Check all required fields (id, name, version)
3. Check file permissions
4. Delete `.next` and `node_modules`, reinstall

## Best Practices

### 1. Always Discover After Changes
```bash
# After creating/updating plugins
pnpm discover-plugins
```

### 2. Commit Generated Files
```bash
# Add to git
git add packages/core/config/src/plugins/discovered-plugins.json
git add packages/core/config/src/plugins/auto-discovered-plugins.ts
```

### 3. Use Pre-Commit Hooks
```bash
# .husky/pre-commit
pnpm validate-plugins || exit 1
```

### 4. Document Plugin Dependencies
```json
{
  "id": "analytics",
  "dependencies": [
    { "id": "auth", "version": "^1.0.0" }
  ]
}
```

## Summary

The auto-discovery system makes your plugin architecture truly modular:

**To add a plugin:**
1. `pnpm create-plugin my-feature`
2. `pnpm discover-plugins`
3. Done! ✅

No manual registration, no imports, no config updates needed!

---

For more information:
- [Plugin System Guide](./PLUGIN_SYSTEM_GUIDE.md)
- [CLI Guide](./CLI_GUIDE.md)
- [Scripts Reference](./SCRIPTS_REFERENCE.md)
