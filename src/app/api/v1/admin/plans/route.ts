// Admin: Subscription Plans Management API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { StripeBillingService } from '../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  tier: z.enum(['FREE', 'BASIC', 'STARTER', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  pricing: z.object({
    amount: z.number().min(0),
    currency: z.string().default('USD'),
    billingInterval: z.enum(['monthly', 'yearly']).default('monthly'),
  }),
  stripePriceId: z.string().optional(),
  trialDays: z.number().min(0).max(90).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
  autoCreateStripe: z.boolean().default(true), // Auto-create Stripe product/price
  limits: z.record(z.string(), z.any()).optional(), // Feature limits
});

const listPlansSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  tier: z.enum(['FREE', 'BASIC', 'STARTER', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      roles: ['admin', 'super-admin', 'system-admin'], // Admin only
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List all plans (admin view)
    GET: async ({ request, context, auth }) => {
      try {
        // Extract query parameters from URL
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const validation = listPlansSchema.safeParse(queryParams);
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

        const { isActive, tier, limit, offset } = validation.data;

        // Build where clause
        const where: any = {};
        if (isActive !== undefined) where.isActive = isActive;
        if (tier) where.tier = tier;

        // Fetch plans with subscription counts
        const [plans, total] = await Promise.all([
          prisma.subscriptionPlan.findMany({
            where,
            include: {
              _count: {
                select: {
                  subscriptions: true,
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: limit,
            skip: offset,
          }),
          prisma.subscriptionPlan.count({ where }),
        ]);

        logger.info('Admin: Plans listed', {
          userId: auth.user?.id,
          count: plans.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            plans,
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
        logger.error('Admin: Failed to list plans', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list plans' },
          context.requestId
        );
      }
    },

    // Create new plan
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createPlanSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid plan data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const planData = validation.data;

        // Check if plan with same tier already exists
        const existingPlan = await prisma.subscriptionPlan.findFirst({
          where: {
            tier: planData.tier,
            isActive: true,
          },
        });

        if (existingPlan) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            { message: `Active plan with tier ${planData.tier} already exists` },
            context.requestId
          );
        }

        // Auto-create Stripe product and price if enabled and no stripePriceId provided
        let { stripePriceId } = planData;
        let stripeProductId: string | undefined;

        if (planData.autoCreateStripe && !stripePriceId && planData.pricing.amount > 0) {
          try {
            const stripeBillingService = new StripeBillingService();
            const stripeResult = await stripeBillingService.createStripeProductAndPrice({
              name: planData.name,
              description: planData.description,
              amount: planData.pricing.amount,
              currency: planData.pricing.currency,
              billingInterval: planData.pricing.billingInterval,
              tier: planData.tier,
              features: planData.features,
            });

            stripePriceId = stripeResult.priceId;
            stripeProductId = stripeResult.productId;

            logger.info('Admin: Stripe product/price auto-created for plan', {
              planName: planData.name,
              stripeProductId,
              stripePriceId,
              userId: auth.user?.id,
            });
          } catch (stripeError) {
            logger.warn('Admin: Failed to auto-create Stripe product/price', {
              error: (stripeError as Error).message,
              planName: planData.name,
            });
            // Continue with plan creation even if Stripe fails
          }
        }

        // Create plan
        const plan = await prisma.subscriptionPlan.create({
          data: {
            name: planData.name,
            tier: planData.tier,
            description: planData.description,
            features: planData.features || [],
            pricing: planData.pricing,
            limits: planData.limits || {},
            stripePriceId,
            stripeProductId,
            trialDays: planData.trialDays,
            isActive: planData.isActive,
            metadata: planData.metadata || {},
          },
        });

        logger.info('Admin: Plan created', {
          planId: plan.id,
          tier: plan.tier,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ plan }, 201, context.requestId);
      } catch (error) {
        logger.error('Admin: Failed to create plan', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create plan' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
