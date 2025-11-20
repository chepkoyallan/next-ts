/**
 * Admin API - Subscription Management
 * Manage subscriptions across all organizations
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const SubscriptionQuerySchema = z.object({
  organizationId: z.string().optional(),
  status: z
    .enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'PAUSED'])
    .optional(),
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const CreateSubscriptionSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  trialDays: z.number().int().min(0).optional(),
  startDate: z
    .string()
    .transform((v) => new Date(v))
    .optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/v1/admin/billing/subscriptions
 * List all subscriptions with filtering
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

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = SubscriptionQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.organizationId) {
      where.organizationId = validatedQuery.organizationId;
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    if (validatedQuery.tier) {
      where.plan = {
        tier: validatedQuery.tier,
      };
    }

    // Get total count
    const total = await prisma.subscription.count({ where });

    // Get subscriptions with related data
    const subscriptions = await prisma.subscription.findMany({
      where,
      take: validatedQuery.limit || 50,
      skip: validatedQuery.offset || 0,
      orderBy: { createdAt: 'desc' },
      include: {
        billingAccount: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
            tier: true,
            pricing: true,
          },
        },
      },
    });

    // Calculate revenue metrics
    const activeSubscriptions = subscriptions.filter(
      (s) => s.status === 'ACTIVE' || s.status === 'TRIALING'
    );
    const totalMRR = activeSubscriptions.reduce((sum, sub) => {
      const pricing = sub.plan.pricing as any;
      const monthlyPrice = pricing?.monthly || pricing?.price || 0;
      return sum + monthlyPrice;
    }, 0);

    // Format subscriptions with organization data
    const formattedSubscriptions = subscriptions.map((sub) => ({
      ...sub,
      organization: sub.billingAccount.organization,
    }));

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: formattedSubscriptions,
        pagination: {
          total,
          limit: validatedQuery.limit || 50,
          offset: validatedQuery.offset || 0,
        },
        metrics: {
          totalSubscriptions: total,
          activeSubscriptions: activeSubscriptions.length,
          mrr: totalMRR,
          arr: totalMRR * 12,
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

    console.error('Error listing subscriptions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list subscriptions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/billing/subscriptions
 * Create a new subscription for an organization
 */
export async function POST(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const body = await request.json();
    const validatedData = CreateSubscriptionSchema.parse(body);

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: validatedData.organizationId },
      include: {
        billingAccounts: {
          // where: { isDefault: true }, // isDefault field doesn't exist
          take: 1,
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

    // Get or create billing account
    let billingAccount = (organization as any).billingAccounts?.[0];
    if (!billingAccount) {
      billingAccount = await prisma.billingAccount.create({
        data: {
          organizationId: organization.id,
          name: organization.name || 'Default Billing Account',
          email: 'billing@example.com', // Required field
          // isDefault: true, // Field may not exist
        } as any,
      });
    }

    // Verify plan exists
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription plan not found',
        },
        { status: 404 }
      );
    }

    // Check for existing active subscriptions
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        billingAccountId: billingAccount.id,
        projectId: 'default', // Required field
        // Removed duplicate projectId
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Organization already has an active subscription. Cancel it first or use update endpoint.',
        },
        { status: 409 }
      );
    }

    // Calculate dates
    const startDate = validatedData.startDate || new Date();
    const trialDays = validatedData.trialDays || 0;
    const isTrialing = trialDays > 0;

    const trialEnd = isTrialing
      ? new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : null;

    // For billing period, use 1 month or 1 year based on plan pricing
    const periodDays = 30; // Default to monthly
    const currentPeriodEnd = new Date(
      (trialEnd || startDate).getTime() + periodDays * 24 * 60 * 60 * 1000
    );

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        billingAccountId: billingAccount.id,
        projectId: 'default', // Required field
        // Removed duplicate projectId
        planId: plan.id,
        status: isTrialing ? 'TRIALING' : 'ACTIVE',
        currentPeriodStart: startDate,
        currentPeriodEnd,
        trialEnd,
        metadata: validatedData.notes ? { notes: validatedData.notes } : {},
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            tier: true,
            pricing: true,
          },
        },
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
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          subscription: {
            id: subscription.id,
            status: subscription.status,
            plan: subscription.plan,
            organization: subscription.billingAccount.organization,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialEnd: subscription.trialEnd,
            createdAt: subscription.createdAt,
          },
        },
        message: 'Subscription created successfully',
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

    console.error('Error creating subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      },
      { status: 500 }
    );
  }
}
