-- Migration: Rename rooms.id to rooms.room_id for consistency
-- Date: 2025-11-01
-- Description: Fix schema inconsistency - rooms primary key should be room_id, not id

BEGIN;

-- Step 1: Rename the primary key column
ALTER TABLE rooms RENAME COLUMN id TO room_id;

-- Step 2: Rename the primary key constraint
ALTER TABLE rooms RENAME CONSTRAINT rooms_pkey TO rooms_room_id_pkey;

-- Step 3: Update all foreign key constraints to reference the renamed column
-- Note: PostgreSQL automatically handles this, but we document it for clarity

-- Verify the change
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'room_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: room_id column not found';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: old id column still exists';
    END IF;
END $$;

COMMIT;
