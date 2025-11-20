-- Create default profile and security records for all existing users

-- ============================================================================
-- STEP 1: Create default user profiles for all users without one
-- ============================================================================

INSERT INTO "user_profiles" (
    "id", "user_id", "is_public", "timezone", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    u."id",
    false,
    'UTC',
    u."created_at",
    u."updated_at"
FROM "users" u
LEFT JOIN "user_profiles" up ON up."user_id" = u."id"
WHERE up."id" IS NULL AND u."deleted_at" IS NULL;

-- ============================================================================
-- STEP 2: Create default user security records for all users without one
-- ============================================================================

INSERT INTO "user_security" (
    "id", "user_id", "two_factor_enabled", "failed_login_attempts",
    "require_password_change", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    u."id",
    false,
    0,
    false,
    u."created_at",
    u."updated_at"
FROM "users" u
LEFT JOIN "user_security" us ON us."user_id" = u."id"
WHERE us."id" IS NULL AND u."deleted_at" IS NULL;

-- ============================================================================
-- STEP 3: Create default notification settings for all users without one
-- ============================================================================

INSERT INTO "user_notification_settings" (
    "id", "user_id", "email_enabled", "email_digest", "email_digest_frequency",
    "product_updates", "security_alerts", "billing_alerts",
    "workflow_notifications", "marketplace_updates",
    "in_app_enabled", "desktop_enabled", "mobile_enabled",
    "quiet_hours_enabled", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(),
    u."id",
    true,
    true,
    'daily',
    true,
    true,
    true,
    true,
    false,
    true,
    false,
    false,
    false,
    u."created_at",
    u."updated_at"
FROM "users" u
LEFT JOIN "user_notification_settings" uns ON uns."user_id" = u."id"
WHERE uns."id" IS NULL AND u."deleted_at" IS NULL;
