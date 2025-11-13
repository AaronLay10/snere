-- Update Device Friendly Names for Better Scene Timeline UX
-- Makes device names more specific and context-aware

-- BoilerRmA Controller Devices - Add context about which TV/location
UPDATE devices SET friendly_name = 'Intro TV Power'
WHERE device_id = 'tv_power'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Intro TV Lift'
WHERE device_id = 'tv_lift'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Boiler Room Fog Machine Power'
WHERE device_id = 'fog_power'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Boiler Room Fog Trigger'
WHERE device_id = 'fog_trigger'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Boiler Gauge Progress LEDs'
WHERE device_id = 'gauge_progress_leds'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Study Door Lock (Top)'
WHERE device_id = 'study_door_maglock_top'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Study Door Lock (Bottom A)'
WHERE device_id = 'study_door_maglock_bottom_a'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Study Door Lock (Bottom B)'
WHERE device_id = 'study_door_maglock_bottom_b'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Boiler Room Ultrasonic Fogger'
WHERE device_id = 'ultrasonic_water'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET friendly_name = 'Barrel Room Maglock'
WHERE device_id = 'barrel_maglock'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

-- PilotLight Controller Devices
UPDATE devices SET friendly_name = 'Boiler Fire LED Animation'
WHERE device_id = 'boiler_fire_leds'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET friendly_name = 'Boiler Monitor TV Power'
WHERE device_id = 'boiler_monitor_relay'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET friendly_name = 'Pilot Light Flange Status LEDs'
WHERE device_id = 'flange_status_leds'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET friendly_name = 'Newell Post Light Power'
WHERE device_id = 'newell_power_relay'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

-- Video Manager Devices (already good, but make consistent)
UPDATE devices SET friendly_name = 'Intro Video Player'
WHERE device_id = 'intro_trigger'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-videomanager');

UPDATE devices SET friendly_name = 'Living Portraits Video Player'
WHERE device_id = 'portrait_trigger'
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-videomanager');

-- Verify updates
SELECT
  c.controller_id,
  d.device_id,
  d.friendly_name,
  d.device_type
FROM devices d
JOIN controllers c ON d.controller_id = c.id
WHERE c.controller_id IN ('clockwork-boilerrma', 'clockwork-pilotlight', 'clockwork-videomanager')
  AND d.device_category IN ('output', 'media_playback')
ORDER BY d.friendly_name;
