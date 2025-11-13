-- 005_enforce_device_uniqueness.sql
-- Purpose: Prevent duplicate device IDs within the same room by enforcing
--          a database-level uniqueness constraint and validating that a
--          device's room matches its controller's room.
--
-- Assumptions (per production reality in docs):
-- - controllers table exists and has (id PK, room_id FK)
-- - devices table exists and has (id PK, controller_id FK -> controllers.id)
-- - Multi-tenant isolation is by rooms -> clients (rooms.client_id)
--
-- Strategy:
-- 1) Add devices.room_id (if missing) and backfill from controllers.
-- 2) Enforce uniqueness on (room_id, device_id).
-- 3) Add trigger to ensure devices.room_id always matches the controller's room.
--
-- Notes:
-- - CREATE INDEX CONCURRENTLY cannot run inside a transaction. If you need to
--   avoid table locks in production, execute the UNIQUE INDEX step separately
--   with CONCURRENTLY.

-- 1) Add room_id column if it does not exist
ALTER TABLE devices
    ADD COLUMN IF NOT EXISTS room_id INTEGER;

-- 1b) Backfill room_id for existing rows based on their controller's room
UPDATE devices d
SET room_id = c.room_id
FROM controllers c
WHERE d.controller_id = c.id
  AND d.room_id IS NULL;

-- 2) Enforce uniqueness for device names within a room
-- For low-traffic windows you can use the standard unique index:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_devices_room_device
    ON devices (room_id, device_id);

-- If you prefer a non-blocking build, drop the index above and instead run:
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_devices_room_device
--     ON devices (room_id, device_id);

-- 3) Guardrail: ensure devices.room_id matches its controller's room_id
--    (prevents accidental cross-room assignment during updates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_devices_room_matches_controller'
    ) THEN
        CREATE OR REPLACE FUNCTION check_device_room_matches_controller()
        RETURNS trigger AS $$
        BEGIN
            IF NEW.controller_id IS NOT NULL THEN
                PERFORM 1 FROM controllers c
                 WHERE c.id = NEW.controller_id AND c.room_id = NEW.room_id;
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Device room_id (%) must match controller.room_id for controller_id (%)', NEW.room_id, NEW.controller_id;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trg_devices_room_matches_controller
        BEFORE INSERT OR UPDATE ON devices
        FOR EACH ROW
        EXECUTE FUNCTION check_device_room_matches_controller();
    END IF;
END$$;

-- Optional: If you want to harden casing rules (snake_case), consider a CHECK constraint elsewhere.

-- Verification queries (optional):
-- SELECT d.id, d.device_id, d.room_id, d.controller_id FROM devices d
-- WHERE d.device_id = 'intro_tv';
