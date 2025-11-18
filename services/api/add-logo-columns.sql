-- Migration: Add logo and profile photo columns
-- Run this SQL against your database

-- Add logo columns to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_filename VARCHAR(255);

-- Add profile photo columns to users table if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS profile_photo_filename VARCHAR(255);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_logo_url ON clients(logo_url) WHERE logo_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_profile_photo_url ON users(profile_photo_url) WHERE profile_photo_url IS NOT NULL;

-- Show confirmation
SELECT 'Migration completed successfully!' AS status;
