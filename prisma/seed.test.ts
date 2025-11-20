/**
 * Test Seed Script
 * Creates test users for E2E testing with exact credentials from role-helpers.ts
 *
 * Run with: npx tsx prisma/seed.test.ts
 * Or: NODE_ENV=test npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Test user credentials from tests/utils/role-helpers.ts
const TEST_USERS = {
  VIEWER: {
    email: 'viewer@icodeai.com',
    password: 'Viewer123!',
    role: 'viewer',
    name: 'Test Viewer',
  },
  DEVELOPER: {
    email: 'developer@icodeai.com',
    password: 'Developer123!',
    role: 'developer',
    name: 'Test Developer',
  },
  OPERATOR: {
    email: 'operator@icodeai.com',
    password: 'Operator123!',
    role: 'operator',
    name: 'Test Operator',
  },
  PROJECT_ADMIN: {
    email: 'projectadmin@icodeai.com',
    password: 'ProjectAdmin123!',
    role: 'project-admin',
    name: 'Test Project Admin',
  },
  SYSTEM_ADMIN: {
    email: 'sysadmin@icodeai.com',
    password: 'SysAdmin123!',
    role: 'system-admin',
    name: 'Test System Admin',
  },
  SUPER_ADMIN: {
    email: 'superadmin@icodeai.com',
    password: 'SuperAdmin123!',
    role: 'super-admin',
    name: 'Test Super Admin',
  },
};

async function main() {
  console.log('🌱 Starting TEST database seeding...');
  console.log('👥 Creating 6 test users for E2E testing\n');

  // First, ensure roles exist (run seed-roles-permissions if needed)
  const roleCount = await prisma.role.count();
  if (roleCount === 0) {
    console.log('⚠️  No roles found. Please run: npx tsx prisma/seed-roles-permissions.ts');
    console.log('   Or: yarn db:seed (if configured)\n');
    throw new Error('Roles must be seeded first');
  }

  console.log(`✅ Found ${roleCount} system roles\n`);

  // Create or find test organization
  const testOrg = await prisma.organization.upsert({
    where: { slug: 'test-org' },
    update: {},
    create: {
      name: 'Test Organization',
      slug: 'test-org',
      description: 'Organization for E2E testing',
      industry: 'Technology',
      size: 'ENTERPRISE',
      status: 'ACTIVE',
      settings: {
        allowPublicWorkflows: true,
        defaultDomain: 'development',
        maxProjects: 100,
        ssoEnabled: false,
        auditLogsEnabled: true,
      },
    },
  });

  console.log(`✅ Test organization: ${testOrg.name} (${testOrg.slug})\n`);

  // Create test users
  console.log('👥 Creating test users...\n');

  for (const [roleKey, userData] of Object.entries(TEST_USERS)) {
    try {
      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Find role
      const role = await prisma.role.findUnique({
        where: { name: userData.role },
      });

      if (!role) {
        console.error(`   ❌ Role '${userData.role}' not found. Skipping ${userData.email}`);
        continue;
      }

      // Create or update user
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          passwordHash,
          emailVerified: true,
          name: userData.name,
        },
        create: {
          email: userData.email,
          name: userData.name,
          passwordHash,
          emailVerified: true,
          phoneNumber: `+1-555-TEST-${roleKey.substring(0, 4)}`,
          country: 'United States',
          city: 'San Francisco',
          state: 'CA',
          about: `${userData.name} for E2E testing`,
          isPublic: true,
          twoFactorEnabled: false, // Disable 2FA for test users
          notificationPreferences: {
            email: true,
            sms: false,
            push: false,
            marketing: false,
          },
        },
      });

      // Assign role to user
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
          assignedBy: 'system',
        },
      });

      // Add user to test organization
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: testOrg.id,
            userId: user.id,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          organizationId: testOrg.id,
          userId: user.id,
          role:
            roleKey === 'SUPER_ADMIN' || roleKey === 'SYSTEM_ADMIN' || roleKey === 'PROJECT_ADMIN'
              ? 'ADMIN'
              : roleKey === 'VIEWER'
                ? 'VIEWER'
                : 'MEMBER',
          invitedBy: user.id, // Self-invite for test users
          isActive: true,
        },
      });

      console.log(`   ✅ ${userData.name.padEnd(25)} ${userData.email.padEnd(30)} [${role.name}]`);
    } catch (error) {
      console.error(`   ❌ Failed to create ${userData.email}:`, error);
    }
  }

  // Create test project for all users
  console.log('\n🗂️  Creating test project...');

  const testProject = await prisma.project.upsert({
    where: { id: 'test-project-001' },
    update: {},
    create: {
      id: 'test-project-001',
      organizationId: testOrg.id,
      name: 'Test Project',
      description: 'Project for E2E testing',
      domain: 'development',
      flyteProjectId: 'test',
      flyteOrgPrefix: `org-${testOrg.id.substring(0, 8)}`,
      flyteDomains: [
        { id: 'test-development', name: 'Test - Development' },
        { id: 'test-staging', name: 'Test - Staging' },
        { id: 'test-production', name: 'Test - Production' },
      ],
      createdBy:
        (await prisma.user.findUnique({ where: { email: 'superadmin@icodeai.com' } }))?.id ||
        'system',
      settings: {
        maxWorkflows: 1000,
        allowPublicWorkflows: true,
      },
    },
  });

  console.log(`   ✅ ${testProject.name} (${testProject.id})`);

  // Create test billing account
  console.log('\n💳 Creating test billing account...');

  const testBilling = await prisma.billingAccount.upsert({
    where: { id: 'billing-test-001' },
    update: {},
    create: {
      id: 'billing-test-001',
      organizationId: testOrg.id,
      name: 'Test Billing Account',
      email: 'billing@test.icodeai.com',
      status: 'ACTIVE',
      paymentMethodId: 'pm_test_card_001',
      currency: 'USD',
      stripeCustomerId: 'cus_test_001',
      billingAddress: {
        name: 'Test Organization',
        line1: '123 Test Street',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94102',
        country: 'US',
        phone: '+1-555-TEST-ORG',
      },
      metadata: {
        accountType: 'test',
        testEnvironment: true,
      },
    },
  });

  console.log(`   ✅ ${testBilling.name}`);

  // Create test subscriptions for each major plan tier
  console.log('\n📝 Creating test subscriptions...');

  // Get plans
  const freePlan = await prisma.subscriptionPlan.findFirst({ where: { tier: 'FREE' } });
  const starterPlan = await prisma.subscriptionPlan.findFirst({ where: { tier: 'STARTER' } });
  const professionalPlan = await prisma.subscriptionPlan.findFirst({
    where: { tier: 'PROFESSIONAL' },
  });
  const enterprisePlan = await prisma.subscriptionPlan.findFirst({ where: { tier: 'ENTERPRISE' } });

  if (!freePlan || !starterPlan || !professionalPlan || !enterprisePlan) {
    console.log('   ⚠️  Subscription plans not found. Skipping subscription creation.');
    console.log('   Run the main seed script first to create plans.');
  } else {
    // Enterprise subscription for test project
    await prisma.subscription.upsert({
      where: { id: 'sub-test-enterprise-001' },
      update: {},
      create: {
        id: 'sub-test-enterprise-001',
        billingAccountId: testBilling.id,
        projectId: testProject.id,
        planId: enterprisePlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        stripeSubscriptionId: 'sub_test_ent_001',
        metadata: {
          tier: 'enterprise',
          testEnvironment: true,
        },
      },
    });

    console.log('   ✅ Enterprise subscription created');
  }

  console.log('\n====================================');
  console.log('  ✨ Test Seeding Complete!');
  console.log('====================================\n');

  console.log('📊 Summary:');
  console.log('   • Test Organization: test-org');
  console.log('   • Test Users: 6 (all roles)');
  console.log('   • Test Project: test-project-001');
  console.log('   • Test Billing: Active');
  console.log('   • Test Subscription: Enterprise\n');

  console.log('🔐 Test User Credentials:\n');

  Object.values(TEST_USERS).forEach((user) => {
    console.log(`   ${user.role.padEnd(15)} ${user.email.padEnd(35)} ${user.password}`);
  });

  console.log('\n🚀 Ready for E2E Testing!');
  console.log('\n💡 Quick Start:');
  console.log('   1. Update .env.test with these credentials (or use defaults)');
  console.log('   2. Run: ./scripts/test-smoke.sh');
  console.log('   3. Run: ./scripts/test-all-roles.sh\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error during test seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
