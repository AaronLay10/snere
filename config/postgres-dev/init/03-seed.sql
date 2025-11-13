-- Mythra Sentient Engine - Seed Data
-- Version: 1.0.0
-- Created: 2025-10-14
-- Purpose: Initial data for Paragon Escape Games and Clockwork Corridor

-- ============================================================================
-- CLIENT: Paragon Escape Games
-- ============================================================================

INSERT INTO clients (
  id,
  name,
  slug,
  description,
  contact_email,
  mqtt_namespace,
  status
) VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'Paragon Escape Games',
  'paragon',
  'First client of the Mythra Sentient Engine. Premier escape room experiences featuring advanced automation and theatrical effects.',
  'info@paragonescape.com',
  'paragon',
  'active'
);

-- ============================================================================
-- ROOM: Clockwork Corridor
-- ============================================================================

INSERT INTO rooms (
  id,
  client_id,
  name,
  slug,
  short_name,
  theme,
  description,
  narrative,
  objective,
  min_players,
  max_players,
  recommended_players,
  duration_minutes,
  difficulty_level,
  difficulty_rating,
  physical_difficulty,
  age_recommendation,
  wheelchair_accessible,
  hearing_impaired_friendly,
  vision_impaired_friendly,
  accessibility_notes,
  scene_count,
  puzzle_count,
  device_count,
  mqtt_topic_base,
  network_segment,
  status,
  version,
  development_start_date,
  testing_start_date,
  expected_launch_date
) VALUES (
  'clockwork-corridor',
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'Clockwork Corridor',
  'clockwork-corridor',
  'Clockwork',
  'Steampunk',
  'A heist in the heart of steam-powered chaos. Navigate through Vincent Vondæther''s mechanized laboratory to retrieve the stolen Æther.',
  'In the realm of steampunk chaos, Lord Phineas Sterling has hired your gang to retrieve his magical Æther from the infamous "Clockwork Corridor." The "Clockwork Corridor" is run by Vincent Vondæther, an ominous alchemist. Because of Vincent''s power-hungry nature, he has stolen Phineas Sterling''s prized Æther to use in his twisted inventions.

The retrieval plan was simple. Get in. Get out. Get paid. However, Vincent is more clever than you originally intended. Now you and your renegade team of thieves must outsmart Vincent and his menacing "Clockwork Corridor." Are you up to the task?

Set in an alternate timeline, "Clockwork Corridor," is immersed in Victorian Steampunk culture and sophistication. Retro-futuristic inventions dominate this industrial steam-powered society and the race for power keeps man driven. The science of alchemy, which uses rare chemicals to create elixirs, can empower these mechanized gadgets. This is the root of Vincent Vondæther''s distorted success.',
  'Infiltrate Vincent Vondæther''s Clockwork Corridor, navigate through steampunk puzzles and mechanical challenges, retrieve Lord Phineas Sterling''s magical Æther, and escape before being caught.',
  2,
  8,
  6,
  60,
  'Medium-Hard',
  4,
  'Low',
  '12+',
  false,
  true,
  false,
  'Room requires ability to manipulate small objects and read clues. Some physical movement between rooms required.',
  8,
  12,
  7,
  'sentient/paragon/clockwork',
  '192.168.20.0/24',
  'testing',
  '1.0.0',
  '2024-01-01',
  '2024-09-01',
  '2025-01-15'
);

-- ============================================================================
-- SCENES: Clockwork Corridor (8 scenes)
-- ============================================================================

INSERT INTO scenes (id, room_id, scene_number, name, slug, description, scene_type, estimated_duration_seconds, transition_type) VALUES
('c0000001-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 1, 'Intro & Boiler Room', 'intro-boiler', 'Gamemaster starts intro movie, players enter boiler room and begin first puzzles', 'standard', 600, 'manual'),
('c0000002-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 2, 'The Betrayal', 'betrayal', 'Plot twist revealed through video/audio', 'cutscene', 120, 'auto'),
('c0000003-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 3, 'The Study', 'study', 'Players solve puzzles to gain access to the study', 'standard', 480, 'manual'),
('c0000004-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 4, 'The Kraken', 'kraken', 'Mechanical kraken encounter with pneumatic tentacles', 'standard', 360, 'triggered'),
('c0000005-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 5, 'The Lab', 'lab', 'Navigate Vincent''s laboratory with complex scientific puzzles', 'standard', 540, 'manual'),
('c0000006-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 6, 'The Plan', 'plan', 'Players discover the plan to escape with the Æther', 'cutscene', 90, 'auto'),
('c0000007-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 7, 'The Clock', 'clock', 'Final countdown puzzle with time pressure', 'standard', 420, 'triggered'),
('c0000008-0000-0000-0000-000000000001'::UUID, 'clockwork-corridor', 8, 'Sacrifice & Escape', 'escape', 'Dramatic finale and escape sequence', 'standard', 300, 'manual');

-- ============================================================================
-- DEVICES: Clockwork Corridor (from enhanced config)
-- ============================================================================

INSERT INTO devices (id, room_id, device_id, friendly_name, device_type, device_category, physical_location, mqtt_topic, emergency_stop_required, status, config) VALUES
(
  'd0000001-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'pilot_light',
  'Pilot Light Controller',
  'controller',
  'sensor',
  'Boiler Room - Main Control Panel',
  'sentient/paragon/clockwork/pilotlight/teensy-4-1',
  false,
  'active',
  '{"puzzleId": "PilotLight", "sensors": [{"id": "color_sensor", "type": "color"}, {"id": "ir_sensor", "type": "digital"}], "actuators": [{"id": "fire_leds", "type": "led_strip"}, {"id": "boiler_power", "type": "relay"}]}'::JSONB
),
(
  'd0000002-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'gauge_1_3_4',
  'Gauges 1, 3, 4',
  'controller',
  'mechanical_movement',
  'Boiler Room - Gauge Panel Left',
  'sentient/paragon/clockwork/gauge/gauge_1-3-4',
  true,
  'active',
  '{"puzzleId": "Gauge", "sensors": [{"id": "valve_1_pot", "type": "analog"}, {"id": "valve_3_pot", "type": "analog"}, {"id": "valve_4_pot", "type": "analog"}], "actuators": [{"id": "stepper_1", "type": "stepper"}, {"id": "stepper_3", "type": "stepper"}, {"id": "stepper_4", "type": "stepper"}]}'::JSONB
),
(
  'd0000003-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'gauge_2_5_7',
  'Gauges 2, 5, 7',
  'controller',
  'mechanical_movement',
  'Boiler Room - Gauge Panel Right',
  'sentient/paragon/clockwork/gauge/gauge_2-5-7',
  true,
  'active',
  '{"puzzleId": "Gauge", "sensors": [{"id": "valve_2_pot", "type": "analog"}, {"id": "valve_5_pot", "type": "analog"}, {"id": "valve_7_pot", "type": "analog"}], "actuators": [{"id": "stepper_2", "type": "stepper"}, {"id": "stepper_5", "type": "stepper"}, {"id": "stepper_7", "type": "stepper"}]}'::JSONB
),
(
  'd0000004-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'ceiling_clock_leds',
  'Ceiling Clock LEDs',
  'controller',
  'variable_control',
  'Boiler Room - Ceiling Center',
  'sentient/paragon/clockwork/gauge/gauge_6-leds',
  false,
  'active',
  '{"puzzleId": "Gauge", "actuators": [{"id": "clock_leds", "type": "led_strip", "count": 12}]}'::JSONB
),
(
  'd0000005-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'kraken',
  'Kraken Controller',
  'controller',
  'mechanical_movement',
  'Kraken Chamber - Main Platform',
  'sentient/paragon/clockwork/kraken/kraken',
  true,
  'active',
  '{"puzzleId": "Kraken", "actuators": [{"id": "tentacle_1", "type": "pneumatic"}, {"id": "tentacle_2", "type": "pneumatic"}, {"id": "tentacle_3", "type": "pneumatic"}], "sensors": [{"id": "tentacle_position", "type": "digital"}]}'::JSONB
),
(
  'd0000006-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'fog_machine_main',
  'Main Fog Machine',
  'effect',
  'switchable_on_off',
  'Boiler Room - Under Floor',
  'sentient/paragon/clockwork/effects/fog',
  false,
  'active',
  '{"actuators": [{"id": "fog_trigger", "type": "relay", "warmupTime": 30000, "cooldownTime": 60000}]}'::JSONB
),
(
  'd0000007-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'study_door_maglock',
  'Study Door Magnetic Lock',
  'security',
  'switchable_on_off',
  'Study - Entry Door',
  'sentient/paragon/clockwork/access/study-door',
  false,
  'active',
  '{"actuators": [{"id": "maglock", "type": "maglock", "holdingForce": "1200lbs", "failMode": "secure"}], "sensors": [{"id": "door_sensor", "type": "digital"}]}'::JSONB
);

-- ============================================================================
-- DEVICE GROUPS
-- ============================================================================

INSERT INTO device_groups (id, room_id, name, slug, description, group_type, emergency_stop_required) VALUES
(
  'e0000001-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'All Gauge Controllers',
  'gauge_puzzle_all',
  'Complete gauge puzzle system',
  'logical',
  true
),
(
  'e0000002-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'Boiler System',
  'boiler_system',
  'All boiler room devices',
  'logical',
  false
),
(
  'e0000003-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'All Mechanical Movement Devices',
  'mechanical_movement_all',
  'All devices requiring emergency stop capability',
  'emergency_stop_group',
  true
);

-- ============================================================================
-- DEVICE GROUP MEMBERS
-- ============================================================================

INSERT INTO device_group_members (group_id, device_id, member_role) VALUES
-- Gauge puzzle group
('e0000001-0000-0000-0000-000000000001'::UUID, 'd0000002-0000-0000-0000-000000000001'::UUID, 'primary'),
('e0000001-0000-0000-0000-000000000001'::UUID, 'd0000003-0000-0000-0000-000000000001'::UUID, 'primary'),
('e0000001-0000-0000-0000-000000000001'::UUID, 'd0000004-0000-0000-0000-000000000001'::UUID, 'secondary'),

-- Boiler system group
('e0000002-0000-0000-0000-000000000001'::UUID, 'd0000001-0000-0000-0000-000000000001'::UUID, 'primary'),
('e0000002-0000-0000-0000-000000000001'::UUID, 'd0000006-0000-0000-0000-000000000001'::UUID, 'secondary'),

-- Mechanical movement group
('e0000003-0000-0000-0000-000000000001'::UUID, 'd0000002-0000-0000-0000-000000000001'::UUID, 'primary'),
('e0000003-0000-0000-0000-000000000001'::UUID, 'd0000003-0000-0000-0000-000000000001'::UUID, 'primary'),
('e0000003-0000-0000-0000-000000000001'::UUID, 'd0000005-0000-0000-0000-000000000001'::UUID, 'primary');

-- ============================================================================
-- PUZZLES: Clockwork Corridor (Key puzzles)
-- ============================================================================

INSERT INTO puzzles (
  id,
  room_id,
  scene_id,
  puzzle_id,
  name,
  puzzle_type,
  description,
  difficulty_rating,
  time_limit_seconds,
  solve_conditions,
  solve_actions
) VALUES
(
  'f0000001-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'c0000001-0000-0000-0000-000000000001'::UUID,
  'pilot_light',
  'Pilot Light Puzzle',
  'physical',
  'Insert correct chemical pilot light into boiler to activate fire',
  2,
  600,
  '[{"id": "color_match", "sensor": "color_sensor", "condition": "colorTemp >= 2500 && colorTemp <= 3500", "holdTime": 1000}]'::JSONB,
  '[{"id": "trigger_fog", "device": "fog_machine_main", "command": "FogBlast"}, {"id": "turn_on_fire_leds", "device": "pilot_light", "command": "FireLED"}]'::JSONB
),
(
  'f0000002-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'c0000001-0000-0000-0000-000000000001'::UUID,
  'gauge_puzzle',
  'Pressure Gauge Puzzle',
  'sequence',
  'Adjust boiler valves to match ceiling clock LED patterns across 3 stages',
  4,
  900,
  '[{"id": "stage_1", "setpoints": {"valve_1": 512, "valve_3": 768, "valve_4": 256}}, {"id": "stage_2", "setpoints": {"valve_1": 820, "valve_3": 410, "valve_4": 650}}, {"id": "stage_3", "setpoints": {"valve_1": 300, "valve_3": 900, "valve_4": 512}}]'::JSONB,
  '[{"id": "unlock_study", "device": "study_door_maglock", "command": "unlock"}]'::JSONB
),
(
  'f0000003-0000-0000-0000-000000000001'::UUID,
  'clockwork-corridor',
  'c0000004-0000-0000-0000-000000000001'::UUID,
  'kraken_puzzle',
  'Kraken Encounter',
  'pattern',
  'Navigate kraken tentacle movements to progress',
  3,
  480,
  '[]'::JSONB,
  '[{"id": "tentacle_sequence", "device": "kraken", "command": "TentacleSequence"}]'::JSONB
);

-- ============================================================================
-- USERS: Initial System Accounts
-- ============================================================================

-- Note: Password hashes will be generated by application on first run
-- Default password: changeme123! (MUST be changed on first login)

-- System Administrator (Super Admin)
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  client_id,
  is_active,
  email_verified
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'admin',
  'admin@mythrasentient.com',
  '$2b$10$YourHashHere', -- Will be replaced by seed script
  'System',
  'Administrator',
  'admin',
  NULL, -- Super admin, no client restriction
  true,
  true
);

-- Paragon Admin
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  client_id,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000002'::UUID,
  'paragon_admin',
  'admin@paragonescape.com',
  '$2b$10$YourHashHere', -- Will be replaced
  'Paragon',
  'Administrator',
  'admin',
  'a0000000-0000-0000-0000-000000000001'::UUID,
  true
);

-- Paragon Editor (Tech Team)
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  client_id,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000003'::UUID,
  'tech_team',
  'tech@paragonescape.com',
  '$2b$10$YourHashHere',
  'Technical',
  'Team',
  'editor',
  'a0000000-0000-0000-0000-000000000001'::UUID,
  true
);

-- Paragon Game Master
INSERT INTO users (
  id,
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  client_id,
  is_active
) VALUES (
  '00000000-0000-0000-0000-000000000004'::UUID,
  'gamemaster1',
  'gm1@paragonescape.com',
  '$2b$10$YourHashHere',
  'Game',
  'Master',
  'game_master',
  'a0000000-0000-0000-0000-000000000001'::UUID,
  true
);

-- ============================================================================
-- AUDIT LOG: Seed Data Creation
-- ============================================================================

INSERT INTO audit_log (
  user_id,
  action,
  entity_type,
  reason,
  success
) VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'seed_database',
  'system',
  'Initial database seed with Paragon Escape Games and Clockwork Corridor configuration',
  true
);

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================

-- Display summary
SELECT 'Database seeded successfully!' as message;
SELECT COUNT(*) as client_count FROM clients;
SELECT COUNT(*) as room_count FROM rooms;
SELECT COUNT(*) as scene_count FROM scenes;
SELECT COUNT(*) as device_count FROM devices;
SELECT COUNT(*) as puzzle_count FROM puzzles;
SELECT COUNT(*) as user_count FROM users;
