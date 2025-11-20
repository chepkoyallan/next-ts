// Direct subscription creation endpoint (for development/manual creation)
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

const createSubscriptionDirectSchema = z.object({
  planTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
  priceId: z.string().optional(),
  paymentIntentId: z.string().optional(),
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
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createSubscriptionDirectSchema.safeParse(body);
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

        const { planTier, priceId, paymentIntentId } = validation.data;
        const userId = auth.user?.id;

        if (!userId) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not authenticated' },
            context.requestId
          );
        }

        // Get user's organization
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            organizationMembers: {
              where: { isActive: true },
              include: { organization: true },
            },
          },
        });

        if (!user) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not found' },
            context.requestId
          );
        }

        // Get or create organization for user
        const organization =
          user.organizationMembers.length > 0
            ? user.organizationMembers[0].organization
            : await (async () => {
                // Create a default organization for the user
                const userNameSlug = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const uniqueSlug = `${userNameSlug}-${userId.slice(-8)}`;

                const newOrg = await prisma.organization.create({
                  data: {
                    name: `${user.name}'s Organization`,
                    slug: uniqueSlug,
                    ownerId: userId,
                    status: 'ACTIVE',
                    members: {
                      create: {
                        userId,
                        role: 'OWNER',
                        isActive: true,
                      },
                    },
                  },
                });

                logger.info('Created default organization for user', {
                  userId,
                  organizationId: newOrg.id,
                  requestId: context.requestId,
                });

                return newOrg;
              })();

        // Get or create billing account
        let billingAccount = await prisma.billingAccount.findFirst({
          where: { organizationId: organization.id },
        });

        if (!billingAccount) {
          billingAccount = await prisma.billingAccount.create({
            data: {
              organizationId: organization.id,
              name: `${organization.name} Billing`,
              email: user.email, // Required field
            },
          });
        }

        // Find or create subscription plan
        const planMapping: Record<string, string> = {
          STARTER: 'Starter',
          PROFESSIONAL: 'Professional',
          ENTERPRISE: 'Enterprise',
        };

        const planName = planMapping[planTier];
        let subscriptionPlan = await prisma.subscriptionPlan.findFirst({
          where: { tier: planTier },
        });

        if (!subscriptionPlan) {
          // Create default plan
          const planPrices: Record<string, { monthly: number; yearly: number }> = {
            STARTER: { monthly: 29, yearly: 290 },
            PROFESSIONAL: { monthly: 99, yearly: 990 },
            ENTERPRISE: { monthly: 299, yearly: 2990 },
          };

          const isYearly = priceId?.includes('yearly');
          const amount = planPrices[planTier]?.[isYearly ? 'yearly' : 'monthly'];

          subscriptionPlan = await prisma.subscriptionPlan.create({
            data: {
              name: planName,
              tier: planTier,
              pricing: {
                price: amount,
                currency: 'usd',
                billingInterval: isYearly ? 'yearly' : 'monthly',
                stripePriceId: priceId,
              },
              limits: {
                projects: (() => {
                  if (planTier === 'STARTER') return 10;
                  if (planTier === 'PROFESSIONAL') return 50;
                  return -1;
                })(),
                executions: (() => {
                  if (planTier === 'STARTER') return 1000;
                  if (planTier === 'PROFESSIONAL') return 10000;
                  return -1;
                })(),
                storage: (() => {
                  if (planTier === 'STARTER') return '10 GB';
                  if (planTier === 'PROFESSIONAL') return '100 GB';
                  return 'Unlimited';
                })(),
                users: (() => {
                  if (planTier === 'STARTER') return 3;
                  if (planTier === 'PROFESSIONAL') return 10;
                  return -1;
                })(),
              },
              features: {},
              isActive: true,
            },
          });
        }

        // Get or create default project
        let project = await prisma.project.findFirst({
          where: { organizationId: organization.id },
        });

        if (!project) {
          project = await prisma.project.create({
            data: {
              name: `${organization.name} Project`,
              description: 'Default project',
              organizationId: organization.id,
              domain: 'production',
              createdBy: userId,
              flyteState: 0, // 0 = ACTIVE
            },
          });
        }

        // Check if subscription already exists
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            billingAccountId: billingAccount.id,
            projectId: project.id,
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
        });

        if (existingSubscription) {
          // Update existing subscription
          const subscription = await prisma.subscription.update({
            where: { id: existingSubscription.id },
            data: {
              planId: subscriptionPlan.id,
              status: 'TRIALING',
              metadata: {
                ...(existingSubscription.metadata as any),
                paymentIntentId,
                priceId,
                updatedVia: 'direct_creation',
              },
              updatedAt: new Date(),
            },
            include: {
              plan: true,
              billingAccount: true,
              project: true,
            },
          });

          logger.info('Subscription updated via direct creation', {
            subscriptionId: subscription.id,
            userId,
            organizationId: organization.id,
            planTier,
            requestId: context.requestId,
          });

          return createSuccessResponse(
            {
              subscription,
              message: 'Subscription updated successfully',
            },
            200,
            context.requestId
          );
        }

        // Calculate subscription dates
        const now = new Date();
        const trialDays = 14;
        const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

        const isYearly = priceId?.includes('yearly');
        const currentPeriodEnd = new Date(now);
        if (isYearly) {
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        } else {
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        }

        // Create new subscription
        const subscription = await prisma.subscription.create({
          data: {
            billingAccountId: billingAccount.id,
            projectId: project.id,
            planId: subscriptionPlan.id,
            status: 'TRIALING',
            stripeSubscriptionId: paymentIntentId,
            currentPeriodStart: now,
            currentPeriodEnd,
            trialStart: now,
            trialEnd,
            metadata: {
              paymentIntentId,
              priceId,
              createdVia: 'direct_creation',
            },
          },
          include: {
            plan: true,
            billingAccount: true,
            project: true,
          },
        });

        logger.info('Subscription created via direct creation', {
          subscriptionId: subscription.id,
          userId,
          organizationId: organization.id,
          planTier,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscription,
            message: 'Subscription created successfully',
          },
          201,
          context.requestId
        );
      } catch (error) {
        console.error('SUBSCRIPTION CREATE ERROR:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          body,
        });

        logger.error('Failed to create subscription directly', error as Error, {
          userId: auth.user?.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          planTier: body?.planTier,
          priceId: body?.priceId,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to create subscription',
            details: error instanceof Error ? error.message : String(error),
            stack: (() => {
              if (process.env.NODE_ENV !== 'development') return undefined;
              if (error instanceof Error) return error.stack;
              return undefined;
            })(),
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
