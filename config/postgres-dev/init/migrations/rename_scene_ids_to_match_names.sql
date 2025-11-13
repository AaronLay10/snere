-- ============================================================================
-- Migration: Rename Scene IDs to Match Scene Names
-- Date: 2025-10-21
-- Purpose:
--   Update scene IDs to be descriptive and match their names
--   Old IDs were legacy names or didn't match current names
-- ============================================================================

BEGIN;

-- ============================================================================
-- Scene 1 - Intro & Boiler (already good: scene_1_intro_boiler)
-- ============================================================================
-- No change needed

-- ============================================================================
-- Scene 2 - Betrayal (change from: vern_dies_cutscene)
-- ============================================================================
UPDATE scenes
SET id = 'scene_2_betrayal'
WHERE id = 'vern_dies_cutscene';

-- ============================================================================
-- Scene 3 - The Study (change from: scene_2_study)
-- ============================================================================
UPDATE scenes
SET id = 'scene_3_study'
WHERE id = 'scene_2_study';

-- ============================================================================
-- Scene 4 - The Kraken (change from: scene_3_kraken)
-- ============================================================================
UPDATE scenes
SET id = 'scene_4_kraken'
WHERE id = 'scene_3_kraken';

-- ============================================================================
-- Scene 5 - The Lab (change from: scene_4_lab)
-- ============================================================================
UPDATE scenes
SET id = 'scene_5_lab'
WHERE id = 'scene_4_lab';

-- ============================================================================
-- Scene 6 - The Plan (change from: clock_cutscene)
-- ============================================================================
UPDATE scenes
SET id = 'scene_6_plan'
WHERE id = 'clock_cutscene';

-- ============================================================================
-- Scene 7 - The Clock (change from: scene_5_clock)
-- ============================================================================
UPDATE scenes
SET id = 'scene_7_clock'
WHERE id = 'scene_5_clock';

-- ============================================================================
-- Scene 8 - Sacrifice & Escape (change from: scene_6_sacrifice_escape)
-- ============================================================================
UPDATE scenes
SET id = 'scene_8_sacrifice_escape'
WHERE id = 'scene_6_sacrifice_escape';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- List all scenes with their new IDs
SELECT scene_number, id, name, scene_type
FROM scenes
ORDER BY scene_number;

-- Count scenes (should be 8)
SELECT COUNT(*) as total_scenes FROM scenes;

COMMIT;
