#!/usr/bin/env node

/**
 * Migrate Legacy Plugins to New Manifest System
 *
 * This script converts existing plugin.ts files to the new plugin.json + index.ts format
 *
 * Usage:
 *   node scripts/migrate-to-plugin-manifest.js
 */

const fs = require('fs');
const path = require('path');

const featuresDir = path.join(__dirname, '..', 'packages', 'features');

// Plugin metadata mapping (for plugins with src/plugin.ts)
const pluginMetadata = {
  auth: {
    id: 'auth',
    name: 'Authentication',
    description: 'User authentication and session management with multiple providers',
    enabled: true,
  },
  blog: {
    id: 'blog',
    name: 'Blog',
    description: 'Blog and content management system',
    enabled: true,
  },
  calendar: {
    id: 'calendar',
    name: 'Calendar',
    description: 'Event and calendar management',
    enabled: true,
  },
  chat: {
    id: 'chat',
    name: 'Chat',
    description: 'Real-time messaging and chat functionality',
    enabled: true,
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main dashboard and overview analytics',
    enabled: true,
  },
  invoice: {
    id: 'invoice',
    name: 'Invoice',
    description: 'Invoice creation and management',
    enabled: true,
  },
  kanban: {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Task and project management with kanban board',
    enabled: true,
  },
  mail: {
    id: 'mail',
    name: 'Mail',
    description: 'Email client and management',
    enabled: true,
  },
  product: {
    id: 'product',
    name: 'Product',
    description: 'Product catalog and management',
    enabled: true,
  },
  user: {
    id: 'user',
    name: 'User Management',
    description: 'User profiles and management',
    enabled: true,
  },
};

// Plugins without plugin.ts - create minimal manifests
const minimalPlugins = {
  address: {
    id: 'address',
    name: 'Address',
    description: 'Address management system',
    enabled: true,
  },
  checkout: {
    id: 'checkout',
    name: 'Checkout',
    description: 'Shopping cart checkout process',
    enabled: true,
  },
  'file-manager': {
    id: 'file-manager',
    name: 'File Manager',
    description: 'File upload and management',
    enabled: true,
  },
  job: {
    id: 'job',
    name: 'Job Board',
    description: 'Job posting and application management',
    enabled: true,
  },
  order: {
    id: 'order',
    name: 'Order Management',
    description: 'Order processing and tracking',
    enabled: true,
  },
  payment: {
    id: 'payment',
    name: 'Payment',
    description: 'Payment processing and integration',
    enabled: true,
  },
  tour: {
    id: 'tour',
    name: 'Tour',
    description: 'Guided tours and onboarding',
    enabled: true,
  },
};

function createPluginManifest(pluginId, meta) {
  return {
    id: meta.id,
    name: meta.name,
    version: '1.0.0',
    description: meta.description,
    author: 'Core Team',
    license: 'MIT',
    enabled: meta.enabled,
    routes: [],
    navigation: [],
    components: [],
    hooks: [],
  };
}

function createIndexTs(pluginId, meta) {
  return `/**
 * ${meta.name} Plugin
 * ${meta.description}
 */

export * from './src';

// Plugin manifest is in plugin.json
// Main plugin exports should be defined in src/index.ts
`;
}

function migratePlugin(pluginId, metadata) {
  const pluginDir = path.join(featuresDir, pluginId);
  const manifestPath = path.join(pluginDir, 'plugin.json');
  const indexPath = path.join(pluginDir, 'index.ts');

  // Check if plugin directory exists
  if (!fs.existsSync(pluginDir)) {
    console.log(`⚠️  Plugin directory not found: ${pluginId}`);
    return false;
  }

  // Create plugin.json
  if (!fs.existsSync(manifestPath)) {
    const manifest = createPluginManifest(pluginId, metadata);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Created plugin.json for ${pluginId}`);
  } else {
    console.log(`⏭️  Skipped ${pluginId} - plugin.json already exists`);
  }

  // Create index.ts
  if (!fs.existsSync(indexPath)) {
    const indexContent = createIndexTs(pluginId, metadata);
    fs.writeFileSync(indexPath, indexContent);
    console.log(`✅ Created index.ts for ${pluginId}`);
  } else {
    console.log(`⏭️  Skipped ${pluginId} - index.ts already exists`);
  }

  return true;
}

function main() {
  console.log('🔄 Migrating Legacy Plugins to New Manifest System\n');

  let successCount = 0;
  let skipCount = 0;

  // Migrate plugins with src/plugin.ts
  console.log('📦 Migrating plugins with existing metadata:\n');
  Object.entries(pluginMetadata).forEach(([pluginId, meta]) => {
    const result = migratePlugin(pluginId, meta);
    if (result) successCount++;
    else skipCount++;
  });

  // Create minimal plugins
  console.log('\n📦 Creating minimal plugin manifests:\n');
  Object.entries(minimalPlugins).forEach(([pluginId, meta]) => {
    const result = migratePlugin(pluginId, meta);
    if (result) successCount++;
    else skipCount++;
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Migration complete!`);
  console.log(`   Processed: ${successCount + skipCount} plugins`);
  console.log(`   Created: ${successCount} manifests`);
  console.log(`   Skipped: ${skipCount} existing`);
  console.log('\n📝 Next steps:');
  console.log('   1. Review generated plugin.json files');
  console.log('   2. Run: pnpm validate-plugins');
  console.log('   3. Fix any validation errors');
  console.log('   4. Restart dev server: pnpm dev\n');
}

main();
