-- Change scenes.id from UUID to VARCHAR
-- Migration: 005
-- Created: 2025-10-17
-- Description: Scene Orchestrator uses string IDs (e.g., "intro_cutscene") not UUIDs

-- Drop foreign keys first
ALTER TABLE scene_runtime_state DROP CONSTRAINT IF EXISTS scene_runtime_state_scene_id_fkey;
ALTER TABLE scene_steps DROP CONSTRAINT IF EXISTS scene_steps_scene_id_fkey;
ALTER TABLE puzzles DROP CONSTRAINT IF EXISTS puzzles_scene_id_fkey;
ALTER TABLE director_commands DROP CONSTRAINT IF EXISTS director_commands_scene_id_fkey;

-- Change scenes.id to VARCHAR
ALTER TABLE scenes ALTER COLUMN id TYPE VARCHAR(255);

-- Change foreign key columns to VARCHAR
ALTER TABLE scene_runtime_state ALTER COLUMN scene_id TYPE VARCHAR(255);
ALTER TABLE scene_steps ALTER COLUMN scene_id TYPE VARCHAR(255);
ALTER TABLE puzzles ALTER COLUMN scene_id TYPE VARCHAR(255);
ALTER TABLE director_commands ALTER COLUMN scene_id TYPE VARCHAR(255);

-- Re-add foreign keys with new type
ALTER TABLE scene_runtime_state ADD CONSTRAINT scene_runtime_state_scene_id_fkey
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE scene_steps ADD CONSTRAINT scene_steps_scene_id_fkey
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE puzzles ADD CONSTRAINT puzzles_scene_id_fkey
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE director_commands ADD CONSTRAINT director_commands_scene_id_fkey
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL;

-- Update schema version
INSERT INTO schema_version (version, description, applied_at)
VALUES ('1.1.1', 'Change scene IDs from UUID to VARCHAR for Scene Orchestrator compatibility', NOW())
ON CONFLICT DO NOTHING;
