-- Sentient Engine Database Initialization
-- This script runs automatically when the PostgreSQL container is first created

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create schema version tracking table
CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Log initialization
INSERT INTO schema_version (version, description)
VALUES ('1.0.0', 'Initial database setup with UUID extension')
ON CONFLICT (version) DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sentient_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sentient_dev;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentient_dev;

-- Create logging function for auditing
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;