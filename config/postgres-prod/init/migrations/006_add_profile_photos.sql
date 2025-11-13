-- Migration: Add profile photo support to users table
-- Date: 2025-10-30
-- Description: Adds profile_photo_url and profile_photo_filename columns to support user profile photos

-- Add profile photo columns
ALTER TABLE users
ADD COLUMN profile_photo_url VARCHAR(500),
ADD COLUMN profile_photo_filename VARCHAR(255);

-- Add comment
COMMENT ON COLUMN users.profile_photo_url IS 'URL or path to user profile photo';
COMMENT ON COLUMN users.profile_photo_filename IS 'Original filename of uploaded profile photo';

-- Create index for faster queries when filtering by users with photos
CREATE INDEX idx_users_has_photo ON users(profile_photo_url) WHERE profile_photo_url IS NOT NULL;
