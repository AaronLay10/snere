-- ============================================================================
-- Migration 003: Device Sensor Data & Real-time State Tracking
-- ============================================================================
-- Purpose: Store real-time sensor readings and device state for dashboard display
-- Created: 2025-10-17
-- Version: 1.0.0

-- Create device_sensor_data table for time-series sensor readings
CREATE TABLE IF NOT EXISTS device_sensor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sensor_name VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  received_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_device_sensor_data_device ON device_sensor_data(device_id);
CREATE INDEX idx_device_sensor_data_received ON device_sensor_data(received_at DESC);
CREATE INDEX idx_device_sensor_data_device_sensor ON device_sensor_data(device_id, sensor_name);
CREATE INDEX idx_device_sensor_data_device_recent ON device_sensor_data(device_id, received_at DESC);

-- Add state JSONB column to devices table if not exists (for current state storage)
-- This stores the most recent hardware state (e.g., {fireLEDs: true, monitorPower: false})
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='devices' AND column_name='state') THEN
        ALTER TABLE devices ADD COLUMN state JSONB;
    END IF;
END $$;

-- Create function to auto-cleanup old sensor data (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_sensor_data()
RETURNS void AS $$
BEGIN
    DELETE FROM device_sensor_data
    WHERE received_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sensor-data', '0 2 * * *', 'SELECT cleanup_old_sensor_data();');

-- Record migration
INSERT INTO schema_version (version, description, applied_at)
VALUES ('1.0.1', 'Add device sensor data tracking and real-time state storage', NOW())
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed successfully!';
    RAISE NOTICE 'Created device_sensor_data table with indexes';
    RAISE NOTICE 'Added state column to devices table';
    RAISE NOTICE 'Sensor data will be auto-cleaned after 7 days';
END $$;
