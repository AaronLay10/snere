-- Mythra Sentient Engine - Database Schema
-- Version: 1.0.0
-- Created: 2025-10-14

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CLIENTS & TENANCY
-- ============================================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, archived
  mqtt_namespace VARCHAR(100) NOT NULL, -- e.g., 'paragon'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_clients_slug ON clients(slug);
CREATE INDEX idx_clients_status ON clients(status);

COMMENT ON TABLE clients IS 'Escape room businesses (tenants) using the Mythra Sentient Engine';

-- ============================================================================
-- ROOMS
-- ============================================================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  short_name VARCHAR(50),
  theme VARCHAR(255),
  description TEXT,
  narrative TEXT,
  objective TEXT,

  -- Operational parameters
  min_players INTEGER DEFAULT 2,
  max_players INTEGER DEFAULT 8,
  recommended_players INTEGER DEFAULT 6,
  duration_minutes INTEGER DEFAULT 60,
  difficulty_level VARCHAR(50), -- Easy, Medium, Hard, Expert
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
  physical_difficulty VARCHAR(50), -- Low, Medium, High
  age_recommendation VARCHAR(50) DEFAULT '12+',

  -- Accessibility
  wheelchair_accessible BOOLEAN DEFAULT false,
  hearing_impaired_friendly BOOLEAN DEFAULT false,
  vision_impaired_friendly BOOLEAN DEFAULT false,
  accessibility_notes TEXT,

  -- Technical
  scene_count INTEGER DEFAULT 0,
  puzzle_count INTEGER DEFAULT 0,
  device_count INTEGER DEFAULT 0,
  mqtt_topic_base VARCHAR(500), -- e.g., 'sentient/paragon/clockwork'
  network_segment VARCHAR(50),

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, testing, live, maintenance, retired
  version VARCHAR(50) DEFAULT '1.0.0',

  -- Launch info
  development_start_date DATE,
  testing_start_date DATE,
  expected_launch_date DATE,
  soft_launch_date DATE,
  public_launch_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE(client_id, slug)
);

CREATE INDEX idx_rooms_client ON rooms(client_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_slug ON rooms(slug);

COMMENT ON TABLE rooms IS 'Individual escape room experiences';

-- ============================================================================
-- SCENES
-- ============================================================================

CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  scene_type VARCHAR(50) DEFAULT 'standard', -- standard, cutscene, puzzle, transition

  -- Timing
  estimated_duration_seconds INTEGER,
  min_duration_seconds INTEGER,
  max_duration_seconds INTEGER,

  -- Flow control
  transition_type VARCHAR(50) DEFAULT 'manual', -- auto, manual, triggered, conditional
  auto_advance BOOLEAN DEFAULT false,
  auto_advance_delay_ms INTEGER,

  -- Prerequisites
  prerequisites JSONB, -- Array of scene IDs that must complete first

  -- Configuration
  config JSONB, -- Scene-specific configuration data

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE(room_id, scene_number)
);

CREATE INDEX idx_scenes_room ON scenes(room_id);
CREATE INDEX idx_scenes_number ON scenes(scene_number);
CREATE INDEX idx_scenes_slug ON scenes(slug);

COMMENT ON TABLE scenes IS 'Narrative and gameplay phases within a room';

-- ============================================================================
-- SCENE STEPS (Timeline)
-- ============================================================================

CREATE TABLE scene_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL, -- puzzle, video, audio, effect, timed_event, wait_state
  name VARCHAR(255),
  description TEXT,

  -- Configuration
  config JSONB NOT NULL, -- Step-specific configuration
  timing_config JSONB, -- Timing parameters (delays, durations, etc.)

  -- Flow control
  required BOOLEAN DEFAULT true, -- Can this step be skipped?
  repeatable BOOLEAN DEFAULT false,
  max_attempts INTEGER,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE(scene_id, step_number)
);

CREATE INDEX idx_scene_steps_scene ON scene_steps(scene_id);
CREATE INDEX idx_scene_steps_type ON scene_steps(step_type);

COMMENT ON TABLE scene_steps IS 'Individual steps within a scene timeline';

-- ============================================================================
-- DEVICES
-- ============================================================================

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

  -- Identity
  device_id VARCHAR(100) NOT NULL, -- Matches Arduino DEVICE_ID
  puzzle_id VARCHAR(100),
  friendly_name VARCHAR(255),

  -- Classification
  device_type VARCHAR(50) NOT NULL, -- controller, effect, security, composite
  device_category VARCHAR(50) NOT NULL, -- mechanical_movement, sensor, switchable_on_off, variable_control, media_playback

  -- Location
  physical_location VARCHAR(255),

  -- Network
  mqtt_topic VARCHAR(500) NOT NULL,
  ip_address INET,
  mac_address MACADDR,

  -- Hardware
  hardware_type VARCHAR(100), -- Teensy 4.1, Raspberry Pi, etc.
  hardware_version VARCHAR(50),
  firmware_version VARCHAR(50),

  -- Capabilities
  capabilities JSONB, -- Array of capability strings

  -- Safety
  emergency_stop_required BOOLEAN DEFAULT false,
  emergency_stop_config JSONB,
  safety_classification VARCHAR(50), -- standard, safety-critical

  -- Configuration
  config JSONB, -- Full device configuration (sensors, actuators, etc.)

  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance, error
  last_seen TIMESTAMP,
  last_heartbeat TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE(room_id, device_id)
);

CREATE INDEX idx_devices_room ON devices(room_id);
CREATE INDEX idx_devices_type ON devices(device_type);
CREATE INDEX idx_devices_category ON devices(device_category);
CREATE INDEX idx_devices_mqtt_topic ON devices(mqtt_topic);
CREATE INDEX idx_devices_emergency_stop ON devices(emergency_stop_required) WHERE emergency_stop_required = true;
CREATE INDEX idx_devices_status ON devices(status);

COMMENT ON TABLE devices IS 'Physical devices (Teensy controllers, effects, locks)';

-- ============================================================================
-- DEVICE GROUPS
-- ============================================================================

CREATE TABLE device_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  group_type VARCHAR(50), -- composite, logical, emergency_stop_group

  -- Safety
  emergency_stop_required BOOLEAN DEFAULT false,
  emergency_stop_behavior VARCHAR(100),

  -- Configuration
  config JSONB,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(room_id, slug)
);

CREATE INDEX idx_device_groups_room ON device_groups(room_id);

COMMENT ON TABLE device_groups IS 'Logical groupings of devices';

-- ============================================================================
-- DEVICE GROUP MEMBERS
-- ============================================================================

CREATE TABLE device_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  member_role VARCHAR(100), -- primary, secondary, backup
  priority INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(group_id, device_id)
);

CREATE INDEX idx_device_group_members_group ON device_group_members(group_id);
CREATE INDEX idx_device_group_members_device ON device_group_members(device_id);

COMMENT ON TABLE device_group_members IS 'Devices belonging to groups';

-- ============================================================================
-- PUZZLES
-- ============================================================================

CREATE TABLE puzzles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  step_id UUID REFERENCES scene_steps(id) ON DELETE SET NULL,

  -- Identity
  puzzle_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  puzzle_type VARCHAR(50), -- sequence, logic, pattern, physical, timed
  description TEXT,

  -- Solve conditions
  solve_conditions JSONB, -- Array of condition objects
  solve_actions JSONB, -- Array of action objects
  fail_conditions JSONB,
  fail_actions JSONB,

  -- Timing
  time_limit_seconds INTEGER,
  hint_delay_seconds INTEGER,

  -- Configuration
  config JSONB,

  -- Dependencies
  depends_on_puzzles JSONB, -- Array of puzzle IDs
  unlocks_puzzles JSONB, -- Array of puzzle IDs

  -- Difficulty
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),

  -- Status
  status VARCHAR(50) DEFAULT 'active',

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  UNIQUE(room_id, puzzle_id)
);

CREATE INDEX idx_puzzles_room ON puzzles(room_id);
CREATE INDEX idx_puzzles_scene ON puzzles(scene_id);
CREATE INDEX idx_puzzles_step ON puzzles(step_id);
CREATE INDEX idx_puzzles_type ON puzzles(puzzle_type);

COMMENT ON TABLE puzzles IS 'Interactive challenges within rooms';

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),

  -- Role & Access
  role VARCHAR(50) NOT NULL, -- admin, editor, viewer, game_master, creative_director, technician
  client_id UUID REFERENCES clients(id), -- NULL for super admins

  -- Status
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,

  -- Security
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,

  -- Activity
  last_login TIMESTAMP,
  last_login_ip INET,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_users_active ON users(is_active);

COMMENT ON TABLE users IS 'System users with role-based access';

-- ============================================================================
-- USER SESSIONS
-- ============================================================================

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL UNIQUE,

  -- Session data
  ip_address INET,
  user_agent TEXT,

  -- Expiry
  expires_at TIMESTAMP NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

COMMENT ON TABLE user_sessions IS 'Active user sessions for authentication';

-- ============================================================================
-- ROOM SESSIONS (Game Sessions)
-- ============================================================================

CREATE TABLE room_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  game_master_id UUID REFERENCES users(id),

  -- Session info
  session_number VARCHAR(50), -- e.g., "CLK-2025-001"
  player_count INTEGER,

  -- Timing
  scheduled_start_time TIMESTAMP,
  actual_start_time TIMESTAMP,
  actual_end_time TIMESTAMP,
  duration_seconds INTEGER,

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, running, completed, aborted, cancelled

  -- Outcome
  completed BOOLEAN DEFAULT false,
  escaped BOOLEAN DEFAULT false,
  time_remaining_seconds INTEGER,
  puzzles_solved INTEGER,
  puzzles_total INTEGER,
  hints_used INTEGER,
  overrides_used INTEGER,

  -- Notes
  notes TEXT,
  incidents JSONB, -- Array of incident objects

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_room_sessions_room ON room_sessions(room_id);
CREATE INDEX idx_room_sessions_game_master ON room_sessions(game_master_id);
CREATE INDEX idx_room_sessions_status ON room_sessions(status);
CREATE INDEX idx_room_sessions_start_time ON room_sessions(actual_start_time);

COMMENT ON TABLE room_sessions IS 'Individual game sessions (groups playing a room)';

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action details
  action VARCHAR(100) NOT NULL, -- create, update, delete, override, emergency_stop, etc.
  entity_type VARCHAR(50), -- room, scene, device, puzzle, user, etc.
  entity_id UUID,

  -- Changes
  changes JSONB, -- Before/after values for updates

  -- Context
  room_session_id UUID REFERENCES room_sessions(id),
  reason TEXT,

  -- Request info
  ip_address INET,
  user_agent TEXT,

  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_room_session ON audit_log(room_session_id);

COMMENT ON TABLE audit_log IS 'Comprehensive audit trail of all system actions';

-- ============================================================================
-- EMERGENCY STOP EVENTS
-- ============================================================================

CREATE TABLE emergency_stop_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id),
  room_session_id UUID REFERENCES room_sessions(id),

  -- Event details
  device_id UUID REFERENCES devices(id),
  device_group_id UUID REFERENCES device_groups(id),
  stop_type VARCHAR(50) NOT NULL, -- global, device, group

  -- Trigger
  triggered_by_user_id UUID REFERENCES users(id),
  trigger_method VARCHAR(50) NOT NULL, -- mythra_interface, physical_button, mqtt_command, automatic
  trigger_reason TEXT,

  -- Response
  response_time_ms INTEGER,
  devices_affected JSONB, -- Array of device IDs
  stop_successful BOOLEAN,

  -- Recovery
  inspection_required BOOLEAN DEFAULT true,
  inspection_completed BOOLEAN DEFAULT false,
  inspected_by_user_id UUID REFERENCES users(id),
  inspection_notes TEXT,
  inspection_completed_at TIMESTAMP,

  reset_at TIMESTAMP,
  reset_by_user_id UUID REFERENCES users(id),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_emergency_stop_room ON emergency_stop_events(room_id);
CREATE INDEX idx_emergency_stop_session ON emergency_stop_events(room_session_id);
CREATE INDEX idx_emergency_stop_device ON emergency_stop_events(device_id);
CREATE INDEX idx_emergency_stop_created ON emergency_stop_events(created_at DESC);

COMMENT ON TABLE emergency_stop_events IS 'Log of all emergency stop activations';

-- ============================================================================
-- DEVICE HEARTBEATS
-- ============================================================================

CREATE TABLE device_heartbeats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,

  -- Heartbeat data
  mqtt_topic VARCHAR(500),
  payload JSONB,

  -- Status
  online BOOLEAN DEFAULT true,
  firmware_version VARCHAR(50),
  uptime_seconds INTEGER,

  -- Health metrics
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_percent DECIMAL(5,2),
  temperature_celsius DECIMAL(5,2),

  -- Metadata
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_device_heartbeats_device ON device_heartbeats(device_id);
CREATE INDEX idx_device_heartbeats_received ON device_heartbeats(received_at DESC);

-- Automatically delete old heartbeats (keep last 24 hours)
-- This will be handled by application logic or a cron job

COMMENT ON TABLE device_heartbeats IS 'Device health monitoring via MQTT heartbeats';

-- ============================================================================
-- CONFIGURATION VERSIONS
-- ============================================================================

CREATE TABLE configuration_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(50) NOT NULL, -- room, scene, device, puzzle
  entity_id UUID NOT NULL,

  -- Version info
  version_number INTEGER NOT NULL,
  version_tag VARCHAR(100), -- e.g., 'v1.2.0', 'pre-launch', 'production'

  -- Configuration snapshot
  configuration JSONB NOT NULL,

  -- Change description
  change_summary TEXT,
  change_details JSONB,

  -- Status
  is_current BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_config_versions_entity ON configuration_versions(entity_type, entity_id);
CREATE INDEX idx_config_versions_current ON configuration_versions(is_current) WHERE is_current = true;
CREATE INDEX idx_config_versions_version ON configuration_versions(version_number DESC);

COMMENT ON TABLE configuration_versions IS 'Version history of all configurations';

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at BEFORE UPDATE ON scenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scene_steps_updated_at BEFORE UPDATE ON scene_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_puzzles_updated_at BEFORE UPDATE ON puzzles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_room_sessions_updated_at BEFORE UPDATE ON room_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA / SEED
-- ============================================================================

-- Insert system admin user (password will be hashed in application)
-- Default password: 'changeme123!' (MUST be changed on first login)
INSERT INTO users (username, email, password_hash, role, first_name, last_name, is_active)
VALUES (
  'admin',
  'admin@mythrasentient.com',
  '$2b$10$placeholder', -- This will be replaced by proper hash in seed script
  'admin',
  'System',
  'Administrator',
  true
);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Active Devices with Health Status
CREATE VIEW v_active_devices AS
SELECT
  d.*,
  dh.received_at as last_heartbeat_at,
  dh.online,
  dh.firmware_version as current_firmware_version,
  CASE
    WHEN dh.received_at > NOW() - INTERVAL '5 minutes' THEN 'online'
    WHEN dh.received_at > NOW() - INTERVAL '15 minutes' THEN 'warning'
    ELSE 'offline'
  END as health_status
FROM devices d
LEFT JOIN LATERAL (
  SELECT * FROM device_heartbeats
  WHERE device_id = d.id
  ORDER BY received_at DESC
  LIMIT 1
) dh ON true
WHERE d.status = 'active';

COMMENT ON VIEW v_active_devices IS 'Active devices with latest heartbeat status';

-- View: Room Configuration Summary
CREATE VIEW v_room_summary AS
SELECT
  r.*,
  c.name as client_name,
  c.slug as client_slug,
  (SELECT COUNT(*) FROM scenes WHERE room_id = r.id) as actual_scene_count,
  (SELECT COUNT(*) FROM devices WHERE room_id = r.id) as actual_device_count,
  (SELECT COUNT(*) FROM puzzles WHERE room_id = r.id) as actual_puzzle_count,
  (SELECT COUNT(*) FROM devices WHERE room_id = r.id AND emergency_stop_required = true) as emergency_stop_device_count
FROM rooms r
JOIN clients c ON r.client_id = c.id;

COMMENT ON VIEW v_room_summary IS 'Room information with computed statistics';

-- ============================================================================
-- GRANTS (will be customized per deployment)
-- ============================================================================

-- Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentient_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentient_app;

-- ============================================================================
-- SCHEMA VERSION
-- ============================================================================

CREATE TABLE schema_version (
  version VARCHAR(50) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT
);

INSERT INTO schema_version (version, description)
VALUES ('1.0.0', 'Initial Mythra Sentient Engine schema');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
