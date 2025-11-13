-- 007_prevent_device_takeover.sql
-- Purpose:
--  - Prevent an existing device in a room from being reassigned to a different controller
--    via accidental upsert/registration ("controller takeover").
--  - Ensure device's controller lives in the same room.
--  - Add unique constraint on (room_id, device_id) aligned with UUID room ids.
--
-- Notes:
--  - Existing schema already has a unique constraint on (room_slug_old, device_id).
--    This migration adds the same uniqueness with (room_id, device_id) for robustness.
--  - The trigger blocks changing controller_id on an existing device row once set.

BEGIN;

-- 1) Unique index on (room_id, device_id) if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uniq_devices_roomid_deviceid'
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX uniq_devices_roomid_deviceid ON devices (room_id, device_id)';
    END IF;
END$$;

-- 2) Function: prevent controller takeover and enforce room match
CREATE OR REPLACE FUNCTION prevent_device_controller_hijack()
RETURNS trigger AS $$
DECLARE
    _ok int;
BEGIN
    -- Enforce that controller belongs to the same room
    IF NEW.controller_id IS NOT NULL THEN
        SELECT 1 INTO _ok
        FROM controllers c
        WHERE c.id = NEW.controller_id
          AND c.room_id = NEW.room_id
        LIMIT 1;
        IF _ok IS NULL THEN
            RAISE EXCEPTION 'Controller (%) must belong to the same room as device (room_id=%)', NEW.controller_id, NEW.room_id;
        END IF;
    END IF;

    -- Block reassignment of controller for an existing device (once set)
    IF TG_OP = 'UPDATE' THEN
        IF OLD.controller_id IS NOT NULL
           AND NEW.controller_id IS NOT NULL
           AND NEW.controller_id <> OLD.controller_id THEN
            RAISE EXCEPTION 'Device % in room % already owned by controller %, refusing takeover by %',
                NEW.device_id, NEW.room_id, OLD.controller_id, NEW.controller_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Trigger binding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_devices_prevent_takeover'
    ) THEN
        CREATE TRIGGER trg_devices_prevent_takeover
        BEFORE INSERT OR UPDATE ON devices
        FOR EACH ROW
        EXECUTE FUNCTION prevent_device_controller_hijack();
    END IF;
END$$;

COMMIT;
