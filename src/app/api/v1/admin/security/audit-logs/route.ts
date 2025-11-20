/**
 * Admin API - Audit Logs
 * View and manage audit logs across the platform
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const AuditLogQuerySchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  endDate: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/security/audit-logs
 * Get audit logs with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false, // Don't log audit log access
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = AuditLogQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.userId) {
      where.userId = validatedQuery.userId;
    }

    if (validatedQuery.action) {
      where.action = { contains: validatedQuery.action, mode: 'insensitive' };
    }

    if (validatedQuery.resource) {
      where.resource = validatedQuery.resource;
    }

    if (validatedQuery.startDate || validatedQuery.endDate) {
      where.timestamp = {};
      if (validatedQuery.startDate) {
        where.timestamp.gte = validatedQuery.startDate;
      }
      if (validatedQuery.endDate) {
        where.timestamp.lte = validatedQuery.endDate;
      }
    }

    // ⚡ Performance: Get total count and logs in parallel with caching
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({
        where,
        cacheStrategy: { ttl: 30, swr: 10 },
      } as any),
      prisma.auditLog.findMany({
        where,
        take: validatedQuery.limit || 100,
        skip: validatedQuery.offset || 0,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        cacheStrategy: { ttl: 30, swr: 10 },
      } as any),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
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

    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit logs',
      },
      { status: 500 }
    );
  }
}
