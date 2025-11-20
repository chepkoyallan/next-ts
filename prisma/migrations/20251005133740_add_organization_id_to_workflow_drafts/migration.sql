-- AlterTable: Add organizationId to workflow_drafts (nullable for backwards compatibility)

-- Add the column as nullable
ALTER TABLE "workflow_drafts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Create index on organizationId for performance
CREATE INDEX IF NOT EXISTS "workflow_drafts_organization_id_idx" ON "workflow_drafts"("organization_id");

-- Add foreign key constraint (nullable) - drop first if exists to avoid errors
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workflow_drafts_organization_id_fkey'
    ) THEN
        ALTER TABLE "workflow_drafts" DROP CONSTRAINT "workflow_drafts_organization_id_fkey";
    END IF;
END $$;

ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
