#!/usr/bin/env node

/**
 * Enable/Disable Plugin CLI
 * Enables or disables a plugin by updating its manifest
 *
 * Usage:
 *   node scripts/enable-plugin.js <plugin-id>
 *   node scripts/enable-plugin.js <plugin-id> --disable
 *   pnpm enable-plugin <plugin-id>
 *   pnpm disable-plugin <plugin-id>
 */

const fs = require('fs');
const path = require('path');

function main() {
  const pluginId = process.argv[2];
  const isDisable = process.argv.includes('--disable') || process.argv[0].includes('disable');

  if (!pluginId) {
    console.error('❌ Plugin ID required');
    console.log('\nUsage:');
    console.log('  pnpm enable-plugin <plugin-id>');
    console.log('  pnpm disable-plugin <plugin-id>');
    process.exit(1);
  }

  const pluginPath = path.join(__dirname, '..', 'packages', 'features', pluginId);
  const manifestPath = path.join(pluginPath, 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Plugin "${pluginId}" not found`);
    console.log(`\nLooked in: ${pluginPath}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    console.error('❌ Invalid plugin.json:', error.message);
    process.exit(1);
  }

  const action = isDisable ? 'Disabling' : 'Enabling';
  const newValue = !isDisable;

  console.log(`${isDisable ? '❌' : '✅'} ${action} plugin: ${manifest.name}\n`);

  manifest.enabled = newValue;

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Plugin ${isDisable ? 'disabled' : 'enabled'} successfully`);
  console.log(`\nRestart your dev server for changes to take effect:\n  pnpm dev\n`);
}

main();
