/**
 * Admin API - Revoke API Key
 * Revoke an API key for security reasons
 */

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

// const RevokeReasonSchema = z.object({
//   reason: z.string().min(1),
// });

/**
 * POST /api/v1/admin/security/api-keys/:id/revoke
 * Revoke an API key
 *
 * NOTE: Disabled - ApiKey model doesn't exist in Prisma schema
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return NextResponse.json(
    {
      success: false,
      error: 'API Key management is not available - model not configured',
      code: 'FEATURE_DISABLED',
    },
    { status: 501 }
  );

  /* Disabled until ApiKey model is added to schema
export async function POST_DISABLED(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const apiKeyId = params.id;

    // Validate request body
    const body = await request.json();
    const validatedData = RevokeReasonSchema.parse(body);

    // Check if API key exists
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key not found',
        },
        { status: 404 }
      );
    }

    if (!apiKey.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'API key is already revoked',
        },
        { status: 400 }
      );
    }

    // Revoke the API key
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'api_key_revoked',
      resource: 'api_keys',
      resourceId: apiKeyId,
      projectId: 'admin',
      details: {
        keyName: apiKey.name,
        userEmail: apiKey.user.email,
        organizationName: apiKey.organization?.name,
        reason: validatedData.reason,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully',
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

    console.error('Error revoking API key:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke API key',
      },
      { status: 500 }
    );
  }
}
*/
}
