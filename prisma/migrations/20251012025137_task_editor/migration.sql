-- AlterTable
ALTER TABLE "public"."connector_configs" ADD COLUMN     "category" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "public"."task_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'development',
    "input_schema_id" TEXT NOT NULL,
    "output_schema_id" TEXT NOT NULL,
    "generated_input_model" TEXT NOT NULL,
    "generated_output_model" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "base_image" TEXT NOT NULL DEFAULT 'minimal-python',
    "extra_dependencies" JSONB NOT NULL DEFAULT '[]',
    "is_valid" BOOLEAN NOT NULL DEFAULT false,
    "validation_errors" JSONB,
    "last_validated" TIMESTAMP(3),
    "flyte_task_id" TEXT,
    "registered_at" TIMESTAMP(3),
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_definitions_flyte_task_id_key" ON "public"."task_definitions"("flyte_task_id");

-- CreateIndex
CREATE INDEX "task_definitions_organization_id_idx" ON "public"."task_definitions"("organization_id");

-- CreateIndex
CREATE INDEX "task_definitions_project_id_idx" ON "public"."task_definitions"("project_id");

-- CreateIndex
CREATE INDEX "task_definitions_input_schema_id_idx" ON "public"."task_definitions"("input_schema_id");

-- CreateIndex
CREATE INDEX "task_definitions_output_schema_id_idx" ON "public"."task_definitions"("output_schema_id");

-- CreateIndex
CREATE INDEX "task_definitions_is_valid_idx" ON "public"."task_definitions"("is_valid");

-- CreateIndex
CREATE INDEX "task_definitions_created_by_idx" ON "public"."task_definitions"("created_by");

-- CreateIndex
CREATE INDEX "task_definitions_flyte_task_id_idx" ON "public"."task_definitions"("flyte_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_definitions_organization_id_project_id_domain_name_ver_key" ON "public"."task_definitions"("organization_id", "project_id", "domain", "name", "version");

-- CreateIndex
CREATE INDEX "connector_configs_category_idx" ON "public"."connector_configs"("category");

-- AddForeignKey
ALTER TABLE "public"."task_definitions" ADD CONSTRAINT "task_definitions_input_schema_id_fkey" FOREIGN KEY ("input_schema_id") REFERENCES "public"."form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_definitions" ADD CONSTRAINT "task_definitions_output_schema_id_fkey" FOREIGN KEY ("output_schema_id") REFERENCES "public"."form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
