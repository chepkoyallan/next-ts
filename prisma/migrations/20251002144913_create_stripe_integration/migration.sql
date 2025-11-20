/*
  Warnings:

  - A unique constraint covering the columns `[stripe_customer_id]` on the table `billing_accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_invoice_id]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_subscription_id]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."billing_accounts" ADD COLUMN     "stripe_customer_id" TEXT;

-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN     "stripe_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "public"."subscriptions" ADD COLUMN     "stripe_subscription_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripe_customer_id_key" ON "public"."billing_accounts"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripe_invoice_id_key" ON "public"."invoices"("stripe_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "public"."subscriptions"("stripe_subscription_id");
