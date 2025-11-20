#!/usr/bin/env node

/**
 * List Plugins CLI
 * Lists all plugins with their status and details
 *
 * Usage:
 *   node scripts/list-plugins.js
 *   pnpm list-plugins
 */

const fs = require('fs');
const path = require('path');

function main() {
  console.log('📦 Plugin List\n');

  const featuresDir = path.join(__dirname, '..', 'packages', 'features');

  if (!fs.existsSync(featuresDir)) {
    console.error('❌ Features directory not found');
    process.exit(1);
  }

  const plugins = fs.readdirSync(featuresDir)
    .filter(dir => {
      const pluginPath = path.join(featuresDir, dir);
      return fs.statSync(pluginPath).isDirectory();
    })
    .map(dir => {
      const pluginPath = path.join(featuresDir, dir);
      const manifestPath = path.join(pluginPath, 'plugin.json');

      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        return { dir, manifest, path: pluginPath };
      }

      return { dir, manifest: null, path: pluginPath };
    });

  if (plugins.length === 0) {
    console.log('No plugins found.');
    return;
  }

  // Group by status
  const enabled = plugins.filter(p => p.manifest?.enabled);
  const disabled = plugins.filter(p => p.manifest && !p.manifest.enabled);
  const noManifest = plugins.filter(p => !p.manifest);

  console.log(`Total: ${plugins.length} plugins\n`);

  if (enabled.length > 0) {
    console.log('✅ Enabled Plugins:\n');
    enabled.forEach(p => {
      console.log(`  ${p.manifest.name} (v${p.manifest.version})`);
      console.log(`    ID: ${p.manifest.id}`);
      console.log(`    Path: packages/features/${p.dir}`);
      if (p.manifest.description) {
        console.log(`    Description: ${p.manifest.description}`);
      }
      const features = [];
      if (p.manifest.routes?.length) features.push(`${p.manifest.routes.length} routes`);
      if (p.manifest.navigation?.length) features.push(`${p.manifest.navigation.length} nav items`);
      if (p.manifest.components?.length) features.push(`${p.manifest.components.length} components`);
      if (p.manifest.hooks?.length) features.push(`${p.manifest.hooks.length} hooks`);
      if (features.length > 0) {
        console.log(`    Features: ${features.join(', ')}`);
      }
      console.log('');
    });
  }

  if (disabled.length > 0) {
    console.log('❌ Disabled Plugins:\n');
    disabled.forEach(p => {
      console.log(`  ${p.manifest.name} (v${p.manifest.version})`);
      console.log(`    ID: ${p.manifest.id}`);
      console.log(`    Path: packages/features/${p.dir}\n`);
    });
  }

  if (noManifest.length > 0) {
    console.log('⚠️  No Manifest:\n');
    noManifest.forEach(p => {
      console.log(`  ${p.dir}`);
      console.log(`    Path: packages/features/${p.dir}\n`);
    });
  }
}

main();
