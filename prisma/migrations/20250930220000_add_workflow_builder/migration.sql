-- AlterTable: Update FormAssignment to support task identification
ALTER TABLE "form_assignments"
  DROP COLUMN IF EXISTS "target_id",
  ADD COLUMN IF NOT EXISTS "target_project" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "target_domain" TEXT NOT NULL DEFAULT 'development',
  ADD COLUMN IF NOT EXISTS "target_name" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "target_version" TEXT NOT NULL DEFAULT '1.0.0';

-- Drop old index
DROP INDEX IF EXISTS "form_assignments_target_type_target_id_idx";

-- Create new unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "form_assignments_target_project_target_domain_target_name_target_version_assignment_type_key" ON "form_assignments"("target_project", "target_domain", "target_name", "target_version", "assignment_type");

-- CreateTable: WorkflowDraft
CREATE TABLE IF NOT EXISTS "workflow_drafts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "project" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deployed_at" TIMESTAMP(3),
    "deployed_by" TEXT,
    "workflow_id" TEXT,

    CONSTRAINT "workflow_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ConnectorConfig
CREATE TABLE IF NOT EXISTS "connector_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "authentication" JSONB,
    "schema" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_health_check" TIMESTAMP(3),
    "health_status" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connector_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: WorkflowDraft indexes
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_drafts_name_project_domain_version_key" ON "workflow_drafts"("name", "project", "domain", "version");
CREATE INDEX IF NOT EXISTS "workflow_drafts_status_idx" ON "workflow_drafts"("status");
CREATE INDEX IF NOT EXISTS "workflow_drafts_created_by_idx" ON "workflow_drafts"("created_by");
CREATE INDEX IF NOT EXISTS "workflow_drafts_created_at_idx" ON "workflow_drafts"("created_at");

-- CreateIndex: ConnectorConfig indexes
CREATE INDEX IF NOT EXISTS "connector_configs_type_idx" ON "connector_configs"("type");
CREATE INDEX IF NOT EXISTS "connector_configs_status_idx" ON "connector_configs"("status");
CREATE INDEX IF NOT EXISTS "connector_configs_created_by_idx" ON "connector_configs"("created_by");