#!/usr/bin/env node
/**
 * Prisma Schema Builder
 * Merges modular schema files into a single schema.prisma
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '../../prisma/schema');
const OUTPUT_PATH = path.join(__dirname, '../../prisma/schema.prisma');
const BASE_PATH = path.join(SCHEMA_DIR, '_base.prisma');

// Order matters for dependencies
const FILE_ORDER = [
  '_shared.prisma',       // Enums first (no dependencies)
  'auth.prisma',          // User model (foundation)
  'organizations.prisma', // Organization model
  'projects.prisma',      // Project model
  'workflows.prisma',     // Workflow models
  'billing.prisma',       // Billing models
  'marketplace.prisma',   // Marketplace models
  'features.prisma',      // Feature flags
  'audit.prisma',         // Audit logs
  'monitoring.prisma',    // Metrics and alerts
  'forms.prisma',         // Form schemas
  'connectors.prisma',    // Connectors
  'tasks.prisma',         // Task definitions
  'config.prisma',        // Configuration
  'bmaas.prisma',         // BMaaS models
  'api.prisma',           // API keys and rate limiting
  'notifications.prisma', // Notification system
];

function readFile(filepath) {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (error) {
    console.warn(`⚠ Warning: Could not read ${filepath}`);
    return '';
  }
}

function buildSchema() {
  console.log('🔨 Building Prisma schema...\n');

  // Start with base configuration
  console.log('📝 Adding base configuration...');
  let schema = readFile(BASE_PATH);
  if (!schema) {
    console.error('❌ Error: _base.prisma not found!');
    process.exit(1);
  }

  schema += '\n\n';

  // Add each domain file in order
  let filesAdded = 0;
  for (const filename of FILE_ORDER) {
    const filepath = path.join(SCHEMA_DIR, filename);
    if (fs.existsSync(filepath)) {
      console.log(`   ✓ Adding ${filename}`);
      const content = readFile(filepath);
      if (content.trim()) {
        schema += `// ============================================================================\n`;
        schema += `// ${filename.replace('.prisma', '').toUpperCase()}\n`;
        schema += `// ============================================================================\n\n`;
        schema += content + '\n\n';
        filesAdded++;
      }
    } else {
      console.log(`   ⚠ Skipping ${filename} (not found)`);
    }
  }

  // Write the combined schema
  console.log(`\n📄 Writing combined schema to ${OUTPUT_PATH}...`);
  fs.writeFileSync(OUTPUT_PATH, schema);

  console.log(`\n✅ Schema built successfully!`);
  console.log(`   Files merged: ${filesAdded}`);
  console.log(`   Output size: ${(schema.length / 1024).toFixed(2)} KB`);
  console.log(`   Lines: ${schema.split('\n').length}`);
}

// Run
try {
  buildSchema();
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
