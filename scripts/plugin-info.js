#!/usr/bin/env node

/**
 * Plugin Info CLI
 * Shows detailed information about a plugin
 *
 * Usage:
 *   node scripts/plugin-info.js <plugin-id>
 *   pnpm plugin-info <plugin-id>
 */

const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getDirectorySize(dir) {
  let size = 0;
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        size += getDirectorySize(filePath);
      }
    } else {
      size += stats.size;
    }
  });

  return size;
}

function countFiles(dir, extensions = []) {
  let count = 0;
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        count += countFiles(filePath, extensions);
      }
    } else {
      if (extensions.length === 0 || extensions.some(ext => file.endsWith(ext))) {
        count++;
      }
    }
  });

  return count;
}

function main() {
  const pluginId = process.argv[2];

  if (!pluginId) {
    console.error('❌ Plugin ID required');
    console.log('\nUsage: pnpm plugin-info <plugin-id>');
    process.exit(1);
  }

  const pluginPath = path.join(__dirname, '..', 'packages', 'features', pluginId);
  const manifestPath = path.join(pluginPath, 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Plugin "${pluginId}" not found`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    console.error('❌ Invalid plugin.json:', error.message);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${manifest.name} v${manifest.version}`);
  console.log(`${'='.repeat(60)}\n`);

  // Basic Info
  console.log('📋 Basic Information:\n');
  console.log(`  ID: ${manifest.id}`);
  console.log(`  Name: ${manifest.name}`);
  console.log(`  Version: ${manifest.version}`);
  console.log(`  Status: ${manifest.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  if (manifest.description) console.log(`  Description: ${manifest.description}`);
  if (manifest.author) {
    const author = typeof manifest.author === 'string' ? manifest.author : manifest.author.name;
    console.log(`  Author: ${author}`);
  }
  if (manifest.license) console.log(`  License: ${manifest.license}`);
  console.log(`  Path: packages/features/${pluginId}`);

  // Features
  console.log('\n🎯 Features:\n');
  const features = [];
  if (manifest.routes?.length) features.push(`${manifest.routes.length} routes`);
  if (manifest.navigation?.length) features.push(`${manifest.navigation.length} navigation items`);
  if (manifest.components?.length) features.push(`${manifest.components.length} components`);
  if (manifest.providers?.length) features.push(`${manifest.providers.length} providers`);
  if (manifest.hooks?.length) features.push(`${manifest.hooks.length} hooks`);

  if (features.length > 0) {
    features.forEach(f => console.log(`  • ${f}`));
  } else {
    console.log('  No features registered');
  }

  // Routes
  if (manifest.routes?.length > 0) {
    console.log('\n🛣️  Routes:\n');
    manifest.routes.forEach(route => {
      console.log(`  ${route.path}`);
      if (route.layout) console.log(`    Layout: ${route.layout}`);
      if (route.protected) console.log(`    Protected: Yes`);
      if (route.roles) console.log(`    Roles: ${route.roles.join(', ')}`);
    });
  }

  // Navigation
  if (manifest.navigation?.length > 0) {
    console.log('\n🧭 Navigation:\n');
    manifest.navigation.forEach(nav => {
      console.log(`  ${nav.title}`);
      if (nav.path) console.log(`    Path: ${nav.path}`);
      if (nav.icon) console.log(`    Icon: ${nav.icon}`);
      if (nav.section) console.log(`    Section: ${nav.section}`);
    });
  }

  // Dependencies
  if (manifest.dependencies?.length > 0) {
    console.log('\n📦 Dependencies:\n');
    manifest.dependencies.forEach(dep => {
      const optional = dep.optional ? ' (optional)' : '';
      const version = dep.version ? ` v${dep.version}` : '';
      console.log(`  • ${dep.id}${version}${optional}`);
    });
  }

  // Files
  console.log('\n📁 Files:\n');
  const totalFiles = countFiles(pluginPath);
  const tsFiles = countFiles(pluginPath, ['.ts', '.tsx']);
  const jsFiles = countFiles(pluginPath, ['.js', '.jsx']);
  const size = getDirectorySize(pluginPath);

  console.log(`  Total files: ${totalFiles}`);
  console.log(`  TypeScript: ${tsFiles}`);
  console.log(`  JavaScript: ${jsFiles}`);
  console.log(`  Size: ${formatBytes(size)}`);

  // Check for key files
  console.log('\n📄 Key Files:\n');
  const keyFiles = [
    { name: 'index.ts', label: 'Main file' },
    { name: 'README.md', label: 'Documentation' },
    { name: 'package.json', label: 'Package config' },
    { name: 'tsconfig.json', label: 'TypeScript config' }
  ];

  keyFiles.forEach(({ name, label }) => {
    const exists = fs.existsSync(path.join(pluginPath, name));
    console.log(`  ${exists ? '✅' : '❌'} ${label} (${name})`);
  });

  console.log('\n' + '='.repeat(60) + '\n');
}

main();
