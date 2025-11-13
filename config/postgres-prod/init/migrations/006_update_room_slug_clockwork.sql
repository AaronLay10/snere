-- 006_update_room_slug_clockwork.sql
-- Purpose: Align rooms.slug with MQTT namespace by setting slug to 'clockwork'
-- Context: mqtt_topic_base is 'sentient/paragon/clockwork'; slug was 'clockwork-corridor'

BEGIN;

-- Safety: Skip if slug already set to 'clockwork'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rooms WHERE slug = 'clockwork') THEN
    RAISE NOTICE 'rooms.slug already set to clockwork; no changes applied';
  ELSE
    UPDATE rooms
    SET slug = 'clockwork'
    WHERE slug = 'clockwork-corridor'
       OR mqtt_topic_base LIKE '%/clockwork';
  END IF;
END $$;

COMMIT;
