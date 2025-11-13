-- ============================================================================
-- Migration: Fix Scenes and Puzzles Structure
-- Date: 2025-10-21
-- Purpose:
--   1. Create 6 missing standard scenes
--   2. Fix cutscene naming to match flowchart
--   3. Migrate puzzles from scenes table to puzzles table
--   4. Delete puzzle records from scenes table
-- ============================================================================

-- Room ID for Clockwork Corridor
-- clockwork-corridor

BEGIN;

-- ============================================================================
-- STEP 1: Create 6 Standard Scenes
-- ============================================================================

-- Scene 1 - Intro & Boiler
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_1_intro_boiler',
  'clockwork-corridor',
  1,
  'Scene 1 - Intro & Boiler',
  'intro-boiler',
  'Opening scene with Vern introduction and boiler room puzzles',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scene 2 - The Study
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_2_study',
  'clockwork-corridor',
  2,
  'Scene 2 - The Study',
  'the-study',
  'Study room with multiple puzzles and challenges',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scene 3 - The Kraken
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_3_kraken',
  'clockwork-corridor',
  3,
  'Scene 3 - The Kraken',
  'the-kraken',
  'Kraken room with tentacle mechanisms',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scene 4 - The Lab
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_4_lab',
  'clockwork-corridor',
  4,
  'Scene 4 - The Lab',
  'the-lab',
  'Laboratory area with scientific puzzles',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scene 5 - The Clock
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_5_clock',
  'clockwork-corridor',
  5,
  'Scene 5 - The Clock',
  'the-clock',
  'Clock tower section with timing puzzles',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Scene 6 - Sacrifice & Escape
INSERT INTO scenes (
  id, room_id, scene_number, name, slug, description,
  scene_type, transition_type, auto_advance,
  created_at, updated_at
)
VALUES (
  'scene_6_sacrifice_escape',
  'clockwork-corridor',
  6,
  'Scene 6 - Sacrifice & Escape',
  'sacrifice-escape',
  'Final scene with sacrifice and escape sequence',
  'standard',
  'manual',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Update Cutscenes to Match Flowchart
-- ============================================================================

-- Update existing cutscenes to have proper scene numbers
-- Cutscene 1 - Betrayal (appears after Scene 1)
UPDATE scenes
SET scene_number = 11,
    name = 'Cutscene 1 - Betrayal',
    slug = 'cutscene-betrayal',
    updated_at = NOW()
WHERE id = 'vern_dies_cutscene';

-- Cutscene 2 - The Plan (appears after Scene 4)
UPDATE scenes
SET scene_number = 12,
    name = 'Cutscene 2 - The Plan',
    slug = 'cutscene-plan',
    updated_at = NOW()
WHERE id = 'clock_cutscene';

-- Delete extra cutscenes that aren't in the flowchart
DELETE FROM scenes WHERE id IN (
  'intro_cutscene',
  'lights_blacklight_cutscene',
  'lab_doors_cutscene',
  'final_cutscene'
);

-- ============================================================================
-- STEP 3: Migrate Puzzles from scenes table to puzzles table
-- ============================================================================

-- Insert puzzles into puzzles table from scenes table
INSERT INTO puzzles (
  id,
  room_id,
  scene_id,
  puzzle_id,
  name,
  puzzle_type,
  description,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() AS id,
  'clockwork-corridor' AS room_id,
  NULL AS scene_id,  -- Will need to be updated manually based on flowchart
  LOWER(REPLACE(id, '_puzzle', '')) AS puzzle_id,
  name,
  'mechanical' AS puzzle_type,  -- Default type, adjust as needed
  name AS description,
  'active' AS status,
  NOW() AS created_at,
  NOW() AS updated_at
FROM scenes
WHERE scene_type = 'puzzle'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Delete puzzle records from scenes table
-- ============================================================================

DELETE FROM scenes WHERE scene_type = 'puzzle';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count scenes by type (should show 6 standard + 2 cutscene = 8 total)
SELECT scene_type, COUNT(*)
FROM scenes
GROUP BY scene_type
ORDER BY scene_type;

-- Count puzzles (should show 18)
SELECT COUNT(*) as puzzle_count FROM puzzles;

-- List all scenes
SELECT id, name, scene_type, scene_number
FROM scenes
ORDER BY scene_number NULLS LAST;

COMMIT;
