-- CreateEnum
CREATE TYPE "public"."task_registration_status" AS ENUM ('NOT_REGISTERED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."task_definitions" ADD COLUMN     "registration_error" TEXT,
ADD COLUMN     "registration_status" "public"."task_registration_status" NOT NULL DEFAULT 'NOT_REGISTERED';

-- CreateIndex
CREATE INDEX "task_definitions_registration_status_idx" ON "public"."task_definitions"("registration_status");
