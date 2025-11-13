-- Scene Orchestrator Database Schema
-- MythraOS - Theatrical Control System

-- ============================================================================
-- Scenes Table
-- Stores all puzzle and cutscene configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenes (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('puzzle', 'cutscene')),
  name VARCHAR(255) NOT NULL,
  room_id VARCHAR(100) NOT NULL,
  description TEXT,

  -- Full configuration stored as JSONB for flexibility
  config JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT valid_config CHECK (
    config ? 'id' AND
    config ? 'type' AND
    config ? 'name' AND
    config ? 'roomId'
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenes_room_id ON scenes(room_id);
CREATE INDEX IF NOT EXISTS idx_scenes_type ON scenes(type);
CREATE INDEX IF NOT EXISTS idx_scenes_room_type ON scenes(room_id, type);

-- ============================================================================
-- Scene Runtime State Table
-- Tracks the current state of each scene during gameplay
-- ============================================================================

CREATE TABLE IF NOT EXISTS scene_runtime_state (
  scene_id VARCHAR(255) PRIMARY KEY REFERENCES scenes(id) ON DELETE CASCADE,
  session_id VARCHAR(255),

  -- Current state
  state VARCHAR(50) NOT NULL CHECK (state IN (
    'inactive',
    'waiting',
    'active',
    'solved',
    'overridden',
    'reset',
    'powered_off',
    'failed',
    'timeout',
    'error'
  )),

  -- Timing
  started_at BIGINT,
  completed_at BIGINT,
  last_updated BIGINT NOT NULL,

  -- Tracking
  attempts INTEGER DEFAULT 0,
  current_action_index INTEGER, -- For cutscenes

  -- Additional runtime data
  runtime_data JSONB DEFAULT '{}'::JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runtime_session ON scene_runtime_state(session_id);
CREATE INDEX IF NOT EXISTS idx_runtime_state ON scene_runtime_state(state);

-- ============================================================================
-- Room State Table
-- Tracks room-level state (power, current session, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_state (
  room_id VARCHAR(100) PRIMARY KEY,
  power_state VARCHAR(20) NOT NULL DEFAULT 'on' CHECK (power_state IN ('on', 'off', 'emergency_off')),
  current_session_id VARCHAR(255),
  last_updated BIGINT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================================================
-- Scene History Table
-- Audit log of all scene state changes for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS scene_history (
  id SERIAL PRIMARY KEY,
  scene_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  room_id VARCHAR(100) NOT NULL,

  -- State transition
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,

  -- Timing
  timestamp BIGINT NOT NULL,
  duration_ms BIGINT, -- Time spent in previous state

  -- Context
  triggered_by VARCHAR(50), -- 'player', 'director', 'system', 'timeout'
  trigger_reason TEXT,

  -- Additional context
  context JSONB DEFAULT '{}'::JSONB
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_history_scene ON scene_history(scene_id);
CREATE INDEX IF NOT EXISTS idx_history_session ON scene_history(session_id);
CREATE INDEX IF NOT EXISTS idx_history_room ON scene_history(room_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON scene_history(timestamp);

-- ============================================================================
-- Director Commands Log
-- Audit log of all director interventions
-- ============================================================================

CREATE TABLE IF NOT EXISTS director_commands (
  id SERIAL PRIMARY KEY,
  command VARCHAR(50) NOT NULL,
  scene_id VARCHAR(255),
  room_id VARCHAR(100),
  session_id VARCHAR(255),

  -- Command details
  payload JSONB,
  reason TEXT,

  -- Audit
  executed_by VARCHAR(255), -- Username/ID of director
  executed_at BIGINT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commands_room ON director_commands(room_id);
CREATE INDEX IF NOT EXISTS idx_commands_timestamp ON director_commands(executed_at);

-- ============================================================================
-- Scene Configurations Archive
-- Stores historical versions of scene configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS scene_config_versions (
  id SERIAL PRIMARY KEY,
  scene_id VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  config JSONB NOT NULL,

  -- Change tracking
  changed_by VARCHAR(255),
  changed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT,

  UNIQUE(scene_id, version)
);

CREATE INDEX IF NOT EXISTS idx_versions_scene ON scene_config_versions(scene_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for scenes table
CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log scene state changes
CREATE OR REPLACE FUNCTION log_scene_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO scene_history (
      scene_id,
      session_id,
      room_id,
      from_state,
      to_state,
      timestamp,
      duration_ms,
      triggered_by
    )
    SELECT
      NEW.scene_id,
      NEW.session_id,
      s.room_id,
      OLD.state,
      NEW.state,
      NEW.last_updated,
      CASE
        WHEN OLD.started_at IS NOT NULL THEN NEW.last_updated - OLD.started_at
        ELSE NULL
      END,
      'system' -- Can be overridden by application
    FROM scenes s
    WHERE s.id = NEW.scene_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic history logging
CREATE TRIGGER log_scene_state_change_trigger
  AFTER UPDATE ON scene_runtime_state
  FOR EACH ROW
  EXECUTE FUNCTION log_scene_state_change();

-- ============================================================================
-- Initial Data / Seed
-- ============================================================================

-- Insert default room states for known rooms
INSERT INTO room_state (room_id, power_state, last_updated)
VALUES
  ('clockwork', 'on', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('pharaohs', 'on', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('requiem', 'on', EXTRACT(EPOCH FROM NOW()) * 1000),
  ('flytanic', 'on', EXTRACT(EPOCH FROM NOW()) * 1000)
ON CONFLICT (room_id) DO NOTHING;

-- ============================================================================
-- Useful Queries (Comments for reference)
-- ============================================================================

-- Get all scenes for a room with their current state:
-- SELECT s.*, rs.state, rs.started_at, rs.attempts
-- FROM scenes s
-- LEFT JOIN scene_runtime_state rs ON s.id = rs.scene_id
-- WHERE s.room_id = 'clockwork'
-- ORDER BY s.created_at;

-- Get available scenes (prerequisites met, not blocked):
-- This is complex and better handled in application logic

-- Get room timeline/progress:
-- SELECT
--   s.id,
--   s.name,
--   s.type,
--   COALESCE(rs.state, 'inactive') as state,
--   s.config->'prerequisites' as prerequisites
-- FROM scenes s
-- LEFT JOIN scene_runtime_state rs ON s.id = rs.scene_id
-- WHERE s.room_id = 'clockwork';

-- Get director command history:
-- SELECT * FROM director_commands
-- WHERE room_id = 'clockwork'
-- ORDER BY executed_at DESC
-- LIMIT 50;
