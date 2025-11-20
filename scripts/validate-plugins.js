#!/usr/bin/env node

/**
 * Validate Plugins CLI
 * Validates all plugin manifests and structure
 *
 * Usage:
 *   node scripts/validate-plugins.js
 *   pnpm validate-plugins
 */

const fs = require('fs');
const path = require('path');

function validateManifest(manifest, pluginPath) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!manifest.id) errors.push('Missing required field: id');
  if (!manifest.name) errors.push('Missing required field: name');
  if (!manifest.version) errors.push('Missing required field: version');

  // Validate ID format
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push('Invalid id format (use lowercase, numbers, hyphens only)');
  }

  // Validate version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    warnings.push('Version should follow semver format (x.y.z)');
  }

  // Check for main file
  const indexPath = path.join(pluginPath, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    errors.push('Missing index.ts file');
  }

  // Check routes reference existing files
  if (manifest.routes) {
    manifest.routes.forEach(route => {
      if (!route.id) warnings.push(`Route missing id: ${route.path}`);
      if (!route.path) errors.push('Route missing path');
    });
  }

  // Check components exist
  if (manifest.components) {
    manifest.components.forEach(comp => {
      const compPath = path.join(pluginPath, 'components', `${comp.name}.tsx`);
      if (!fs.existsSync(compPath)) {
        warnings.push(`Component file not found: ${comp.name}.tsx`);
      }
    });
  }

  // Check for README
  if (!fs.existsSync(path.join(pluginPath, 'README.md'))) {
    warnings.push('Missing README.md');
  }

  return { errors, warnings };
}

function main() {
  console.log('🔍 Plugin Validation\n');

  const featuresDir = path.join(__dirname, '..', 'packages', 'features');

  if (!fs.existsSync(featuresDir)) {
    console.error('❌ Features directory not found');
    process.exit(1);
  }

  const plugins = fs.readdirSync(featuresDir)
    .filter(dir => {
      const pluginPath = path.join(featuresDir, dir);
      return fs.statSync(pluginPath).isDirectory();
    });

  let totalErrors = 0;
  let totalWarnings = 0;
  const results = [];

  plugins.forEach(dir => {
    const pluginPath = path.join(featuresDir, dir);
    const manifestPath = path.join(pluginPath, 'plugin.json');

    if (!fs.existsSync(manifestPath)) {
      results.push({
        name: dir,
        status: 'error',
        errors: ['Missing plugin.json'],
        warnings: []
      });
      totalErrors++;
      return;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      results.push({
        name: dir,
        status: 'error',
        errors: [`Invalid JSON: ${error.message}`],
        warnings: []
      });
      totalErrors++;
      return;
    }

    const validation = validateManifest(manifest, pluginPath);
    totalErrors += validation.errors.length;
    totalWarnings += validation.warnings.length;

    results.push({
      name: manifest.name || dir,
      id: manifest.id,
      status: validation.errors.length > 0 ? 'error' : validation.warnings.length > 0 ? 'warning' : 'valid',
      errors: validation.errors,
      warnings: validation.warnings
    });
  });

  // Print results
  results.forEach(result => {
    if (result.status === 'valid') {
      console.log(`✅ ${result.name}`);
      if (result.id) console.log(`   ID: ${result.id}`);
    } else if (result.status === 'warning') {
      console.log(`⚠️  ${result.name}`);
      if (result.id) console.log(`   ID: ${result.id}`);
      result.warnings.forEach(w => console.log(`   Warning: ${w}`));
    } else {
      console.log(`❌ ${result.name}`);
      if (result.id) console.log(`   ID: ${result.id}`);
      result.errors.forEach(e => console.log(`   Error: ${e}`));
      result.warnings.forEach(w => console.log(`   Warning: ${w}`));
    }
    console.log('');
  });

  // Summary
  console.log('─'.repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`   Total plugins: ${results.length}`);
  console.log(`   Valid: ${results.filter(r => r.status === 'valid').length}`);
  console.log(`   Warnings: ${results.filter(r => r.status === 'warning').length} (${totalWarnings} issues)`);
  console.log(`   Errors: ${results.filter(r => r.status === 'error').length} (${totalErrors} issues)`);

  if (totalErrors > 0) {
    console.log('\n❌ Validation failed\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  Validation passed with warnings\n');
  } else {
    console.log('\n✅ All plugins valid\n');
  }
}

main();
