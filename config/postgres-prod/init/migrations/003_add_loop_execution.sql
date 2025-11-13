-- Migration: Add loop execution mode to scene_steps
-- Date: 2025-10-22
-- Description: Adds support for looping actions at intervals with unique loop IDs

-- Add execution mode columns
ALTER TABLE scene_steps
  ADD COLUMN execution_mode VARCHAR(20) DEFAULT 'once' CHECK (execution_mode IN ('once', 'loop')),
  ADD COLUMN execution_interval INTEGER,
  ADD COLUMN loop_id VARCHAR(100);

-- Create index for loop lookups
CREATE INDEX idx_scene_steps_loop_id ON scene_steps(loop_id) WHERE loop_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN scene_steps.execution_mode IS 'Execution mode: "once" (default) or "loop" (repeats at interval)';
COMMENT ON COLUMN scene_steps.execution_interval IS 'Interval in milliseconds for loop execution (only used when execution_mode = "loop")';
COMMENT ON COLUMN scene_steps.loop_id IS 'Unique identifier for the loop, auto-generated as {device_id}_{action}, used to stop loops later';

-- Update schema version
INSERT INTO schema_version (version, description, applied_at)
VALUES ('1.1.0', 'Add loop execution mode to scene_steps', NOW());
