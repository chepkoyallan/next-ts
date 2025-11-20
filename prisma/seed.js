const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

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

  // System roles
  const systemAdmin = await prisma.role.upsert({
    where: { name: 'system-admin' },
    update: {},
    create: {
      name: 'system-admin',
      description: 'Full system administrator with all permissions',
      hierarchy: 1000,
      isSystemRole: true,
    },
  });

  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Organization administrator',
      hierarchy: 800,
      isSystemRole: true,
    },
  });

  const manager = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: {
      name: 'manager',
      description: 'Project manager with workflow and team management access',
      hierarchy: 600,
      isSystemRole: true,
    },
  });

  const developer = await prisma.role.upsert({
    where: { name: 'developer' },
    update: {},
    create: {
      name: 'developer',
      description: 'Developer with workflow creation and execution access',
      hierarchy: 400,
      isSystemRole: true,
    },
  });

  const viewer = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access to workflows and data',
      hierarchy: 200,
      isSystemRole: true,
    },
  });

  console.log(`✅ Created ${permissions.length} permissions and 5 system roles`);

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

  // Hash password for demo users (in production, use proper bcrypt)
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Check if profile fields exist in database schema
  let hasProfileFields = false;
  try {
    // Try to query with a profile field to test if schema is updated
    await prisma.user.findFirst({
      select: { id: true, phoneNumber: true },
    });
    hasProfileFields = true;
    console.log('✅ Profile fields detected in database schema');
  } catch (error) {
    console.log('⚠️  Profile fields not yet available - using basic schema');
  }

  const adminUserData = {
    email: 'admin@acme-corp.com',
    name: 'Admin User',
    passwordHash: hashedPassword,
    emailVerified: true,
  };

  const devUserData = {
    email: 'developer@acme-corp.com',
    name: 'Developer User',
    passwordHash: hashedPassword,
    emailVerified: true,
  };

  // Add profile fields if schema supports them
  if (hasProfileFields) {
    console.log('📝 Adding complete profile data...');
    Object.assign(adminUserData, {
      phoneNumber: '+1-555-0123',
      country: 'United States',
      address: '123 Admin Street',
      state: 'California',
      city: 'San Francisco',
      zipCode: '94105',
      about:
        'System administrator with 10+ years of experience in platform management and user operations.',
      isPublic: true,
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      socialLinks: JSON.stringify({
        linkedin: 'https://linkedin.com/in/admin-user',
        twitter: 'https://twitter.com/admin_user',
        facebook: '',
        instagram: '',
      }),
      notificationPreferences: JSON.stringify({
        selected: ['activity_comments', 'application_product', 'application_news'],
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        marketingEmails: true,
        activity_comments: true,
        activity_answers: true,
        activityFollows: true,
        application_news: true,
        application_product: true,
        application_blog: false,
      }),
      twoFactorEnabled: false,
    });

    Object.assign(devUserData, {
      phoneNumber: '+1-555-0456',
      country: 'Canada',
      address: '456 Developer Avenue',
      state: 'Ontario',
      city: 'Toronto',
      zipCode: 'M5V 3A8',
      about:
        'Full-stack developer passionate about building scalable applications and workflow automation.',
      isPublic: false,
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer',
      socialLinks: JSON.stringify({
        linkedin: 'https://linkedin.com/in/dev-user',
        twitter: '',
        facebook: '',
        instagram: 'https://instagram.com/dev_user',
      }),
      notificationPreferences: JSON.stringify({
        selected: ['activity_comments', 'application_product'],
        emailNotifications: true,
        pushNotifications: false,
        smsNotifications: false,
        marketingEmails: false,
        activity_comments: true,
        activity_answers: false,
        activityFollows: false,
        application_news: false,
        application_product: true,
        application_blog: true,
      }),
      twoFactorEnabled: false,
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acme-corp.com' },
    update: {},
    create: adminUserData,
  });

  const devUser = await prisma.user.upsert({
    where: { email: 'developer@acme-corp.com' },
    update: {},
    create: devUserData,
  });

  // Create organization memberships
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: sampleOrg.id, userId: adminUser.id } },
    update: {},
    create: {
      organizationId: sampleOrg.id,
      userId: adminUser.id,
      role: 'ADMIN',
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

  // Assign user roles
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: admin.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: admin.id,
      assignedBy: 'system',
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: devUser.id, roleId: developer.id } },
    update: {},
    create: {
      userId: devUser.id,
      roleId: developer.id,
      assignedBy: adminUser.id,
    },
  });

  // Create sample project
  const sampleProject = await prisma.project.upsert({
    where: { id: 'project-sample' },
    update: {},
    create: {
      id: 'project-sample',
      organizationId: sampleOrg.id,
      name: 'Sample Project',
      description: 'A sample project for testing workflows',
      domain: 'development',
      settings: {
        maxWorkflows: 100,
        allowPublicWorkflows: true,
      },
    },
  });

  console.log(`✅ Created organization, 2 users, and 1 project`);
  console.log(`📧 Demo login: admin@acme-corp.com / password123`);
  console.log(`📧 Demo login: developer@acme-corp.com / password123`);

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
