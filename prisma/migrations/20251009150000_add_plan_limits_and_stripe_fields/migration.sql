-- Add new fields to subscription_plans table
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "trial_days" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Add unique constraint for stripe_price_id
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_stripe_price_id_key" ON "subscription_plans"("stripe_price_id");

-- Add new plan tiers
ALTER TYPE "plan_tier" ADD VALUE IF NOT EXISTS 'BASIC';
ALTER TYPE "plan_tier" ADD VALUE IF NOT EXISTS 'PREMIUM';

-- Add new usage metrics
ALTER TYPE "usage_metric" ADD VALUE IF NOT EXISTS 'FORMS';
ALTER TYPE "usage_metric" ADD VALUE IF NOT EXISTS 'FORM_SUBMISSIONS';
ALTER TYPE "usage_metric" ADD VALUE IF NOT EXISTS 'CONNECTORS';
ALTER TYPE "usage_metric" ADD VALUE IF NOT EXISTS 'CONNECTOR_CALLS';
ALTER TYPE "usage_metric" ADD VALUE IF NOT EXISTS 'WORKFLOWS';
