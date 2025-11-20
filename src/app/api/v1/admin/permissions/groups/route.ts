/**
 * Admin API - Permission Groups
 * Get permissions grouped by resource
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/permissions/groups
 * Get permissions grouped by resource
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Get all permissions
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      include: {
        rolePermissions: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Group permissions by resource
    const groupedPermissions = permissions.reduce(
      (acc, permission) => {
        const { resource } = permission;

        if (!acc[resource]) {
          acc[resource] = {
            resource,
            permissions: [],
            totalPermissions: 0,
          };
        }

        acc[resource].permissions.push({
          id: permission.id,
          action: permission.action,
          description: permission.description,
          conditions: permission.conditions,
          roleCount: permission.rolePermissions.length,
          roles: permission.rolePermissions.map((rp) => ({
            id: rp.role.id,
            name: rp.role.name,
          })),
        });

        acc[resource].totalPermissions += 1;

        return acc;
      },
      {} as Record<string, any>
    );

    // Convert to array and sort by resource name
    const groups = Object.values(groupedPermissions).sort((a: any, b: any) =>
      a.resource.localeCompare(b.resource)
    );

    return NextResponse.json({
      success: true,
      data: {
        groups,
        totalGroups: groups.length,
        totalPermissions: permissions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching permission groups:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch permission groups',
      },
      { status: 500 }
    );
  }
}
