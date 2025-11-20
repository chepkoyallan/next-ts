-- Schema v2.0 Migration: Modular User Model
-- This migration safely transforms the monolithic User model into modular tables
-- and backfills existing data without data loss

-- ============================================================================
-- STEP 1: Create new tables (safe - no data loss)
-- ============================================================================

-- User Profile table
CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "photo_url" TEXT,
    "phone_number" TEXT,
    "country" TEXT,
    "address" TEXT,
    "state" TEXT,
    "city" TEXT,
    "zip_code" TEXT,
    "about" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "website" TEXT,
    "company" TEXT,
    "location" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- User Security table
CREATE TABLE IF NOT EXISTS "user_security" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "password_changed_at" TIMESTAMP(3),
    "require_password_change" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "account_locked_until" TIMESTAMP(3),
    "last_failed_login_attempt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_security_pkey" PRIMARY KEY ("id")
);

-- Two Factor Backup Codes
CREATE TABLE IF NOT EXISTS "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "user_security_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(3),
    "used_from_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- User Sessions
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "device_info" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- Email Verification
CREATE TABLE IF NOT EXISTS "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "verified_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_security_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- User Social Links
CREATE TABLE IF NOT EXISTS "user_social_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_social_links_pkey" PRIMARY KEY ("id")
);

-- User Notification Settings
CREATE TABLE IF NOT EXISTS "user_notification_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_digest" BOOLEAN NOT NULL DEFAULT true,
    "email_digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "product_updates" BOOLEAN NOT NULL DEFAULT true,
    "security_alerts" BOOLEAN NOT NULL DEFAULT true,
    "billing_alerts" BOOLEAN NOT NULL DEFAULT true,
    "workflow_notifications" BOOLEAN NOT NULL DEFAULT true,
    "marketplace_updates" BOOLEAN NOT NULL DEFAULT false,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "desktop_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mobile_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "quiet_hours_timezone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_settings_pkey" PRIMARY KEY ("id")
);

-- Trusted Devices
CREATE TABLE IF NOT EXISTS "trusted_devices" (
    "id" TEXT NOT NULL,
    "user_security_id" TEXT NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "device_name" TEXT,
    "user_agent" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "is_trusted" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- Security Audit Logs
CREATE TABLE IF NOT EXISTS "security_audit_logs" (
    "id" TEXT NOT NULL,
    "user_security_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- STEP 2: Migrate existing user data to new tables
-- ============================================================================

-- Migrate user profile data
INSERT INTO "user_profiles" (
    "id", "user_id", "photo_url", "phone_number", "country", "address",
    "state", "city", "zip_code", "about", "is_public", "timezone",
    "created_at", "updated_at"
)
SELECT
    gen_random_uuid(), -- Generate new UUID for profile
    "id" as "user_id",
    "photo_url",
    "phone_number",
    "country",
    "address",
    "state",
    "city",
    "zip_code",
    "about",
    COALESCE("is_public", false),
    COALESCE("timezone", 'UTC'),
    "created_at",
    "updated_at"
FROM "users"
WHERE "deleted_at" IS NULL
ON CONFLICT DO NOTHING;

-- Migrate user security data (including 2FA)
INSERT INTO "user_security" (
    "id", "user_id", "two_factor_enabled", "two_factor_secret",
    "failed_login_attempts", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    "id" as "user_id",
    COALESCE("two_factor_enabled", false),
    "two_factor_secret",
    0, -- Reset failed attempts
    "created_at",
    "updated_at"
FROM "users"
WHERE "deleted_at" IS NULL
ON CONFLICT DO NOTHING;

-- Migrate 2FA backup codes (if stored as JSON)
-- Note: This extracts JSON array of backup codes and creates individual records
INSERT INTO "two_factor_backup_codes" (
    "id", "user_security_id", "code", "is_used", "created_at"
)
SELECT
    gen_random_uuid(),
    us."id" as "user_security_id",
    jsonb_array_elements_text(u."two_factor_backup_codes") as "code",
    false,
    u."created_at"
FROM "users" u
INNER JOIN "user_security" us ON us."user_id" = u."id"
WHERE u."two_factor_backup_codes" IS NOT NULL
  AND u."two_factor_backup_codes" != 'null'::jsonb
  AND jsonb_typeof(u."two_factor_backup_codes") = 'array'
  AND u."deleted_at" IS NULL
ON CONFLICT DO NOTHING;

-- Migrate notification preferences
INSERT INTO "user_notification_settings" (
    "id", "user_id", "email_enabled", "product_updates",
    "security_alerts", "billing_alerts", "workflow_notifications",
    "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    "id" as "user_id",
    true, -- Default to enabled
    true,
    true,
    true,
    true,
    "created_at",
    "updated_at"
FROM "users"
WHERE "deleted_at" IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: Backfill required foreign keys
-- ============================================================================

-- Find or create a system user for orphaned records
DO $$
DECLARE
    system_user_id TEXT;
BEGIN
    -- Try to find first admin user
    SELECT id INTO system_user_id
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE r.name IN ('admin', 'super-admin')
    LIMIT 1;

    -- If no admin, use first user
    IF system_user_id IS NULL THEN
        SELECT id INTO system_user_id FROM users ORDER BY created_at LIMIT 1;
    END IF;

    -- Backfill NULL owner_id in organizations
    UPDATE organizations
    SET owner_id = system_user_id
    WHERE owner_id IS NULL;

    -- Backfill NULL created_by in projects
    UPDATE projects
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in workflows
    UPDATE workflows
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in tasks
    UPDATE tasks
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in launch_plans
    UPDATE launch_plans
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in workflow_executions
    UPDATE workflow_executions
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in workflow_drafts
    UPDATE workflow_drafts
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in bmaas tables
    UPDATE bmaas_instances
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    UPDATE bmaas_volumes
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    UPDATE bmaas_networks
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    UPDATE bmaas_buckets
    SET created_by = system_user_id
    WHERE created_by IS NULL;

    -- Backfill NULL created_by in connector_configs
    UPDATE connector_configs
    SET created_by = system_user_id
    WHERE created_by IS NULL;
END $$;

-- ============================================================================
-- STEP 4: Add unique constraints
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_user_id_key" ON "user_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_security_user_id_key" ON "user_security"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_notification_settings_user_id_key" ON "user_notification_settings"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_backup_codes_code_key" ON "two_factor_backup_codes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_key" ON "user_sessions"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");
CREATE UNIQUE INDEX IF NOT EXISTS "email_verifications_token_key" ON "email_verifications"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_key" ON "password_reset_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_user_security_id_key" ON "password_reset_tokens"("user_security_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_social_links_user_id_platform_key" ON "user_social_links"("user_id", "platform");

-- ============================================================================
-- STEP 5: Add regular indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS "user_profiles_user_id_idx" ON "user_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "user_security_user_id_idx" ON "user_security"("user_id");
CREATE INDEX IF NOT EXISTS "user_security_account_locked_until_idx" ON "user_security"("account_locked_until");
CREATE INDEX IF NOT EXISTS "two_factor_backup_codes_user_security_id_idx" ON "two_factor_backup_codes"("user_security_id");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_is_active_idx" ON "user_sessions"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
CREATE INDEX IF NOT EXISTS "email_verifications_user_id_idx" ON "email_verifications"("user_id");
CREATE INDEX IF NOT EXISTS "trusted_devices_user_security_id_idx" ON "trusted_devices"("user_security_id");
CREATE INDEX IF NOT EXISTS "security_audit_logs_user_security_id_idx" ON "security_audit_logs"("user_security_id");
CREATE INDEX IF NOT EXISTS "user_social_links_user_id_idx" ON "user_social_links"("user_id");

-- ============================================================================
-- STEP 6: Add foreign key constraints
-- ============================================================================

-- User Profile
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User Security
ALTER TABLE "user_security" ADD CONSTRAINT "user_security_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backup Codes
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_security_id_fkey"
    FOREIGN KEY ("user_security_id") REFERENCES "user_security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User Sessions
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Email Verifications
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Password Reset Tokens
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_security_id_fkey"
    FOREIGN KEY ("user_security_id") REFERENCES "user_security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Social Links
ALTER TABLE "user_social_links" ADD CONSTRAINT "user_social_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification Settings
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trusted Devices
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_security_id_fkey"
    FOREIGN KEY ("user_security_id") REFERENCES "user_security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security Audit Logs
ALTER TABLE "security_audit_logs" ADD CONSTRAINT "security_audit_logs_user_security_id_fkey"
    FOREIGN KEY ("user_security_id") REFERENCES "user_security"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- STEP 7: Make foreign keys required (now that data is backfilled)
-- ============================================================================

-- Organizations
ALTER TABLE "organizations" ALTER COLUMN "owner_id" SET NOT NULL;

-- Projects
ALTER TABLE "projects" ALTER COLUMN "created_by" SET NOT NULL;

-- Add foreign key constraints for creator fields
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- STEP 8: Drop old columns from users table (data already migrated)
-- ============================================================================

ALTER TABLE "users" DROP COLUMN IF EXISTS "photo_url";
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number";
ALTER TABLE "users" DROP COLUMN IF EXISTS "country";
ALTER TABLE "users" DROP COLUMN IF EXISTS "address";
ALTER TABLE "users" DROP COLUMN IF EXISTS "state";
ALTER TABLE "users" DROP COLUMN IF EXISTS "city";
ALTER TABLE "users" DROP COLUMN IF EXISTS "zip_code";
ALTER TABLE "users" DROP COLUMN IF EXISTS "about";
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_public";
ALTER TABLE "users" DROP COLUMN IF EXISTS "social_links";
ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_preferences";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_enabled";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_secret";
ALTER TABLE "users" DROP COLUMN IF EXISTS "two_factor_backup_codes";
ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone";

-- ============================================================================
-- DONE! Schema v2.0 migration complete
-- ============================================================================
