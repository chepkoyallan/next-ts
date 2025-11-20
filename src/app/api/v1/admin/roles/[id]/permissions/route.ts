/**
 * Admin API - Role Permissions Management
 * Get and update permissions for a role
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const UpdatePermissionsSchema = z.object({
  permissionIds: z.array(z.string()),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/roles/[id]/permissions
 * Get all permissions for a role
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id } = params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description,
          conditions: rp.permission.conditions,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch role permissions',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/roles/[id]/permissions
 * Update permissions for a role (replaces all permissions)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id } = params;
    const body = await request.json();
    const validatedData = UpdatePermissionsSchema.parse(body);

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role not found',
        },
        { status: 404 }
      );
    }

    // Prevent modifying system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot modify system role permissions',
        },
        { status: 403 }
      );
    }

    // Verify all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: validatedData.permissionIds },
      },
    });

    if (permissions.length !== validatedData.permissionIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more invalid permission IDs provided',
        },
        { status: 400 }
      );
    }

    // Use transaction to update permissions
    await prisma.$transaction([
      // Delete existing permissions
      prisma.rolePermission.deleteMany({
        where: { roleId: id },
      }),
      // Create new permissions
      prisma.rolePermission.createMany({
        data: validatedData.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      }),
    ]);

    // Fetch updated role with permissions
    const updatedRole = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        role: {
          id: updatedRole!.id,
          name: updatedRole!.name,
          permissionCount: updatedRole!.rolePermissions.length,
          permissions: updatedRole!.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            resource: rp.permission.resource,
            action: rp.permission.action,
            description: rp.permission.description,
          })),
        },
      },
      message: 'Role permissions updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error updating role permissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update role permissions',
      },
      { status: 500 }
    );
  }
}
