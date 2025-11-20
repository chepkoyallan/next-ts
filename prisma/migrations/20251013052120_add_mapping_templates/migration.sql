-- CreateEnum
CREATE TYPE "public"."mapping_template_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "public"."mapping_template_visibility" AS ENUM ('PUBLIC', 'ORGANIZATION', 'PRIVATE');

-- CreateTable
CREATE TABLE "public"."mapping_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "service" TEXT,
    "connector_type" TEXT NOT NULL,
    "root_path" TEXT,
    "mappings" JSONB NOT NULL,
    "value_field" TEXT,
    "display_field" TEXT,
    "search_fields" JSONB,
    "sample_data" JSONB,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."mapping_template_status" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "public"."mapping_template_visibility" NOT NULL DEFAULT 'PUBLIC',
    "organization_id" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "icon" TEXT,
    "logo_url" TEXT,
    "documentation" TEXT,
    "setup_instructions" JSONB,
    "is_system_template" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mapping_templates_provider_idx" ON "public"."mapping_templates"("provider");

-- CreateIndex
CREATE INDEX "mapping_templates_category_idx" ON "public"."mapping_templates"("category");

-- CreateIndex
CREATE INDEX "mapping_templates_connector_type_idx" ON "public"."mapping_templates"("connector_type");

-- CreateIndex
CREATE INDEX "mapping_templates_status_idx" ON "public"."mapping_templates"("status");

-- CreateIndex
CREATE INDEX "mapping_templates_visibility_idx" ON "public"."mapping_templates"("visibility");

-- CreateIndex
CREATE INDEX "mapping_templates_organization_id_idx" ON "public"."mapping_templates"("organization_id");

-- CreateIndex
CREATE INDEX "mapping_templates_is_system_template_idx" ON "public"."mapping_templates"("is_system_template");

-- CreateIndex
CREATE INDEX "mapping_templates_is_featured_idx" ON "public"."mapping_templates"("is_featured");

-- CreateIndex
CREATE INDEX "mapping_templates_usage_count_idx" ON "public"."mapping_templates"("usage_count");

-- CreateIndex
CREATE INDEX "mapping_templates_rating_idx" ON "public"."mapping_templates"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_templates_provider_service_connector_type_key" ON "public"."mapping_templates"("provider", "service", "connector_type");
