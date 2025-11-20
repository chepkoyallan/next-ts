/**
 * Admin API - Individual Role Operations
 * GET, PUT, DELETE operations for a specific role
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { SYSTEM_ROLES } from 'src/app/api/lib/auth/rbac/roles';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  hierarchy: z.number().int().min(0).max(10).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/roles/[id]
 * Get role details
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
        userRoles: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
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
        role: {
          id: role.id,
          name: role.name,
          description: role.description,
          hierarchy: role.hierarchy,
          isSystemRole: role.isSystemRole,
          permissionCount: role.rolePermissions.length,
          userCount: role.userRoles.length,
          permissions: role.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            resource: rp.permission.resource,
            action: rp.permission.action,
            description: rp.permission.description,
          })),
          users: role.userRoles.map((ur) => ({
            id: ur.user.id,
            email: ur.user.email,
            name: ur.user.name,
            assignedAt: ur.assignedAt,
            expiresAt: ur.expiresAt,
          })),
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch role',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/roles/[id]
 * Update role details
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
    const validatedData = UpdateRoleSchema.parse(body);

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
          error: 'Cannot modify system roles',
        },
        { status: 403 }
      );
    }

    // Check hierarchy constraint
    if (validatedData.hierarchy !== undefined) {
      const userMaxHierarchy = Math.max(
        ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
      );

      if (validatedData.hierarchy >= userMaxHierarchy) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot set hierarchy level equal to or higher than your own',
          },
          { status: 403 }
        );
      }
    }

    // Check if new name conflicts with existing role
    if (validatedData.name && validatedData.name !== role.name) {
      const existingRole = await prisma.role.findUnique({
        where: { name: validatedData.name },
      });

      if (existingRole) {
        return NextResponse.json(
          {
            success: false,
            error: 'A role with this name already exists',
          },
          { status: 409 }
        );
      }
    }

    // Update role
    const updatedRole = await prisma.role.update({
      where: { id },
      data: validatedData,
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        userRoles: {
          where: { isActive: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        role: {
          id: updatedRole.id,
          name: updatedRole.name,
          description: updatedRole.description,
          hierarchy: updatedRole.hierarchy,
          isSystemRole: updatedRole.isSystemRole,
          permissionCount: updatedRole.rolePermissions.length,
          userCount: updatedRole.userRoles.length,
          permissions: updatedRole.rolePermissions.map((rp) => ({
            id: rp.permission.id,
            resource: rp.permission.resource,
            action: rp.permission.action,
          })),
          createdAt: updatedRole.createdAt,
          updatedAt: updatedRole.updatedAt,
        },
      },
      message: 'Role updated successfully',
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

    console.error('Error updating role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update role',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/roles/[id]
 * Delete a custom role
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin', // Only super admin can delete roles
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id } = params;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        userRoles: {
          where: { isActive: true },
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

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete system roles',
        },
        { status: 403 }
      );
    }

    // Check if role has active users
    if (role.userRoles.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role with ${role.userRoles.length} active user(s). Please reassign users first.`,
        },
        { status: 409 }
      );
    }

    // Delete role (cascade will delete rolePermissions)
    await prisma.role.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete role',
      },
      { status: 500 }
    );
  }
}
