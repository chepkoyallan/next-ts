-- Add workflow_inputs and workflow_outputs to workflow_drafts table
-- Add size_bytes to bmaas_buckets table
-- These columns were already applied via prisma db push

ALTER TABLE "workflow_drafts" ADD COLUMN IF NOT EXISTS "workflow_inputs" JSONB;
ALTER TABLE "workflow_drafts" ADD COLUMN IF NOT EXISTS "workflow_outputs" JSONB;
ALTER TABLE "bmaas_buckets" ADD COLUMN IF NOT EXISTS "size_bytes" BIGINT NOT NULL DEFAULT 0;
