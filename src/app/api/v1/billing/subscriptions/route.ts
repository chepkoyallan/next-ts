// Subscription management API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { StripeBillingService } from '../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const createSubscriptionSchema = z.object({
  billingAccountId: z.string().min(1, 'Billing account ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  trialDays: z.number().min(0).max(90).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// const updateSubscriptionSchema = z.object({
//   planId: z.string().optional(),
//   cancelAt: z.string().datetime().optional(),
//   metadata: z.record(z.string(), z.any()).optional(),
// });

const listSubscriptionsSchema = z.object({
  billingAccountId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.enum(['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List subscriptions
    GET: async ({ request, context, auth }) => {
      try {
        // Extract query parameters from URL
        const url = new URL(request.url);
        const queryParams = {
          billingAccountId: url.searchParams.get('billingAccountId') || undefined,
          projectId: url.searchParams.get('projectId') || undefined,
          status: url.searchParams.get('status') || undefined,
          limit: url.searchParams.get('limit') || '20',
          offset: url.searchParams.get('offset') || '0',
        };

        const validation = listSubscriptionsSchema.safeParse(queryParams);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid query parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { billingAccountId, projectId, status, limit, offset } = validation.data;

        // Get user's organizations
        const userId = auth.user?.id || '';
        const userOrganizations = await prisma.organizationMember.findMany({
          where: {
            userId,
            isActive: true,
          },
          select: {
            organizationId: true,
          },
        });

        const organizationIds = userOrganizations.map((m) => m.organizationId);

        if (organizationIds.length === 0) {
          return createSuccessResponse(
            {
              subscriptions: [],
              pagination: { limit, offset, total: 0, hasMore: false },
            },
            200,
            context.requestId
          );
        }

        // Build where clause
        const where: any = {
          billingAccount: {
            organizationId: {
              in: organizationIds,
            },
          },
        };

        if (billingAccountId) {
          where.billingAccountId = billingAccountId;
        }

        if (projectId) {
          where.projectId = projectId;
        }

        if (status) {
          where.status = status;
        }

        // Fetch subscriptions
        const [subscriptions, total] = await Promise.all([
          prisma.subscription.findMany({
            where,
            include: {
              billingAccount: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
              plan: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          prisma.subscription.count({ where }),
        ]);

        logger.info('Subscriptions listed', {
          userId: auth.user?.id,
          count: subscriptions.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscriptions,
            pagination: {
              limit,
              offset,
              total,
              hasMore: offset + limit < total,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list subscriptions', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list subscriptions' },
          context.requestId
        );
      }
    },

    // Create subscription
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createSubscriptionSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid subscription data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const subscriptionData = validation.data;

        // Verify user can create subscription for this billing account
        const billingAccount = await prisma.billingAccount.findUnique({
          where: { id: subscriptionData.billingAccountId },
        });

        if (!billingAccount) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Billing account not found' },
            context.requestId
          );
        }

        // Check permissions
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to billing account' },
            context.requestId
          );
        }

        // Check if project already has an active subscription
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            projectId: subscriptionData.projectId,
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
        });

        if (existingSubscription) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            { message: 'Project already has an active subscription' },
            context.requestId
          );
        }

        // Get plan to determine trial and pricing
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: subscriptionData.planId },
        });

        if (!plan) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription plan not found' },
            context.requestId
          );
        }

        // Calculate period dates
        const now = new Date();
        const trialEnd = subscriptionData.trialDays
          ? new Date(now.getTime() + subscriptionData.trialDays * 24 * 60 * 60 * 1000)
          : undefined;

        // Calculate period end based on billing interval
        const billingInterval = (plan.pricing as any)?.billingInterval || 'monthly';
        const currentPeriodEnd = new Date(now);
        if (billingInterval === 'yearly') {
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        } else {
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        }

        // Create subscription
        const subscription = await prisma.subscription.create({
          data: {
            billingAccountId: subscriptionData.billingAccountId,
            projectId: subscriptionData.projectId,
            planId: subscriptionData.planId,
            status: trialEnd ? 'TRIALING' : 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd,
            trialStart: trialEnd ? now : undefined,
            trialEnd,
            metadata: subscriptionData.metadata || {},
          },
          include: {
            billingAccount: {
              select: {
                id: true,
                name: true,
                organizationId: true,
              },
            },
            plan: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Create Stripe subscription (async, don't block response)
        const stripeBillingService = new StripeBillingService();
        stripeBillingService
          .createStripeSubscription(subscription.id, {
            trialDays: subscriptionData.trialDays,
          })
          .catch((error) => {
            logger.error('Failed to create Stripe subscription', error, {
              subscriptionId: subscription.id,
            });
          });

        logger.info('Subscription created', {
          subscriptionId: subscription.id,
          projectId: subscriptionData.projectId,
          planId: subscriptionData.planId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ subscription }, 201, context.requestId);
      } catch (error) {
        logger.error('Failed to create subscription', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create subscription' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
