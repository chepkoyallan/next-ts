/**
 * Admin API - Permissions Management
 * List and manage system permissions
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const PermissionQuerySchema = z.object({
  resource: z.string().optional(),
  action: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/permissions
 * List all permissions with optional filtering
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

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = PermissionQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.resource) {
      where.resource = validatedQuery.resource;
    }

    if (validatedQuery.action) {
      where.action = validatedQuery.action;
    }

    if (validatedQuery.search) {
      where.OR = [
        { resource: { contains: validatedQuery.search, mode: 'insensitive' } },
        { action: { contains: validatedQuery.search, mode: 'insensitive' } },
        { description: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    // Get total count and permissions
    const [total, permissions] = await Promise.all([
      prisma.permission.count({ where }),
      prisma.permission.findMany({
        where,
        take: validatedQuery.limit || 100,
        skip: validatedQuery.offset || 0,
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        include: {
          rolePermissions: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  hierarchy: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Format response with role count
    const formattedPermissions = permissions.map((permission) => ({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      description: permission.description,
      conditions: permission.conditions,
      roleCount: permission.rolePermissions.length,
      roles: permission.rolePermissions.map((rp) => ({
        id: rp.role.id,
        name: rp.role.name,
        hierarchy: rp.role.hierarchy,
      })),
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        permissions: formattedPermissions,
        pagination: {
          total,
          limit: validatedQuery.limit || 100,
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

    console.error('Error listing permissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list permissions',
      },
      { status: 500 }
    );
  }
}
