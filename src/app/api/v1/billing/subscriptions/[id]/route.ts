// Individual subscription management API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { StripeBillingService } from '../../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  cancelAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const cancelSubscriptionSchema = z.object({
  cancelAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
  },
  {
    // Get subscription details
    GET: async ({ routeParams, context, auth }) => {
      try {
        const subscriptionId = routeParams?.id;
        if (!subscriptionId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription ID is required' },
            context.requestId
          );
        }

        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
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

        if (!subscription) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription not found' },
            context.requestId
          );
        }

        // Check permissions
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: subscription.billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to subscription' },
            context.requestId
          );
        }

        // Get current usage (aggregate from usage records)
        const usageRecords = await prisma.usageRecord.findMany({
          where: {
            subscriptionId,
            timestamp: {
              gte: subscription.currentPeriodStart,
              lte: new Date(),
            },
          },
          select: {
            metric: true,
            quantity: true,
          },
        });

        const currentUsage = usageRecords.reduce(
          (acc, record) => {
            acc[record.metric] = (acc[record.metric] || 0) + Number(record.quantity);
            return acc;
          },
          {} as Record<string, number>
        );

        logger.info('Subscription retrieved', {
          subscriptionId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscription,
            currentUsage,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to get subscription', error as Error, {
          subscriptionId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get subscription' },
          context.requestId
        );
      }
    },

    // Update subscription
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const subscriptionId = routeParams?.id;
        if (!subscriptionId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription ID is required' },
            context.requestId
          );
        }

        const validation = updateSubscriptionSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid update data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        // Get existing subscription
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            billingAccount: {
              select: {
                organizationId: true,
              },
            },
          },
        });

        if (!subscription) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription not found' },
            context.requestId
          );
        }

        // Check permissions
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: subscription.billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to subscription' },
            context.requestId
          );
        }

        // Validate plan change if requested
        if (validation.data.planId && validation.data.planId !== subscription.planId) {
          const newPlan = await prisma.subscriptionPlan.findUnique({
            where: { id: validation.data.planId },
          });

          if (!newPlan || !newPlan.isActive) {
            return createErrorResponse(
              'VALIDATION_ERROR',
              { message: 'Invalid or inactive plan' },
              context.requestId
            );
          }
        }

        // Update subscription
        const updateData: any = {};
        const planChanged =
          validation.data.planId && validation.data.planId !== subscription.planId;

        if (validation.data.planId) updateData.planId = validation.data.planId;
        if (validation.data.cancelAt) updateData.cancelAt = new Date(validation.data.cancelAt);
        if (validation.data.metadata) updateData.metadata = validation.data.metadata;

        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: updateData,
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

        // Sync plan change to Stripe if plan was updated
        if (planChanged && validation.data.planId) {
          const stripeBillingService = new StripeBillingService();
          stripeBillingService
            .updateStripeSubscription(subscriptionId, validation.data.planId)
            .catch((error) => {
              logger.error('Failed to sync plan change to Stripe', error, {
                subscriptionId,
                newPlanId: validation.data.planId,
              });
              // Note: Database already updated, webhook will eventually sync
            });
        }

        logger.info('Subscription updated', {
          subscriptionId,
          changes: validation.data,
          planChanged,
          stripeSyncTriggered: planChanged,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ subscription: updatedSubscription }, 200, context.requestId);
      } catch (error) {
        logger.error('Failed to update subscription', error as Error, {
          subscriptionId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to update subscription' },
          context.requestId
        );
      }
    },

    // Cancel subscription
    DELETE: async ({ routeParams, body, context, auth }) => {
      try {
        console.log('DELETE subscription - routeParams:', routeParams);
        console.log('DELETE subscription - body:', body);

        const subscriptionId = routeParams?.id;
        if (!subscriptionId) {
          console.error('Missing subscription ID in routeParams');
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription ID is required' },
            context.requestId
          );
        }

        const validation = cancelSubscriptionSchema.safeParse(body || {});
        if (!validation.success) {
          console.error('Validation failed:', validation.error.issues);
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid cancellation data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { cancelAt, reason } = validation.data;

        // Get existing subscription
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            billingAccount: {
              select: {
                organizationId: true,
              },
            },
          },
        });

        if (!subscription) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription not found' },
            context.requestId
          );
        }

        // Check permissions
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: subscription.billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to subscription' },
            context.requestId
          );
        }

        // Cancel subscription
        const cancelDate = cancelAt ? new Date(cancelAt) : new Date();
        const updateData: any = {
          status: 'CANCELED',
          cancelAt: cancelDate,
          canceledAt: new Date(),
        };

        if (reason) {
          updateData.metadata = {
            ...(subscription.metadata as any),
            cancellationReason: reason,
            canceledBy: userId,
          };
        }

        const canceledSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: updateData,
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

        // Cancel Stripe subscription (async, don't block response)
        const stripeBillingService = new StripeBillingService();
        stripeBillingService.cancelStripeSubscription(subscriptionId).catch((error) => {
          logger.error('Failed to cancel Stripe subscription', error, { subscriptionId });
        });

        logger.info('Subscription canceled', {
          subscriptionId,
          cancelAt: cancelDate,
          reason,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscription: canceledSubscription,
            message: 'Subscription canceled successfully',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to cancel subscription', error as Error, {
          subscriptionId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to cancel subscription' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
