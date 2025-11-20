-- Migration: Add Activity Tracking and Remove Avatar
-- Run this SQL directly on your database through Prisma Accelerate dashboard or pgAdmin

-- Add activity tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(255);

-- Remove avatar column (already migrated to photoURL)
ALTER TABLE users DROP COLUMN IF EXISTS avatar;

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('last_login_at', 'last_login_ip', 'photo_url', 'avatar')
ORDER BY column_name;
