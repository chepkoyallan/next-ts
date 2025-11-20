/*
  Warnings:

  - A unique constraint covering the columns `[name,project,domain,version,organization_id]` on the table `workflow_drafts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."FeatureFlagType" AS ENUM ('BOOLEAN', 'PERCENTAGE', 'WHITELIST', 'DATE_RANGE', 'ENVIRONMENT');

-- CreateEnum
CREATE TYPE "public"."FeatureFlagScope" AS ENUM ('USER', 'ORGANIZATION', 'ROLE', 'GLOBAL');

-- DropForeignKey
ALTER TABLE "public"."workflow_drafts" DROP CONSTRAINT "workflow_drafts_organization_id_fkey";

-- DropIndex
DROP INDEX "public"."workflow_drafts_name_project_domain_version_key";

-- CreateTable
CREATE TABLE "public"."feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."FeatureFlagType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percentage" INTEGER DEFAULT 0,
    "enabled_from" TIMESTAMP(3),
    "enabled_until" TIMESTAMP(3),
    "environments" JSONB,
    "category" TEXT,
    "tags" JSONB,
    "depends_on" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flag_overrides" (
    "id" TEXT NOT NULL,
    "flag_id" TEXT NOT NULL,
    "scope" "public"."FeatureFlagScope" NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT,
    "role_id" TEXT,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."feature_flag_audit_logs" (
    "id" TEXT NOT NULL,
    "flag_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "user_id" TEXT,
    "organization_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flag_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "public"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_key_idx" ON "public"."feature_flags"("key");

-- CreateIndex
CREATE INDEX "feature_flags_category_idx" ON "public"."feature_flags"("category");

-- CreateIndex
CREATE INDEX "feature_flags_enabled_idx" ON "public"."feature_flags"("enabled");

-- CreateIndex
CREATE INDEX "feature_flag_overrides_flag_id_idx" ON "public"."feature_flag_overrides"("flag_id");

-- CreateIndex
CREATE INDEX "feature_flag_overrides_user_id_idx" ON "public"."feature_flag_overrides"("user_id");

-- CreateIndex
CREATE INDEX "feature_flag_overrides_organization_id_idx" ON "public"."feature_flag_overrides"("organization_id");

-- CreateIndex
CREATE INDEX "feature_flag_overrides_scope_idx" ON "public"."feature_flag_overrides"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flag_overrides_flag_id_scope_user_id_organization_i_key" ON "public"."feature_flag_overrides"("flag_id", "scope", "user_id", "organization_id", "role_id");

-- CreateIndex
CREATE INDEX "feature_flag_audit_logs_flag_id_idx" ON "public"."feature_flag_audit_logs"("flag_id");

-- CreateIndex
CREATE INDEX "feature_flag_audit_logs_action_idx" ON "public"."feature_flag_audit_logs"("action");

-- CreateIndex
CREATE INDEX "feature_flag_audit_logs_user_id_idx" ON "public"."feature_flag_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "feature_flag_audit_logs_created_at_idx" ON "public"."feature_flag_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_drafts_name_project_domain_version_organization_id_key" ON "public"."workflow_drafts"("name", "project", "domain", "version", "organization_id");

-- AddForeignKey
ALTER TABLE "public"."feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."feature_flag_audit_logs" ADD CONSTRAINT "feature_flag_audit_logs_flag_id_fkey" FOREIGN KEY ("flag_id") REFERENCES "public"."feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
