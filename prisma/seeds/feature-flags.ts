import { PrismaClient } from '@prisma/client';

import { DEFAULT_FEATURE_FLAGS } from '../../src/config/feature-flags';

/**
 * Seed feature flags into the database
 */
export async function seedFeatureFlags(prisma: PrismaClient) {
  console.log('🚩 Seeding feature flags...');

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const flagConfig of DEFAULT_FEATURE_FLAGS) {
    try {
      const existingFlag = await prisma.featureFlag.findUnique({
        where: { key: flagConfig.key },
      });

      if (existingFlag) {
        // Update existing flag (preserving enabled status)
        await prisma.featureFlag.update({
          where: { key: flagConfig.key },
          data: {
            name: flagConfig.name,
            description: flagConfig.description,
            type: flagConfig.type,
            // Don't override enabled status if it's already set
            rolloutPercentage: flagConfig.rolloutPercentage,
            category: flagConfig.category,
            tags: flagConfig.tags || [],
            dependsOn: flagConfig.dependsOn || [],
            updatedAt: new Date(),
          },
        });
        updatedCount++;
        console.log(`  ✓ Updated: ${flagConfig.key}`);
      } else {
        // Create new flag
        await prisma.featureFlag.create({
          data: {
            key: flagConfig.key,
            name: flagConfig.name,
            description: flagConfig.description,
            type: flagConfig.type,
            enabled: flagConfig.enabled,
            rolloutPercentage: flagConfig.rolloutPercentage,
            category: flagConfig.category,
            tags: flagConfig.tags || [],
            dependsOn: flagConfig.dependsOn || [],
          },
        });
        createdCount++;
        console.log(`  + Created: ${flagConfig.key}`);
      }
    } catch (error) {
      console.error(`  ✗ Failed to seed flag ${flagConfig.key}:`, error);
      skippedCount++;
    }
  }

  console.log(`✅ Feature flags seeded:`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${DEFAULT_FEATURE_FLAGS.length}`);
}

/**
 * Seed common feature flag overrides for testing/development
 */
export async function seedFeatureFlagOverrides(
  prisma: PrismaClient,
  options?: {
    adminUserId?: string;
    testOrganizationId?: string;
  }
) {
  if (!options?.adminUserId && !options?.testOrganizationId) {
    console.log('⏭️  Skipping feature flag overrides (no test data provided)');
    return;
  }

  console.log('🔧 Seeding feature flag overrides...');

  const overrides = [];

  // Create some test overrides if we have a test user
  if (options.adminUserId) {
    // Give admin user early access to beta features
    const betaFlags = await prisma.featureFlag.findMany({
      where: {
        OR: [{ tags: { array_contains: 'beta' } }, { tags: { array_contains: 'experiment' } }],
      },
    });

    for (const flag of betaFlags) {
      try {
        const override = await prisma.featureFlagOverride.upsert({
          where: {
            flagId_scope_userId_organizationId_roleId: {
              flagId: flag.id,
              scope: 'USER',
              userId: options.adminUserId,
              organizationId: '',
              roleId: '',
            },
          },
          update: {
            enabled: true,
          },
          create: {
            flagId: flag.id,
            scope: 'USER',
            userId: options.adminUserId,
            enabled: true,
            createdBy: options.adminUserId,
          },
        });
        overrides.push(override);
        console.log(`  ✓ Created user override for ${flag.key}`);
      } catch (error) {
        console.error(`  ✗ Failed to create override for ${flag.key}:`, error);
      }
    }
  }

  // Create organization-level overrides if we have a test org
  if (options.testOrganizationId) {
    // Enable all features for test organization
    const allFlags = await prisma.featureFlag.findMany({
      where: {
        enabled: false,
      },
      take: 5, // Just a few for testing
    });

    for (const flag of allFlags) {
      try {
        const override = await prisma.featureFlagOverride.upsert({
          where: {
            flagId_scope_userId_organizationId_roleId: {
              flagId: flag.id,
              scope: 'ORGANIZATION',
              userId: '',
              organizationId: options.testOrganizationId,
              roleId: '',
            },
          },
          update: {
            enabled: true,
          },
          create: {
            flagId: flag.id,
            scope: 'ORGANIZATION',
            organizationId: options.testOrganizationId,
            enabled: true,
            createdBy: options.adminUserId,
          },
        });
        overrides.push(override);
        console.log(`  ✓ Created org override for ${flag.key}`);
      } catch (error) {
        console.error(`  ✗ Failed to create org override for ${flag.key}:`, error);
      }
    }
  }

  console.log(`✅ Feature flag overrides seeded: ${overrides.length}`);
}

/**
 * Main function to seed all feature flag data
 */
export async function seedFeatureFlagSystem(
  prisma: PrismaClient,
  options?: {
    adminUserId?: string;
    testOrganizationId?: string;
    skipOverrides?: boolean;
  }
) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚩 Feature Flags Seeding');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await seedFeatureFlags(prisma);

  if (!options?.skipOverrides) {
    await seedFeatureFlagOverrides(prisma, options);
  }

  console.log('\n✅ Feature flag system seeded successfully\n');
}
