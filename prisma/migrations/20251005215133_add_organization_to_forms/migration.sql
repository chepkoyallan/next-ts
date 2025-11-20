-- AlterTable FormSchema - Add nullable organizationId
ALTER TABLE "form_schemas" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS "form_schemas_organization_id_idx" ON "form_schemas"("organization_id");

-- Add foreign key constraint (nullable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_schemas_organization_id_fkey') THEN
        ALTER TABLE "form_schemas" DROP CONSTRAINT "form_schemas_organization_id_fkey";
    END IF;
END $$;

ALTER TABLE "form_schemas" ADD CONSTRAINT "form_schemas_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable FormAssignment - Add nullable organizationId
ALTER TABLE "form_assignments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS "form_assignments_organization_id_idx" ON "form_assignments"("organization_id");

-- Add foreign key constraint (nullable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_assignments_organization_id_fkey') THEN
        ALTER TABLE "form_assignments" DROP CONSTRAINT "form_assignments_organization_id_fkey";
    END IF;
END $$;

ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable FormSubmission - Add nullable organizationId
ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS "form_submissions_organization_id_idx" ON "form_submissions"("organization_id");

-- Add foreign key constraint (nullable)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'form_submissions_organization_id_fkey') THEN
        ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_organization_id_fkey";
    END IF;
END $$;

ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
