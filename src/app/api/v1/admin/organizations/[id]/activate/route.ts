/**
 * Admin API - Activate Organization
 * Activate a suspended organization
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/v1/admin/organizations/:id/activate
 * Activate a suspended organization
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const organizationId = params.id;

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    if (organization.status === 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization is already active',
        },
        { status: 400 }
      );
    }

    // Activate the organization
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'ACTIVE',
        metadata: {
          ...(organization.metadata as any),
          activatedAt: new Date().toISOString(),
          activatedBy: adminContext.userId,
        },
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'organization_activated',
      resource: 'organizations',
      resourceId: organizationId,
      // projectId: null,
      details: {
        organizationName: organization.name,
        previousStatus: organization.status,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: { organization: updated },
      message: 'Organization activated successfully',
    });
  } catch (error) {
    console.error('Error activating organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate organization',
      },
      { status: 500 }
    );
  }
}
