-- ============================================================================
-- Migration: Eliminate Cutscene Terminology
-- Date: 2025-10-21
-- Purpose:
--   Convert all scenes to type 'standard' and renumber according to new flowchart
--   Scene 1 - Intro & Boiler
--   Scene 2 - Betrayal (was Cutscene 1)
--   Scene 3 - The Study
--   Scene 4 - The Kraken
--   Scene 5 - The Lab
--   Scene 6 - The Plan (was Cutscene 2)
--   Scene 7 - The Clock
--   Scene 8 - Sacrifice & Escape
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: First, set all scene_numbers to temporary high values to avoid conflicts
-- ============================================================================
UPDATE scenes SET scene_number = 101 WHERE id = 'scene_1_intro_boiler';
UPDATE scenes SET scene_number = 102 WHERE id = 'vern_dies_cutscene';
UPDATE scenes SET scene_number = 103 WHERE id = 'scene_2_study';
UPDATE scenes SET scene_number = 104 WHERE id = 'scene_3_kraken';
UPDATE scenes SET scene_number = 105 WHERE id = 'scene_4_lab';
UPDATE scenes SET scene_number = 106 WHERE id = 'clock_cutscene';
UPDATE scenes SET scene_number = 107 WHERE id = 'scene_5_clock';
UPDATE scenes SET scene_number = 108 WHERE id = 'scene_6_sacrifice_escape';

-- ============================================================================
-- STEP 1: Scene 1 - Intro & Boiler (no change needed)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 1,
  scene_type = 'standard',
  name = 'Scene 1 - Intro & Boiler',
  slug = 'intro-boiler',
  updated_at = NOW()
WHERE id = 'scene_1_intro_boiler';

-- ============================================================================
-- STEP 2: Scene 2 - Betrayal (was cutscene 1)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 2,
  scene_type = 'standard',
  name = 'Scene 2 - Betrayal',
  slug = 'betrayal',
  description = 'Betrayal scene with Vern and critical story moments',
  updated_at = NOW()
WHERE id = 'vern_dies_cutscene';

-- ============================================================================
-- STEP 3: Scene 3 - The Study (was scene 2)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 3,
  scene_type = 'standard',
  name = 'Scene 3 - The Study',
  slug = 'the-study',
  updated_at = NOW()
WHERE id = 'scene_2_study';

-- ============================================================================
-- STEP 4: Scene 4 - The Kraken (was scene 3)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 4,
  scene_type = 'standard',
  name = 'Scene 4 - The Kraken',
  slug = 'the-kraken',
  updated_at = NOW()
WHERE id = 'scene_3_kraken';

-- ============================================================================
-- STEP 5: Scene 5 - The Lab (was scene 4)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 5,
  scene_type = 'standard',
  name = 'Scene 5 - The Lab',
  slug = 'the-lab',
  updated_at = NOW()
WHERE id = 'scene_4_lab';

-- ============================================================================
-- STEP 6: Scene 6 - The Plan (was cutscene 2)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 6,
  scene_type = 'standard',
  name = 'Scene 6 - The Plan',
  slug = 'the-plan',
  description = 'The Plan scene with strategic story elements',
  updated_at = NOW()
WHERE id = 'clock_cutscene';

-- ============================================================================
-- STEP 7: Scene 7 - The Clock (was scene 5)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 7,
  scene_type = 'standard',
  name = 'Scene 7 - The Clock',
  slug = 'the-clock',
  updated_at = NOW()
WHERE id = 'scene_5_clock';

-- ============================================================================
-- STEP 8: Scene 8 - Sacrifice & Escape (was scene 6)
-- ============================================================================
UPDATE scenes
SET
  scene_number = 8,
  scene_type = 'standard',
  name = 'Scene 8 - Sacrifice & Escape',
  slug = 'sacrifice-escape',
  updated_at = NOW()
WHERE id = 'scene_6_sacrifice_escape';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count scenes by type (should show 8 standard, 0 cutscene)
SELECT scene_type, COUNT(*)
FROM scenes
GROUP BY scene_type
ORDER BY scene_type;

-- List all scenes in order
SELECT scene_number, name, scene_type, id
FROM scenes
ORDER BY scene_number;

COMMIT;
