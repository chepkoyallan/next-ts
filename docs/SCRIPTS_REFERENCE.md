# Plugin Scripts Reference

Complete reference for all plugin management scripts.

## Overview

The plugin system includes 5 CLI scripts to help you manage plugins efficiently:

| Script | Purpose | Command |
|--------|---------|---------|
| `create-plugin` | Generate new plugin | `pnpm create-plugin [name]` |
| `list-plugins` | List all plugins | `pnpm list-plugins` |
| `validate-plugins` | Validate manifests | `pnpm validate-plugins` |
| `enable-plugin` | Enable a plugin | `pnpm enable-plugin <id>` |
| `disable-plugin` | Disable a plugin | `pnpm disable-plugin <id>` |
| `plugin-info` | Show plugin details | `pnpm plugin-info <id>` |

---

## create-plugin

Generate a complete plugin starter template with best practices built-in.

### Usage

```bash
# Interactive mode
pnpm create-plugin

# With plugin name
pnpm create-plugin my-awesome-plugin
```

### Interactive Prompts

```
Plugin ID: analytics
Plugin Name: Analytics Plugin
Description: Real-time analytics
Author: Your Team

Include page routes? (y/n): y
Include API routes? (y/n): y
Include navigation items? (y/n): y
Include components? (y/n): y
Include React hooks? (y/n): y
Include event system? (y/n): y
```

### Output

```
✅ Plugin created successfully!

📁 Files created:
   packages/features/analytics/plugin.json
   packages/features/analytics/index.ts
   packages/features/analytics/package.json
   packages/features/analytics/README.md
   packages/features/analytics/components/ExampleComponent.tsx
   packages/features/analytics/hooks/useAnalytics.ts
   packages/features/analytics/api/handlers.ts
   packages/features/analytics/types/index.ts

🎯 Next steps:
1. Review: packages/features/analytics
2. Register in: packages/core/config/src/config-manager.ts
3. Create pages: src/app/analytics/
4. Create APIs: src/app/api/analytics/
5. Run: pnpm dev
```

### Generated Structure

```
packages/features/my-plugin/
├── plugin.json              # Manifest
├── index.ts                 # Main plugin file
├── package.json             # Package config
├── tsconfig.json            # TypeScript config
├── README.md                # Documentation
├── components/              # React components
│   └── ExampleComponent.tsx
├── hooks/                   # Custom hooks
│   └── useMyPlugin.ts
├── api/                     # API handlers
│   └── handlers.ts
├── types/                   # TypeScript types
│   └── index.ts
└── utils/                   # Utilities
```

### See Also

- [CLI Guide](./CLI_GUIDE.md) - Complete CLI documentation

---

## list-plugins

List all plugins with their status and basic information.

### Usage

```bash
pnpm list-plugins
```

### Output

```
📦 Plugin List

Total: 5 plugins

✅ Enabled Plugins:

  Analytics Plugin (v1.0.0)
    ID: analytics
    Path: packages/features/analytics
    Description: Real-time analytics and reporting
    Features: 2 routes, 2 nav items, 1 components, 3 hooks

  File Manager (v1.2.0)
    ID: file-manager
    Path: packages/features/file-manager
    Features: 3 routes, 1 nav items, 5 components

❌ Disabled Plugins:

  Beta Feature (v0.1.0)
    ID: beta-feature
    Path: packages/features/beta-feature

⚠️  No Manifest:

  old-plugin
    Path: packages/features/old-plugin
```

### Use Cases

- Quick overview of all plugins
- Check plugin status
- Find plugin paths
- Identify plugins without manifests

---

## validate-plugins

Validate all plugin manifests and check for common issues.

### Usage

```bash
pnpm validate-plugins
```

### Output

```
🔍 Plugin Validation

✅ Analytics Plugin
   ID: analytics

⚠️  File Manager
   ID: file-manager
   Warning: Missing README.md
   Warning: Component file not found: FileUploader.tsx

❌ Broken Plugin
   ID: broken-plugin
   Error: Missing required field: version
   Error: Invalid id format (use lowercase, numbers, hyphens only)
   Warning: Route missing id: /broken

────────────────────────────────────────────────────

📊 Summary:
   Total plugins: 3
   Valid: 1
   Warnings: 1 (2 issues)
   Errors: 1 (2 issues)

❌ Validation failed
```

### Checks

**Required Fields:**
- `id` - Unique identifier
- `name` - Display name
- `version` - Semver version

**Format Validation:**
- Plugin ID format (lowercase, numbers, hyphens)
- Version format (semver)

**File Checks:**
- `index.ts` exists
- `README.md` exists (warning)
- Component files exist

**Route Validation:**
- Routes have IDs
- Routes have paths

### Exit Codes

- `0` - All plugins valid
- `1` - Validation failed (errors found)

### Use Cases

- CI/CD pipeline checks
- Pre-commit hooks
- Development validation
- Find configuration issues

---

## enable-plugin

Enable a disabled plugin by updating its manifest.

### Usage

```bash
pnpm enable-plugin <plugin-id>
```

### Example

```bash
$ pnpm enable-plugin analytics

✅ Enabling plugin: Analytics Plugin

✅ Plugin enabled successfully

Restart your dev server for changes to take effect:
  pnpm dev
```

### What It Does

1. Finds plugin by ID
2. Loads `plugin.json`
3. Sets `enabled: true`
4. Saves manifest
5. Reminds you to restart

### Notes

- Changes take effect after dev server restart
- Updates `plugin.json` directly
- Preserves all other settings

---

## disable-plugin

Disable an enabled plugin without deleting it.

### Usage

```bash
pnpm disable-plugin <plugin-id>
```

### Example

```bash
$ pnpm disable-plugin analytics

❌ Disabling plugin: Analytics Plugin

✅ Plugin disabled successfully

Restart your dev server for changes to take effect:
  pnpm dev
```

### What It Does

1. Finds plugin by ID
2. Loads `plugin.json`
3. Sets `enabled: false`
4. Saves manifest
5. Reminds you to restart

### Use Cases

- Temporarily disable features
- Testing without a plugin
- Debugging issues
- Feature flag management

---

## plugin-info

Show detailed information about a specific plugin.

### Usage

```bash
pnpm plugin-info <plugin-id>
```

### Example

```bash
$ pnpm plugin-info analytics

============================================================
  Analytics Plugin v1.0.0
============================================================

📋 Basic Information:

  ID: analytics
  Name: Analytics Plugin
  Version: 1.0.0
  Status: ✅ Enabled
  Description: Real-time analytics and reporting
  Author: Analytics Team
  License: MIT
  Path: packages/features/analytics

🎯 Features:

  • 2 routes
  • 2 navigation items
  • 1 components
  • 3 hooks

🛣️  Routes:

  /analytics
    Layout: dashboard
    Protected: Yes
    Roles: admin, analyst

  /analytics/reports
    Layout: dashboard
    Protected: Yes
    Roles: admin, analyst

🧭 Navigation:

  Analytics
    Path: /analytics
    Icon: chart
    Section: tools

  Reports
    Path: /analytics/reports
    Icon: report
    Section: tools

📦 Dependencies:

  • auth-plugin v1.0.0
  • theme-plugin (optional)

📁 Files:

  Total files: 15
  TypeScript: 12
  JavaScript: 0
  Size: 45.2 KB

📄 Key Files:

  ✅ Main file (index.ts)
  ✅ Documentation (README.md)
  ✅ Package config (package.json)
  ✅ TypeScript config (tsconfig.json)

============================================================
```

### Information Shown

**Basic Info:**
- ID, name, version
- Enabled/disabled status
- Description
- Author, license
- File path

**Features:**
- Routes, navigation, components
- Providers, hooks

**Detailed Lists:**
- All routes with settings
- All navigation items
- Dependencies

**File Stats:**
- Total file count
- TypeScript/JavaScript breakdown
- Total size
- Key file checks

### Use Cases

- Quick plugin overview
- Debugging configuration
- Documentation reference
- Understanding plugin structure

---

## Common Workflows

### Creating a New Plugin

```bash
# 1. Generate plugin
pnpm create-plugin my-feature

# 2. Check it was created
pnpm list-plugins

# 3. View details
pnpm plugin-info my-feature

# 4. Validate it
pnpm validate-plugins
```

### Enabling/Disabling Plugins

```bash
# Disable for testing
pnpm disable-plugin analytics
pnpm dev  # Restart server

# Re-enable
pnpm enable-plugin analytics
pnpm dev  # Restart server
```

### Pre-Deployment Checks

```bash
# 1. List all plugins
pnpm list-plugins

# 2. Validate all
pnpm validate-plugins

# 3. Check specific plugin
pnpm plugin-info my-plugin

# 4. Build if valid
pnpm build
```

### CI/CD Pipeline

```yaml
# .github/workflows/validate.yml
- name: Validate Plugins
  run: pnpm validate-plugins

- name: Build
  run: pnpm build
  if: success()
```

---

## Script Locations

All scripts are in the `scripts/` directory:

```
scripts/
├── create-plugin.js      # Generator
├── list-plugins.js       # Lister
├── validate-plugins.js   # Validator
├── enable-plugin.js      # Enable/disable
└── plugin-info.js        # Info display
```

---

## Troubleshooting

### Plugin Not Found

```
❌ Plugin "my-plugin" not found
```

**Solutions:**
- Check plugin ID spelling
- Run `pnpm list-plugins` to see available plugins
- Verify plugin directory exists in `packages/features/`

### Invalid JSON

```
❌ Invalid plugin.json: Unexpected token
```

**Solutions:**
- Check JSON syntax in `plugin.json`
- Use a JSON validator
- Look for missing commas, quotes, brackets

### Permission Denied

```
❌ Permission denied
```

**Solution:**
```bash
chmod +x scripts/*.js
```

### Command Not Found

```
❌ Command failed with ENOENT: create-plugin
```

**Solution:**
Check `package.json` has the script:
```json
{
  "scripts": {
    "create-plugin": "node scripts/create-plugin.js"
  }
}
```

---

## Advanced Usage

### Custom Validation

Add to `scripts/validate-plugins.js`:

```javascript
// Check custom rules
if (manifest.routes) {
  manifest.routes.forEach(route => {
    // Custom validation
    if (route.path.includes('//')) {
      errors.push(`Invalid path: ${route.path}`);
    }
  });
}
```

### Batch Operations

Enable multiple plugins:

```bash
for plugin in analytics dashboard reports; do
  pnpm enable-plugin $plugin
done
```

Validate and list:

```bash
pnpm validate-plugins && pnpm list-plugins
```

### Integration with Git Hooks

`.husky/pre-commit`:

```bash
#!/bin/sh
pnpm validate-plugins || exit 1
```

---

## Best Practices

### 1. Always Validate

Run validation before committing:

```bash
pnpm validate-plugins
git add .
git commit -m "Add new plugin"
```

### 2. Use Descriptive IDs

```bash
# Good
pnpm create-plugin user-management
pnpm create-plugin analytics-dashboard

# Bad
pnpm create-plugin plugin1
pnpm create-plugin temp
```

### 3. Check Before Disabling

```bash
pnpm plugin-info my-plugin  # Review dependencies
pnpm disable-plugin my-plugin
```

### 4. Document Changes

When creating plugins, update:
- Plugin README.md
- Main project docs
- Changelog

### 5. Test After Changes

```bash
pnpm validate-plugins  # Validate
pnpm dev              # Test locally
pnpm build            # Test build
```

---

## Summary

The plugin scripts provide:

- ✅ **Fast plugin creation** - Generate in minutes
- ✅ **Easy management** - Enable/disable with one command
- ✅ **Validation** - Catch errors early
- ✅ **Information** - Quick plugin overview
- ✅ **Best practices** - Templates and standards

Master these scripts to work efficiently with the plugin system! 🚀
