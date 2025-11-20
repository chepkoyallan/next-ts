/*
  Warnings:

  - A unique constraint covering the columns `[flyte_launch_plan_id]` on the table `launch_plans` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[flyte_project_id]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[flyte_workflow_id]` on the table `workflows` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `flyte_launch_plan_id` to the `launch_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `launch_plans` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flyte_execution_id` to the `workflow_executions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `workflow_executions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `flyte_workflow_id` to the `workflows` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `workflows` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."launch_plans" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "flyte_launch_plan_id" TEXT NOT NULL,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."projects" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "flyte_domains" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "flyte_org_prefix" TEXT,
ADD COLUMN     "flyte_project_id" TEXT,
ADD COLUMN     "flyte_state" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."workflow_executions" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "flyte_execution_id" TEXT NOT NULL,
ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."workflows" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "flyte_workflow_id" TEXT NOT NULL,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "spec" JSONB NOT NULL,
    "flyte_task_id" TEXT NOT NULL,
    "created_by" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_flyte_task_id_key" ON "public"."tasks"("flyte_task_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_idx" ON "public"."tasks"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_created_by_idx" ON "public"."tasks"("created_by");

-- CreateIndex
CREATE INDEX "tasks_is_deleted_idx" ON "public"."tasks"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_project_id_domain_name_version_key" ON "public"."tasks"("project_id", "domain", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "launch_plans_flyte_launch_plan_id_key" ON "public"."launch_plans"("flyte_launch_plan_id");

-- CreateIndex
CREATE INDEX "launch_plans_organization_id_idx" ON "public"."launch_plans"("organization_id");

-- CreateIndex
CREATE INDEX "launch_plans_created_by_idx" ON "public"."launch_plans"("created_by");

-- CreateIndex
CREATE INDEX "launch_plans_is_deleted_idx" ON "public"."launch_plans"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "projects_flyte_project_id_key" ON "public"."projects"("flyte_project_id");

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "public"."projects"("organization_id");

-- CreateIndex
CREATE INDEX "projects_created_by_idx" ON "public"."projects"("created_by");

-- CreateIndex
CREATE INDEX "projects_flyte_org_prefix_idx" ON "public"."projects"("flyte_org_prefix");

-- CreateIndex
CREATE INDEX "projects_is_archived_idx" ON "public"."projects"("is_archived");

-- CreateIndex
CREATE INDEX "workflow_executions_organization_id_idx" ON "public"."workflow_executions"("organization_id");

-- CreateIndex
CREATE INDEX "workflow_executions_created_by_idx" ON "public"."workflow_executions"("created_by");

-- CreateIndex
CREATE INDEX "workflow_executions_phase_idx" ON "public"."workflow_executions"("phase");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_flyte_workflow_id_key" ON "public"."workflows"("flyte_workflow_id");

-- CreateIndex
CREATE INDEX "workflows_organization_id_idx" ON "public"."workflows"("organization_id");

-- CreateIndex
CREATE INDEX "workflows_created_by_idx" ON "public"."workflows"("created_by");

-- CreateIndex
CREATE INDEX "workflows_is_deleted_idx" ON "public"."workflows"("is_deleted");
