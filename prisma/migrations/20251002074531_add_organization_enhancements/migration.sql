-- CreateEnum
CREATE TYPE "public"."organization_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "public"."organization_members" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."organizations" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "size" TEXT,
ADD COLUMN     "status" "public"."organization_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "public"."organization_invitations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."organization_role" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "message" TEXT,
    "status" "public"."invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "public"."organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_email_idx" ON "public"."organization_invitations"("email");

-- CreateIndex
CREATE INDEX "organization_invitations_token_idx" ON "public"."organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_status_idx" ON "public"."organization_invitations"("status");

-- CreateIndex
CREATE INDEX "organization_invitations_expires_at_idx" ON "public"."organization_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "public"."organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_is_active_idx" ON "public"."organization_members"("is_active");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "public"."organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "public"."organizations"("owner_id");

-- CreateIndex
CREATE INDEX "organizations_created_at_idx" ON "public"."organizations"("created_at");

-- AddForeignKey
ALTER TABLE "public"."organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
