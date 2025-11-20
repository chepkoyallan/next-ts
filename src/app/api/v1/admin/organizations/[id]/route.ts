/**
 * Admin API - Single Organization Management
 * Get, update, and manage individual organizations
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

// Validation schemas
const OrganizationUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().optional(),
  email: z.string().email().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/v1/admin/organizations/:id
 * Get detailed information about a single organization
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get organization with detailed information
    const orgQuery = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            isActive: true,
            // createdAt: true, // Field may not exist
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                // createdAt: true, // Field may not exist
              },
            },
          },
          orderBy: { /* createdAt: */ userId: 'desc' },
        },
        projects: {
          where: { deletedAt: null, isArchived: false },
          select: {
            id: true,
            name: true,
            flyteProjectId: true,
            // createdAt: true, // Field may not exist
            createdBy: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        billingAccounts: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            subscriptions: {
              include: {
                plan: {
                  select: {
                    name: true,
                    tier: true,
                    pricing: true,
                    // billingInterval: true, // Field may not exist
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
            // workflows: true, // Field may not exist
          },
        },
      },
    });

    // Cast to any to access fields that may not exist in Prisma schema
    const organization = orgQuery as any;

    if (!organization) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Get usage statistics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyExecutions = await prisma.workflowExecution.count({
      where: {
        project: { organizationId },
        createdAt: { gte: startOfMonth },
      },
    });

    // Get all subscriptions from billing accounts
    const allSubscriptions = organization.billingAccounts[0]?.subscriptions || [];

    // Calculate total revenue from subscriptions
    const totalRevenue = allSubscriptions
      .filter((sub: any) => sub.status === 'ACTIVE' || sub.status === 'PAID')
      .reduce((sum: number, sub: any) => {
        const pricing = sub.plan.pricing as any;
        const monthlyPrice = pricing?.monthly || pricing?.price || 0;
        return sum + monthlyPrice;
      }, 0);

    // Extract metadata fields
    const metadata = (organization.metadata || {}) as any;

    return NextResponse.json({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        description: metadata.description || null,
        logoUrl: metadata.logoUrl || null,
        website: organization.website,
        industry: metadata.industry || null,
        size: metadata.size || null,
        domain: organization.domain,
        email: organization.email,
        status: organization.status,
        ownerId: organization.ownerId,
        settings: organization.settings,
        metadata: organization.metadata,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        deletedAt: organization.deletedAt,
        members: organization.members.map((m: any) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          isActive: m.isActive,
          createdAt: m.createdAt,
          user: m.user,
        })),
        projects: organization.projects,
        subscriptions: allSubscriptions,
        billingAccounts: organization.billingAccounts,
        stats: {
          memberCount: organization._count.members,
          projectCount: organization._count.projects,
          activeProjectCount: organization._count.projects,
        },
        counts: {
          members: organization._count.members,
          projects: organization._count.projects,
          workflows: organization._count.workflows,
          subscriptions: allSubscriptions.length,
        },
        usage: {
          monthlyExecutions,
          monthlyApiCalls: 0, // Not tracked yet
        },
        revenue: {
          total: totalRevenue,
          mrr: totalRevenue,
          arr: totalRevenue * 12,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/organizations/:id
 * Update organization details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const validatedData = OrganizationUpdateSchema.parse(body);

    // Check if organization exists
    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Update organization
    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: validatedData,
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'organization_updated',
      resource: 'organizations',
      resourceId: organizationId,
      projectId: null,
      details: {
        changes: validatedData,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: { organization: updated },
      message: 'Organization updated successfully',
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

    console.error('Error updating organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update organization',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/organizations/:id
 * Delete (soft delete) an organization
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin', // Only super admins can delete orgs
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const organizationId = params.id;

    // Check if organization exists
    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Soft delete by setting status to DELETED
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'organization_deleted',
      resource: 'organizations',
      resourceId: organizationId,
      projectId: null,
      details: {
        organizationName: existing.name,
        memberCount: existing._count.members,
        projectCount: existing._count.projects,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete organization',
      },
      { status: 500 }
    );
  }
}
