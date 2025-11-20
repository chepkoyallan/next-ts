import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper function to generate dates relative to now
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  console.log('🌱 Starting PRODUCTION database seeding...');
  console.log('📊 This will create comprehensive test data covering all edge cases\n');

  // ============================================================================
  // PASSWORD GENERATION
  // ============================================================================
  console.log('🔐 Generating password hashes...');
  const passwords = {
    superAdmin: await bcrypt.hash('superadmin123', 10),
    systemAdmin: await bcrypt.hash('sysadmin123', 10),
    projectAdmin: await bcrypt.hash('projadmin123', 10),
    developer: await bcrypt.hash('dev123', 10),
    operator: await bcrypt.hash('operator123', 10),
    viewer: await bcrypt.hash('viewer123', 10),
    trial: await bcrypt.hash('trial123', 10),
    suspended: await bcrypt.hash('suspended123', 10),
  };

  // ============================================================================
  // RBAC SYSTEM - PERMISSIONS AND ROLES
  // ============================================================================
  console.log('🔐 Creating permissions and roles...');

  const permissions = [
    // User management
    { resource: 'users', action: 'create', description: 'Create new users' },
    { resource: 'users', action: 'read', description: 'View user information' },
    { resource: 'users', action: 'update', description: 'Update user information' },
    { resource: 'users', action: 'delete', description: 'Delete users' },

    // Organization management
    { resource: 'organizations', action: 'create', description: 'Create organizations' },
    { resource: 'organizations', action: 'read', description: 'View organization information' },
    { resource: 'organizations', action: 'update', description: 'Update organization settings' },
    { resource: 'organizations', action: 'delete', description: 'Delete organizations' },

    // Project management
    { resource: 'projects', action: 'create', description: 'Create new projects' },
    { resource: 'projects', action: 'read', description: 'View project information' },
    { resource: 'projects', action: 'update', description: 'Update project settings' },
    { resource: 'projects', action: 'delete', description: 'Delete projects' },

    // Workflow management
    { resource: 'workflows', action: 'create', description: 'Create workflows' },
    { resource: 'workflows', action: 'read', description: 'View workflows' },
    { resource: 'workflows', action: 'update', description: 'Update workflows' },
    { resource: 'workflows', action: 'delete', description: 'Delete workflows' },
    { resource: 'workflows', action: 'execute', description: 'Execute workflows' },

    // Billing and payments
    { resource: 'billing', action: 'read', description: 'View billing information' },
    { resource: 'billing', action: 'manage', description: 'Manage billing and subscriptions' },
    { resource: 'payments', action: 'create', description: 'Create payment intents' },
    { resource: 'payments', action: 'read', description: 'View payment information' },
    { resource: 'payments', action: 'refund', description: 'Process refunds' },

    // Marketplace
    { resource: 'marketplace', action: 'read', description: 'Browse marketplace' },
    { resource: 'marketplace', action: 'publish', description: 'Publish workflows to marketplace' },
    { resource: 'marketplace', action: 'purchase', description: 'Purchase marketplace workflows' },

    // Analytics and monitoring
    { resource: 'analytics', action: 'read', description: 'View analytics and reports' },
    { resource: 'monitoring', action: 'read', description: 'View monitoring data' },
    { resource: 'monitoring', action: 'manage', description: 'Manage alerts and monitoring' },

    // System administration
    { resource: 'system', action: 'admin', description: 'Full system administration' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }

  // System roles
  const superAdmin = await prisma.role.upsert({
    where: { name: 'super-admin' },
    update: {},
    create: {
      name: 'super-admin',
      description: 'Ultimate system access with all permissions',
      hierarchy: 6,
      isSystemRole: true,
    },
  });

  const systemAdmin = await prisma.role.upsert({
    where: { name: 'system-admin' },
    update: {},
    create: {
      name: 'system-admin',
      description: 'Full system administration access',
      hierarchy: 5,
      isSystemRole: true,
    },
  });

  const projectAdmin = await prisma.role.upsert({
    where: { name: 'project-admin' },
    update: {},
    create: {
      name: 'project-admin',
      description: 'Full access to project resources',
      hierarchy: 4,
      isSystemRole: true,
    },
  });

  const operator = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: {
      name: 'operator',
      description: 'Can manage executions and monitor operations',
      hierarchy: 3,
      isSystemRole: true,
    },
  });

  const developer = await prisma.role.upsert({
    where: { name: 'developer' },
    update: {},
    create: {
      name: 'developer',
      description: 'Can create and manage workflows',
      hierarchy: 2,
      isSystemRole: true,
    },
  });

  const viewer = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access',
      hierarchy: 1,
      isSystemRole: true,
    },
  });

  console.log(`✅ Created ${permissions.length} permissions and 6 system roles`);

  // Assign permissions to roles
  console.log('🔗 Assigning permissions to roles...');
  const allPermissions = await prisma.permission.findMany();

  // Super Admin - ALL permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
  }

  // System Admin - All except system:admin
  const systemAdminPerms = allPermissions.filter(
    (p) => !(p.resource === 'system' && p.action === 'admin')
  );
  for (const perm of systemAdminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: systemAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: systemAdmin.id, permissionId: perm.id },
    });
  }

  // Project Admin
  const projectAdminPerms = allPermissions.filter((p) =>
    [
      'projects',
      'workflows',
      'users',
      'billing',
      'analytics',
      'monitoring',
      'marketplace',
    ].includes(p.resource)
  );
  for (const perm of projectAdminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: projectAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: projectAdmin.id, permissionId: perm.id },
    });
  }

  // Operator
  const operatorPerms = allPermissions.filter(
    (p) =>
      (p.resource === 'workflows' && ['execute', 'read'].includes(p.action)) ||
      (p.resource === 'projects' && p.action === 'read') ||
      p.resource === 'monitoring'
  );
  for (const perm of operatorPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operator.id, permissionId: perm.id } },
      update: {},
      create: { roleId: operator.id, permissionId: perm.id },
    });
  }

  // Developer
  const developerPerms = allPermissions.filter(
    (p) =>
      (p.resource === 'workflows' && ['create', 'read', 'update', 'execute'].includes(p.action)) ||
      (p.resource === 'projects' && ['read', 'update'].includes(p.action)) ||
      (p.resource === 'analytics' && p.action === 'read') ||
      (p.resource === 'marketplace' && ['read', 'purchase'].includes(p.action))
  );
  for (const perm of developerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: developer.id, permissionId: perm.id } },
      update: {},
      create: { roleId: developer.id, permissionId: perm.id },
    });
  }

  // Viewer - Read-only
  const viewerPerms = allPermissions.filter((p) => p.action === 'read');
  for (const perm of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewer.id, permissionId: perm.id } },
      update: {},
      create: { roleId: viewer.id, permissionId: perm.id },
    });
  }

  console.log('✅ Assigned permissions to all roles');

  // ============================================================================
  // ORGANIZATIONS (3 Organizations)
  // ============================================================================
  console.log('🏢 Creating organizations...');

  // Organization A - Acme Corp (Full-featured enterprise)
  const acmeCorp = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'Enterprise organization with full feature set',
      industry: 'Technology',
      size: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: {
        allowPublicWorkflows: true,
        defaultDomain: 'production',
        maxProjects: 50,
        ssoEnabled: true,
        auditLogsEnabled: true,
      },
    },
  });

  // Organization B - TechStart Inc (Startup)
  const techStart = await prisma.organization.upsert({
    where: { slug: 'techstart-inc' },
    update: {},
    create: {
      name: 'TechStart Inc',
      slug: 'techstart-inc',
      description: 'Startup organization testing growth limits',
      industry: 'Software',
      size: 'SMALL',
      status: 'ACTIVE',
      settings: {
        allowPublicWorkflows: false,
        defaultDomain: 'development',
        maxProjects: 5,
        ssoEnabled: false,
      },
    },
  });

  // Organization C - InactiveCorp (Suspended/Testing)
  const inactiveCorp = await prisma.organization.upsert({
    where: { slug: 'inactive-corp' },
    update: {},
    create: {
      name: 'InactiveCorp',
      slug: 'inactive-corp',
      description: 'Organization for testing suspended/inactive states',
      industry: 'Other',
      size: 'MEDIUM',
      status: 'SUSPENDED',
      settings: {
        allowPublicWorkflows: false,
        defaultDomain: 'development',
        maxProjects: 3,
      },
    },
  });

  console.log(`✅ Created 3 organizations`);

  // ============================================================================
  // SUBSCRIPTION PLANS
  // ============================================================================
  console.log('📋 Creating subscription plans...');

  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-free' },
    update: {},
    create: {
      id: 'plan-free',
      name: 'Free',
      description: 'Perfect for getting started',
      tier: 'FREE',
      pricing: {
        basePrice: 0,
        currency: 'USD',
        billingPeriod: 'monthly',
        overageRates: {
          executions: 0.01,
          cpuHours: 0.05,
          memoryGbHours: 0.01,
          storageGb: 0.001,
          networkGb: 0.001,
        },
      },
      features: ['basic_workflows', 'community_support', 'basic_monitoring', 'public_workflows'],
      limits: {
        executions: 100,
        cpuHours: 10,
        memoryGbHours: 20,
        storageGb: 1,
        networkGb: 5,
        users: 1,
        projects: 1,
        workflowComplexity: 'basic',
        supportLevel: 'community',
      },
    },
  });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-starter' },
    update: {},
    create: {
      id: 'plan-starter',
      name: 'Starter',
      description: 'For small teams',
      tier: 'STARTER',
      pricing: {
        basePrice: 49,
        currency: 'USD',
        billingPeriod: 'monthly',
        overageRates: {
          executions: 0.008,
          cpuHours: 0.04,
          memoryGbHours: 0.008,
          storageGb: 0.0008,
          networkGb: 0.0008,
        },
      },
      features: [
        'basic_workflows',
        'advanced_workflows',
        'email_support',
        'team_collaboration',
        'private_workflows',
      ],
      limits: {
        executions: 1000,
        cpuHours: 100,
        memoryGbHours: 200,
        storageGb: 10,
        networkGb: 50,
        users: 5,
        projects: 3,
        workflowComplexity: 'intermediate',
        supportLevel: 'email',
      },
    },
  });

  const professionalPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-professional' },
    update: {},
    create: {
      id: 'plan-professional',
      name: 'Professional',
      description: 'Advanced features for professionals',
      tier: 'PROFESSIONAL',
      pricing: {
        basePrice: 199,
        currency: 'USD',
        billingPeriod: 'monthly',
        overageRates: {
          executions: 0.006,
          cpuHours: 0.03,
          memoryGbHours: 0.006,
          storageGb: 0.0006,
          networkGb: 0.0006,
        },
      },
      features: [
        'basic_workflows',
        'advanced_workflows',
        'enterprise_workflows',
        'priority_support',
        'real_time_monitoring',
        'advanced_analytics',
        'api_access',
        'webhook_support',
        'marketplace_publishing',
      ],
      limits: {
        executions: 10000,
        cpuHours: 1000,
        memoryGbHours: 2000,
        storageGb: 100,
        networkGb: 500,
        users: 25,
        projects: 10,
        workflowComplexity: 'advanced',
        supportLevel: 'priority',
      },
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-enterprise' },
    update: {},
    create: {
      id: 'plan-enterprise',
      name: 'Enterprise',
      description: 'Unlimited scale for large organizations',
      tier: 'ENTERPRISE',
      pricing: {
        basePrice: 999,
        currency: 'USD',
        billingPeriod: 'monthly',
        overageRates: {
          executions: 0.004,
          cpuHours: 0.02,
          memoryGbHours: 0.004,
          storageGb: 0.0004,
          networkGb: 0.0004,
        },
      },
      features: [
        'basic_workflows',
        'advanced_workflows',
        'enterprise_workflows',
        'custom_workflows',
        'dedicated_support',
        'real_time_monitoring',
        'predictive_analytics',
        'api_access',
        'webhook_support',
        'marketplace_publishing',
        'sso_integration',
        'audit_logging',
        'compliance_reporting',
        'multi_cloud_orchestration',
      ],
      limits: {
        executions: -1,
        cpuHours: -1,
        memoryGbHours: -1,
        storageGb: -1,
        networkGb: -1,
        users: -1,
        projects: -1,
        workflowComplexity: 'unlimited',
        supportLevel: 'dedicated',
      },
    },
  });

  console.log('✅ Created 4 subscription plans');

  // ============================================================================
  // USERS - Organization A (Acme Corp) - 10 Users
  // ============================================================================
  console.log('👥 Creating users for Acme Corp...');

  const acme_superAdmin = await prisma.user.upsert({
    where: { email: 'super-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'super-admin@acme-corp.com',
      name: 'Alice Super Admin',
      passwordHash: passwords.superAdmin,
      emailVerified: true,
      phoneNumber: '+1-555-0001',
      country: 'United States',
      address: '1 Super Way',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94104',
      about: 'Super administrator with ultimate system access',
      isPublic: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      notificationPreferences: { email: true, sms: true, push: true, marketing: false },
    },
  });

  const acme_sysAdmin = await prisma.user.upsert({
    where: { email: 'sys-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'sys-admin@acme-corp.com',
      name: 'Bob System Admin',
      passwordHash: passwords.systemAdmin,
      emailVerified: true,
      phoneNumber: '+1-555-0002',
      country: 'United States',
      city: 'San Francisco',
      state: 'CA',
      about: 'System administrator',
      isPublic: false,
      notificationPreferences: { email: true, sms: true, push: true, marketing: false },
    },
  });

  const acme_projAdmin = await prisma.user.upsert({
    where: { email: 'project-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'project-admin@acme-corp.com',
      name: 'Carol Project Admin',
      passwordHash: passwords.projectAdmin,
      emailVerified: true,
      phoneNumber: '+1-555-0003',
      country: 'United States',
      city: 'San Francisco',
      state: 'CA',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: true, marketing: true },
    },
  });

  const acme_dev1 = await prisma.user.upsert({
    where: { email: 'dev1@acme-corp.com' },
    update: {},
    create: {
      email: 'dev1@acme-corp.com',
      name: 'David Developer',
      passwordHash: passwords.developer,
      emailVerified: true,
      phoneNumber: '+1-555-0004',
      country: 'United States',
      city: 'Palo Alto',
      state: 'CA',
      about: 'Senior developer',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: true, marketing: false },
    },
  });

  const acme_dev2 = await prisma.user.upsert({
    where: { email: 'dev2@acme-corp.com' },
    update: {},
    create: {
      email: 'dev2@acme-corp.com',
      name: 'Eve Developer',
      passwordHash: passwords.developer,
      emailVerified: true,
      phoneNumber: '+1-555-0005',
      country: 'United States',
      city: 'Mountain View',
      state: 'CA',
      about: 'Junior developer approaching usage limits',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: false, marketing: false },
    },
  });

  const acme_op1 = await prisma.user.upsert({
    where: { email: 'operator1@acme-corp.com' },
    update: {},
    create: {
      email: 'operator1@acme-corp.com',
      name: 'Frank Operator',
      passwordHash: passwords.operator,
      emailVerified: true,
      phoneNumber: '+1-555-0006',
      country: 'United States',
      city: 'San Jose',
      state: 'CA',
      about: 'Operations specialist',
      isPublic: true,
      notificationPreferences: { email: true, sms: true, push: true, marketing: false },
    },
  });

  const acme_op2 = await prisma.user.upsert({
    where: { email: 'operator2@acme-corp.com' },
    update: {},
    create: {
      email: 'operator2@acme-corp.com',
      name: 'Grace Operator',
      passwordHash: passwords.operator,
      emailVerified: true,
      phoneNumber: '+1-555-0007',
      country: 'United States',
      city: 'Oakland',
      state: 'CA',
      about: 'Monitoring specialist',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: true, marketing: false },
    },
  });

  const acme_viewer = await prisma.user.upsert({
    where: { email: 'viewer@acme-corp.com' },
    update: {},
    create: {
      email: 'viewer@acme-corp.com',
      name: 'Henry Viewer',
      passwordHash: passwords.viewer,
      emailVerified: true,
      phoneNumber: '+1-555-0008',
      country: 'United States',
      city: 'Berkeley',
      state: 'CA',
      about: 'Read-only user',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: false, marketing: true },
    },
  });

  const acme_trial = await prisma.user.upsert({
    where: { email: 'trial@acme-corp.com' },
    update: {},
    create: {
      email: 'trial@acme-corp.com',
      name: 'Iris Trial User',
      passwordHash: passwords.trial,
      emailVerified: true,
      phoneNumber: '+1-555-0009',
      country: 'United States',
      city: 'San Francisco',
      state: 'CA',
      about: 'Trial user - expiring soon',
      isPublic: false,
      notificationPreferences: { email: true, sms: true, push: true, marketing: true },
    },
  });

  const acme_suspended = await prisma.user.upsert({
    where: { email: 'suspended@acme-corp.com' },
    update: {},
    create: {
      email: 'suspended@acme-corp.com',
      name: 'Jack Suspended',
      passwordHash: passwords.suspended,
      emailVerified: false,
      phoneNumber: '+1-555-0010',
      country: 'United States',
      city: 'San Francisco',
      state: 'CA',
      about: 'Suspended account for testing',
      isPublic: false,
      notificationPreferences: { email: false, sms: false, push: false, marketing: false },
    },
  });

  console.log('✅ Created 10 users for Acme Corp');

  // ============================================================================
  // USERS - Organization B (TechStart) - 6 Users
  // ============================================================================
  console.log('👥 Creating users for TechStart Inc...');

  const tech_owner = await prisma.user.upsert({
    where: { email: 'owner@techstart.io' },
    update: {},
    create: {
      email: 'owner@techstart.io',
      name: 'Karen Owner',
      passwordHash: passwords.projectAdmin,
      emailVerified: true,
      phoneNumber: '+1-555-1001',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'Startup founder and owner',
      isPublic: true,
      notificationPreferences: { email: true, sms: true, push: true, marketing: true },
    },
  });

  const tech_dev = await prisma.user.upsert({
    where: { email: 'dev@techstart.io' },
    update: {},
    create: {
      email: 'dev@techstart.io',
      name: 'Leo Developer',
      passwordHash: passwords.developer,
      emailVerified: true,
      phoneNumber: '+1-555-1002',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'Full-stack developer near usage limits',
      isPublic: true,
      notificationPreferences: { email: true, sms: false, push: true, marketing: false },
    },
  });

  const tech_op = await prisma.user.upsert({
    where: { email: 'ops@techstart.io' },
    update: {},
    create: {
      email: 'ops@techstart.io',
      name: 'Maria Operator',
      passwordHash: passwords.operator,
      emailVerified: true,
      phoneNumber: '+1-555-1003',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'DevOps on free tier hitting limits',
      isPublic: true,
      notificationPreferences: { email: true, sms: true, push: true, marketing: false },
    },
  });

  const tech_viewer = await prisma.user.upsert({
    where: { email: 'viewer@techstart.io' },
    update: {},
    create: {
      email: 'viewer@techstart.io',
      name: 'Nathan Viewer',
      passwordHash: passwords.viewer,
      emailVerified: true,
      phoneNumber: '+1-555-1004',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'Contractor with read-only access',
      isPublic: false,
      notificationPreferences: { email: true, sms: false, push: false, marketing: false },
    },
  });

  const tech_invited = await prisma.user.upsert({
    where: { email: 'invited@techstart.io' },
    update: {},
    create: {
      email: 'invited@techstart.io',
      name: 'Olivia Invited',
      passwordHash: passwords.viewer,
      emailVerified: false,
      phoneNumber: '+1-555-1005',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'Pending invitation',
      isPublic: false,
      notificationPreferences: { email: true, sms: false, push: false, marketing: false },
    },
  });

  const tech_expired = await prisma.user.upsert({
    where: { email: 'expired@techstart.io' },
    update: {},
    create: {
      email: 'expired@techstart.io',
      name: 'Paul Expired Trial',
      passwordHash: passwords.trial,
      emailVerified: true,
      phoneNumber: '+1-555-1006',
      country: 'United States',
      city: 'Austin',
      state: 'TX',
      about: 'Trial expired, no payment method',
      isPublic: false,
      notificationPreferences: { email: true, sms: false, push: false, marketing: true },
    },
  });

  console.log('✅ Created 6 users for TechStart Inc');

  // ============================================================================
  // USERS - Organization C (InactiveCorp) - 2 Users
  // ============================================================================
  console.log('👥 Creating users for InactiveCorp...');

  const inactive_admin = await prisma.user.upsert({
    where: { email: 'admin@inactive-corp.com' },
    update: {},
    create: {
      email: 'admin@inactive-corp.com',
      name: 'Quinn Suspended Admin',
      passwordHash: passwords.systemAdmin,
      emailVerified: true,
      phoneNumber: '+1-555-2001',
      country: 'United States',
      city: 'Seattle',
      state: 'WA',
      about: 'Admin of suspended organization',
      isPublic: false,
      notificationPreferences: { email: false, sms: false, push: false, marketing: false },
    },
  });

  const inactive_deleted = await prisma.user.upsert({
    where: { email: 'deleted@inactive-corp.com' },
    update: {},
    create: {
      email: 'deleted@inactive-corp.com',
      name: 'Rachel Deleted',
      passwordHash: passwords.viewer,
      emailVerified: true,
      phoneNumber: '+1-555-2002',
      country: 'United States',
      city: 'Seattle',
      state: 'WA',
      about: 'Soft-deleted user for GDPR testing',
      isPublic: false,
      deletedAt: daysAgo(30),
      notificationPreferences: { email: false, sms: false, push: false, marketing: false },
    },
  });

  console.log('✅ Created 2 users for InactiveCorp');
  console.log('📊 Total users created: 18\n');

  // ============================================================================
  // ORGANIZATION MEMBERSHIPS
  // ============================================================================
  console.log('🔗 Creating organization memberships...');

  // Acme Corp memberships
  const acmeMemberships = [
    { user: acme_superAdmin, role: 'OWNER' as const },
    { user: acme_sysAdmin, role: 'ADMIN' as const },
    { user: acme_projAdmin, role: 'ADMIN' as const },
    { user: acme_dev1, role: 'MEMBER' as const },
    { user: acme_dev2, role: 'MEMBER' as const },
    { user: acme_op1, role: 'MEMBER' as const },
    { user: acme_op2, role: 'MEMBER' as const },
    { user: acme_viewer, role: 'VIEWER' as const },
    { user: acme_trial, role: 'MEMBER' as const },
    { user: acme_suspended, role: 'MEMBER' as const },
  ];

  for (const { user, role } of acmeMemberships) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: acmeCorp.id, userId: user.id } },
      update: {},
      create: {
        organizationId: acmeCorp.id,
        userId: user.id,
        role,
        invitedBy: acme_superAdmin.id,
      },
    });
  }

  // TechStart memberships
  const techMemberships = [
    { user: tech_owner, role: 'OWNER' as const },
    { user: tech_dev, role: 'MEMBER' as const },
    { user: tech_op, role: 'MEMBER' as const },
    { user: tech_viewer, role: 'VIEWER' as const },
    { user: tech_invited, role: 'MEMBER' as const, isActive: false },
    { user: tech_expired, role: 'MEMBER' as const },
  ];

  for (const { user, role, isActive = true } of techMemberships) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: techStart.id, userId: user.id } },
      update: {},
      create: {
        organizationId: techStart.id,
        userId: user.id,
        role,
        invitedBy: tech_owner.id,
        isActive,
      },
    });
  }

  // InactiveCorp memberships
  const inactiveMemberships = [
    { user: inactive_admin, role: 'OWNER' as const },
    { user: inactive_deleted, role: 'MEMBER' as const },
  ];

  for (const { user, role } of inactiveMemberships) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: inactiveCorp.id, userId: user.id } },
      update: {},
      create: {
        organizationId: inactiveCorp.id,
        userId: user.id,
        role,
        invitedBy: inactive_admin.id,
      },
    });
  }

  console.log('✅ Created organization memberships');

  // ============================================================================
  // USER ROLES ASSIGNMENT
  // ============================================================================
  console.log('🎭 Assigning user roles...');

  const roleAssignments = [
    // Acme Corp
    { user: acme_superAdmin, role: superAdmin, assignedBy: 'system' },
    { user: acme_sysAdmin, role: systemAdmin, assignedBy: acme_superAdmin.id },
    { user: acme_projAdmin, role: projectAdmin, assignedBy: acme_sysAdmin.id },
    { user: acme_dev1, role: developer, assignedBy: acme_projAdmin.id },
    { user: acme_dev2, role: developer, assignedBy: acme_projAdmin.id },
    { user: acme_op1, role: operator, assignedBy: acme_projAdmin.id },
    { user: acme_op2, role: operator, assignedBy: acme_projAdmin.id },
    { user: acme_viewer, role: viewer, assignedBy: acme_projAdmin.id },
    { user: acme_trial, role: developer, assignedBy: acme_projAdmin.id },
    { user: acme_suspended, role: viewer, assignedBy: acme_projAdmin.id },
    // TechStart
    { user: tech_owner, role: projectAdmin, assignedBy: 'system' },
    { user: tech_dev, role: developer, assignedBy: tech_owner.id },
    { user: tech_op, role: operator, assignedBy: tech_owner.id },
    { user: tech_viewer, role: viewer, assignedBy: tech_owner.id },
    { user: tech_expired, role: viewer, assignedBy: tech_owner.id },
    // InactiveCorp
    { user: inactive_admin, role: systemAdmin, assignedBy: 'system' },
    { user: inactive_deleted, role: viewer, assignedBy: inactive_admin.id },
  ];

  for (const { user, role, assignedBy } of roleAssignments) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
        assignedBy,
      },
    });
  }

  console.log('✅ Assigned roles to all users');

  // ============================================================================
  // PROJECTS
  // ============================================================================
  console.log('🗂️  Creating projects...');

  const orgPrefix_acme = `org-${acmeCorp.id.substring(0, 8)}`;
  const orgPrefix_tech = `org-${techStart.id.substring(0, 8)}`;
  const sharedFlyteProjectId = 'aus';

  // Acme Corp Projects (5 projects)
  const acme_prod = await prisma.project.upsert({
    where: { id: 'acme-prod-001' },
    update: {},
    create: {
      id: 'acme-prod-001',
      organizationId: acmeCorp.id,
      name: 'Production Workflows',
      description: 'Production-grade workflows',
      domain: 'production',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_acme,
      flyteDomains: [
        { id: 'acme-prod-001-development', name: 'Production - Development' },
        { id: 'acme-prod-001-staging', name: 'Production - Staging' },
        { id: 'acme-prod-001-production', name: 'Production - Production' },
      ],
      createdBy: acme_superAdmin.id,
      settings: { maxWorkflows: 1000, allowPublicWorkflows: false },
    },
  });

  const acme_dev = await prisma.project.upsert({
    where: { id: 'acme-dev-001' },
    update: {},
    create: {
      id: 'acme-dev-001',
      organizationId: acmeCorp.id,
      name: 'Development Lab',
      description: 'Development and testing',
      domain: 'development',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_acme,
      flyteDomains: [{ id: 'acme-dev-001-development', name: 'Dev Lab - Development' }],
      createdBy: acme_projAdmin.id,
      settings: { maxWorkflows: 100, allowPublicWorkflows: true },
    },
  });

  const acme_ml = await prisma.project.upsert({
    where: { id: 'acme-ml-001' },
    update: {},
    create: {
      id: 'acme-ml-001',
      organizationId: acmeCorp.id,
      name: 'ML Training Pipelines',
      description: 'Machine learning workflows',
      domain: 'production',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_acme,
      flyteDomains: [
        { id: 'acme-ml-001-development', name: 'ML - Development' },
        { id: 'acme-ml-001-production', name: 'ML - Production' },
      ],
      createdBy: acme_dev1.id,
      settings: { maxWorkflows: 500, allowPublicWorkflows: false },
    },
  });

  const acme_etl = await prisma.project.upsert({
    where: { id: 'acme-etl-001' },
    update: {},
    create: {
      id: 'acme-etl-001',
      organizationId: acmeCorp.id,
      name: 'Data ETL Pipelines',
      description: 'Extract, Transform, Load workflows',
      domain: 'production',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_acme,
      flyteDomains: [{ id: 'acme-etl-001-production', name: 'ETL - Production' }],
      createdBy: acme_dev2.id,
      settings: { maxWorkflows: 200, allowPublicWorkflows: false },
    },
  });

  const acme_archived = await prisma.project.upsert({
    where: { id: 'acme-archived-001' },
    update: {},
    create: {
      id: 'acme-archived-001',
      organizationId: acmeCorp.id,
      name: 'Archived Project',
      description: 'Old project for testing archived state',
      domain: 'development',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_acme,
      flyteDomains: [{ id: 'acme-archived-001-development', name: 'Archived - Development' }],
      createdBy: acme_projAdmin.id,
      isArchived: true,
      settings: { maxWorkflows: 50, allowPublicWorkflows: false },
    },
  });

  // TechStart Projects (2 projects)
  const tech_main = await prisma.project.upsert({
    where: { id: 'tech-main-001' },
    update: {},
    create: {
      id: 'tech-main-001',
      organizationId: techStart.id,
      name: 'Main Application',
      description: 'Primary application workflows',
      domain: 'development',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_tech,
      flyteDomains: [
        { id: 'tech-main-001-development', name: 'Main App - Development' },
        { id: 'tech-main-001-production', name: 'Main App - Production' },
      ],
      createdBy: tech_owner.id,
      settings: { maxWorkflows: 50, allowPublicWorkflows: true },
    },
  });

  const tech_test = await prisma.project.upsert({
    where: { id: 'tech-test-001' },
    update: {},
    create: {
      id: 'tech-test-001',
      organizationId: techStart.id,
      name: 'Testing Sandbox',
      description: 'Testing and experimentation',
      domain: 'development',
      flyteProjectId: sharedFlyteProjectId,
      flyteOrgPrefix: orgPrefix_tech,
      flyteDomains: [{ id: 'tech-test-001-development', name: 'Testing - Development' }],
      createdBy: tech_dev.id,
      settings: { maxWorkflows: 20, allowPublicWorkflows: true },
    },
  });

  console.log('✅ Created 7 projects across organizations');

  // ============================================================================
  // BILLING ACCOUNTS
  // ============================================================================
  console.log('💳 Creating billing accounts...');

  const billing_acme = await prisma.billingAccount.upsert({
    where: { id: 'billing-acme-001' },
    update: {},
    create: {
      id: 'billing-acme-001',
      organizationId: acmeCorp.id,
      name: 'Acme Corp Billing',
      email: 'billing@acme-corp.com',
      status: 'ACTIVE',
      paymentMethodId: 'pm_acme_card_001',
      taxId: 'US123456789',
      currency: 'USD',
      stripeCustomerId: 'cus_acme_stripe_001',
      billingAddress: {
        name: 'Acme Corporation',
        line1: '1 Super Way',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94104',
        country: 'US',
        phone: '+1-555-0001',
      },
      metadata: { accountType: 'enterprise', contractNumber: 'ENT-2024-001' },
    },
  });

  const billing_tech = await prisma.billingAccount.upsert({
    where: { id: 'billing-tech-001' },
    update: {},
    create: {
      id: 'billing-tech-001',
      organizationId: techStart.id,
      name: 'TechStart Inc Billing',
      email: 'billing@techstart.io',
      status: 'ACTIVE',
      paymentMethodId: 'pm_tech_card_001',
      currency: 'USD',
      stripeCustomerId: 'cus_tech_stripe_001',
      billingAddress: {
        name: 'TechStart Inc',
        line1: '100 Startup Lane',
        city: 'Austin',
        state: 'TX',
        postal_code: '78701',
        country: 'US',
        phone: '+1-555-1001',
      },
      metadata: { accountType: 'startup' },
    },
  });

  const billing_inactive = await prisma.billingAccount.upsert({
    where: { id: 'billing-inactive-001' },
    update: {},
    create: {
      id: 'billing-inactive-001',
      organizationId: inactiveCorp.id,
      name: 'InactiveCorp Billing',
      email: 'billing@inactive-corp.com',
      status: 'SUSPENDED',
      currency: 'USD',
      billingAddress: {
        name: 'InactiveCorp',
        line1: '200 Suspended St',
        city: 'Seattle',
        state: 'WA',
        postal_code: '98101',
        country: 'US',
      },
      metadata: { suspensionReason: 'payment_failure', suspendedAt: daysAgo(15).toISOString() },
    },
  });

  console.log('✅ Created 3 billing accounts');

  // ============================================================================
  // SUBSCRIPTIONS - EDGE CASES
  // ============================================================================
  console.log('📝 Creating subscriptions with various states...');

  // Acme Corp Subscriptions

  // 1. Active Enterprise (Super Admin)
  const sub_acme_enterprise = await prisma.subscription.upsert({
    where: { id: 'sub-acme-enterprise-001' },
    update: {},
    create: {
      id: 'sub-acme-enterprise-001',
      billingAccountId: billing_acme.id,
      projectId: acme_prod.id,
      planId: enterprisePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(15),
      currentPeriodEnd: daysFromNow(15),
      stripeSubscriptionId: 'sub_acme_ent_001',
      metadata: { userId: acme_superAdmin.id, tier: 'enterprise', annualContract: true },
    },
  });

  // 2. Active Professional (System Admin)
  const sub_acme_pro = await prisma.subscription.upsert({
    where: { id: 'sub-acme-pro-001' },
    update: {},
    create: {
      id: 'sub-acme-pro-001',
      billingAccountId: billing_acme.id,
      projectId: acme_dev.id,
      planId: professionalPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(10),
      currentPeriodEnd: daysFromNow(20),
      stripeSubscriptionId: 'sub_acme_pro_001',
      metadata: { userId: acme_sysAdmin.id, tier: 'professional' },
    },
  });

  // 3. Active Starter (Dev 1)
  const sub_acme_starter1 = await prisma.subscription.upsert({
    where: { id: 'sub-acme-starter-001' },
    update: {},
    create: {
      id: 'sub-acme-starter-001',
      billingAccountId: billing_acme.id,
      projectId: acme_ml.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(5),
      currentPeriodEnd: daysFromNow(25),
      stripeSubscriptionId: 'sub_acme_starter_001',
      metadata: { userId: acme_dev1.id, tier: 'starter' },
    },
  });

  // 4. Active Starter (Dev 2 - near limits)
  const sub_acme_starter2 = await prisma.subscription.upsert({
    where: { id: 'sub-acme-starter-002' },
    update: {},
    create: {
      id: 'sub-acme-starter-002',
      billingAccountId: billing_acme.id,
      projectId: acme_etl.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(20),
      currentPeriodEnd: daysFromNow(10),
      stripeSubscriptionId: 'sub_acme_starter_002',
      metadata: { userId: acme_dev2.id, tier: 'starter', nearLimit: true, usagePercent: 95 },
    },
  });

  // 5. Free Tier (Viewer)
  const sub_acme_free = await prisma.subscription.upsert({
    where: { id: 'sub-acme-free-001' },
    update: {},
    create: {
      id: 'sub-acme-free-001',
      billingAccountId: billing_acme.id,
      projectId: acme_dev.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(28),
      currentPeriodEnd: daysFromNow(2),
      metadata: { userId: acme_viewer.id, tier: 'free' },
    },
  });

  // 6. Trialing Professional (Trial User - expiring soon)
  const sub_acme_trial = await prisma.subscription.upsert({
    where: { id: 'sub-acme-trial-001' },
    update: {},
    create: {
      id: 'sub-acme-trial-001',
      billingAccountId: billing_acme.id,
      projectId: acme_dev.id,
      planId: professionalPlan.id,
      status: 'TRIALING',
      currentPeriodStart: daysAgo(11),
      currentPeriodEnd: daysFromNow(19),
      trialStart: daysAgo(11),
      trialEnd: daysFromNow(3), // Expiring in 3 days
      stripeSubscriptionId: 'sub_acme_trial_001',
      metadata: { userId: acme_trial.id, tier: 'professional', trialExpiringSoon: true },
    },
  });

  // TechStart Subscriptions

  // 7. Active Professional (Owner)
  const sub_tech_pro = await prisma.subscription.upsert({
    where: { id: 'sub-tech-pro-001' },
    update: {},
    create: {
      id: 'sub-tech-pro-001',
      billingAccountId: billing_tech.id,
      projectId: tech_main.id,
      planId: professionalPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(7),
      currentPeriodEnd: daysFromNow(23),
      stripeSubscriptionId: 'sub_tech_pro_001',
      metadata: { userId: tech_owner.id, tier: 'professional' },
    },
  });

  // 8. Active Starter (Dev - near limits)
  const sub_tech_starter = await prisma.subscription.upsert({
    where: { id: 'sub-tech-starter-001' },
    update: {},
    create: {
      id: 'sub-tech-starter-001',
      billingAccountId: billing_tech.id,
      projectId: tech_test.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(25),
      currentPeriodEnd: daysFromNow(5),
      stripeSubscriptionId: 'sub_tech_starter_001',
      metadata: { userId: tech_dev.id, tier: 'starter', nearLimit: true, usagePercent: 88 },
    },
  });

  // 9. Free Tier (Operator - at limits)
  const sub_tech_free = await prisma.subscription.upsert({
    where: { id: 'sub-tech-free-001' },
    update: {},
    create: {
      id: 'sub-tech-free-001',
      billingAccountId: billing_tech.id,
      projectId: tech_test.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(28),
      currentPeriodEnd: daysFromNow(2),
      metadata: { userId: tech_op.id, tier: 'free', atLimit: true, usagePercent: 100 },
    },
  });

  // 10. Past Due (Expired Trial User)
  const sub_tech_pastdue = await prisma.subscription.upsert({
    where: { id: 'sub-tech-pastdue-001' },
    update: {},
    create: {
      id: 'sub-tech-pastdue-001',
      billingAccountId: billing_tech.id,
      projectId: tech_main.id,
      planId: starterPlan.id,
      status: 'PAST_DUE',
      currentPeriodStart: daysAgo(35),
      currentPeriodEnd: daysAgo(5),
      trialStart: daysAgo(45),
      trialEnd: daysAgo(15),
      stripeSubscriptionId: 'sub_tech_pastdue_001',
      metadata: { userId: tech_expired.id, tier: 'starter', paymentFailed: true, attemptCount: 3 },
    },
  });

  // 11. Canceled (scheduled)
  const sub_tech_canceled = await prisma.subscription.upsert({
    where: { id: 'sub-tech-canceled-001' },
    update: {},
    create: {
      id: 'sub-tech-canceled-001',
      billingAccountId: billing_tech.id,
      projectId: tech_test.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: daysAgo(20),
      currentPeriodEnd: daysFromNow(10),
      cancelAt: daysFromNow(10), // Will cancel at period end
      metadata: { userId: tech_viewer.id, tier: 'free', canceledByUser: true },
    },
  });

  console.log('✅ Created 11 subscriptions covering all states');

  // ============================================================================
  // FEATURE GATES
  // ============================================================================
  console.log('🚪 Creating feature gates...');

  const featureGates = [
    {
      feature: 'basic_workflows',
      name: 'Basic Workflows',
      description: 'Simple linear workflows',
      requiredPlans: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'advanced_workflows',
      name: 'Advanced Workflows',
      description: 'Complex workflows with conditionals',
      requiredPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'enterprise_workflows',
      name: 'Enterprise Workflows',
      description: 'Mission-critical workflows',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'custom_workflows',
      name: 'Custom Workflows',
      description: 'Fully customizable workflows',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'real_time_monitoring',
      name: 'Real-time Monitoring',
      description: 'Live monitoring and alerting',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Detailed analytics and insights',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'predictive_analytics',
      name: 'Predictive Analytics',
      description: 'AI-powered predictions',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'marketplace_publishing',
      name: 'Marketplace Publishing',
      description: 'Publish workflows to marketplace',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 10,
      usagePeriod: 'monthly',
    },
    {
      feature: 'api_access',
      name: 'API Access',
      description: 'Full REST API access',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 1000,
      usagePeriod: 'daily',
    },
    {
      feature: 'webhook_support',
      name: 'Webhook Support',
      description: 'Real-time notifications via webhooks',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 100,
      usagePeriod: 'daily',
    },
    {
      feature: 'sso_integration',
      name: 'SSO Integration',
      description: 'Single Sign-On with enterprise IdP',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'audit_logging',
      name: 'Audit Logging',
      description: 'Comprehensive audit trails',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'compliance_reporting',
      name: 'Compliance Reporting',
      description: 'Automated compliance reports',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'team_collaboration',
      name: 'Team Collaboration',
      description: 'Multi-user collaboration',
      requiredPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
  ];

  for (const gate of featureGates) {
    await prisma.featureGate.upsert({
      where: { feature: gate.feature },
      update: {},
      create: {
        feature: gate.feature,
        name: gate.name,
        description: gate.description,
        requiredPlans: gate.requiredPlans,
        usageLimit: gate.usageLimit,
        usagePeriod: gate.usagePeriod || 'monthly',
        isActive: true,
      },
    });
  }

  console.log(`✅ Created ${featureGates.length} feature gates`);

  // ============================================================================
  // FEATURE FLAGS
  // ============================================================================

  const { seedFeatureFlagSystem } = await import('./seeds/feature-flags');
  await seedFeatureFlagSystem(prisma, {
    adminUserId: acme_superAdmin.id,
    testOrganizationId: acmeCorp.id,
  });

  console.log('\n🎉 PRODUCTION DATABASE SEEDING COMPLETED!');
  console.log('\n📊 Summary:');
  console.log('   - 3 Organizations (Active, Startup, Suspended)');
  console.log('   - 18 Users across all organizations');
  console.log('   - 6 RBAC Roles with full permission mapping');
  console.log('   - 7 Projects (5 Acme, 2 TechStart)');
  console.log('   - 3 Billing Accounts (Active, Active, Suspended)');
  console.log('   - 11 Subscriptions (covering all states and tiers)');
  console.log('   - 14 Feature Gates');
  console.log('   - 34 Feature Flags with overrides');
  console.log('\n✅ All edge cases covered for production testing');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
