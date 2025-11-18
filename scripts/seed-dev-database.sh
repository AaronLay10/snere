#!/bin/bash
# Seed Development Database with Test Data
# Creates realistic multi-tenant test data for local development

set -e

echo "🌱 Seeding development database..."

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sentient_dev}"
DB_USER="${DB_USER:-sentient_dev}"

# Check if database is accessible
if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
  echo "❌ Cannot connect to database $DB_NAME on $DB_HOST:$DB_PORT"
  echo "Make sure Docker is running: docker compose up -d"
  exit 1
fi

echo "✅ Database connection successful"

# Run seed SQL
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'

-- ============================================================================
-- SEED DATA FOR DEVELOPMENT
-- ============================================================================

BEGIN;

-- Clean existing data (preserve structure)
TRUNCATE TABLE
  audit_log,
  user_sessions,
  users,
  scene_steps,
  scenes,
  devices,
  rooms,
  clients
CASCADE;

-- ============================================================================
-- CLIENTS
-- ============================================================================

INSERT INTO clients (id, name, slug, description, mqtt_namespace, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Paragon Mesa', 'paragon', 'Primary escape room facility in Mesa, AZ', 'paragon', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Test Client', 'test', 'Test client for development', 'test', 'active');

-- ============================================================================
-- USERS
-- ============================================================================

-- Password: 'password' (bcrypt hash with 10 rounds)
INSERT INTO users (id, client_id, username, email, password_hash, role, first_name, last_name, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin', 'admin@paragon.local', '$2b$10$mWpu37GpJ4lFREugknh9WOnOtqt3vMjMlX3KMTv1VyA1VaZfAZsWq', 'admin', 'Admin', 'User', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'gamemaster', 'gm@paragon.local', '$2b$10$mWpu37GpJ4lFREugknh9WOnOtqt3vMjMlX3KMTv1VyA1VaZfAZsWq', 'game_master', 'Game', 'Master', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'editor', 'editor@paragon.local', '$2b$10$mWpu37GpJ4lFREugknh9WOnOtqt3vMjMlX3KMTv1VyA1VaZfAZsWq', 'editor', 'Content', 'Editor', true);

-- ============================================================================
-- ROOMS
-- ============================================================================

INSERT INTO rooms (id, client_id, name, slug, description, min_players, max_players, duration_minutes) VALUES
  ('10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'The Clockwork Conspiracy', 'clockwork', 'A steampunk adventure through time and gears', 2, 8, 60);

-- ============================================================================
-- CONTROLLERS
-- ============================================================================

INSERT INTO controllers (id, room_id, controller_id, friendly_name, hardware_type, firmware_version, ip_address, status) VALUES
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'boiler_room_subpanel', 'Boiler Room Subpanel', 'teensy41', 'v2.0.1', '192.168.3.101', 'active'),
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'chemical_controller', 'Chemical Station', 'teensy41', 'v2.0.1', '192.168.3.102', 'active'),
  ('c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'clock_controller', 'Clock Mechanism', 'teensy41', 'v2.0.1', '192.168.3.103', 'active');

-- ============================================================================
-- DEVICES
-- ============================================================================

INSERT INTO devices (id, room_id, controller_id, device_id, friendly_name, device_type, device_category, mqtt_topic, emergency_stop_required, status) VALUES
  ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'intro_tv', 'Introduction TV', 'display', 'media_playback', 'paragon/clockwork/commands/boiler_room_subpanel/intro_tv', false, 'active'),
  ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pilot_light', 'Boiler Pilot Light', 'led_indicator', 'sensor', 'paragon/clockwork/sensors/boiler_room_subpanel/pilot_light', false, 'active'),
  ('d0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'chemical_pump', 'Chemical Pump', 'pump', 'mechanical_movement', 'paragon/clockwork/commands/chemical_controller/chemical_pump', true, 'active');

-- ============================================================================
-- DEVICE COMMANDS
-- ============================================================================

INSERT INTO device_commands (id, device_id, command_name, specific_command, friendly_name, mqtt_topic_suffix) VALUES
  ('00000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'powerOn', 'power_tv_on', 'Power On', 'commands/power_tv_on'),
  ('00000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'powerOff', 'power_tv_off', 'Power Off', 'commands/power_tv_off'),
  ('00000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'pumpStart', 'pump_start', 'Start Pump', 'commands/pump_start'),
  ('00000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'pumpStop', 'pump_stop', 'Stop Pump', 'commands/pump_stop');

-- ============================================================================
-- SCENES
-- ============================================================================

INSERT INTO scenes (id, room_id, scene_number, name, slug, description, estimated_duration_seconds) VALUES
  ('00000001-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Introduction', 'introduction', 'Welcome players and set the scene', 300),
  ('00000001-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, 'Boiler Room Puzzle', 'boiler_room_puzzle', 'Activate the boiler system', 600),
  ('00000001-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, 'Chemical Laboratory', 'chemical_laboratory', 'Mix the correct chemical formula', 900);

-- ============================================================================
-- SCENE STEPS
-- ============================================================================

INSERT INTO scene_steps (id, scene_id, step_number, step_type, name, config) VALUES
  ('00000002-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000001', 1, 'mqtt_command', 'Power on intro TV', '{"device_id": "intro_tv", "command": "powerOn"}'),
  ('00000002-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001', 2, 'wait', 'Wait for video', '{"duration_seconds": 120}'),
  ('00000002-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000002', 1, 'mqtt_command', 'Activate pilot light', '{"device_id": "pilot_light", "state": "on"}');

COMMIT;

EOF

echo "✅ Development database seeded successfully!"
echo ""
echo "Test accounts (password: 'password'):"
echo "  - admin@paragon.local (admin)"
echo "  - gm@paragon.local (game_master)"
echo "  - editor@paragon.local (editor)"
echo ""
echo "Test room: The Clockwork Conspiracy"
echo "  - 3 controllers, 3 devices, 3 scenes"
