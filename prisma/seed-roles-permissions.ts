/**
 * Seed Script for Roles and Permissions
 * This script populates the database with system roles and permissions
 */

import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../src/app/api/lib/auth/rbac/permissions';
import { SYSTEM_ROLES } from '../src/app/api/lib/auth/rbac/roles';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting role and permission seeding...');

  // 1. Seed all permissions
  console.log('\n📝 Seeding permissions...');
  const permissionMap = new Map<string, string>();

  for (const [permId, permData] of Object.entries(PERMISSIONS)) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permData.resource,
          action: permData.action,
        },
      },
      update: {
        description: permData.description,
        conditions: permData.conditions ? (permData.conditions as any) : null,
      },
      create: {
        resource: permData.resource,
        action: permData.action,
        description: permData.description,
        conditions: permData.conditions ? (permData.conditions as any) : null,
      },
    });

    permissionMap.set(permId, permission.id);
    console.log(`  ✓ ${permId} → ${permission.id}`);
  }

  console.log(`\n✅ Seeded ${permissionMap.size} permissions`);

  // 2. Seed all system roles
  console.log('\n🎭 Seeding system roles...');
  const roleMap = new Map<string, string>();

  for (const [roleId, roleData] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: {
        description: roleData.description,
        hierarchy: roleData.hierarchy,
        isSystemRole: roleData.isSystemRole,
      },
      create: {
        name: roleData.name,
        description: roleData.description,
        hierarchy: roleData.hierarchy,
        isSystemRole: roleData.isSystemRole,
      },
    });

    roleMap.set(roleId, role.id);
    console.log(`  ✓ ${roleData.name} (Level ${roleData.hierarchy}) → ${role.id}`);
  }

  console.log(`\n✅ Seeded ${roleMap.size} system roles`);

  // 3. Create role-permission mappings
  console.log('\n🔗 Creating role-permission mappings...');
  let mappingCount = 0;

  for (const [roleId, roleData] of Object.entries(SYSTEM_ROLES)) {
    const dbRoleId = roleMap.get(roleId);
    if (!dbRoleId) continue;

    // Get all permission IDs for this role
    const permissionIds = roleData.permissions
      .map((permId) => permissionMap.get(permId))
      .filter((id): id is string => id !== undefined);

    // Create mappings
    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRoleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: dbRoleId,
          permissionId,
        },
      });
      mappingCount++;
    }

    console.log(`  ✓ ${roleData.name}: ${permissionIds.length} permissions`);
  }

  console.log(`\n✅ Created ${mappingCount} role-permission mappings`);

  // 4. Summary
  console.log('\n📊 Summary:');
  console.log(`  • Permissions: ${permissionMap.size}`);
  console.log(`  • Roles: ${roleMap.size}`);
  console.log(`  • Mappings: ${mappingCount}`);
  console.log('\n✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
