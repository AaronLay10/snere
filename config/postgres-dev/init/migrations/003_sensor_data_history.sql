-- Migration: Add sensor data history tables
-- Version: 1.1.0
-- Description: Adds tables for storing historical sensor readings and aggregations

-- Sensor readings table (raw data, time-series optimized)
CREATE TABLE sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(100) NOT NULL,  -- temperature, pressure, position, humidity, etc.
  value NUMERIC(12, 4) NOT NULL,       -- Sensor value
  unit VARCHAR(20),                    -- Unit of measurement (F, C, PSI, %, etc.)
  timestamp TIMESTAMPTZ DEFAULT NOW(), -- When reading was taken
  metadata JSONB,                      -- Additional sensor-specific data

  -- Performance indexes
  CONSTRAINT fk_sensor_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Index for time-series queries (most common query pattern)
CREATE INDEX idx_sensor_readings_device_time
  ON sensor_readings(device_id, timestamp DESC);

-- Index for sensor type filtering
CREATE INDEX idx_sensor_readings_type
  ON sensor_readings(sensor_type);

-- Index for time-range queries
CREATE INDEX idx_sensor_readings_timestamp
  ON sensor_readings(timestamp DESC);

-- Composite index for device + sensor type queries
CREATE INDEX idx_sensor_readings_device_sensor
  ON sensor_readings(device_id, sensor_type, timestamp DESC);

-- GIN index for JSONB metadata queries
CREATE INDEX idx_sensor_readings_metadata
  ON sensor_readings USING GIN (metadata);


-- Sensor aggregations table (pre-computed hourly stats for performance)
CREATE TABLE sensor_aggregations (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(100) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,   -- Start of aggregation period
  period_end TIMESTAMPTZ NOT NULL,     -- End of aggregation period
  aggregation_level VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day'

  -- Aggregated statistics
  min_value NUMERIC(12, 4),
  max_value NUMERIC(12, 4),
  avg_value NUMERIC(12, 4),
  stddev_value NUMERIC(12, 4),
  sample_count INTEGER,                -- Number of readings in this period

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_sensor_agg_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE,

  -- Prevent duplicate aggregations
  CONSTRAINT unique_sensor_aggregation
    UNIQUE (device_id, sensor_type, period_start, aggregation_level)
);

-- Index for querying aggregations
CREATE INDEX idx_sensor_agg_device_time
  ON sensor_aggregations(device_id, period_start DESC);

CREATE INDEX idx_sensor_agg_level
  ON sensor_aggregations(aggregation_level, period_start DESC);


-- Sensor thresholds table (for alerts/warnings)
CREATE TABLE sensor_thresholds (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(100) NOT NULL,

  -- Threshold values
  min_warning NUMERIC(12, 4),
  min_critical NUMERIC(12, 4),
  max_warning NUMERIC(12, 4),
  max_critical NUMERIC(12, 4),

  -- Alert settings
  alert_enabled BOOLEAN DEFAULT true,
  alert_cooldown_seconds INTEGER DEFAULT 300, -- 5 minutes between alerts
  last_alert_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_sensor_threshold_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE,

  CONSTRAINT unique_device_sensor_threshold
    UNIQUE (device_id, sensor_type)
);


-- Sensor alerts table (history of threshold violations)
CREATE TABLE sensor_alerts (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  sensor_type VARCHAR(100) NOT NULL,

  alert_level VARCHAR(20) NOT NULL, -- 'warning', 'critical'
  threshold_type VARCHAR(20) NOT NULL, -- 'min', 'max'

  sensor_value NUMERIC(12, 4) NOT NULL,
  threshold_value NUMERIC(12, 4) NOT NULL,

  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  acknowledged_by INTEGER REFERENCES users(id),

  CONSTRAINT fk_sensor_alert_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE
);

-- Index for active alerts
CREATE INDEX idx_sensor_alerts_active
  ON sensor_alerts(device_id) WHERE resolved_at IS NULL;

-- Index for alert history queries
CREATE INDEX idx_sensor_alerts_triggered
  ON sensor_alerts(triggered_at DESC);


-- Data retention policy function (automatically delete old readings)
CREATE OR REPLACE FUNCTION cleanup_old_sensor_data()
RETURNS void AS $$
BEGIN
  -- Keep raw readings for 30 days
  DELETE FROM sensor_readings
  WHERE timestamp < NOW() - INTERVAL '30 days';

  -- Keep minute aggregations for 7 days
  DELETE FROM sensor_aggregations
  WHERE aggregation_level = 'minute'
    AND period_start < NOW() - INTERVAL '7 days';

  -- Keep hourly aggregations for 90 days
  DELETE FROM sensor_aggregations
  WHERE aggregation_level = 'hour'
    AND period_start < NOW() - INTERVAL '90 days';

  -- Keep daily aggregations for 1 year
  DELETE FROM sensor_aggregations
  WHERE aggregation_level = 'day'
    AND period_start < NOW() - INTERVAL '1 year';

  -- Keep resolved alerts for 90 days
  DELETE FROM sensor_alerts
  WHERE resolved_at IS NOT NULL
    AND resolved_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Sensor data cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension or external scheduler)
-- For now, this needs to be run manually or via cron job
-- Example cron: 0 2 * * * psql -U sentient -d sentient -c "SELECT cleanup_old_sensor_data();"


-- Hourly aggregation function (pre-compute stats for performance)
CREATE OR REPLACE FUNCTION aggregate_sensor_data_hourly()
RETURNS void AS $$
DECLARE
  target_hour TIMESTAMPTZ;
BEGIN
  -- Aggregate data for the previous hour
  target_hour := date_trunc('hour', NOW() - INTERVAL '1 hour');

  INSERT INTO sensor_aggregations (
    device_id,
    sensor_type,
    period_start,
    period_end,
    aggregation_level,
    min_value,
    max_value,
    avg_value,
    stddev_value,
    sample_count
  )
  SELECT
    device_id,
    sensor_type,
    target_hour AS period_start,
    target_hour + INTERVAL '1 hour' AS period_end,
    'hour' AS aggregation_level,
    MIN(value) AS min_value,
    MAX(value) AS max_value,
    AVG(value) AS avg_value,
    STDDEV(value) AS stddev_value,
    COUNT(*) AS sample_count
  FROM sensor_readings
  WHERE timestamp >= target_hour
    AND timestamp < target_hour + INTERVAL '1 hour'
  GROUP BY device_id, sensor_type
  ON CONFLICT (device_id, sensor_type, period_start, aggregation_level)
  DO UPDATE SET
    min_value = EXCLUDED.min_value,
    max_value = EXCLUDED.max_value,
    avg_value = EXCLUDED.avg_value,
    stddev_value = EXCLUDED.stddev_value,
    sample_count = EXCLUDED.sample_count;

  RAISE NOTICE 'Hourly aggregation completed for %', target_hour;
END;
$$ LANGUAGE plpgsql;


-- View for current sensor status (latest reading per device/sensor)
CREATE OR REPLACE VIEW current_sensor_status AS
SELECT DISTINCT ON (device_id, sensor_type)
  sr.device_id,
  d.friendly_name AS device_name,
  sr.sensor_type,
  sr.value,
  sr.unit,
  sr.timestamp,
  sr.metadata,
  -- Include threshold info if configured
  st.min_warning,
  st.min_critical,
  st.max_warning,
  st.max_critical,
  -- Alert status
  CASE
    WHEN sr.value < st.min_critical OR sr.value > st.max_critical THEN 'critical'
    WHEN sr.value < st.min_warning OR sr.value > st.max_warning THEN 'warning'
    ELSE 'normal'
  END AS alert_status,
  -- Time since last reading
  EXTRACT(EPOCH FROM (NOW() - sr.timestamp)) AS seconds_since_reading
FROM sensor_readings sr
LEFT JOIN devices d ON sr.device_id = d.device_id
LEFT JOIN sensor_thresholds st ON sr.device_id = st.device_id
  AND sr.sensor_type = st.sensor_type
ORDER BY sr.device_id, sr.sensor_type, sr.timestamp DESC;


-- Grant permissions
GRANT SELECT, INSERT, DELETE ON sensor_readings TO sentient;
GRANT SELECT, INSERT, UPDATE, DELETE ON sensor_aggregations TO sentient;
GRANT SELECT, INSERT, UPDATE, DELETE ON sensor_thresholds TO sentient;
GRANT SELECT, INSERT, UPDATE, DELETE ON sensor_alerts TO sentient;
GRANT SELECT ON current_sensor_status TO sentient;
GRANT USAGE, SELECT ON SEQUENCE sensor_readings_id_seq TO sentient;
GRANT USAGE, SELECT ON SEQUENCE sensor_aggregations_id_seq TO sentient;
GRANT USAGE, SELECT ON SEQUENCE sensor_thresholds_id_seq TO sentient;
GRANT USAGE, SELECT ON SEQUENCE sensor_alerts_id_seq TO sentient;

-- Success message
SELECT 'Sensor data history schema created successfully!' AS status;
