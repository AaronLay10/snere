-- Scene Orchestrator Runtime Tables
-- Migration: 004
-- Created: 2025-10-17
-- Description: Tables for Scene Orchestrator runtime state, room state, and director commands

-- ============================================================================
-- SCENE RUNTIME STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS scene_runtime_state (
  scene_id UUID PRIMARY KEY REFERENCES scenes(id) ON DELETE CASCADE,
  session_id UUID, -- Optional reference to current session

  -- State tracking
  state VARCHAR(50) NOT NULL DEFAULT 'inactive', -- inactive, waiting, active, solved, overridden, failed, timeout, error, powered_off
  attempts INTEGER DEFAULT 0,

  -- Timing
  started_at BIGINT, -- Timestamp in milliseconds since epoch
  completed_at BIGINT, -- Timestamp in milliseconds since epoch
  last_updated BIGINT NOT NULL, -- Timestamp in milliseconds since epoch

  -- Cutscene-specific
  current_action_index INTEGER, -- Current action index for cutscenes

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scene_runtime_state_session ON scene_runtime_state(session_id);
CREATE INDEX idx_scene_runtime_state_state ON scene_runtime_state(state);
CREATE INDEX idx_scene_runtime_last_updated ON scene_runtime_state(last_updated);

COMMENT ON TABLE scene_runtime_state IS 'Runtime state tracking for scenes (puzzles and cutscenes)';
COMMENT ON COLUMN scene_runtime_state.state IS 'Current scene state: inactive, waiting, active, solved, overridden, failed, timeout, error, powered_off';
COMMENT ON COLUMN scene_runtime_state.started_at IS 'Unix timestamp (ms) when scene was activated';
COMMENT ON COLUMN scene_runtime_state.completed_at IS 'Unix timestamp (ms) when scene was completed';
COMMENT ON COLUMN scene_runtime_state.last_updated IS 'Unix timestamp (ms) of last state change';

-- ============================================================================
-- ROOM STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS room_state (
  room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,

  -- Power state
  power_state VARCHAR(50) NOT NULL DEFAULT 'on', -- on, off, emergency_off

  -- Session tracking
  current_session_id UUID, -- Currently active session

  -- Timing
  last_updated BIGINT NOT NULL, -- Timestamp in milliseconds since epoch

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_room_state_power ON room_state(power_state);
CREATE INDEX idx_room_state_session ON room_state(current_session_id);

COMMENT ON TABLE room_state IS 'Room-level state tracking (power, session)';
COMMENT ON COLUMN room_state.power_state IS 'Room power state: on, off, emergency_off';
COMMENT ON COLUMN room_state.current_session_id IS 'UUID of currently active game session';

-- ============================================================================
-- DIRECTOR COMMANDS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS director_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Command details
  command VARCHAR(100) NOT NULL, -- reset, override, skip, stop, start, power_on, power_off, emergency_stop, jump_to_scene
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  session_id UUID, -- Optional session reference

  -- Command payload
  payload JSONB, -- Additional command parameters
  reason TEXT, -- Optional reason for director intervention

  -- Execution details
  executed_by VARCHAR(255) NOT NULL DEFAULT 'system', -- Username or system
  executed_at BIGINT NOT NULL, -- Unix timestamp in milliseconds

  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT, -- Error message if success = false

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_director_commands_scene ON director_commands(scene_id);
CREATE INDEX idx_director_commands_room ON director_commands(room_id);
CREATE INDEX idx_director_commands_session ON director_commands(session_id);
CREATE INDEX idx_director_commands_executed_at ON director_commands(executed_at);
CREATE INDEX idx_director_commands_command ON director_commands(command);

COMMENT ON TABLE director_commands IS 'Audit log for all director interventions';
COMMENT ON COLUMN director_commands.command IS 'Type of director command executed';
COMMENT ON COLUMN director_commands.executed_by IS 'Username of director or "system" for automated actions';
COMMENT ON COLUMN director_commands.executed_at IS 'Unix timestamp (ms) when command was executed';

-- ============================================================================
-- UPDATE SCHEMA VERSION
-- ============================================================================

INSERT INTO schema_version (version, description, applied_at)
VALUES ('1.1.0', 'Scene Orchestrator runtime tables', NOW())
ON CONFLICT DO NOTHING;
