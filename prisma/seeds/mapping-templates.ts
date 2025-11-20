/**
 * Seed Pre-built Mapping Templates
 * Popular connector mapping configurations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SYSTEM_USER_ID = 'system'; // Replace with actual system user ID

const mappingTemplates = [
  // Salesforce Templates
  {
    name: 'Salesforce Contacts',
    description: 'Standard Salesforce Contacts API mapping for CRM integration',
    provider: 'salesforce',
    category: 'crm',
    service: 'contacts',
    connectorType: 'REST',
    rootPath: '$.records',
    mappings: [
      { sourceField: 'Id', targetField: 'id' },
      { sourceField: 'FirstName', targetField: 'firstName', transformExpression: 'trim' },
      { sourceField: 'LastName', targetField: 'lastName', transformExpression: 'trim' },
      { sourceField: 'Email', targetField: 'email', transformExpression: 'lowercase' },
      { sourceField: 'Phone', targetField: 'phone', transformExpression: 'trim' },
      { sourceField: 'AccountId', targetField: 'accountId' },
      { sourceField: 'CreatedDate', targetField: 'createdAt', transformExpression: 'date' },
      { sourceField: 'LastModifiedDate', targetField: 'updatedAt', transformExpression: 'date' },
    ],
    valueField: 'Id',
    displayField: 'FirstName',
    searchFields: ['FirstName', 'LastName', 'Email'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    isFeatured: true,
    tags: ['salesforce', 'crm', 'contacts', 'featured'],
    documentation:
      'Maps Salesforce Contact fields to standardized format. Includes automatic trimming of name fields and lowercase conversion for emails.',
  },
  {
    name: 'Salesforce Accounts',
    description: 'Salesforce Accounts (Companies) API mapping',
    provider: 'salesforce',
    category: 'crm',
    service: 'accounts',
    connectorType: 'REST',
    rootPath: '$.records',
    mappings: [
      { sourceField: 'Id', targetField: 'id' },
      { sourceField: 'Name', targetField: 'name', transformExpression: 'trim' },
      { sourceField: 'BillingStreet', targetField: 'address' },
      { sourceField: 'BillingCity', targetField: 'city' },
      { sourceField: 'BillingState', targetField: 'state' },
      { sourceField: 'BillingCountry', targetField: 'country' },
      { sourceField: 'Phone', targetField: 'phone', transformExpression: 'trim' },
      { sourceField: 'Website', targetField: 'website' },
      { sourceField: 'Industry', targetField: 'industry' },
      { sourceField: 'AnnualRevenue', targetField: 'revenue', transformExpression: 'number' },
    ],
    valueField: 'Id',
    displayField: 'Name',
    searchFields: ['Name', 'Industry'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    isFeatured: true,
    tags: ['salesforce', 'crm', 'accounts', 'companies', 'featured'],
  },

  // HubSpot Templates
  {
    name: 'HubSpot Contacts',
    description: 'HubSpot Contacts API v3 mapping',
    provider: 'hubspot',
    category: 'crm',
    service: 'contacts',
    connectorType: 'REST',
    rootPath: '$.results',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      {
        sourceField: 'properties.firstname',
        targetField: 'firstName',
        transformExpression: 'trim',
      },
      { sourceField: 'properties.lastname', targetField: 'lastName', transformExpression: 'trim' },
      { sourceField: 'properties.email', targetField: 'email', transformExpression: 'lowercase' },
      { sourceField: 'properties.phone', targetField: 'phone', transformExpression: 'trim' },
      { sourceField: 'properties.company', targetField: 'company' },
      {
        sourceField: 'properties.createdate',
        targetField: 'createdAt',
        transformExpression: 'date',
      },
      {
        sourceField: 'properties.lastmodifieddate',
        targetField: 'updatedAt',
        transformExpression: 'date',
      },
    ],
    valueField: 'id',
    displayField: 'firstname',
    searchFields: ['firstname', 'lastname', 'email', 'company'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    isFeatured: true,
    tags: ['hubspot', 'crm', 'contacts', 'featured'],
  },
  {
    name: 'HubSpot Companies',
    description: 'HubSpot Companies API v3 mapping',
    provider: 'hubspot',
    category: 'crm',
    service: 'companies',
    connectorType: 'REST',
    rootPath: '$.results',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'properties.name', targetField: 'name', transformExpression: 'trim' },
      { sourceField: 'properties.domain', targetField: 'domain' },
      { sourceField: 'properties.industry', targetField: 'industry' },
      {
        sourceField: 'properties.annualrevenue',
        targetField: 'revenue',
        transformExpression: 'number',
      },
      { sourceField: 'properties.city', targetField: 'city' },
      { sourceField: 'properties.state', targetField: 'state' },
      { sourceField: 'properties.country', targetField: 'country' },
    ],
    valueField: 'id',
    displayField: 'name',
    searchFields: ['name', 'domain', 'industry'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    tags: ['hubspot', 'crm', 'companies'],
  },

  // Stripe Templates
  {
    name: 'Stripe Customers',
    description: 'Stripe Customers API mapping for payment processing',
    provider: 'stripe',
    category: 'payments',
    service: 'customers',
    connectorType: 'REST',
    rootPath: '$.data',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'email', targetField: 'email', transformExpression: 'lowercase' },
      { sourceField: 'name', targetField: 'name', transformExpression: 'trim' },
      { sourceField: 'phone', targetField: 'phone', transformExpression: 'trim' },
      { sourceField: 'description', targetField: 'description' },
      { sourceField: 'currency', targetField: 'currency', transformExpression: 'uppercase' },
      { sourceField: 'balance', targetField: 'balance', transformExpression: 'number' },
      { sourceField: 'created', targetField: 'createdAt', transformExpression: 'date' },
    ],
    valueField: 'id',
    displayField: 'name',
    searchFields: ['name', 'email'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    isFeatured: true,
    tags: ['stripe', 'payments', 'customers', 'featured'],
  },
  {
    name: 'Stripe Invoices',
    description: 'Stripe Invoices API mapping',
    provider: 'stripe',
    category: 'payments',
    service: 'invoices',
    connectorType: 'REST',
    rootPath: '$.data',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'customer', targetField: 'customerId' },
      { sourceField: 'number', targetField: 'invoiceNumber' },
      { sourceField: 'amount_due', targetField: 'amountDue', transformExpression: 'number' },
      { sourceField: 'amount_paid', targetField: 'amountPaid', transformExpression: 'number' },
      { sourceField: 'currency', targetField: 'currency', transformExpression: 'uppercase' },
      { sourceField: 'status', targetField: 'status' },
      { sourceField: 'created', targetField: 'createdAt', transformExpression: 'date' },
      { sourceField: 'due_date', targetField: 'dueDate', transformExpression: 'date' },
    ],
    valueField: 'id',
    displayField: 'number',
    searchFields: ['number', 'customer'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    tags: ['stripe', 'payments', 'invoices'],
  },

  // Database Templates
  {
    name: 'PostgreSQL Users Table',
    description: 'Standard users table mapping for PostgreSQL databases',
    provider: 'postgresql',
    category: 'database',
    service: 'users',
    connectorType: 'DATABASE',
    rootPath: '$',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'email', targetField: 'email', transformExpression: 'lowercase' },
      { sourceField: 'first_name', targetField: 'firstName', transformExpression: 'trim' },
      { sourceField: 'last_name', targetField: 'lastName', transformExpression: 'trim' },
      { sourceField: 'created_at', targetField: 'createdAt', transformExpression: 'date' },
      { sourceField: 'updated_at', targetField: 'updatedAt', transformExpression: 'date' },
      { sourceField: 'is_active', targetField: 'active', transformExpression: 'boolean' },
    ],
    valueField: 'id',
    displayField: 'email',
    searchFields: ['email', 'first_name', 'last_name'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    tags: ['postgresql', 'database', 'users'],
  },

  // Generic REST API Templates
  {
    name: 'Generic REST API (JSON)',
    description: 'Generic REST API with standard JSON response structure',
    provider: 'rest-api',
    category: 'api',
    service: 'generic',
    connectorType: 'REST',
    rootPath: '$.data',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'name', targetField: 'name', transformExpression: 'trim' },
      { sourceField: 'description', targetField: 'description' },
      { sourceField: 'created_at', targetField: 'createdAt', transformExpression: 'date' },
      { sourceField: 'updated_at', targetField: 'updatedAt', transformExpression: 'date' },
    ],
    valueField: 'id',
    displayField: 'name',
    searchFields: ['name', 'description'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    tags: ['rest-api', 'generic', 'json'],
  },

  // GraphQL Templates
  {
    name: 'GitHub GraphQL API',
    description: 'GitHub GraphQL API v4 user query mapping',
    provider: 'github',
    category: 'development',
    service: 'users',
    connectorType: 'GraphQL',
    rootPath: '$.data.user',
    mappings: [
      { sourceField: 'id', targetField: 'id' },
      { sourceField: 'login', targetField: 'username' },
      { sourceField: 'name', targetField: 'name', transformExpression: 'trim' },
      { sourceField: 'email', targetField: 'email', transformExpression: 'lowercase' },
      { sourceField: 'bio', targetField: 'bio' },
      { sourceField: 'avatarUrl', targetField: 'avatar' },
      { sourceField: 'createdAt', targetField: 'createdAt', transformExpression: 'date' },
    ],
    valueField: 'id',
    displayField: 'login',
    searchFields: ['login', 'name', 'email'],
    visibility: 'PUBLIC',
    isSystemTemplate: true,
    tags: ['github', 'graphql', 'users', 'development'],
  },
];

async function seedMappingTemplates() {
  console.log('Seeding mapping templates...');

  for (const template of mappingTemplates) {
    try {
      await prisma.mappingTemplate.upsert({
        where: {
          provider_service_connector_unique: {
            provider: template.provider,
            service: template.service || '',
            connectorType: template.connectorType,
          },
        },
        update: {
          name: template.name,
          description: template.description,
          category: template.category,
          rootPath: template.rootPath,
          mappings: template.mappings as any,
          valueField: template.valueField,
          displayField: template.displayField,
          searchFields: template.searchFields as any,
          visibility: template.visibility as any,
          isSystemTemplate: template.isSystemTemplate,
          isFeatured: template.isFeatured,
          tags: template.tags,
          documentation: template.documentation,
        },
        create: {
          name: template.name,
          description: template.description,
          provider: template.provider,
          category: template.category,
          service: template.service,
          connectorType: template.connectorType,
          rootPath: template.rootPath,
          mappings: template.mappings as any,
          valueField: template.valueField,
          displayField: template.displayField,
          searchFields: template.searchFields as any,
          visibility: template.visibility as any,
          isSystemTemplate: template.isSystemTemplate,
          isFeatured: template.isFeatured,
          tags: template.tags,
          documentation: template.documentation,
          createdBy: SYSTEM_USER_ID,
        },
      });
      console.log(`✓ Seeded: ${template.name}`);
    } catch (error: any) {
      console.error(`✗ Failed to seed ${template.name}:`, error.message);
    }
  }

  console.log('Mapping templates seeded successfully!');
}

// Run seed if called directly
if (require.main === module) {
  seedMappingTemplates()
    .catch((error) => {
      console.error('Error seeding mapping templates:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { seedMappingTemplates };
