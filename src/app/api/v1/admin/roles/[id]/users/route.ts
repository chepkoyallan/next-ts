/**
 * Admin API - Role Users Management
 * Manage users assigned to a role
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const AssignUsersSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
  expiresAt: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/roles/[id]/users
 * Get all users with this role
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
        userRoles: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
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
        users: role.userRoles.map((ur) => ({
          id: ur.user.id,
          email: ur.user.email,
          name: ur.user.name,
          assignedAt: ur.assignedAt,
          assignedBy: ur.assignedBy,
          expiresAt: ur.expiresAt,
          createdAt: ur.user.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching role users:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch role users',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/roles/[id]/users
 * Assign role to multiple users
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
    const { id } = params;
    const body = await request.json();
    const validatedData = AssignUsersSchema.parse(body);

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

    // Verify all users exist
    const users = await prisma.user.findMany({
      where: {
        id: { in: validatedData.userIds },
      },
    });

    if (users.length !== validatedData.userIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more invalid user IDs provided',
        },
        { status: 400 }
      );
    }

    // Assign role to users (upsert to handle existing assignments)
    const assignments = await Promise.all(
      validatedData.userIds.map((userId) =>
        prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId,
              roleId: id,
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
            roleId: id,
            assignedBy: adminContext.userId,
            expiresAt: validatedData.expiresAt,
            isActive: true,
          },
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        assigned: assignments.length,
        users: assignments.map((a) => ({
          id: a.userId,
          email: a.user.email,
          name: a.user.name,
          assignedAt: a.assignedAt,
        })),
      },
      message: `Role assigned to ${assignments.length} user(s) successfully`,
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

    console.error('Error assigning role to users:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign role to users',
      },
      { status: 500 }
    );
  }
}
