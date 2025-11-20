// Admin: Individual Plan Management API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  pricing: z
    .object({
      amount: z.number().min(0),
      currency: z.string(),
      billingInterval: z.enum(['monthly', 'yearly']),
    })
    .optional(),
  stripePriceId: z.string().optional(),
  trialDays: z.number().min(0).max(90).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      roles: ['admin', 'super-admin', 'system-admin'], // Admin only
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
  },
  {
    // Get plan details
    GET: async ({ routeParams, context, auth }) => {
      try {
        const planId = routeParams?.id;
        if (!planId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Plan ID is required' },
            context.requestId
          );
        }

        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId },
          include: {
            _count: {
              select: {
                subscriptions: true,
              },
            },
            subscriptions: {
              where: {
                status: { in: ['ACTIVE', 'TRIALING'] },
              },
              select: {
                id: true,
                status: true,
                billingAccount: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              take: 10,
            },
          },
        });

        if (!plan) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Plan not found' },
            context.requestId
          );
        }

        logger.info('Admin: Plan retrieved', {
          planId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ plan }, 200, context.requestId);
      } catch (error) {
        logger.error('Admin: Failed to get plan', error as Error, {
          planId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get plan' },
          context.requestId
        );
      }
    },

    // Update plan
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const planId = routeParams?.id;
        if (!planId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Plan ID is required' },
            context.requestId
          );
        }

        const validation = updatePlanSchema.safeParse(body);
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

        // Check if plan exists
        const existingPlan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId },
        });

        if (!existingPlan) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Plan not found' },
            context.requestId
          );
        }

        // Update plan
        const updateData: any = {};
        if (validation.data.name !== undefined) updateData.name = validation.data.name;
        if (validation.data.description !== undefined)
          updateData.description = validation.data.description;
        if (validation.data.features !== undefined) updateData.features = validation.data.features;
        if (validation.data.pricing !== undefined) updateData.pricing = validation.data.pricing;
        if (validation.data.stripePriceId !== undefined)
          updateData.stripePriceId = validation.data.stripePriceId;
        if (validation.data.trialDays !== undefined)
          updateData.trialDays = validation.data.trialDays;
        if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive;
        if (validation.data.metadata !== undefined) updateData.metadata = validation.data.metadata;

        const updatedPlan = await prisma.subscriptionPlan.update({
          where: { id: planId },
          data: updateData,
          include: {
            _count: {
              select: {
                subscriptions: true,
              },
            },
          },
        });

        logger.info('Admin: Plan updated', {
          planId,
          changes: validation.data,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ plan: updatedPlan }, 200, context.requestId);
      } catch (error) {
        logger.error('Admin: Failed to update plan', error as Error, {
          planId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to update plan' },
          context.requestId
        );
      }
    },

    // Delete plan (soft delete - mark as inactive)
    DELETE: async ({ routeParams, context, auth }) => {
      try {
        const planId = routeParams?.id;
        if (!planId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Plan ID is required' },
            context.requestId
          );
        }

        // Check if plan exists
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId },
          include: {
            _count: {
              select: {
                subscriptions: {
                  where: {
                    status: { in: ['ACTIVE', 'TRIALING'] },
                  },
                },
              },
            },
          },
        });

        if (!plan) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Plan not found' },
            context.requestId
          );
        }

        // Check if plan has active subscriptions
        const activeSubscriptionsCount = plan._count.subscriptions;
        if (activeSubscriptionsCount > 0) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: `Cannot delete plan with ${activeSubscriptionsCount} active subscriptions. Mark as inactive instead.`,
            },
            context.requestId
          );
        }

        // Soft delete: Mark as inactive
        const deletedPlan = await prisma.subscriptionPlan.update({
          where: { id: planId },
          data: {
            isActive: false,
            metadata: {
              ...(plan.metadata as any),
              deletedAt: new Date().toISOString(),
              deletedBy: auth.user?.id,
            },
          },
        });

        logger.info('Admin: Plan deleted (marked inactive)', {
          planId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            plan: deletedPlan,
            message: 'Plan marked as inactive',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Admin: Failed to delete plan', error as Error, {
          planId: routeParams?.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to delete plan' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
