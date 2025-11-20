-- AlterTable: Add activity tracking columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_ip" TEXT;

-- AlterTable: Remove deprecated avatar column
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar";
