-- Migration: Clean Scene IDs - Remove scene_N_ prefix
-- Purpose: Standardize scene IDs to use clean slug format (intro_boiler instead of scene_1_intro_boiler)
-- Date: 2025-10-22
-- Version: 1.1.0

BEGIN;

-- Create temporary table to track old -> new ID mappings
CREATE TEMP TABLE scene_id_mapping (
    old_id VARCHAR(255),
    new_id VARCHAR(255),
    scene_name VARCHAR(255)
);

-- Build mapping for scenes that need to change (those with scene_N_ prefix)
INSERT INTO scene_id_mapping (old_id, new_id, scene_name)
SELECT
    id as old_id,
    REGEXP_REPLACE(id, '^scene_\d+_', '') as new_id,
    name as scene_name
FROM scenes
WHERE id LIKE 'scene_%'
AND id ~ '^scene_\d+_';

-- Show what will be changed
SELECT
    old_id as "Current ID",
    new_id as "New ID",
    scene_name as "Scene Name"
FROM scene_id_mapping
ORDER BY old_id;

-- STEP 1: Temporarily disable foreign key constraints
ALTER TABLE scene_steps DROP CONSTRAINT scene_steps_scene_id_fkey;
ALTER TABLE scene_runtime_state DROP CONSTRAINT scene_runtime_state_scene_id_fkey;
ALTER TABLE puzzles DROP CONSTRAINT puzzles_scene_id_fkey;
ALTER TABLE director_commands DROP CONSTRAINT director_commands_scene_id_fkey;

-- STEP 2: Update the scene IDs themselves (primary key update)
UPDATE scenes
SET id = m.new_id
FROM scene_id_mapping m
WHERE scenes.id = m.old_id;

-- STEP 3: Update all foreign key references

-- 3a. Update scene_steps.scene_id
UPDATE scene_steps
SET scene_id = m.new_id
FROM scene_id_mapping m
WHERE scene_steps.scene_id = m.old_id;

-- 3b. Update scene_runtime_state.scene_id
UPDATE scene_runtime_state
SET scene_id = m.new_id
FROM scene_id_mapping m
WHERE scene_runtime_state.scene_id = m.old_id;

-- 3c. Update puzzles.scene_id
UPDATE puzzles
SET scene_id = m.new_id
FROM scene_id_mapping m
WHERE puzzles.scene_id = m.old_id;

-- 3d. Update director_commands.scene_id
UPDATE director_commands
SET scene_id = m.new_id
FROM scene_id_mapping m
WHERE director_commands.scene_id = m.old_id;

-- 3e. Update any scene prerequisites references (JSONB array)
UPDATE scenes
SET prerequisites = (
    SELECT jsonb_agg(
        CASE
            WHEN elem.value::text IN (SELECT concat('"', old_id, '"') FROM scene_id_mapping)
            THEN to_jsonb((SELECT new_id FROM scene_id_mapping WHERE concat('"', old_id, '"') = elem.value::text))
            ELSE elem.value
        END
    )
    FROM jsonb_array_elements(prerequisites) elem
)
WHERE prerequisites IS NOT NULL
AND prerequisites != '[]'::jsonb;

-- STEP 4: Re-enable foreign key constraints
ALTER TABLE scene_steps ADD CONSTRAINT scene_steps_scene_id_fkey
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE scene_runtime_state ADD CONSTRAINT scene_runtime_state_scene_id_fkey
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE puzzles ADD CONSTRAINT puzzles_scene_id_fkey
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;
ALTER TABLE director_commands ADD CONSTRAINT director_commands_scene_id_fkey
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL;

-- Show final result
SELECT
    id as "Scene ID",
    name as "Name",
    slug as "Slug",
    scene_number as "Number"
FROM scenes
WHERE room_id = 'clockwork-corridor'
AND scene_number IS NOT NULL
ORDER BY scene_number;

COMMIT;
