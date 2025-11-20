/**
 * Admin API - Remove User from Role
 * Revoke a role from a specific user
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/v1/admin/roles/[id]/users/[userId]
 * Revoke role from a specific user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const { id: roleId, userId } = params;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
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

    // Check if user has this role
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!userRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'User does not have this role',
        },
        { status: 404 }
      );
    }

    // Soft delete: mark as inactive instead of deleting
    await prisma.userRole.update({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Role revoked from user successfully',
      data: {
        userId,
        roleId,
        roleName: role.name,
        userEmail: user.email,
      },
    });
  } catch (error) {
    console.error('Error revoking role from user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke role from user',
      },
      { status: 500 }
    );
  }
}
