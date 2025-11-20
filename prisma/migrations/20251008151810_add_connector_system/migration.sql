/*
  Warnings:

  - Added the required column `organization_id` to the `connector_configs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."connector_configs" ADD COLUMN     "average_response_time" DOUBLE PRECISION,
ADD COLUMN     "caching" JSONB,
ADD COLUMN     "data_mapping" JSONB,
ADD COLUMN     "failed_executions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "health_check_config" JSONB,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "rate_limit" JSONB,
ADD COLUMN     "successful_executions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_executions" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."connector_audit_logs" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "query_params" JSONB,
    "result" JSONB,
    "changes" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_audit_logs_connector_id_idx" ON "public"."connector_audit_logs"("connector_id");

-- CreateIndex
CREATE INDEX "connector_audit_logs_user_id_idx" ON "public"."connector_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "connector_audit_logs_organization_id_idx" ON "public"."connector_audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "connector_audit_logs_action_idx" ON "public"."connector_audit_logs"("action");

-- CreateIndex
CREATE INDEX "connector_audit_logs_timestamp_idx" ON "public"."connector_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "connector_configs_organization_id_idx" ON "public"."connector_configs"("organization_id");

-- CreateIndex
CREATE INDEX "connector_configs_health_status_idx" ON "public"."connector_configs"("health_status");

-- AddForeignKey
ALTER TABLE "public"."connector_configs" ADD CONSTRAINT "connector_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."connector_audit_logs" ADD CONSTRAINT "connector_audit_logs_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "public"."connector_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
