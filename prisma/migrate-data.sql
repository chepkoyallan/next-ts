-- Migrate existing user data to new normalized tables

-- ============================================================================
-- STEP 1: Migrate user profile data
-- ============================================================================

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
ON CONFLICT (user_id) DO UPDATE SET
    photo_url = EXCLUDED.photo_url,
    phone_number = EXCLUDED.phone_number,
    country = EXCLUDED.country,
    address = EXCLUDED.address,
    state = EXCLUDED.state,
    city = EXCLUDED.city,
    zip_code = EXCLUDED.zip_code,
    about = EXCLUDED.about,
    is_public = EXCLUDED.is_public,
    timezone = EXCLUDED.timezone,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 2: Migrate user security data (including 2FA)
-- ============================================================================

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
ON CONFLICT (user_id) DO UPDATE SET
    two_factor_enabled = EXCLUDED.two_factor_enabled,
    two_factor_secret = EXCLUDED.two_factor_secret,
    updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- STEP 3: Migrate 2FA backup codes (if stored as JSON)
-- ============================================================================

-- Extract JSON array of backup codes and create individual records
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
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- STEP 4: Migrate notification preferences
-- ============================================================================

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
ON CONFLICT (user_id) DO NOTHING;
