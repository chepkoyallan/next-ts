-- CreateTable
CREATE TABLE "form_schemas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "schema" JSONB NOT NULL,
    "uischema" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'general',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "assignment_count" INTEGER NOT NULL DEFAULT 0,
    "last_used" TIMESTAMP(3),
    "popularity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "form_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_assignments" (
    "id" TEXT NOT NULL,
    "schema_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "assignment_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "configuration" JSONB,
    "name" TEXT,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "is_valid" BOOLEAN NOT NULL,
    "errors" JSONB NOT NULL,
    "submitted_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_schemas_category_idx" ON "form_schemas"("category");

-- CreateIndex
CREATE INDEX "form_schemas_created_by_idx" ON "form_schemas"("created_by");

-- CreateIndex
CREATE INDEX "form_schemas_created_at_idx" ON "form_schemas"("created_at");

-- CreateIndex
CREATE INDEX "form_assignments_schema_id_idx" ON "form_assignments"("schema_id");

-- CreateIndex
CREATE INDEX "form_assignments_target_type_target_id_idx" ON "form_assignments"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "form_assignments_status_idx" ON "form_assignments"("status");

-- CreateIndex
CREATE INDEX "form_submissions_assignment_id_idx" ON "form_submissions"("assignment_id");

-- CreateIndex
CREATE INDEX "form_submissions_is_valid_idx" ON "form_submissions"("is_valid");

-- CreateIndex
CREATE INDEX "form_submissions_submitted_by_idx" ON "form_submissions"("submitted_by");

-- CreateIndex
CREATE INDEX "form_submissions_created_at_idx" ON "form_submissions"("created_at");

-- AddForeignKey
ALTER TABLE "form_assignments" ADD CONSTRAINT "form_assignments_schema_id_fkey" FOREIGN KEY ("schema_id") REFERENCES "form_schemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "form_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;