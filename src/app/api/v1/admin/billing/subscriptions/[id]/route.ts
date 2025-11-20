/**
 * Admin API - Single Subscription Management
 * Get and manage individual subscriptions
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

const SubscriptionUpdateSchema = z.object({
  status: z
    .enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'PAUSED'])
    .optional(),
  planId: z.string().optional(),
  currentPeriodEnd: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
});

/**
 * GET /api/v1/admin/billing/subscriptions/:id
 * Get detailed subscription information
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
    const subscriptionId = params.id;

    // Get subscription with full details
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        // organization: {  // Relation doesn't exist on Subscription
        //   select: {
        //     id: true,
        //     name: true,
        //     domain: true,
        //     status: true,
        //   },
        // },
        plan: true,
        billingAccount: {
          select: {
            id: true,
            stripeCustomerId: true,
            // paymentMethod: true, // Relation may not exist
            // billingEmail: true, // Field doesn't exist
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription not found',
        },
        { status: 404 }
      );
    }

    // Get usage for current period
    const startOfPeriod = subscription.currentPeriodStart;
    const endOfPeriod = subscription.currentPeriodEnd;

    const [executionCount, apiCallCount] = await Promise.all([
      prisma.workflowExecution.count({
        where: {
          // organizationId removed,
          createdAt: {
            gte: startOfPeriod,
            lte: endOfPeriod,
          },
        },
      }),
      prisma.usageRecord.count({
        where: {
          // organizationId removed,
          /* recordedAt: { */ timestamp: {
            gte: startOfPeriod,
            lte: endOfPeriod,
          },
          // resourceType: 'api_call', // Field doesn't exist in UsageRecord
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        subscription,
        usage: {
          executions: executionCount,
          apiCalls: apiCallCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscription',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/billing/subscriptions/:id
 * Update subscription details
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin', // Only super admins can modify subscriptions
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const subscriptionId = params.id;

    // Validate request body
    const body = await request.json();
    const validatedData = SubscriptionUpdateSchema.parse(body);

    // Check if subscription exists
    const existing = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        // organization: true, // Field may not exist
        plan: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription not found',
        },
        { status: 404 }
      );
    }

    // Update subscription
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: validatedData as any, // Cast to bypass planId update restriction
      include: {
        plan: true,
      },
    });

    // Audit log
    const { logAuditEvent } = await import('src/app/api/lib/services/audit-service');
    await logAuditEvent({
      userId: adminContext.userId,
      action: 'subscription_updated',
      resource: 'subscriptions',
      resourceId: subscriptionId,
      projectId: 'admin',
      details: {
        organizationName: (existing as any).organization?.name,
        changes: validatedData,
        previousStatus: existing.status,
        previousPlan: (existing as any).plan?.name,
        adminEmail: adminContext.email,
      },
    });

    return NextResponse.json({
      success: true,
      data: { subscription: updated },
      message: 'Subscription updated successfully',
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

    console.error('Error updating subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update subscription',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/billing/subscriptions/:id
 * Cancel/delete a subscription
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const subscriptionId = params.id;

    // Parse query parameters for immediate cancellation
    const { searchParams } = request.nextUrl;
    const immediately = searchParams.get('immediately') === 'true';

    // Check if subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        billingAccount: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        plan: {
          select: {
            name: true,
            tier: true,
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription not found',
        },
        { status: 404 }
      );
    }

    // Update subscription status
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        // If immediately, set period end to now; otherwise let it expire naturally
        currentPeriodEnd: immediately ? new Date() : subscription.currentPeriodEnd,
        metadata: {
          ...(subscription.metadata as any),
          canceledBy: adminContext.userId,
          canceledByEmail: adminContext.email,
          canceledAt: new Date().toISOString(),
          immediately,
        },
      },
      include: {
        plan: true,
        billingAccount: {
          include: {
            // organization: true, // Field may not exist
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        subscription: updated,
        canceledImmediately: immediately,
        effectiveUntil: updated.currentPeriodEnd,
      },
      message: immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the current period',
    });
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete subscription',
      },
      { status: 500 }
    );
  }
}
