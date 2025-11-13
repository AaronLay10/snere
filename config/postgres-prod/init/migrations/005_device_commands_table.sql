-- ============================================================================
-- Migration 005: Device Commands Table & Controller Support
-- ============================================================================
-- Purpose: Add proper device-to-commands many-to-one relationship
--          Add controllers table
--          Clear existing data for clean re-registration
-- 
-- Aligned with: Documentation/SYSTEM_ARCHITECTURE.md
-- MQTT Topic Standard: [client]/[room]/[controller]/[device]/commands/[specific_command]
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Create controllers table if it doesn't exist
-- ============================================================================
-- Production has this table but schema.sql doesn't (schema drift)

CREATE TABLE IF NOT EXISTS controllers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  
  -- Identity
  controller_id VARCHAR(100) NOT NULL, -- e.g., boiler_room_subpanel (snake_case)
  friendly_name VARCHAR(255),
  
  -- Hardware
  hardware_type VARCHAR(100), -- Teensy 4.1, Raspberry Pi, etc.
  mcu_model VARCHAR(50),
  clock_speed_mhz INTEGER,
  firmware_version VARCHAR(50),
  sketch_name VARCHAR(100),
  
  -- Capabilities
  controller_type VARCHAR(100), -- e.g., BoilerRmA, VideoManager
  capability_manifest JSONB, -- Full manifest from Teensy registration
  digital_pins_total INTEGER,
  analog_pins_total INTEGER,
  
  -- Network
  ip_address INET,
  mac_address MACADDR,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance, error
  last_heartbeat TIMESTAMP,
  heartbeat_interval_ms INTEGER DEFAULT 10000,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(room_id, controller_id)
);

CREATE INDEX IF NOT EXISTS idx_controllers_room ON controllers(room_id);
CREATE INDEX IF NOT EXISTS idx_controllers_status ON controllers(status);
CREATE INDEX IF NOT EXISTS idx_controllers_controller_id ON controllers(controller_id);

COMMENT ON TABLE controllers IS 'Hardware controllers (Teensy 4.1, RPi) that manage devices';
COMMENT ON COLUMN controllers.controller_id IS 'snake_case identifier used in MQTT topics (e.g., boiler_room_subpanel)';

-- ============================================================================
-- Step 2: Add controller_id FK to devices if it doesn't exist
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'controller_id'
  ) THEN
    ALTER TABLE devices 
    ADD COLUMN controller_id UUID REFERENCES controllers(id) ON DELETE CASCADE;
    
    CREATE INDEX idx_devices_controller ON devices(controller_id);
  END IF;
END $$;

-- ============================================================================
-- Step 3: Create device_commands table (NEW)
-- ============================================================================
-- One-to-many: one device has many commands
-- Populated automatically by device-monitor during controller registration

CREATE TABLE IF NOT EXISTS device_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  
  -- Command identification
  command_name VARCHAR(100) NOT NULL, -- Scene-friendly name (e.g., powerOn, lowerTV)
  specific_command VARCHAR(100) NOT NULL, -- Firmware command name (e.g., power_tv_on, move_tv_down)
  friendly_name VARCHAR(255), -- Human-readable (e.g., "Turn TV On")
  
  -- MQTT topic construction
  -- Full topic: [client]/[room]/[controller]/[device]/commands/[specific_command]
  -- Built from: client_id + room_id + controller_id + device_id + specific_command
  mqtt_topic_suffix VARCHAR(500), -- e.g., "commands/power_tv_on"
  
  -- Command metadata
  command_type VARCHAR(50), -- command, query, reset, calibrate
  parameters JSONB, -- Expected parameters schema
  duration_ms INTEGER, -- Expected execution duration
  
  -- Safety
  safety_critical BOOLEAN DEFAULT false,
  requires_confirmation BOOLEAN DEFAULT false,
  
  -- Status
  enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(device_id, specific_command)
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_command_name ON device_commands(command_name);
CREATE INDEX IF NOT EXISTS idx_device_commands_enabled ON device_commands(enabled);

COMMENT ON TABLE device_commands IS 'Commands available for each device - populated by controller registration';
COMMENT ON COLUMN device_commands.command_name IS 'Scene-friendly name used in scene JSON (e.g., powerOn)';
COMMENT ON COLUMN device_commands.specific_command IS 'Firmware command name used in MQTT topic (e.g., power_tv_on)';
COMMENT ON COLUMN device_commands.mqtt_topic_suffix IS 'Last part of MQTT topic (e.g., commands/power_tv_on)';

-- ============================================================================
-- Step 4: Clean existing data for fresh controller registration
-- ============================================================================
-- Controllers will re-register themselves with correct data

-- Clear devices (cascades to device_commands)
DELETE FROM devices;

-- Clear controllers
DELETE FROM controllers WHERE 1=1;

-- ============================================================================
-- Step 5: Update schema version
-- ============================================================================

INSERT INTO schema_version (version, description, applied_at)
VALUES ('005', 'Add device_commands table, controllers table, and prepare for clean registration', NOW());

COMMIT;

-- ============================================================================
-- Post-Migration Notes
-- ============================================================================
-- 1. Restart all Teensy controllers to trigger re-registration
-- 2. Controllers will self-register with correct controller_id (e.g., boiler_room_subpanel)
-- 3. device-monitor will populate device_commands from capability manifest
-- 4. scene-executor needs update to query device_commands for MQTT topic construction
-- ============================================================================
