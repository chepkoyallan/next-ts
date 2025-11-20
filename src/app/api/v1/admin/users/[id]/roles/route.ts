/**
 * Admin API - User Roles Management
 * Manage roles for a specific user
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { SYSTEM_ROLES } from 'src/app/api/lib/auth/rbac/roles';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const AssignRolesSchema = z.object({
  roleIds: z.array(z.string()).min(1, 'At least one role ID is required'),
  expiresAt: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
});

const RemoveRoleSchema = z.object({
  roleId: z.string().min(1, 'Role ID is required'),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/users/[id]/roles
 * Get all roles assigned to a user
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
    const { id: userId } = params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          where: { isActive: true },
          include: {
            role: true,
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        roles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          description: ur.role.description,
          hierarchy: ur.role.hierarchy,
          isSystemRole: ur.role.isSystemRole,
          assignedAt: ur.assignedAt,
          assignedBy: ur.assignedBy,
          expiresAt: ur.expiresAt,
        })),
        totalRoles: user.userRoles.length,
      },
    });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user roles',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/users/[id]/roles
 * Assign multiple roles to a user
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id: userId } = params;
    const body = await request.json();
    const validatedData = AssignRolesSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Verify all roles exist
    const roles = await prisma.role.findMany({
      where: {
        id: { in: validatedData.roleIds },
      },
    });

    if (roles.length !== validatedData.roleIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more invalid role IDs provided',
        },
        { status: 400 }
      );
    }

    // Check hierarchy constraint - cannot assign roles equal to or higher than admin's
    const userMaxHierarchy = Math.max(
      ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
    );

    const invalidRoles = roles.filter((role) => role.hierarchy >= userMaxHierarchy);

    if (invalidRoles.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot assign roles with hierarchy level equal to or higher than your own: ${invalidRoles
            .map((r) => r.name)
            .join(', ')}`,
        },
        { status: 403 }
      );
    }

    // Assign roles to user (upsert to handle existing assignments)
    const assignments = await Promise.all(
      validatedData.roleIds.map((roleId) =>
        prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId,
              roleId,
            },
          },
          update: {
            isActive: true,
            expiresAt: validatedData.expiresAt,
            assignedBy: adminContext.userId,
            assignedAt: new Date(),
          },
          create: {
            userId,
            roleId,
            assignedBy: adminContext.userId,
            expiresAt: validatedData.expiresAt,
            isActive: true,
          },
          include: {
            role: true,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        assigned: assignments.length,
        roles: assignments.map((a) => ({
          id: a.role.id,
          name: a.role.name,
          hierarchy: a.role.hierarchy,
          assignedAt: a.assignedAt,
          expiresAt: a.expiresAt,
        })),
      },
      message: `${assignments.length} role(s) assigned to user successfully`,
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

    console.error('Error assigning role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign role',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/users/[id]/roles
 * Remove a role from a user
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id: userId } = params;
    const body = await request.json();
    const validatedData = RemoveRoleSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: validatedData.roleId },
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

    // Check if user has this role
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: validatedData.roleId,
        },
      },
    });

    if (!userRole || !userRole.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'User does not have this role',
        },
        { status: 404 }
      );
    }

    // Soft delete: mark as inactive
    await prisma.userRole.update({
      where: {
        userId_roleId: {
          userId,
          roleId: validatedData.roleId,
        },
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Role removed from user successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        role: {
          id: role.id,
          name: role.name,
        },
      },
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

    console.error('Error removing role from user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove role from user',
      },
      { status: 500 }
    );
  }
}
