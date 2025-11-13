-- 006_remove_video_manager_controller.sql
-- Purpose: Remove the 'video_manager' controller and its devices in the
--          paragon/clockwork room, with strict multi-tenant isolation.
-- Notes:
-- - This script is idempotent: DELETEs are WHERE-scoped and won't error if nothing matches.
-- - Review live dependencies (scenes referencing these devices) before applying.

BEGIN;

-- Resolve the specific controller row(s) for video_manager in paragon/clockwork
WITH target_controller AS (
  SELECT c.id
  FROM controllers c
  JOIN rooms r ON c.room_id = r.id
  JOIN clients cl ON r.client_id = cl.id
  WHERE cl.slug = 'paragon'
    AND r.slug  = 'clockwork'
    AND c.controller_id = 'video_manager'
)
-- Remove devices owned by video_manager in this room
DELETE FROM devices d
USING target_controller tc
WHERE d.controller_id = tc.id;

-- Finally remove the controller row itself
DELETE FROM controllers c
USING rooms r, clients cl
WHERE c.room_id = r.id
  AND r.client_id = cl.id
  AND cl.slug = 'paragon'
  AND r.slug  = 'clockwork'
  AND c.controller_id = 'video_manager';

COMMIT;

-- Optional post-checks:
-- SELECT d.* FROM devices d JOIN controllers c ON d.controller_id=c.id JOIN rooms r ON c.room_id=r.id JOIN clients cl ON r.client_id=cl.id
-- WHERE cl.client_id='paragon' AND r.room_id='clockwork' AND (d.device_id='intro_tv' OR d.device_id='living_frames');
-- SELECT * FROM controllers c JOIN rooms r ON c.room_id=r.id JOIN clients cl ON r.client_id=cl.id
-- WHERE cl.client_id='paragon' AND r.room_id='clockwork' AND c.controller_id='video_manager';
