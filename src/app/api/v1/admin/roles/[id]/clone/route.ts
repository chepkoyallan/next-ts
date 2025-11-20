/**
 * Admin API - Clone Role
 * Create a copy of an existing role with a new name
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { SYSTEM_ROLES } from 'src/app/api/lib/auth/rbac/roles';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const CloneRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  includePermissions: z.boolean().default(true),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/roles/[id]/clone
 * Clone an existing role
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
    const validatedData = CloneRoleSchema.parse(body);

    // Get source role
    const sourceRole = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: true,
      },
    });

    if (!sourceRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Source role not found',
        },
        { status: 404 }
      );
    }

    // Check if new name already exists
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

    // Check hierarchy constraint
    const userMaxHierarchy = Math.max(
      ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
    );

    if (sourceRole.hierarchy >= userMaxHierarchy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot clone role with hierarchy level equal to or higher than your own',
        },
        { status: 403 }
      );
    }

    // Create new role
    const newRole = await prisma.role.create({
      data: {
        name: validatedData.name,
        description: validatedData.description || `Clone of ${sourceRole.name}`,
        hierarchy: sourceRole.hierarchy,
        isSystemRole: false, // Clones are never system roles
      },
    });

    // Copy permissions if requested
    if (validatedData.includePermissions && sourceRole.rolePermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: sourceRole.rolePermissions.map((rp) => ({
          roleId: newRole.id,
          permissionId: rp.permissionId,
        })),
      });
    }

    // Fetch complete role
    const completeRole = await prisma.role.findUnique({
      where: { id: newRole.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          role: {
            id: completeRole!.id,
            name: completeRole!.name,
            description: completeRole!.description,
            hierarchy: completeRole!.hierarchy,
            isSystemRole: completeRole!.isSystemRole,
            permissionCount: completeRole!.rolePermissions.length,
            permissions: completeRole!.rolePermissions.map((rp) => ({
              id: rp.permission.id,
              resource: rp.permission.resource,
              action: rp.permission.action,
            })),
            createdAt: completeRole!.createdAt,
          },
        },
        message: 'Role cloned successfully',
      },
      { status: 201 }
    );
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

    console.error('Error cloning role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clone role',
      },
      { status: 500 }
    );
  }
}
