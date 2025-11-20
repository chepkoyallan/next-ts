-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."usage_metric" ADD VALUE 'FORM_FIELDS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'FORM_ASSIGNMENTS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'WORKFLOW_DRAFTS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'WORKFLOW_VERSIONS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'MARKETPLACE_LISTINGS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'WORKFLOW_PURCHASES';
ALTER TYPE "public"."usage_metric" ADD VALUE 'ALERTS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'ALERT_RULES';
ALTER TYPE "public"."usage_metric" ADD VALUE 'API_KEYS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'API_CALLS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'WEBHOOK_ENDPOINTS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'CUSTOM_ROLES';
ALTER TYPE "public"."usage_metric" ADD VALUE 'ORGANIZATIONS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'INVITATIONS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'COMMENTS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'TASKS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'LAUNCH_PLANS';
ALTER TYPE "public"."usage_metric" ADD VALUE 'SUPPORT_TICKETS';
