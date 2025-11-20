/**
 * Admin API - Roles Management
 * CRUD operations for roles
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { SYSTEM_ROLES } from 'src/app/api/lib/auth/rbac/roles';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const RoleQuerySchema = z.object({
  search: z.string().optional(),
  isSystemRole: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  minHierarchy: z.string().transform(Number).optional(),
  maxHierarchy: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required'),
  hierarchy: z.number().int().min(0).max(10),
  permissions: z.array(z.string()).default([]),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/roles
 * List all roles with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = RoleQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.search) {
      where.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { description: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    if (validatedQuery.isSystemRole !== undefined) {
      where.isSystemRole = validatedQuery.isSystemRole;
    }

    if (validatedQuery.minHierarchy !== undefined || validatedQuery.maxHierarchy !== undefined) {
      where.hierarchy = {};
      if (validatedQuery.minHierarchy !== undefined) {
        where.hierarchy.gte = validatedQuery.minHierarchy;
      }
      if (validatedQuery.maxHierarchy !== undefined) {
        where.hierarchy.lte = validatedQuery.maxHierarchy;
      }
    }

    // Get total count and roles
    const [total, roles] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        take: validatedQuery.limit || 50,
        skip: validatedQuery.offset || 0,
        orderBy: { hierarchy: 'desc' },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          userRoles: {
            where: { isActive: true },
            select: { userId: true },
          },
        },
      }),
    ]);

    // Format response
    const formattedRoles = roles.map((role) => ({
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
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        roles: formattedRoles,
        pagination: {
          total,
          limit: validatedQuery.limit || 50,
          offset: validatedQuery.offset || 0,
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

    console.error('Error listing roles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list roles',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/roles
 * Create a new custom role
 */
export async function POST(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const body = await request.json();
    const validatedData = CreateRoleSchema.parse(body);

    // Check if name already exists
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

    // Check hierarchy constraint (can't create role higher than own level)
    const userMaxHierarchy = Math.max(
      ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
    );

    if (validatedData.hierarchy >= userMaxHierarchy) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot create role with hierarchy level equal to or higher than your own',
        },
        { status: 403 }
      );
    }

    // Verify all permissions exist
    if (validatedData.permissions.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: {
          id: { in: validatedData.permissions },
        },
      });

      if (permissions.length !== validatedData.permissions.length) {
        return NextResponse.json(
          {
            success: false,
            error: 'One or more invalid permission IDs provided',
          },
          { status: 400 }
        );
      }
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        hierarchy: validatedData.hierarchy,
        isSystemRole: false,
      },
    });

    // Create role-permission mappings
    if (validatedData.permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: validatedData.permissions.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Fetch complete role with permissions
    const completeRole = await prisma.role.findUnique({
      where: { id: role.id },
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
            updatedAt: completeRole!.updatedAt,
          },
        },
        message: 'Role created successfully',
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

    console.error('Error creating role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create role',
      },
      { status: 500 }
    );
  }
}
