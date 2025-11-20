// Subscription upgrade/downgrade endpoint
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../../lib/utils/logger';
import { createApiHandler } from '../../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../../lib/utils/response';

const upgradeSubscriptionSchema = z.object({
  newPlanTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  priceId: z.string().optional(),
});

const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['POST'],
  },
  {
    POST: async ({ body, context, auth, params }) => {
      try {
        const subscriptionId = params?.id;

        if (!subscriptionId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription ID is required' },
            context.requestId
          );
        }

        const validation = upgradeSubscriptionSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { newPlanTier, priceId } = validation.data;
        const userId = auth.user?.id;

        if (!userId) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not authenticated' },
            context.requestId
          );
        }

        // Find existing subscription
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            billingAccount: {
              include: {
                organization: {
                  include: {
                    members: {
                      where: { userId, isActive: true },
                    },
                  },
                },
              },
            },
            plan: true,
          },
        });

        if (!subscription) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription not found' },
            context.requestId
          );
        }

        // Check if user has access to this subscription
        if (subscription.billingAccount.organization.members.length === 0) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have access to this subscription' },
            context.requestId
          );
        }

        // Check if trying to upgrade to same plan
        if (subscription.plan.tier === newPlanTier) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription is already on this plan' },
            context.requestId
          );
        }

        // Find or create new plan
        const planMapping: Record<string, string> = {
          STARTER: 'Starter',
          PROFESSIONAL: 'Professional',
          ENTERPRISE: 'Enterprise',
        };

        const planName = planMapping[newPlanTier];
        let newPlan = await prisma.subscriptionPlan.findFirst({
          where: { tier: newPlanTier },
        });

        if (!newPlan) {
          // Create new plan if it doesn't exist
          const planPrices: Record<string, { monthly: number; yearly: number }> = {
            STARTER: { monthly: 29, yearly: 290 },
            PROFESSIONAL: { monthly: 99, yearly: 990 },
            ENTERPRISE: { monthly: 299, yearly: 2990 },
          };

          const isYearly = priceId?.includes('yearly');
          const amount = planPrices[newPlanTier]?.[isYearly ? 'yearly' : 'monthly'];

          newPlan = await prisma.subscriptionPlan.create({
            data: {
              name: planName,
              tier: newPlanTier,
              pricing: {
                price: amount,
                currency: 'usd',
                billingInterval: isYearly ? 'yearly' : 'monthly',
                stripePriceId: priceId,
              },
              limits: {
                projects: (() => {
                  if (newPlanTier === 'STARTER') return 10;
                  if (newPlanTier === 'PROFESSIONAL') return 50;
                  return -1;
                })(),
                executions: (() => {
                  if (newPlanTier === 'STARTER') return 1000;
                  if (newPlanTier === 'PROFESSIONAL') return 10000;
                  return -1;
                })(),
                storage: (() => {
                  if (newPlanTier === 'STARTER') return '10 GB';
                  if (newPlanTier === 'PROFESSIONAL') return '100 GB';
                  return 'Unlimited';
                })(),
                users: (() => {
                  if (newPlanTier === 'STARTER') return 3;
                  if (newPlanTier === 'PROFESSIONAL') return 10;
                  return -1;
                })(),
              },
              features: {},
              isActive: true,
            },
          });
        }

        // Determine if upgrade or downgrade
        const tierOrder = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];
        const currentTierIndex = tierOrder.indexOf(subscription.plan.tier);
        const newTierIndex = tierOrder.indexOf(newPlanTier);
        const isUpgrade = newTierIndex > currentTierIndex;

        // Calculate proration (simplified - just adjust dates)
        const now = new Date();
        let effectiveDate = now;

        if (isUpgrade) {
          // Upgrade takes effect immediately
          effectiveDate = now;
        } else {
          // Downgrade takes effect at end of current period
          effectiveDate = subscription.currentPeriodEnd;
        }

        // Update subscription
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            planId: newPlan.id,
            ...(isUpgrade && {
              // If upgrade, apply immediately
              currentPeriodStart: now,
            }),
            metadata: {
              ...(subscription.metadata as any),
              previousPlanTier: subscription.plan.tier,
              upgradeDate: isUpgrade ? now.toISOString() : undefined,
              downgradeScheduledDate: !isUpgrade ? effectiveDate.toISOString() : undefined,
              priceId,
            },
            updatedAt: new Date(),
          },
          include: {
            plan: true,
            billingAccount: true,
            project: true,
          },
        });

        // Log the change
        logger.info(`Subscription ${isUpgrade ? 'upgraded' : 'downgraded'}`, {
          subscriptionId,
          userId,
          fromPlan: subscription.plan.tier,
          toPlan: newPlanTier,
          effectiveDate: effectiveDate.toISOString(),
          isUpgrade,
          requestId: context.requestId,
        });

        // TODO: Update Stripe subscription if using Stripe
        // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        // await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        //   items: [{ id: subscriptionItem.id, price: newPlan.pricing.stripePriceId }],
        //   proration_behavior: isUpgrade ? 'always_invoice' : 'none',
        // });

        return createSuccessResponse(
          {
            subscription: updatedSubscription,
            message: isUpgrade
              ? 'Subscription upgraded successfully'
              : 'Subscription will be downgraded at the end of the current billing period',
            isUpgrade,
            effectiveDate: effectiveDate.toISOString(),
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to upgrade/downgrade subscription', error as Error, {
          userId: auth.user?.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to upgrade/downgrade subscription',
            details: error instanceof Error ? error.message : String(error),
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
