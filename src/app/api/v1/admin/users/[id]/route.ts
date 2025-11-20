/**
 * Admin API - Single User Management
 * Get, update, and manage individual users
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

// Validation schemas
const UserUpdateSchema = z.object({
  name: z.string().optional(),
  emailVerified: z.boolean().optional(),
});

/**
 * GET /api/v1/admin/users/:id
 * Get detailed information about a single user
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const userId = params.id;

    // ⚡ Performance: Get user with detailed information and caching
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                name: true,
                hierarchy: true,
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
      cacheStrategy: { ttl: 30, swr: 10 },
    } as any);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Get activity statistics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ⚡ Performance: Parallel activity and login history queries with caching
    const [recentActivity, loginHistory] = await Promise.all([
      prisma.auditLog.count({
        where: {
          userId,
          timestamp: { gte: thirtyDaysAgo },
        },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.auditLog.findMany({
        where: {
          userId,
          action: 'user_login',
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: {
          timestamp: true,
          metadata: true,
        },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
    ]);

    // ⚡ Performance: Get projects and workflows with caching and parallel execution
    const [projects, workflows, projectCount, workflowCount] = await Promise.all([
      prisma.project.findMany({
        where: { createdBy: userId, deletedAt: null },
        select: {
          id: true,
          name: true,
          flyteProjectId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.workflow.findMany({
        where: { createdBy: userId, isDeleted: false },
        select: {
          id: true,
          name: true,
          domain: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.project.count({
        where: { createdBy: userId, deletedAt: null },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.workflow.count({
        where: { createdBy: userId, isDeleted: false },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
    ]);

    // Format response (exclude password and sensitive data)
    const formattedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizations: (user as any).organizationMembers.map((om: any) => om.organization),
      roles: (user as any).userRoles.map((ur: any) => ({
        name: ur.role.name,
        hierarchy: ur.role.hierarchy,
        permissions: ur.role.rolePermissions.map((rp: any) => rp.permission.name),
      })),
      projects,
      workflows,
      counts: {
        projects: projectCount,
        workflows: workflowCount,
      },
      activity: {
        recentActions: recentActivity,
        loginHistory,
      },
    };

    return NextResponse.json({
      success: true,
      data: { user: formattedUser },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/users/:id
 * Update user details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const userId = params.id;

    // Validate request body
    const body = await request.json();
    const validatedData = UserUpdateSchema.parse(body);

    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Update user
    const updated = await prisma.user.update({
      where: { id: userId },
      data: validatedData,
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'user_updated',
      resource: 'users',
      resourceId: userId,
      projectId: 'admin',
      details: {
        changes: validatedData,
        targetEmail: existing.email,
        adminEmail: adminContext.email,
      },
    });

    // Exclude sensitive data (destructure to remove from response)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, twoFactorSecret, ...safeUser } = updated;

    return NextResponse.json({
      success: true,
      data: { user: safeUser },
      message: 'User updated successfully',
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

    console.error('Error updating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/users/:id
 * Delete (soft delete) a user
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin', // Only super admins can delete users
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const userId = params.id;

    // Check if user exists and get counts
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });

    const projectCount = await prisma.project.count({ where: { createdBy: userId } });
    const workflowCount = await prisma.workflow.count({ where: { createdBy: userId } });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // Prevent deleting yourself
    if (userId === adminContext.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete your own account',
        },
        { status: 400 }
      );
    }

    // Soft delete by marking as deleted
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'user_deleted',
      resource: 'users',
      resourceId: userId,
      projectId: 'admin',
      details: {
        userEmail: existing.email,
        projectCount,
        workflowCount,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      },
      { status: 500 }
    );
  }
}
