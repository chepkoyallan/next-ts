/*
  Warnings:

  - You are about to drop the column `target_type` on the `form_assignments` table. All the data in the column will be lost.
  - Added the required column `targetType` to the `form_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."form_assignments" DROP COLUMN "target_type",
ADD COLUMN     "targetType" TEXT NOT NULL,
ALTER COLUMN "target_project" DROP DEFAULT,
ALTER COLUMN "target_domain" DROP DEFAULT,
ALTER COLUMN "target_name" DROP DEFAULT,
ALTER COLUMN "target_version" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."form_submissions" ADD COLUMN     "completion_time" INTEGER,
ADD COLUMN     "schema_id" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'success',
ADD COLUMN     "task_id" TEXT;

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auto_save" BOOLEAN NOT NULL DEFAULT true,
    "auto_save_interval" INTEGER NOT NULL DEFAULT 30,
    "default_view" TEXT NOT NULL DEFAULT 'grid',
    "items_per_page" INTEGER NOT NULL DEFAULT 20,
    "themeMode" TEXT NOT NULL DEFAULT 'auto',
    "primary_color" TEXT NOT NULL DEFAULT '#1976d2',
    "compact_mode" BOOLEAN NOT NULL DEFAULT false,
    "animations" BOOLEAN NOT NULL DEFAULT true,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT false,
    "notify_schema_created" BOOLEAN NOT NULL DEFAULT true,
    "notify_assignment" BOOLEAN NOT NULL DEFAULT true,
    "notify_submission" BOOLEAN NOT NULL DEFAULT false,
    "session_timeout" INTEGER NOT NULL DEFAULT 30,
    "require_password_change" BOOLEAN NOT NULL DEFAULT false,
    "editor_theme" TEXT NOT NULL DEFAULT 'vs-dark',
    "font_size" INTEGER NOT NULL DEFAULT 14,
    "tab_size" INTEGER NOT NULL DEFAULT 2,
    "auto_complete" BOOLEAN NOT NULL DEFAULT true,
    "format_on_save" BOOLEAN NOT NULL DEFAULT true,
    "debug_mode" BOOLEAN NOT NULL DEFAULT false,
    "cache_enabled" BOOLEAN NOT NULL DEFAULT true,
    "experimental_features" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "public"."user_settings"("user_id");

-- CreateIndex
CREATE INDEX "form_assignments_targetType_idx" ON "public"."form_assignments"("targetType");

-- CreateIndex
CREATE INDEX "form_submissions_status_idx" ON "public"."form_submissions"("status");

-- CreateIndex
CREATE INDEX "form_submissions_schema_id_idx" ON "public"."form_submissions"("schema_id");

-- RenameIndex
ALTER INDEX "public"."form_assignments_target_project_target_domain_target_name_targe" RENAME TO "form_assignments_target_project_target_domain_target_name_t_key";
