-- Populate Device Capabilities for Scene 1 Devices
-- This provides command options for the Scene Timeline Effect steps
-- Run this after devices are registered but before configuring timeline

-- BoilerRmA Controller Devices
UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('powerOn'))
WHERE device_id = 'tv_power' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('lowerTV', 'raiseTV', 'stopTV'))
WHERE device_id = 'tv_lift' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('powerOn', 'powerOff'))
WHERE device_id = 'fog_power' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('triggerFog'))
WHERE device_id = 'fog_trigger' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('unlock', 'lock'))
WHERE device_id IN ('study_door_maglock_top', 'study_door_maglock_bottom_a', 'study_door_maglock_bottom_b')
  AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('setProgress', 'clearProgress'))
WHERE device_id = 'gauge_progress_leds' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('activate', 'deactivate'))
WHERE device_id = 'ultrasonic_water' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('unlock', 'lock'))
WHERE device_id = 'barrel_maglock' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-boilerrma');

-- PilotLight Controller Devices
UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('fireLEDsOn', 'fireLEDsOff'))
WHERE device_id = 'boiler_fire_leds' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('powerOn', 'powerOff'))
WHERE device_id = 'boiler_monitor_relay' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('setColor', 'setBrightness', 'turnOff'))
WHERE device_id = 'flange_status_leds' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

UPDATE devices SET capabilities = jsonb_build_object('commands', jsonb_build_array('powerOn', 'powerOff'))
WHERE device_id = 'newell_power_relay' AND controller_id IN (SELECT id FROM controllers WHERE controller_id = 'clockwork-pilotlight');

-- Verify updates
SELECT
  c.controller_id,
  d.device_id,
  d.friendly_name,
  d.capabilities
FROM devices d
JOIN controllers c ON d.controller_id = c.id
WHERE c.controller_id IN ('clockwork-boilerrma', 'clockwork-pilotlight')
  AND d.device_category = 'output'
ORDER BY c.controller_id, d.device_id;
