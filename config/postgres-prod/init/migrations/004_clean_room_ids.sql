-- Migration: Clean Room IDs - Replace UUIDs with slugs
-- Purpose: Replace UUID room IDs with human-readable slugs (clockwork instead of b0000000-0000-0000-0000-000000000001)
-- Date: 2025-10-22
-- Version: 1.2.0

BEGIN;

-- Create temporary table to track old -> new ID mappings
CREATE TEMP TABLE room_id_mapping (
    old_id UUID,
    new_id VARCHAR(255),
    room_name VARCHAR(255),
    room_slug VARCHAR(255)
);

-- Build mapping for rooms
INSERT INTO room_id_mapping (old_id, new_id, room_name, room_slug)
SELECT
    id as old_id,
    COALESCE(
        slug,
        LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '_', 'g'))
    ) as new_id,
    name as room_name,
    slug as room_slug
FROM rooms;

-- Show what will be changed
SELECT
    old_id as "Current UUID",
    new_id as "New ID",
    room_name as "Room Name"
FROM room_id_mapping
ORDER BY room_name;

-- STEP 1: Drop views that depend on rooms table
DROP VIEW IF EXISTS v_room_summary CASCADE;
DROP VIEW IF EXISTS v_active_devices CASCADE;

-- STEP 2: Temporarily disable ALL foreign key constraints
ALTER TABLE scenes DROP CONSTRAINT scenes_room_id_fkey;
ALTER TABLE devices DROP CONSTRAINT devices_room_id_fkey;
ALTER TABLE device_groups DROP CONSTRAINT device_groups_room_id_fkey;
ALTER TABLE puzzles DROP CONSTRAINT puzzles_room_id_fkey;
ALTER TABLE room_sessions DROP CONSTRAINT room_sessions_room_id_fkey;
ALTER TABLE emergency_stop_events DROP CONSTRAINT emergency_stop_events_room_id_fkey;
ALTER TABLE controllers DROP CONSTRAINT controllers_room_id_fkey;
ALTER TABLE room_state DROP CONSTRAINT room_state_room_id_fkey;
ALTER TABLE director_commands DROP CONSTRAINT director_commands_room_id_fkey;

-- STEP 3: Change ALL foreign key column types BEFORE changing primary key
ALTER TABLE scenes ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE devices ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE device_groups ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE puzzles ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE room_sessions ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE emergency_stop_events ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE controllers ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE room_state ALTER COLUMN room_id TYPE VARCHAR(255);
ALTER TABLE director_commands ALTER COLUMN room_id TYPE VARCHAR(255);

-- STEP 4: Change rooms.id column type from UUID to VARCHAR
ALTER TABLE rooms ALTER COLUMN id TYPE VARCHAR(255);

-- STEP 5: Update the room IDs themselves (primary key update)
UPDATE rooms
SET id = m.new_id
FROM room_id_mapping m
WHERE rooms.id::TEXT = m.old_id::TEXT;

-- STEP 6: Update ALL foreign key references

-- 6a. Update scenes.room_id
UPDATE scenes
SET room_id = m.new_id
FROM room_id_mapping m
WHERE scenes.room_id::TEXT = m.old_id::TEXT;

-- 6b. Update devices.room_id
UPDATE devices
SET room_id = m.new_id
FROM room_id_mapping m
WHERE devices.room_id::TEXT = m.old_id::TEXT;

-- 6c. Update device_groups.room_id
UPDATE device_groups
SET room_id = m.new_id
FROM room_id_mapping m
WHERE device_groups.room_id::TEXT = m.old_id::TEXT;

-- 6d. Update puzzles.room_id
UPDATE puzzles
SET room_id = m.new_id
FROM room_id_mapping m
WHERE puzzles.room_id::TEXT = m.old_id::TEXT;

-- 6e. Update room_sessions.room_id
UPDATE room_sessions
SET room_id = m.new_id
FROM room_id_mapping m
WHERE room_sessions.room_id::TEXT = m.old_id::TEXT;

-- 6f. Update emergency_stop_events.room_id
UPDATE emergency_stop_events
SET room_id = m.new_id
FROM room_id_mapping m
WHERE emergency_stop_events.room_id::TEXT = m.old_id::TEXT;

-- 6g. Update controllers.room_id
UPDATE controllers
SET room_id = m.new_id
FROM room_id_mapping m
WHERE controllers.room_id::TEXT = m.old_id::TEXT;

-- 6h. Update room_state.room_id
UPDATE room_state
SET room_id = m.new_id
FROM room_id_mapping m
WHERE room_state.room_id::TEXT = m.old_id::TEXT;

-- 6i. Update director_commands.room_id
UPDATE director_commands
SET room_id = m.new_id
FROM room_id_mapping m
WHERE director_commands.room_id::TEXT = m.old_id::TEXT;

-- STEP 7: Re-enable ALL foreign key constraints with new VARCHAR type
ALTER TABLE scenes ADD CONSTRAINT scenes_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE devices ADD CONSTRAINT devices_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE device_groups ADD CONSTRAINT device_groups_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE puzzles ADD CONSTRAINT puzzles_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_sessions ADD CONSTRAINT room_sessions_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE emergency_stop_events ADD CONSTRAINT emergency_stop_events_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE controllers ADD CONSTRAINT controllers_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_state ADD CONSTRAINT room_state_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE director_commands ADD CONSTRAINT director_commands_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

-- Show final result
SELECT
    id as "Room ID",
    name as "Name",
    slug as "Slug"
FROM rooms
ORDER BY name;

COMMIT;
