/**
 * Admin API - API Key Management
 * View and manage API keys across the platform
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// const ApiKeyQuerySchema = z.object({
//   userId: z.string().optional(),
//   organizationId: z.string().optional(),
//   isActive: z
//     .string()
//     .transform((v) => v === 'true')
//     .optional(),
//   limit: z.string().transform(Number).optional(),
//   offset: z.string().transform(Number).optional(),
// });

/**
 * GET /api/v1/admin/security/api-keys
 * List all API keys with filtering
 *
 * NOTE: Disabled - ApiKey model doesn't exist in Prisma schema
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'API Key management is not available - model not configured',
      code: 'FEATURE_DISABLED',
    },
    { status: 501 }
  );

  /* Disabled until ApiKey model is added to schema
export async function GET_DISABLED(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = ApiKeyQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.userId) {
      where.userId = validatedQuery.userId;
    }

    if (validatedQuery.organizationId) {
      where.organizationId = validatedQuery.organizationId;
    }

    if (validatedQuery.isActive !== undefined) {
      where.isActive = validatedQuery.isActive;
    }

    // Get total count
    const total = await prisma.apiKey.count({ where });

    // Get API keys with related data
    const apiKeys = await prisma.apiKey.findMany({
      where,
      take: validatedQuery.limit || 50,
      skip: validatedQuery.offset || 0,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Format response (hide actual keys)
    const formattedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPreview: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      user: key.user,
      organization: key.organization,
    }));

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: formattedKeys,
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

    console.error('Error listing API keys:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list API keys',
      },
      { status: 500 }
    );
  }
}
*/
}
