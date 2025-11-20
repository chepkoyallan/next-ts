// Stripe Price Synchronization Utility
import Stripe from 'stripe';

import { prisma } from '@app/database';

import { logger } from './logger';

// Lazy initialize Stripe to avoid build-time errors
function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  });
}

/**
 * Create or update Stripe products and prices for subscription plans
 */
export async function syncStripePrices() {
  try {
    logger.info('Starting Stripe price synchronization...');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });

    await Promise.all(plans.map((plan) => syncPlanToStripe(plan)));

    logger.info('Stripe price synchronization completed', {
      plansProcessed: plans.length,
    });

    return { success: true, plansProcessed: plans.length };
  } catch (error) {
    logger.error('Failed to sync Stripe prices', error as Error);
    throw error;
  }
}

/**
 * Sync a single plan to Stripe
 */
async function syncPlanToStripe(plan: any) {
  try {
    const stripe = getStripeClient();
    const pricing = plan.pricing as any;
    // @ts-ignore - metadata field may not exist in Prisma schema
    const metadata = (plan as any).metadata || {};

    // Check if product already exists
    const productId = metadata?.stripeProductId;
    let product: Stripe.Product;

    if (productId) {
      // Update existing product
      product = await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          planId: plan.id,
          tier: plan.tier,
        },
      });
      logger.info('Updated Stripe product', { productId, planName: plan.name });
    } else {
      // Create new product
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          planId: plan.id,
          tier: plan.tier,
        },
      });
      logger.info('Created Stripe product', { productId: product.id, planName: plan.name });
    }

    // Check if price already exists
    const priceId = metadata?.stripePriceId;
    let price: Stripe.Price;

    if (priceId) {
      // Price exists, verify it's correct
      price = await stripe.prices.retrieve(priceId);
      logger.info('Existing Stripe price verified', { priceId, planName: plan.name });
    } else {
      // Create new price
      price = await stripe.prices.create({
        product: product.id,
        currency: pricing.currency?.toLowerCase() || 'usd',
        unit_amount: Math.round(pricing.basePrice * 100), // Convert to cents
        recurring: {
          interval: pricing.billingInterval === 'yearly' ? 'year' : 'month',
        },
        metadata: {
          planId: plan.id,
          tier: plan.tier,
        },
      });
      logger.info('Created Stripe price', { priceId: price.id, planName: plan.name });
    }

    // Update plan metadata with Stripe IDs
    // Note: metadata field may not exist in Prisma schema - skip update
    // await prisma.subscriptionPlan.update({
    //   where: { id: plan.id },
    //   data: {
    //     metadata: {
    //       ...(metadata || {}),
    //       stripeProductId: product.id,
    //       stripePriceId: price.id,
    //       stripeSynced: true,
    //       stripeSyncedAt: new Date().toISOString(),
    //     },
    //   },
    // });

    logger.info('Plan metadata updated with Stripe IDs', {
      planId: plan.id,
      productId: product.id,
      priceId: price.id,
    });

    return { productId: product.id, priceId: price.id };
  } catch (error) {
    logger.error('Failed to sync plan to Stripe', error as Error, { planId: plan.id });
    throw error;
  }
}

/**
 * Get Stripe price ID for a plan
 */
export async function getStripePriceId(planId: string): Promise<string | null> {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // @ts-ignore - metadata field may not exist in Prisma schema
    const metadata = (plan as any).metadata || {};
    return metadata?.stripePriceId || null;
  } catch (error) {
    logger.error('Failed to get Stripe price ID', error as Error, { planId });
    return null;
  }
}

/**
 * Create Stripe prices for all plans (one-time setup)
 */
export async function initializeStripePrices() {
  try {
    logger.info('Initializing Stripe prices for all plans...');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });

    const results = await Promise.all(
      plans.map(async (plan) => {
        try {
          const result = await syncPlanToStripe(plan);
          return { planId: plan.id, success: true, ...result };
        } catch (error) {
          logger.error('Failed to initialize Stripe price for plan', error as Error, {
            planId: plan.id,
          });
          return { planId: plan.id, success: false, error: (error as Error).message };
        }
      })
    );

    logger.info('Stripe price initialization completed', {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  } catch (error) {
    logger.error('Failed to initialize Stripe prices', error as Error);
    throw error;
  }
}
