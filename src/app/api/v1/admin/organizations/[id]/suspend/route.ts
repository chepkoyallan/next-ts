/**
 * Admin API - Suspend Organization
 * Suspend an organization (prevents access)
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

const SuspendReasonSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional(),
});

/**
 * POST /api/v1/admin/organizations/:id/suspend
 * Suspend an organization
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

    // Validate request body
    const body = await request.json();
    const validatedData = SuspendReasonSchema.parse(body);

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: { members: true },
        },
      },
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

    if (organization.status === 'SUSPENDED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization is already suspended',
        },
        { status: 400 }
      );
    }

    // Suspend the organization
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'SUSPENDED',
        metadata: {
          ...(organization.metadata as any),
          suspendedAt: new Date().toISOString(),
          suspendedBy: adminContext.userId,
          suspensionReason: validatedData.reason,
          suspensionNotes: validatedData.notes,
        },
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'organization_suspended',
      resource: 'organizations',
      resourceId: organizationId,
      // projectId: null,
      details: {
        organizationName: organization.name,
        reason: validatedData.reason,
        notes: validatedData.notes,
        affectedMembers: organization._count.members,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: { organization: updated },
      message: 'Organization suspended successfully',
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

    console.error('Error suspending organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to suspend organization',
      },
      { status: 500 }
    );
  }
}
