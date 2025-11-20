#!/usr/bin/env node
/**
 * Prisma Schema Splitter
 * Automatically splits monolithic schema.prisma into modular domain files
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../../prisma/schema.prisma.backup');
const OUTPUT_DIR = path.join(__dirname, '../../prisma/schema');

// Domain mappings - which models belong to which domain
const DOMAIN_MAP = {
  '_shared.prisma': {
    description: 'Shared enums and types used across domains',
    patterns: [/^enum /],
    exclude: [] // We'll handle enums specially
  },
  'auth.prisma': {
    description: 'Authentication, users, roles, and permissions',
    models: ['User', 'Role', 'Permission', 'UserRole', 'RolePermission']
  },
  'organizations.prisma': {
    description: 'Multi-tenancy: organizations, members, invitations',
    models: ['Organization', 'OrganizationMember', 'OrganizationInvitation'],
    enums: ['OrganizationRole', 'OrganizationStatus', 'InvitationStatus']
  },
  'projects.prisma': {
    description: 'Project management and organization',
    models: ['Project']
  },
  'workflows.prisma': {
    description: 'Workflow orchestration: workflows, tasks, executions',
    models: ['Workflow', 'LaunchPlan', 'WorkflowExecution', 'Task', 'WorkflowDraft'],
    enums: ['WorkflowStatus', 'LaunchPlanStatus', 'ExecutionPhase']
  },
  'billing.prisma': {
    description: 'Billing, subscriptions, invoices, and payments',
    models: [
      'BillingAccount', 'SubscriptionPlan', 'Subscription', 'UsageRecord',
      'ExecutionUsage', 'Invoice', 'PaymentHistory', 'BillingAlert',
      'PaymentMethod', 'BillingAddress'
    ],
    enums: [
      'BillingAccountStatus', 'SubscriptionStatus', 'PlanTier', 'UsageMetric',
      'ExecutionStatus', 'InvoiceStatus', 'PaymentStatus', 'BillingAlertType', 'AlertSeverity'
    ]
  },
  'marketplace.prisma': {
    description: 'Workflow marketplace: listings, purchases, reviews',
    models: [
      'MarketplaceWorkflow', 'WorkflowSpecification', 'WorkflowPurchase',
      'WorkflowReview', 'MarketplaceRevenue'
    ],
    enums: [
      'WorkflowCategory', 'MarketplaceStatus', 'LicenseType', 'PurchaseStatus', 'PayoutStatus'
    ]
  },
  'features.prisma': {
    description: 'Feature gates, flags, and usage tracking',
    models: [
      'FeatureGate', 'FeatureUsage', 'FeatureAccessLog', 'FeatureOverride',
      'FeatureFlag', 'FeatureFlagOverride', 'FeatureFlagAuditLog'
    ],
    enums: ['FeatureOverrideType', 'FeatureFlagType', 'FeatureFlagScope']
  },
  'audit.prisma': {
    description: 'Audit logs, compliance, and GDPR',
    models: ['AuditLog', 'DataClassification', 'GdprRequest'],
    enums: ['GdprRequestType', 'GdprRequestStatus']
  },
  'monitoring.prisma': {
    description: 'Metrics, alerts, and system monitoring',
    models: ['Metric', 'AlertRule', 'Alert'],
    enums: ['MetricType', 'AlertStatus']
  },
  'forms.prisma': {
    description: 'Dynamic form generation and submissions',
    models: ['FormSchema', 'FormAssignment', 'FormSubmission']
  },
  'connectors.prisma': {
    description: 'External system connectors and integrations',
    models: ['ConnectorConfig', 'ConnectorAuditLog', 'MappingTemplate'],
    enums: ['MappingTemplateStatus', 'MappingTemplateVisibility']
  },
  'tasks.prisma': {
    description: 'Task definitions and AI-powered code generation',
    models: ['TaskDefinition', 'AIProviderKey', 'AIGenerationLog'],
    enums: ['TaskRegistrationStatus']
  },
  'config.prisma': {
    description: 'Application, user, and plugin configuration',
    models: ['UserSettings', 'AppConfig', 'UserConfig', 'OrganizationConfig', 'PluginConfig']
  },
  'bmaas.prisma': {
    description: 'Bare Metal as a Service: instances, volumes, networks',
    models: [
      'BmaasInstance', 'BmaasFlavor', 'BmaasNetwork', 'BmaasSubnet',
      'BmaasNetworkPort', 'BmaasVolume', 'BmaasBucket', 'BmaasUsageRecord', 'BmaasQuota'
    ],
    enums: [
      'BmaasInstanceStatus', 'BmaasNetworkStatus', 'BmaasVolumeStatus',
      'BmaasBucketStatus', 'BmaasResourceType'
    ]
  }
};

function readSchema() {
  return fs.readFileSync(SCHEMA_PATH, 'utf-8');
}

function extractBlock(content, startPattern, endPattern = null) {
  const lines = content.split('\n');
  const blocks = [];
  let currentBlock = null;
  let braceCount = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line matches start pattern
    if (startPattern.test(line)) {
      inBlock = true;
      currentBlock = { start: i, lines: [line], name: line.match(/(?:model|enum)\s+(\w+)/)?.[1] };
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

      if (braceCount === 0 && line.includes('{') && line.includes('}')) {
        // Single-line enum
        blocks.push(currentBlock);
        currentBlock = null;
        inBlock = false;
      }
      continue;
    }

    if (inBlock && currentBlock) {
      currentBlock.lines.push(line);
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      if (braceCount === 0) {
        blocks.push(currentBlock);
        currentBlock = null;
        inBlock = false;
      }
    }
  }

  return blocks;
}

function splitSchema() {
  console.log('🔍 Reading schema...');
  const content = readSchema();

  console.log('📊 Extracting models and enums...');
  const models = extractBlock(content, /^model\s+\w+/);
  const enums = extractBlock(content, /^enum\s+\w+/);

  console.log(`   Found ${models.length} models`);
  console.log(`   Found ${enums.length} enums`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Track what we've written
  const written = { models: new Set(), enums: new Set() };

  // Write each domain file
  for (const [filename, config] of Object.entries(DOMAIN_MAP)) {
    console.log(`\n📝 Creating ${filename}...`);
    const filePath = path.join(OUTPUT_DIR, filename);
    let fileContent = `// ${config.description}\n// ============================================================================\n\n`;

    // Add models
    if (config.models) {
      for (const modelName of config.models) {
        const modelBlock = models.find(m => m.name === modelName);
        if (modelBlock) {
          fileContent += modelBlock.lines.join('\n') + '\n\n';
          written.models.add(modelName);
          console.log(`   ✓ Added model: ${modelName}`);
        } else {
          console.log(`   ⚠ Model not found: ${modelName}`);
        }
      }
    }

    // Add enums
    if (config.enums) {
      for (const enumName of config.enums) {
        const enumBlock = enums.find(e => e.name === enumName);
        if (enumBlock) {
          fileContent += enumBlock.lines.join('\n') + '\n\n';
          written.enums.add(enumName);
          console.log(`   ✓ Added enum: ${enumName}`);
        } else {
          console.log(`   ⚠ Enum not found: ${enumName}`);
        }
      }
    }

    fs.writeFileSync(filePath, fileContent);
  }

  // Write any remaining enums to _shared.prisma
  console.log(`\n📝 Creating _shared.prisma for remaining enums...`);
  const sharedPath = path.join(OUTPUT_DIR, '_shared.prisma');
  let sharedContent = `// Shared enums and types\n// ============================================================================\n\n`;

  let sharedCount = 0;
  for (const enumBlock of enums) {
    if (!written.enums.has(enumBlock.name)) {
      sharedContent += enumBlock.lines.join('\n') + '\n\n';
      sharedCount++;
      console.log(`   ✓ Added shared enum: ${enumBlock.name}`);
    }
  }

  if (sharedCount > 0) {
    fs.writeFileSync(sharedPath, sharedContent);
  }

  // Report statistics
  console.log('\n📊 Summary:');
  console.log(`   ✓ Written ${written.models.size}/${models.length} models`);
  console.log(`   ✓ Written ${written.enums.size}/${enums.length} enums`);
  console.log(`   ✓ Files created in: ${OUTPUT_DIR}`);

  // List any missing items
  const missingModels = models.filter(m => !written.models.has(m.name)).map(m => m.name);
  const missingEnums = enums.filter(e => !written.enums.has(e.name)).map(e => e.name);

  if (missingModels.length > 0) {
    console.log(`\n⚠ Missing models (${missingModels.length}):`);
    missingModels.forEach(name => console.log(`   - ${name}`));
  }

  if (missingEnums.length > 0 && sharedCount === 0) {
    console.log(`\n⚠ Missing enums (${missingEnums.length}):`);
    missingEnums.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Schema split complete!');
}

// Run
try {
  splitSchema();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
