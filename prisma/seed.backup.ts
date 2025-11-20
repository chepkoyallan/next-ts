import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Generate password hashes
  const superAdminPassword = await bcrypt.hash('superadmin123', 10);
  const systemAdminPassword = await bcrypt.hash('sysadmin123', 10);
  const adminPassword = await bcrypt.hash('admin123', 10);
  const projectAdminPassword = await bcrypt.hash('projadmin123', 10);
  const operatorPassword = await bcrypt.hash('operator123', 10);
  const devPassword = await bcrypt.hash('dev123', 10);
  const viewerPassword = await bcrypt.hash('viewer123', 10);

  // ============================================================================
  // RBAC SYSTEM - PERMISSIONS AND ROLES
  // ============================================================================

  console.log('🔐 Creating permissions and roles...');

  // Core permissions
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

  // System roles (matching RBAC hierarchy)
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
      description: 'Full system administration access including user and role management',
      hierarchy: 5,
      isSystemRole: true,
    },
  });

  const projectAdmin = await prisma.role.upsert({
    where: { name: 'project-admin' },
    update: {},
    create: {
      name: 'project-admin',
      description: 'Full access to project resources and team management',
      hierarchy: 4,
      isSystemRole: true,
    },
  });

  const operator = await prisma.role.upsert({
    where: { name: 'operator' },
    update: {},
    create: {
      name: 'operator',
      description: 'Can manage executions and monitor system operations',
      hierarchy: 3,
      isSystemRole: true,
    },
  });

  const developer = await prisma.role.upsert({
    where: { name: 'developer' },
    update: {},
    create: {
      name: 'developer',
      description: 'Can create and manage workflows, executions, and related resources',
      hierarchy: 2,
      isSystemRole: true,
    },
  });

  const viewer = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access to orchestrator resources',
      hierarchy: 1,
      isSystemRole: true,
    },
  });

  console.log(`✅ Created ${permissions.length} permissions and 6 system roles`);

  // ============================================================================
  // ASSIGN PERMISSIONS TO ROLES
  // ============================================================================

  console.log('🔗 Assigning permissions to roles...');

  // Get all permissions
  const allPermissions = await prisma.permission.findMany();

  // Super Admin - ALL permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
  }

  // System Admin - All permissions except system:admin
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

  // Project Admin - Project, workflow, user, and team management
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

  // Operator - Execute workflows, read projects, monitoring
  const operatorPerms = allPermissions.filter(
    (p) =>
      (p.resource === 'workflows' && p.action === 'execute') ||
      (p.resource === 'workflows' && p.action === 'read') ||
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

  // Developer - Create, read, update workflows and projects
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

  // Viewer - Read-only access
  const viewerPerms = allPermissions.filter((p) => p.action === 'read');
  for (const perm of viewerPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: viewer.id, permissionId: perm.id } },
      update: {},
      create: { roleId: viewer.id, permissionId: perm.id },
    });
  }

  console.log(`✅ Assigned permissions to all 6 roles`);

  // ============================================================================
  // SAMPLE ORGANIZATION AND USERS
  // ============================================================================

  console.log('🏢 Creating sample organization and users...');

  const sampleOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'Sample organization for testing the orchestrator platform',
      settings: {
        allowPublicWorkflows: true,
        defaultDomain: 'development',
        maxProjects: 10,
      },
    },
  });

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'super-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'super-admin@acme-corp.com',
      name: 'Super Administrator',
      passwordHash: superAdminPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0099',
      country: 'United States',
      address: '100 Super Admin Way',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94104',
      about: 'Super administrator with ultimate system access',
      isPublic: false,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        marketing: false,
      },
    },
  });

  const systemAdminUser = await prisma.user.upsert({
    where: { email: 'system-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'system-admin@acme-corp.com',
      name: 'System Administrator',
      passwordHash: systemAdminPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0100',
      country: 'United States',
      address: '123 Admin Street',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94105',
      about: 'System administrator with full platform access',
      isPublic: false,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        marketing: false,
      },
    },
  });

  const projectAdminUser = await prisma.user.upsert({
    where: { email: 'project-admin@acme-corp.com' },
    update: {},
    create: {
      email: 'project-admin@acme-corp.com',
      name: 'Project Administrator',
      passwordHash: projectAdminPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0101',
      country: 'United States',
      address: '456 Business Ave',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94107',
      about: 'Project administrator with team management access',
      isPublic: true,
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
        marketing: true,
      },
    },
  });

  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@acme-corp.com' },
    update: {},
    create: {
      email: 'operator@acme-corp.com',
      name: 'System Operator',
      passwordHash: operatorPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0103',
      country: 'United States',
      address: '321 Operations Center',
      state: 'California',
      city: 'San Jose',
      zipCode: '95110',
      about: 'System operator responsible for monitoring and managing executions',
      isPublic: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        marketing: false,
      },
    },
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'developer@acme-corp.com' },
    update: {},
    create: {
      email: 'developer@acme-corp.com',
      name: 'Developer User',
      passwordHash: devPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0102',
      country: 'United States',
      address: '789 Tech Blvd',
      state: 'California',
      city: 'Palo Alto',
      zipCode: '94301',
      about: 'Full-stack developer specializing in workflow automation',
      isPublic: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: false,
        marketing: false,
      },
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@acme-corp.com' },
    update: {},
    create: {
      email: 'viewer@acme-corp.com',
      name: 'Viewer User',
      passwordHash: viewerPassword,
      emailVerified: true,
      phoneNumber: '+1-555-0104',
      country: 'United States',
      address: '654 Observer Lane',
      state: 'California',
      city: 'Mountain View',
      zipCode: '94041',
      about: 'Read-only user for viewing workflows and system data',
      isPublic: true,
      notificationPreferences: {
        email: true,
        sms: false,
        push: false,
        marketing: true,
      },
    },
  });

  // Create organization memberships
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: superAdminUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: superAdminUser.id,
      role: 'OWNER',
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: systemAdminUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: systemAdminUser.id,
      role: 'ADMIN',
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: projectAdminUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: projectAdminUser.id,
      role: 'ADMIN',
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: operatorUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: operatorUser.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: devUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: devUser.id,
      role: 'MEMBER',
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: viewerUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: viewerUser.id,
      role: 'MEMBER',
    },
  });

  // Assign user roles
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdminUser.id, roleId: superAdmin.id } },
    update: {},
    create: {
      userId: superAdminUser.id,
      roleId: superAdmin.id,
      assignedBy: 'system',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: systemAdminUser.id, roleId: systemAdmin.id } },
    update: {},
    create: {
      userId: systemAdminUser.id,
      roleId: systemAdmin.id,
      assignedBy: superAdminUser.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: projectAdminUser.id, roleId: projectAdmin.id } },
    update: {},
    create: {
      userId: projectAdminUser.id,
      roleId: projectAdmin.id,
      assignedBy: systemAdminUser.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: operatorUser.id, roleId: operator.id } },
    update: {},
    create: {
      userId: operatorUser.id,
      roleId: operator.id,
      assignedBy: projectAdminUser.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: devUser.id, roleId: developer.id } },
    update: {},
    create: {
      userId: devUser.id,
      roleId: developer.id,
      assignedBy: projectAdminUser.id,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: viewerUser.id, roleId: viewer.id } },
    update: {},
    create: {
      userId: viewerUser.id,
      roleId: viewer.id,
      assignedBy: operatorUser.id,
    },
  });

  // Create sample projects with NEW single Flyte project strategy
  // Generate organization prefix for Flyte
  const orgPrefix = `org-${sampleOrg.id.substring(0, 8)}`;
  // ALL projects share ONE Flyte project named "aus"
  const sharedFlyteProjectId = 'aus';

  const sampleProject = await prisma.project.upsert({
    where: { id: 'project-sample' },
    update: {},
    create: {
      id: 'project-sample',
      organizationId: sampleOrg.id,
      name: 'Sample Project',
      description: 'A sample project for testing workflows',
      domain: 'development',
      flyteProjectId: sharedFlyteProjectId, // SHARED across all UI projects
      flyteOrgPrefix: orgPrefix,
      flyteDomains: [
        { id: 'project-sample-development', name: 'Sample Project - Development' },
        { id: 'project-sample-staging', name: 'Sample Project - Staging' },
        { id: 'project-sample-production', name: 'Sample Project - Production' },
      ],
      settings: {
        maxWorkflows: 100,
        allowPublicWorkflows: true,
      },
    },
  });

  // Additional project for testing multi-project scenarios
  const productionProject = await prisma.project.upsert({
    where: { id: 'project-production' },
    update: {},
    create: {
      id: 'project-production',
      organizationId: sampleOrg.id,
      name: 'Production Workflows',
      description: 'Production-grade workflows for enterprise operations',
      domain: 'production',
      flyteProjectId: sharedFlyteProjectId, // SHARED across all UI projects
      flyteOrgPrefix: orgPrefix,
      flyteDomains: [
        { id: 'project-production-development', name: 'Production Workflows - Development' },
        { id: 'project-production-staging', name: 'Production Workflows - Staging' },
        { id: 'project-production-production', name: 'Production Workflows - Production' },
      ],
      settings: {
        maxWorkflows: 1000,
        allowPublicWorkflows: false,
      },
    },
  });

  // Testing project for developers
  const testingProject = await prisma.project.upsert({
    where: { id: 'project-testing' },
    update: {},
    create: {
      id: 'project-testing',
      organizationId: sampleOrg.id,
      name: 'Testing & QA',
      description: 'Testing environment for workflow development',
      domain: 'staging',
      flyteProjectId: sharedFlyteProjectId, // SHARED across all UI projects
      flyteOrgPrefix: orgPrefix,
      flyteDomains: [
        { id: 'project-testing-development', name: 'Testing & QA - Development' },
        { id: 'project-testing-staging', name: 'Testing & QA - Staging' },
        { id: 'project-testing-production', name: 'Testing & QA - Production' },
      ],
      settings: {
        maxWorkflows: 50,
        allowPublicWorkflows: true,
      },
    },
  });

  console.log(`✅ Created organization, 6 users (all role types), and 3 projects`);
  console.log(`ℹ️  NEW: Using single Flyte project strategy`);
  console.log(`   Shared Flyte Project: "aus" (existing Flyte project in US)`);
  console.log(`   UI projects isolated via domains (e.g., "project-testing-development")`);

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
      description: 'Perfect for getting started with basic workflow orchestration',
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
      // metadata: {  // Field doesn't exist in Prisma schema
      //   stripeSynced: false,
      //   note: 'Run stripe-price-sync to create Stripe product/price'
      // }
    },
  });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-starter' },
    update: {},
    create: {
      id: 'plan-starter',
      name: 'Starter',
      description: 'Ideal for small teams and growing businesses',
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
        'basic_monitoring',
        'advanced_monitoring',
        'public_workflows',
        'private_workflows',
        'team_collaboration',
        'basic_analytics',
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
      // metadata: {  // Field doesn't exist in Prisma schema
      //   stripeSynced: false,
      //   note: 'Run stripe-price-sync to create Stripe product/price'
      // }
    },
  });

  const professionalPlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-professional' },
    update: {},
    create: {
      id: 'plan-professional',
      name: 'Professional',
      description: 'Advanced features for professional teams and organizations',
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
        'email_support',
        'priority_support',
        'basic_monitoring',
        'advanced_monitoring',
        'real_time_monitoring',
        'public_workflows',
        'private_workflows',
        'team_collaboration',
        'basic_analytics',
        'advanced_analytics',
        'custom_integrations',
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
      // metadata: {  // Field doesn't exist in Prisma schema
      //   stripeSynced: false,
      //   note: 'Run stripe-price-sync to create Stripe product/price'
      // }
    },
  });

  const enterprisePlan = await prisma.subscriptionPlan.upsert({
    where: { id: 'plan-enterprise' },
    update: {},
    create: {
      id: 'plan-enterprise',
      name: 'Enterprise',
      description: 'Full-featured solution for large organizations with unlimited scale',
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
        'email_support',
        'priority_support',
        'dedicated_support',
        'basic_monitoring',
        'advanced_monitoring',
        'real_time_monitoring',
        'custom_dashboards',
        'public_workflows',
        'private_workflows',
        'team_collaboration',
        'organization_management',
        'basic_analytics',
        'advanced_analytics',
        'predictive_analytics',
        'custom_integrations',
        'api_access',
        'webhook_support',
        'marketplace_publishing',
        'white_labeling',
        'sso_integration',
        'audit_logging',
        'compliance_reporting',
        'multi_cloud_orchestration',
        'disaster_recovery',
        'sla_guarantees',
      ],
      limits: {
        executions: -1, // unlimited
        cpuHours: -1,
        memoryGbHours: -1,
        storageGb: -1,
        networkGb: -1,
        users: -1,
        projects: -1,
        workflowComplexity: 'unlimited',
        supportLevel: 'dedicated',
      },
      // metadata: {  // Field doesn't exist in Prisma schema
      //   stripeSynced: false,
      //   note: 'Run stripe-price-sync to create Stripe product/price'
      // }
    },
  });

  console.log(
    `✅ Created ${
      [freePlan, starterPlan, professionalPlan, enterprisePlan].length
    } subscription plans`
  );

  // ============================================================================
  // FEATURE GATES
  // ============================================================================

  console.log('🚪 Creating feature gates...');

  const featureGates = [
    {
      feature: 'basic_workflows',
      name: 'Basic Workflows',
      description: 'Create and execute simple linear workflows',
      requiredPlans: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'advanced_workflows',
      name: 'Advanced Workflows',
      description: 'Complex workflows with conditional logic and parallel execution',
      requiredPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'enterprise_workflows',
      name: 'Enterprise Workflows',
      description: 'Mission-critical workflows with advanced error handling',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'custom_workflows',
      name: 'Custom Workflows',
      description: 'Fully customizable workflows with custom code execution',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'real_time_monitoring',
      name: 'Real-time Monitoring',
      description: 'Live monitoring and alerting for workflow executions',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Detailed analytics and performance insights',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'predictive_analytics',
      name: 'Predictive Analytics',
      description: 'AI-powered predictions and recommendations',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'marketplace_publishing',
      name: 'Marketplace Publishing',
      description: 'Publish and monetize workflows in the marketplace',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 10,
      usagePeriod: 'monthly',
    },
    {
      feature: 'multi_cloud_orchestration',
      name: 'Multi-cloud Orchestration',
      description: 'Execute workflows across multiple cloud providers',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'sso_integration',
      name: 'SSO Integration',
      description: 'Single Sign-On integration with enterprise identity providers',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'audit_logging',
      name: 'Audit Logging',
      description: 'Comprehensive audit trails for compliance',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'compliance_reporting',
      name: 'Compliance Reporting',
      description: 'Automated compliance reports and data governance',
      requiredPlans: ['ENTERPRISE'],
      usageLimit: null,
    },
    {
      feature: 'api_access',
      name: 'API Access',
      description: 'Full REST API access for integrations',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 1000,
      usagePeriod: 'daily',
    },
    {
      feature: 'webhook_support',
      name: 'Webhook Support',
      description: 'Receive real-time notifications via webhooks',
      requiredPlans: ['PROFESSIONAL', 'ENTERPRISE'],
      usageLimit: 100,
      usagePeriod: 'daily',
    },
    {
      feature: 'team_collaboration',
      name: 'Team Collaboration',
      description: 'Multi-user collaboration and role-based access',
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
  // SAMPLE MARKETPLACE WORKFLOWS
  // ============================================================================

  console.log('🛒 Creating sample marketplace workflows...');

  const sampleWorkflows = [
    {
      id: 'workflow-data-pipeline',
      name: 'Data Processing Pipeline',
      description:
        'Complete ETL pipeline for processing large datasets with validation and error handling',
      category: 'DATA_PROCESSING',
      version: '1.0.0',
      authorId: 'system',
      pricing: {
        singleUse: 9.99,
        unlimited: 49.99,
        team: 99.99,
        enterprise: 299.99,
      },
      tags: ['etl', 'data-processing', 'validation', 'error-handling'],
      status: 'APPROVED',
      featured: true,
    },
    {
      id: 'workflow-ml-training',
      name: 'ML Model Training Pipeline',
      description: 'End-to-end machine learning training pipeline with hyperparameter tuning',
      category: 'ML_TRAINING',
      version: '2.1.0',
      authorId: 'system',
      pricing: {
        singleUse: 19.99,
        unlimited: 99.99,
        team: 199.99,
        enterprise: 499.99,
      },
      tags: ['machine-learning', 'training', 'hyperparameter-tuning', 'model-validation'],
      status: 'APPROVED',
      featured: true,
    },
    {
      id: 'workflow-monitoring-alerts',
      name: 'System Monitoring & Alerting',
      description: 'Comprehensive monitoring solution with intelligent alerting and escalation',
      category: 'MONITORING',
      version: '1.5.0',
      authorId: 'system',
      pricing: {
        singleUse: 14.99,
        unlimited: 79.99,
        team: 149.99,
        enterprise: 399.99,
      },
      tags: ['monitoring', 'alerting', 'escalation', 'system-health'],
      status: 'APPROVED',
      featured: false,
    },
  ];

  for (const workflow of sampleWorkflows) {
    await prisma.marketplaceWorkflow.upsert({
      where: { id: workflow.id },
      update: {},
      create: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        category: workflow.category as any,
        version: workflow.version,
        authorId: workflow.authorId,
        pricing: workflow.pricing,
        tags: workflow.tags,
        status: workflow.status as any,
        featured: workflow.featured,
        rating: 4.5,
        reviewCount: 0,
        downloads: 0,
      },
    });

    // Create workflow specifications
    await prisma.workflowSpecification.upsert({
      where: { workflowId: workflow.id },
      update: {},
      create: {
        workflowId: workflow.id,
        spec: {
          version: '1.0',
          steps: [
            {
              id: 'step-1',
              name: 'Initialize',
              type: 'init',
              config: {},
            },
            {
              id: 'step-2',
              name: 'Process',
              type: 'process',
              config: {},
            },
            {
              id: 'step-3',
              name: 'Finalize',
              type: 'finalize',
              config: {},
            },
          ],
          triggers: ['manual', 'scheduled', 'webhook'],
          outputs: ['logs', 'metrics', 'artifacts'],
        },
        documentation: {
          overview: workflow.description,
          requirements: ['Node.js 18+', 'Docker', 'PostgreSQL'],
          setup: 'Follow the installation guide in the documentation',
          examples: [
            {
              name: 'Basic Usage',
              code: 'workflow.execute({ input: "data" })',
              description: 'Execute workflow with basic input',
            },
          ],
        },
        requirements: {
          cpu: '2 cores',
          memory: '4GB',
          storage: '10GB',
          network: 'High bandwidth recommended',
        },
      },
    });
  }

  console.log(`✅ Created ${sampleWorkflows.length} sample marketplace workflows`);

  // ============================================================================
  // SAMPLE BILLING DATA
  // ============================================================================

  console.log('💳 Creating sample billing data...');

  // Create billing accounts for the organization
  const orgBillingAccount = await prisma.billingAccount.upsert({
    where: { id: 'billing-acme-corp' },
    update: {},
    create: {
      id: 'billing-acme-corp',
      organizationId: sampleOrg.id,
      name: 'Acme Corporation Billing',
      email: 'billing@acme-corp.com',
      status: 'ACTIVE',
      paymentMethodId: 'pm_stripe_example_123',
      taxId: 'US123456789',
      billingAddress: {
        name: 'Acme Corporation',
        line1: '456 Business Ave',
        line2: 'Suite 200',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94107',
        country: 'US',
        phone: '+1-555-0101',
      },
      metadata: {
        stripeCustomerId: 'cus_stripe_example_123',
      },
    },
  });

  // Create sample subscriptions
  const adminSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-admin-professional' },
    update: {},
    create: {
      id: 'sub-admin-professional',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: professionalPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        stripeSubscriptionId: 'sub_stripe_example_123',
      },
    },
  });

  const devSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-dev-starter' },
    update: {},
    create: {
      id: 'sub-dev-starter',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        stripeSubscriptionId: 'sub_stripe_example_456',
      },
    },
  });

  // Enterprise subscription for super-admin user
  const enterpriseSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-superadmin-enterprise' },
    update: {},
    create: {
      id: 'sub-superadmin-enterprise',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: enterprisePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      metadata: {
        stripeSubscriptionId: 'sub_stripe_enterprise_123',
        userId: superAdminUser.id,
        tier: 'enterprise',
      },
    },
  });

  // Professional subscription for system-admin user
  const sysAdminSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-sysadmin-professional' },
    update: {},
    create: {
      id: 'sub-sysadmin-professional',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: professionalPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        stripeSubscriptionId: 'sub_stripe_pro_456',
        userId: systemAdminUser.id,
        tier: 'professional',
      },
    },
  });

  // Starter subscription for operator user
  const operatorSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-operator-starter' },
    update: {},
    create: {
      id: 'sub-operator-starter',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      metadata: {
        stripeSubscriptionId: 'sub_stripe_starter_789',
        userId: operatorUser.id,
        tier: 'starter',
      },
    },
  });

  // Free subscription for viewer user
  const viewerSubscription = await prisma.subscription.upsert({
    where: { id: 'sub-viewer-free' },
    update: {},
    create: {
      id: 'sub-viewer-free',
      billingAccountId: orgBillingAccount.id,
      projectId: sampleProject.id,
      planId: freePlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days (recurring)
      metadata: {
        userId: viewerUser.id,
        tier: 'free',
        note: 'Free tier - no payment required',
      },
    },
  });

  console.log(
    `✅ Created ${6} subscriptions across all tiers (Free, Starter, Professional, Enterprise)`
  );

  // Create sample execution usage data
  await prisma.executionUsage.upsert({
    where: { executionId: 'exec-sample-1' },
    update: {},
    create: {
      executionId: 'exec-sample-1',
      userId: projectAdminUser.id,
      projectId: sampleProject.id,
      workflowId: 'workflow-data-pipeline',
      status: 'SUCCEEDED',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
      duration: 1800, // 30 minutes in seconds
      resourceUsage: {
        cpuTime: 0.5,
        memoryUsage: 1.2,
        storageUsed: 0.1,
        networkTransfer: 0.05,
      },
      cost: {
        total: 0.15,
        breakdown: {
          compute: 0.1,
          storage: 0.02,
          network: 0.03,
        },
      },
    },
  });

  await prisma.executionUsage.upsert({
    where: { executionId: 'exec-sample-2' },
    update: {},
    create: {
      executionId: 'exec-sample-2',
      userId: devUser.id,
      projectId: sampleProject.id,
      workflowId: 'workflow-ml-training',
      status: 'SUCCEEDED',
      startTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      endTime: new Date(Date.now() - 0.5 * 60 * 60 * 1000), // 30 minutes ago
      duration: 1800, // 30 minutes in seconds
      resourceUsage: {
        cpuTime: 0.3,
        memoryUsage: 0.8,
        storageUsed: 0.05,
        networkTransfer: 0.02,
      },
      cost: {
        total: 0.08,
        breakdown: {
          compute: 0.06,
          storage: 0.01,
          network: 0.01,
        },
      },
    },
  });

  // Enterprise execution - high resource usage
  await prisma.executionUsage.upsert({
    where: { executionId: 'exec-enterprise-1' },
    update: {},
    create: {
      executionId: 'exec-enterprise-1',
      userId: superAdminUser.id,
      projectId: productionProject.id,
      workflowId: 'workflow-ml-training',
      status: 'SUCCEEDED',
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      endTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      duration: 7200, // 2 hours in seconds
      resourceUsage: {
        cpuTime: 8.5,
        memoryUsage: 24.0,
        storageUsed: 5.2,
        networkTransfer: 1.8,
      },
      cost: {
        total: 12.45,
        breakdown: {
          compute: 10.2,
          storage: 1.25,
          network: 1.0,
        },
      },
    },
  });

  // Operator execution - monitoring workflow
  await prisma.executionUsage.upsert({
    where: { executionId: 'exec-operator-1' },
    update: {},
    create: {
      executionId: 'exec-operator-1',
      userId: operatorUser.id,
      projectId: sampleProject.id,
      workflowId: 'workflow-monitoring-alerts',
      status: 'RUNNING',
      startTime: new Date(Date.now() - 0.5 * 60 * 60 * 1000), // 30 minutes ago
      endTime: null,
      duration: null,
      resourceUsage: {
        cpuTime: 0.2,
        memoryUsage: 0.4,
        storageUsed: 0.02,
        networkTransfer: 0.01,
      },
      cost: {
        total: 0.05,
        breakdown: {
          compute: 0.03,
          storage: 0.01,
          network: 0.01,
        },
      },
    },
  });

  // Viewer user - should have minimal usage (free tier)
  await prisma.executionUsage.upsert({
    where: { executionId: 'exec-viewer-1' },
    update: {},
    create: {
      executionId: 'exec-viewer-1',
      userId: viewerUser.id,
      projectId: testingProject.id,
      workflowId: 'workflow-data-pipeline',
      status: 'SUCCEEDED',
      startTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      endTime: new Date(Date.now() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
      duration: 1800, // 30 minutes in seconds
      resourceUsage: {
        cpuTime: 0.1,
        memoryUsage: 0.2,
        storageUsed: 0.01,
        networkTransfer: 0.005,
      },
      cost: {
        total: 0.02,
        breakdown: {
          compute: 0.01,
          storage: 0.005,
          network: 0.005,
        },
      },
    },
  });

  console.log(`✅ Created billing account and sample usage data for all user tiers`);

  // ============================================================================
  // PAYMENT INTENTS AND REFUNDS (for Payment API testing)
  // ============================================================================

  console.log('💳 Creating sample payment data...');

  // Create sample payment history entries
  await prisma.paymentHistory.upsert({
    where: { id: 'payment-admin-001' },
    update: {},
    create: {
      id: 'payment-admin-001',
      billingAccountId: orgBillingAccount.id,
      amount: 199.0,
      currency: 'USD',
      status: 'SUCCEEDED',
      paymentMethod: 'card',
      transactionId: 'pi_stripe_example_123',
      metadata: {
        stripePaymentIntentId: 'pi_stripe_example_123',
        subscriptionId: adminSubscription.id,
        description: 'Professional Plan - Monthly',
      },
      processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
  });

  await prisma.paymentHistory.upsert({
    where: { id: 'payment-dev-001' },
    update: {},
    create: {
      id: 'payment-dev-001',
      billingAccountId: orgBillingAccount.id,
      amount: 49.0,
      currency: 'USD',
      status: 'SUCCEEDED',
      paymentMethod: 'card',
      transactionId: 'pi_stripe_example_456',
      metadata: {
        stripePaymentIntentId: 'pi_stripe_example_456',
        subscriptionId: devSubscription.id,
        description: 'Starter Plan - Monthly',
      },
      processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
  });

  // Create a failed payment for testing edge cases
  await prisma.paymentHistory.upsert({
    where: { id: 'payment-failed-001' },
    update: {},
    create: {
      id: 'payment-failed-001',
      billingAccountId: orgBillingAccount.id,
      amount: 999.0,
      currency: 'USD',
      status: 'FAILED',
      paymentMethod: 'card',
      transactionId: 'pi_stripe_failed_789',
      failureReason: 'insufficient_funds',
      metadata: {
        stripePaymentIntentId: 'pi_stripe_failed_789',
        description: 'Enterprise Plan Upgrade - Failed',
      },
      processedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
  });

  // ============================================================================
  // BILLING ALERTS (for Dashboard API testing)
  // ============================================================================

  console.log('🚨 Creating billing alerts...');

  await prisma.billingAlert.upsert({
    where: { id: 'alert-usage-warning' },
    update: {},
    create: {
      id: 'alert-usage-warning',
      billingAccountId: orgBillingAccount.id,
      type: 'USAGE_LIMIT',
      severity: 'WARNING',
      message: 'You have used 80% of your monthly execution limit',
      threshold: 1000,
      currentValue: 800,
      isResolved: false,
    },
  });

  await prisma.billingAlert.upsert({
    where: { id: 'alert-cost-threshold' },
    update: {},
    create: {
      id: 'alert-cost-threshold',
      billingAccountId: orgBillingAccount.id,
      type: 'USAGE_LIMIT',
      severity: 'INFO',
      message: 'Monthly spending is approaching $150 threshold',
      threshold: 150,
      currentValue: 135.5,
      isResolved: false,
    },
  });

  // ============================================================================
  // TASKS (for Workflow Builder)
  // ============================================================================

  console.log('🔧 Creating sample tasks...');

  const sampleTasks = [
    {
      id: 'task-data-validation',
      projectId: testingProject.id,
      organizationId: sampleOrg.id,
      domain: 'development',
      name: 'data_validation',
      version: 'v1',
      description: 'Validates input data against schema',
      flyteTaskId: `${sampleOrg.id}-${testingProject.id}:development:data_validation:v1`,
      spec: {
        template: {
          interface: {
            inputs: {
              variables: {
                data: { type: { simple: 'STRING' }, description: 'JSON data to validate' },
                schema: { type: { simple: 'STRING' }, description: 'JSON schema for validation' },
              },
            },
            outputs: {
              variables: {
                is_valid: { type: { simple: 'BOOLEAN' }, description: 'Validation result' },
                errors: { type: { simple: 'STRING' }, description: 'Validation errors if any' },
              },
            },
          },
        },
      },
      createdBy: systemAdminUser.id,
    },
    {
      id: 'task-data-transform',
      projectId: testingProject.id,
      organizationId: sampleOrg.id,
      domain: 'development',
      name: 'data_transform',
      version: 'v1',
      description: 'Transforms data using specified rules',
      flyteTaskId: `${sampleOrg.id}-${testingProject.id}:development:data_transform:v1`,
      spec: {
        template: {
          interface: {
            inputs: {
              variables: {
                input_data: { type: { simple: 'STRING' }, description: 'Input data to transform' },
                transform_rules: {
                  type: { simple: 'STRING' },
                  description: 'Transformation rules',
                },
              },
            },
            outputs: {
              variables: {
                output_data: { type: { simple: 'STRING' }, description: 'Transformed data' },
              },
            },
          },
        },
      },
      createdBy: systemAdminUser.id,
    },
    {
      id: 'task-http-request',
      projectId: testingProject.id,
      organizationId: sampleOrg.id,
      domain: 'development',
      name: 'http_request',
      version: 'v1',
      description: 'Makes an HTTP request to external API',
      flyteTaskId: `${sampleOrg.id}-${testingProject.id}:development:http_request:v1`,
      spec: {
        template: {
          interface: {
            inputs: {
              variables: {
                url: { type: { simple: 'STRING' }, description: 'API endpoint URL' },
                method: { type: { simple: 'STRING' }, description: 'HTTP method (GET, POST, etc)' },
                headers: { type: { simple: 'STRING' }, description: 'Request headers (JSON)' },
                body: { type: { simple: 'STRING' }, description: 'Request body (optional)' },
              },
            },
            outputs: {
              variables: {
                status_code: { type: { simple: 'INTEGER' }, description: 'HTTP status code' },
                response_body: { type: { simple: 'STRING' }, description: 'Response body' },
              },
            },
          },
        },
      },
      createdBy: systemAdminUser.id,
    },
    {
      id: 'task-send-email',
      projectId: testingProject.id,
      organizationId: sampleOrg.id,
      domain: 'development',
      name: 'send_email',
      version: 'v1',
      description: 'Sends an email notification',
      flyteTaskId: `${sampleOrg.id}-${testingProject.id}:development:send_email:v1`,
      spec: {
        template: {
          interface: {
            inputs: {
              variables: {
                to: { type: { simple: 'STRING' }, description: 'Recipient email address' },
                subject: { type: { simple: 'STRING' }, description: 'Email subject' },
                body: { type: { simple: 'STRING' }, description: 'Email body content' },
              },
            },
            outputs: {
              variables: {
                sent: {
                  type: { simple: 'BOOLEAN' },
                  description: 'Whether email was sent successfully',
                },
                message_id: { type: { simple: 'STRING' }, description: 'Email message ID' },
              },
            },
          },
        },
      },
      createdBy: systemAdminUser.id,
    },
    {
      id: 'task-database-query',
      projectId: testingProject.id,
      organizationId: sampleOrg.id,
      domain: 'development',
      name: 'database_query',
      version: 'v1',
      description: 'Executes a database query',
      flyteTaskId: `${sampleOrg.id}-${testingProject.id}:development:database_query:v1`,
      spec: {
        template: {
          interface: {
            inputs: {
              variables: {
                query: { type: { simple: 'STRING' }, description: 'SQL query to execute' },
                parameters: { type: { simple: 'STRING' }, description: 'Query parameters (JSON)' },
              },
            },
            outputs: {
              variables: {
                results: { type: { simple: 'STRING' }, description: 'Query results (JSON)' },
                row_count: { type: { simple: 'INTEGER' }, description: 'Number of rows returned' },
              },
            },
          },
        },
      },
      createdBy: systemAdminUser.id,
    },
  ];

  for (const taskData of sampleTasks) {
    await prisma.task.upsert({
      where: { id: taskData.id },
      update: {},
      create: taskData,
    });
  }

  console.log(`✅ Created ${sampleTasks.length} sample tasks for workflow builder`);

  // ============================================================================
  // USAGE RECORDS (for Usage API testing)
  // ============================================================================

  console.log('📊 Creating usage records...');

  const currentDate = new Date();

  // Create daily usage records for the past week
  for (let i = 0; i < 7; i++) {
    const recordDate = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000);

    await prisma.usageRecord.upsert({
      where: { id: `usage-executions-${i}` },
      update: {},
      create: {
        id: `usage-executions-${i}`,
        subscriptionId: adminSubscription.id,
        projectId: sampleProject.id,
        metric: 'EXECUTIONS',
        quantity: Math.floor(Math.random() * 50) + 20, // 20-70 executions per day
        unit: 'count',
        timestamp: recordDate,
        cost: Math.random() * 10 + 5, // $5-15 per day
        currency: 'USD',
        metadata: {
          source: 'orchestrator',
          automated: true,
        },
      },
    });

    await prisma.usageRecord.upsert({
      where: { id: `usage-cpu-${i}` },
      update: {},
      create: {
        id: `usage-cpu-${i}`,
        subscriptionId: adminSubscription.id,
        projectId: sampleProject.id,
        metric: 'CPU_HOURS',
        quantity: Math.random() * 5 + 2, // 2-7 CPU hours per day
        unit: 'hours',
        timestamp: recordDate,
        cost: Math.random() * 3 + 1, // $1-4 per day
        currency: 'USD',
        metadata: {
          source: 'orchestrator',
          automated: true,
        },
      },
    });
  }

  console.log(`✅ Created sample marketplace workflows and basic data`);

  // ============================================================================
  // FEATURE USAGE TRACKING (for Feature Gate API testing)
  // ============================================================================

  console.log('🚪 Creating feature usage records...');

  await prisma.featureUsage.upsert({
    where: {
      userId_projectId_feature_resetPeriod: {
        userId: projectAdminUser.id,
        projectId: sampleProject.id,
        feature: 'advanced_analytics',
        resetPeriod: 'monthly',
      },
    },
    update: {},
    create: {
      userId: projectAdminUser.id,
      projectId: sampleProject.id,
      feature: 'advanced_analytics',
      usageCount: 45,
      resetPeriod: 'monthly',
      lastUsed: new Date(),
      lastReset: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      metadata: {
        lastFeature: 'cost_analysis',
        totalSessions: 15,
      },
    },
  });

  await prisma.featureUsage.upsert({
    where: {
      userId_projectId_feature_resetPeriod: {
        userId: devUser.id,
        projectId: sampleProject.id,
        feature: 'api_access',
        resetPeriod: 'daily',
      },
    },
    update: {},
    create: {
      userId: devUser.id,
      projectId: sampleProject.id,
      feature: 'api_access',
      usageCount: 150,
      resetPeriod: 'daily',
      lastUsed: new Date(),
      lastReset: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
      metadata: {
        endpoint: '/api/v1/orchestrator/executions',
        lastIP: '192.168.1.100',
      },
    },
  });

  console.log(`✅ Created comprehensive test data covering all API endpoints`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
