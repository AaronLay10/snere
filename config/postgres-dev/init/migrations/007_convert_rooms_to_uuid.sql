-- Migration: Convert rooms table to use UUID primary key
-- This ensures consistency across all tables which use UUID as primary keys

BEGIN;

-- Step 1: Add new UUID column to rooms table
ALTER TABLE rooms ADD COLUMN uuid_id UUID DEFAULT uuid_generate_v4();

-- Step 2: Update the UUID column with generated values for existing rows
UPDATE rooms SET uuid_id = uuid_generate_v4() WHERE uuid_id IS NULL;

-- Step 3: Make the UUID column NOT NULL
ALTER TABLE rooms ALTER COLUMN uuid_id SET NOT NULL;

-- Step 4: Add UUID columns to all tables that reference rooms
ALTER TABLE controllers ADD COLUMN room_uuid UUID;
ALTER TABLE device_groups ADD COLUMN room_uuid UUID;
ALTER TABLE devices ADD COLUMN room_uuid UUID;
ALTER TABLE director_commands ADD COLUMN room_uuid UUID;
ALTER TABLE emergency_stop_events ADD COLUMN room_uuid UUID;
ALTER TABLE puzzles ADD COLUMN room_uuid UUID;
ALTER TABLE room_sessions ADD COLUMN room_uuid UUID;
ALTER TABLE room_state ADD COLUMN room_uuid UUID;
ALTER TABLE scenes ADD COLUMN room_uuid UUID;

-- Step 5: Populate the UUID columns by joining on the old slug-based room_id
UPDATE controllers c SET room_uuid = r.uuid_id FROM rooms r WHERE c.room_id = r.id;
UPDATE device_groups dg SET room_uuid = r.uuid_id FROM rooms r WHERE dg.room_id = r.id;
UPDATE devices d SET room_uuid = r.uuid_id FROM rooms r WHERE d.room_id = r.id;
UPDATE director_commands dc SET room_uuid = r.uuid_id FROM rooms r WHERE dc.room_id = r.id;
UPDATE emergency_stop_events ese SET room_uuid = r.uuid_id FROM rooms r WHERE ese.room_id = r.id;
UPDATE puzzles p SET room_uuid = r.uuid_id FROM rooms r WHERE p.room_id = r.id;
UPDATE room_sessions rs SET room_uuid = r.uuid_id FROM rooms r WHERE rs.room_id = r.id;
UPDATE room_state rst SET room_uuid = r.uuid_id FROM rooms r WHERE rst.room_id = r.id;
UPDATE scenes s SET room_uuid = r.uuid_id FROM rooms r WHERE s.room_id = r.id;

-- Step 6: Make the new UUID columns NOT NULL (where appropriate)
ALTER TABLE controllers ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE device_groups ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE devices ALTER COLUMN room_uuid SET NOT NULL;
-- director_commands.room_id is nullable, so room_uuid should also be nullable
ALTER TABLE emergency_stop_events ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE puzzles ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE room_sessions ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE room_state ALTER COLUMN room_uuid SET NOT NULL;
ALTER TABLE scenes ALTER COLUMN room_uuid SET NOT NULL;

-- Step 7: Drop old foreign key constraints
ALTER TABLE controllers DROP CONSTRAINT IF EXISTS controllers_room_id_fkey;
ALTER TABLE device_groups DROP CONSTRAINT IF EXISTS device_groups_room_id_fkey;
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_room_id_fkey;
ALTER TABLE director_commands DROP CONSTRAINT IF EXISTS director_commands_room_id_fkey;
ALTER TABLE emergency_stop_events DROP CONSTRAINT IF EXISTS emergency_stop_events_room_id_fkey;
ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_room_id_fkey;
ALTER TABLE room_sessions DROP CONSTRAINT IF EXISTS room_sessions_room_id_fkey;
ALTER TABLE room_state DROP CONSTRAINT IF EXISTS room_state_room_id_fkey;
ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_room_id_fkey;

-- Step 8: Rename old room_id columns to room_slug (preserve for reference/migration)
ALTER TABLE controllers RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE device_groups RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE devices RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE director_commands RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE emergency_stop_events RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE puzzles RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE room_sessions RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE room_state RENAME COLUMN room_id TO room_slug_old;
ALTER TABLE scenes RENAME COLUMN room_id TO room_slug_old;

-- Step 9: Rename UUID columns to room_id
ALTER TABLE controllers RENAME COLUMN room_uuid TO room_id;
ALTER TABLE device_groups RENAME COLUMN room_uuid TO room_id;
ALTER TABLE devices RENAME COLUMN room_uuid TO room_id;
ALTER TABLE director_commands RENAME COLUMN room_uuid TO room_id;
ALTER TABLE emergency_stop_events RENAME COLUMN room_uuid TO room_id;
ALTER TABLE puzzles RENAME COLUMN room_uuid TO room_id;
ALTER TABLE room_sessions RENAME COLUMN room_uuid TO room_id;
ALTER TABLE room_state RENAME COLUMN room_uuid TO room_id;
ALTER TABLE scenes RENAME COLUMN room_uuid TO room_id;

-- Step 10: Drop old primary key and rename old id column in rooms
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_pkey;
ALTER TABLE rooms RENAME COLUMN id TO slug_old;

-- Step 11: Rename uuid_id to id in rooms and make it primary key
ALTER TABLE rooms RENAME COLUMN uuid_id TO id;
ALTER TABLE rooms ADD PRIMARY KEY (id);

-- Step 12: Ensure slug is unique and indexed (it was the old primary key)
-- The slug field should already exist and be populated
ALTER TABLE rooms ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rooms_slug_unique ON rooms(slug);

-- Step 13: Add new foreign key constraints with UUID
ALTER TABLE controllers ADD CONSTRAINT controllers_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE device_groups ADD CONSTRAINT device_groups_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE devices ADD CONSTRAINT devices_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE director_commands ADD CONSTRAINT director_commands_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

ALTER TABLE emergency_stop_events ADD CONSTRAINT emergency_stop_events_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE puzzles ADD CONSTRAINT puzzles_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_sessions ADD CONSTRAINT room_sessions_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE room_state ADD CONSTRAINT room_state_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

ALTER TABLE scenes ADD CONSTRAINT scenes_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

-- Step 14: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_controllers_room ON controllers(room_id);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id);
CREATE INDEX IF NOT EXISTS idx_scenes_room ON scenes(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);

-- Step 15: Update rooms.id column type to UUID (currently character varying with uuid_generate_v4 default)
ALTER TABLE rooms ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE rooms ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Step 16: Clean up - we can drop the old slug columns after verifying migration worked
-- Uncomment these lines after verification:
-- ALTER TABLE controllers DROP COLUMN room_slug_old;
-- ALTER TABLE device_groups DROP COLUMN room_slug_old;
-- ALTER TABLE devices DROP COLUMN room_slug_old;
-- ALTER TABLE director_commands DROP COLUMN room_slug_old;
-- ALTER TABLE emergency_stop_events DROP COLUMN room_slug_old;
-- ALTER TABLE puzzles DROP COLUMN room_slug_old;
-- ALTER TABLE room_sessions DROP COLUMN room_slug_old;
-- ALTER TABLE room_state DROP COLUMN room_slug_old;
-- ALTER TABLE scenes DROP COLUMN room_slug_old;
-- ALTER TABLE rooms DROP COLUMN slug_old;

COMMIT;
