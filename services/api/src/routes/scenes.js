/**
 * Mythra Sentient Engine - Scenes Routes
 * Manages scene configurations and sequences
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireCapability } = require('../middleware/rbac');

// Executor engine URL
const EXECUTOR_URL = process.env.EXECUTOR_URL || 'http://localhost:3004';

const sceneSchema = Joi.object({
  room_id: Joi.string().required(), // Accept UUID or slug - will resolve to UUID internally
  scene_number: Joi.number().integer().min(1).required(),
  name: Joi.string().required(),
  slug: Joi.string().required(),
  description: Joi.string().allow('', null).optional(),
  estimated_duration_seconds: Joi.number().integer().min(0).optional(),
  min_duration_seconds: Joi.number().integer().min(0).optional(),
  max_duration_seconds: Joi.number().integer().min(0).optional(),
  transition_type: Joi.string().valid('manual', 'automatic', 'trigger', 'puzzle_complete').optional(),
  auto_advance: Joi.boolean().optional(),
  auto_advance_delay_ms: Joi.number().integer().min(0).optional(),
  prerequisites: Joi.object().optional(),
  config: Joi.object().optional()
});

// GET all scenes
router.get('/', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { room_id } = req.query;

    let query = `
      SELECT s.*, r.name as room_name, r.client_id
      FROM scenes s
      INNER JOIN rooms r ON s.room_id = r.id
    `;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Non-admins can only see scenes in their client
    if (req.user.role !== 'admin') {
      conditions.push(`r.client_id = $${paramIndex++}`);
      params.push(req.user.client_id);
    }

    if (room_id) {
      // Support both UUID and slug for room_id
      // We need separate parameters because PostgreSQL infers parameter types
      // If we cast $1 to UUID in one place, we can't use it as VARCHAR in another
      conditions.push(`(s.room_id = $${paramIndex}::uuid OR r.slug = $${paramIndex + 1})`);
      params.push(room_id); // For UUID comparison
      params.push(room_id); // For slug comparison
      paramIndex += 2;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY s.scene_number ASC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      scenes: result.rows
    });
  } catch (error) {
    console.error('List scenes error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve scenes'
    });
  }
});

// GET single scene
router.get('/:id', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT s.*, r.name as room_name, r.client_id
       FROM scenes s
       INNER JOIN rooms r ON s.room_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scene not found'
      });
    }

    const scene = result.rows[0];

    // Check access
    if (req.user.role !== 'admin' && scene.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this scene'
      });
    }

    // Get steps for this scene
    const stepsResult = await db.query(
      `SELECT * FROM scene_steps
       WHERE scene_id = $1
       ORDER BY step_number ASC`,
      [id]
    );

    // Parse config and timing_config JSON and flatten to frontend format
    scene.steps = stepsResult.rows.map(row => ({
      id: row.id,
      step_number: row.step_number,
      name: row.name,
      action: row.config?.action,
      device_id: row.config?.device_id,
      parameters: row.config?.parameters,
      wait_for_completion: row.config?.wait_for_completion,
      delay: row.timing_config?.delay,
      step_type: row.step_type
    }));

    res.json({
      success: true,
      scene: scene
    });
  } catch (error) {
    console.error('Get scene error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve scene'
    });
  }
});

// POST create scene
router.post('/', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = sceneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const {
      room_id,
      scene_number,
      name,
      slug,
      description,
      estimated_duration_seconds,
      min_duration_seconds,
      max_duration_seconds,
      transition_type = 'manual',
      auto_advance = false,
      auto_advance_delay_ms,
      prerequisites,
      config
    } = value;

    // Resolve room_id - accept UUID or slug
    const roomResult = await db.query(
      'SELECT id, client_id FROM rooms WHERE id::text = $1 OR slug = $1',
      [room_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: `Room not found: ${room_id}`
      });
    }

    const actualRoomId = roomResult.rows[0].id;
    const client_id = roomResult.rows[0].client_id;

    if (req.user.role !== 'admin' && client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this room'
      });
    }

    // Check if scene number already exists for this room
    const existingScene = await db.query(
      'SELECT id FROM scenes WHERE room_id = $1 AND scene_number = $2',
      [actualRoomId, scene_number]
    );

    if (existingScene.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: `Scene number ${scene_number} already exists for this room`
      });
    }

    // Create scene
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO scenes (
        id, room_id, scene_number, name, slug, description,
        estimated_duration_seconds, min_duration_seconds, max_duration_seconds,
        transition_type, auto_advance, auto_advance_delay_ms,
        prerequisites, config, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id, actualRoomId, scene_number, name, slug, description,
        estimated_duration_seconds, min_duration_seconds, max_duration_seconds,
        transition_type, auto_advance, auto_advance_delay_ms,
        prerequisites ? JSON.stringify(prerequisites) : null,
        config ? JSON.stringify(config) : null,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      scene: result.rows[0]
    });
  } catch (error) {
    console.error('Create scene error:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        error: 'Conflict',
        message: 'A scene with this number already exists in this room'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create scene'
    });
  }
});

// PUT update scene
router.put('/:id', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get existing scene
    const existing = await db.query(
      `SELECT s.*, r.client_id
       FROM scenes s
       INNER JOIN rooms r ON s.room_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scene not found'
      });
    }

    const scene = existing.rows[0];

    // Check access
    if (req.user.role !== 'admin' && scene.client_id !== req.user.client_id) {
      console.error(`Scene update access denied: user.clientId=${req.user.client_id}, scene.client_id=${scene.client_id}, user.role=${req.user.role}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this scene'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const fieldMapping = {
      scene_number: 'scene_number',
      name: 'name',
      slug: 'slug',
      description: 'description',
      scene_type: 'scene_type',
      estimated_duration_seconds: 'estimated_duration_seconds',
      min_duration_seconds: 'min_duration_seconds',
      max_duration_seconds: 'max_duration_seconds',
      transition_type: 'transition_type',
      auto_advance: 'auto_advance',
      auto_advance_delay_ms: 'auto_advance_delay_ms',
      prerequisites: 'prerequisites',
      config: 'config'
    };

    for (const [snakeKey, dbKey] of Object.entries(fieldMapping)) {
      if (req.body[snakeKey] !== undefined) {
        const value = req.body[snakeKey];

        // Handle JSON fields
        if (snakeKey === 'prerequisites' || snakeKey === 'config') {
          updates.push(`${dbKey} = $${paramIndex++}`);
          params.push(value ? JSON.stringify(value) : null);
        } else {
          updates.push(`${dbKey} = $${paramIndex++}`);
          params.push(value);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(req.user.id);
    params.push(id);

    const query = `
      UPDATE scenes
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      scene: result.rows[0]
    });
  } catch (error) {
    console.error('Update scene error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A scene with this number already exists in this room'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update scene'
    });
  }
});

// DELETE scene
router.delete('/:id', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get scene with client_id
    const existing = await db.query(
      `SELECT s.*, r.client_id
       FROM scenes s
       INNER JOIN rooms r ON s.room_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scene not found'
      });
    }

    const scene = existing.rows[0];

    // Check access
    if (req.user.role !== 'admin' && scene.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have access to this scene'
      });
    }

    // Delete scene (will cascade to scene_steps)
    await db.query('DELETE FROM scenes WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Scene deleted successfully'
    });
  } catch (error) {
    console.error('Delete scene error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete scene'
    });
  }
});

// GET scene steps
router.get('/:id/steps', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify scene exists and user has access
    const sceneResult = await db.query(
      `SELECT s.id, r.client_id
       FROM scenes s
       INNER JOIN rooms r ON s.room_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (sceneResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scene not found'
      });
    }

    const scene = sceneResult.rows[0];

    if (req.user.role !== 'admin' && scene.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Get steps
    const stepsResult = await db.query(
      `SELECT * FROM scene_steps
       WHERE scene_id = $1
       ORDER BY step_number ASC`,
      [id]
    );

    // Parse config and timing_config JSON and flatten to frontend format
    const steps = stepsResult.rows.map(row => ({
      id: row.id,
      step_number: row.step_number,
      name: row.name,
      action: row.config?.action,
      device_id: row.config?.device_id,
      parameters: row.config?.parameters,
      wait_for_completion: row.config?.wait_for_completion,
      delay: row.timing_config?.delay,
      step_type: row.step_type
    }));

    res.json({
      success: true,
      steps: steps
    });
  } catch (error) {
    console.error('Get scene steps error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve scene steps'
    });
  }
});

// PUT update all scene steps (replaces all steps)
router.put('/:id/steps', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { id } = req.params;
    const { steps } = req.body;

    if (!Array.isArray(steps)) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Steps must be an array'
      });
    }

    // Verify scene exists and user has access
    const sceneResult = await db.query(
      `SELECT s.id, r.client_id
       FROM scenes s
       INNER JOIN rooms r ON s.room_id = r.id
       WHERE s.id = $1`,
      [id]
    );

    if (sceneResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Scene not found'
      });
    }

    const scene = sceneResult.rows[0];

    if (req.user.role !== 'admin' && scene.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Delete all existing steps for this scene
      await db.query('DELETE FROM scene_steps WHERE scene_id = $1', [id]);

      // Insert new steps
      for (const step of steps) {
        const stepId = uuidv4();

        // Build config object from step data
        const config = {
          action: step.action,
          device_id: step.device_id,
          parameters: step.parameters || {},
          wait_for_completion: step.wait_for_completion || false
        };

        const timingConfig = {
          delay: step.delay || 0
        };

        await db.query(
          `INSERT INTO scene_steps (
            id, scene_id, step_number, step_type, name,
            config, timing_config
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            stepId,
            id,
            step.step_number,
            'effect', // Default step type
            step.name || null,
            JSON.stringify(config),
            JSON.stringify(timingConfig)
          ]
        );
      }

      await db.query('COMMIT');

      // Get updated steps
      const stepsResult = await db.query(
        `SELECT * FROM scene_steps
         WHERE scene_id = $1
         ORDER BY step_number ASC`,
        [id]
      );

      // Parse config and timing_config JSON and flatten to frontend format
      const updatedSteps = stepsResult.rows.map(row => ({
        id: row.id,
        step_number: row.step_number,
        name: row.name,
        action: row.config?.action,
        device_id: row.config?.device_id,
        parameters: row.config?.parameters,
        wait_for_completion: row.config?.wait_for_completion,
        delay: row.timing_config?.delay,
        step_type: row.step_type
      }));

      res.json({
        success: true,
        steps: updatedSteps
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update scene steps error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update scene steps'
    });
  }
});

/**
 * POST /api/sentient/scenes/:id/export-to-json
 * Convert scene_steps to scenes.json format for scene-executor
 */
/**
 * POST /api/sentient/scenes/:id/export-to-json
 * Export scene and puzzles to separate JSON files in scenes/ and puzzles/ directories
 */
router.post('/:id/export-to-json', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id: sceneId } = req.params;
    const fs = require('fs').promises;
    const path = require('path');

    // Get scene details
    const sceneResult = await db.query(
      'SELECT * FROM scenes WHERE id = $1',
      [sceneId]
    );

    if (sceneResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scene not found'
      });
    }

    const scene = sceneResult.rows[0];

    // Get room details
    const roomResult = await db.query(
      'SELECT * FROM rooms WHERE id = $1',
      [scene.room_id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const room = roomResult.rows[0];

    // Get all steps for this scene (ordered)
    const stepsResult = await db.query(
      `SELECT * FROM scene_steps
       WHERE scene_id = $1
       ORDER BY step_number ASC`,
      [sceneId]
    );

    const steps = stepsResult.rows;

    // Use the actual scene ID from database (not slug)
    const sceneIdForFile = scene.id;

    // Convert room name to snake_case for roomId in JSON
    const roomIdSnakeCase = (room.slug || room.name)
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    // Find room directory
    const roomsBasePath = '/opt/sentient/config/rooms';
    const possibleNames = [
      room.slug,
      room.name.toLowerCase().replace(/\s+/g, '-'),
      room.name.toLowerCase().replace(/\s+/g, ''),
      room.name.split(' ')[0].toLowerCase()
    ];

    let roomConfigPath = null;
    const fsSync = require('fs');
    for (const name of possibleNames) {
      const testPath = path.join(roomsBasePath, name);
      if (fsSync.existsSync(testPath)) {
        roomConfigPath = testPath;
        break;
      }
    }

    if (!roomConfigPath) {
      return res.status(404).json({
        success: false,
        message: `Room configuration directory not found. Tried: ${possibleNames.join(', ')}`,
        error: 'Room directory must exist at /opt/sentient/config/rooms/'
      });
    }

    // Ensure scenes/ and puzzles/ directories exist
    const scenesDir = path.join(roomConfigPath, 'scenes');
    const puzzlesDir = path.join(roomConfigPath, 'puzzles');

    if (!fsSync.existsSync(scenesDir)) {
      await fs.mkdir(scenesDir, { recursive: true });
    }
    if (!fsSync.existsSync(puzzlesDir)) {
      await fs.mkdir(puzzlesDir, { recursive: true });
    }

    // Build scene timeline
    const timeline = [];
    let cumulativeDelay = 0;
    const puzzleFiles = [];

    for (const step of steps) {
      let stepDuration = step.timing_config?.duration_ms || 0;

      // For video steps, use duration_seconds from config and convert to ms
      if (step.step_type === 'video' && step.config?.duration_seconds) {
        stepDuration = step.config.duration_seconds * 1000;
      }

      const delayAfterMs = step.timing_config?.delayAfterMs || 0;

      // Handle puzzle steps - create separate puzzle JSON
      if (step.step_type === 'puzzle') {
        const puzzleId = step.config?.puzzle_id || `${sceneIdSnakeCase}_puzzle_${step.step_number}`;
        const puzzleFileName = `${puzzleId}.json`;

        // Create puzzle JSON
        const puzzleJson = {
          id: puzzleId,
          name: step.name,
          type: 'puzzle',
          description: step.description || '',
          devices: step.config?.devices || [],
          timeline: step.config?.puzzle_timeline || [],
          onSolve: step.config?.on_solve || { actions: [] }
        };

        // Write puzzle file
        const puzzleFilePath = path.join(puzzlesDir, puzzleFileName);
        await fs.writeFile(
          puzzleFilePath,
          JSON.stringify(puzzleJson, null, 2)
        );

        puzzleFiles.push(puzzleFileName);

        // Add puzzle activation step to scene timeline
        timeline.push({
          delayMs: cumulativeDelay,
          stepType: 'puzzle',
          action: 'puzzle.activate',
          puzzleFile: puzzleFileName,
          waitForSolve: step.config?.wait_for_solve !== false
        });

        // Add delay after execution
        cumulativeDelay += delayAfterMs;
        continue;
      }

      // Handle stopLoop steps
      if (step.step_type === 'stopLoop') {
        timeline.push({
          delayMs: cumulativeDelay,
          stepType: 'stopLoop',
          action: 'loop.stop',
          loopId: step.config?.loop_id
        });
        cumulativeDelay += stepDuration + delayAfterMs;
        continue;
      }

      // Map step types to actions
      let action = '';
      let target = '';

      switch (step.step_type) {
        case 'video':
          // Video steps now use device + command pattern (like effect steps)
          action = step.config?.command || 'play_intro';
          target = step.config?.device_id || 'intro_tv';
          break;
        case 'audio':
          action = 'audio.play';
          target = step.config?.audio_cue;
          break;
        case 'effect':
          action = step.config?.command || 'effect.trigger';
          target = step.config?.device_id;
          break;
        case 'wait':
          cumulativeDelay += (step.config?.duration_ms || 0) + delayAfterMs;
          continue;
      }

      const timelineStep = {
        delayMs: cumulativeDelay,
        action,
        target
      };

      // Add duration if applicable
      if (stepDuration > 0) {
        timelineStep.duration = stepDuration;
      }

      // Add execution config for loops
      if (step.execution_mode === 'loop' && step.loop_id) {
        timelineStep.execution = {
          mode: 'loop',
          interval: step.execution_interval,
          loopId: step.loop_id
        };
      }

      // Add params if available
      if (step.config?.params) {
        timelineStep.params = step.config.params;
      }

      timeline.push(timelineStep);
      cumulativeDelay += stepDuration + delayAfterMs;
    }

    // Extract all devices used in the timeline
    const devicesSet = new Set();
    for (const step of timeline) {
      if (step.target && step.action !== 'puzzle.activate') {
        devicesSet.add(step.target);
      }
    }
    const devices = Array.from(devicesSet);

    // Create scene JSON
    const sceneJson = {
      id: sceneIdForFile,
      name: scene.name,
      type: 'scene',  // UI uses 'scene' type for timeline-based sequences
      roomId: roomIdSnakeCase,
      description: scene.description || '',
      devices,  // Devices used in this scene
      timeline,  // Timeline of actions
      estimatedDurationMs: cumulativeDelay,
      prerequisites: [],
      metadata: {
        exported_from_ui: true,
        exported_at: new Date().toISOString(),
        original_database_room_id: room.id,
        scene_number: scene.scene_number || 1,
        slug: scene.slug,
        puzzle_files: puzzleFiles
      }
    };

    // Write scene file using database scene ID as filename
    const sceneFilePath = path.join(scenesDir, `${sceneIdForFile}.json`);
    await fs.writeFile(
      sceneFilePath,
      JSON.stringify(sceneJson, null, 2)
    );

    res.json({
      success: true,
      message: `Scene exported to ${sceneFilePath}`,
      data: {
        sceneFile: sceneFilePath,
        puzzleFiles: puzzleFiles.map(f => path.join(puzzlesDir, f)),
        sceneId: sceneIdForFile,
        roomId: roomIdSnakeCase,
        sequence_length: timeline.length,
        total_duration_ms: cumulativeDelay
      }
    });

  } catch (error) {
    console.error('Error exporting scene to JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export scene to JSON',
      error: error.message
    });
  }
});
/**
 * Scene Executor Proxy
 * POST /api/sentient/scenes/:sceneId/execute
 *
 * Proxies requests to the scene-executor service to avoid CORS/mixed content issues
 */
router.post('/:sceneId/execute', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { skipSafety } = req.body;

    const sceneExecutorUrl = process.env.SCENE_EXECUTOR_URL || 'http://localhost:3004';

    // Forward request to scene-executor
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${sceneExecutorUrl}/scenes/${sceneId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ skipSafety: skipSafety || false })
    });

    const data = await response.json();

    res.status(response.status).json(data);

  } catch (error) {
    console.error('Scene executor proxy error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Failed to connect to scene executor'
      }
    });
  }
});

// Trigger executor runtime reload from JSON files (no restart)
router.post('/executor/reload', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const sceneExecutorUrl = process.env.SCENE_EXECUTOR_URL || 'http://localhost:3004';
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(`${sceneExecutorUrl}/configuration/reload-runtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Executor reload proxy error:', error);
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to call executor reload' }
    });
  }
});

// Proxy endpoint for starting a scene on the executor
router.post('/:id/start', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;
    const { skipSafety } = req.body;

    console.log(`Proxying scene start request to executor: ${id}`);

    // Proxy request to executor engine
    const response = await axios.post(
      `${EXECUTOR_URL}/scenes/${id}/start`,
      { skipSafety: skipSafety || false },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Executor start scene proxy error:', error);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to start scene on executor' }
    });
  }
});

// Proxy endpoint for resetting a scene on the executor
router.post('/:id/reset', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Proxying scene reset request to executor: ${id}`);

    // Proxy request to executor engine
    const response = await axios.post(
      `${EXECUTOR_URL}/scenes/${id}/reset`,
      {},
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Executor reset scene proxy error:', error);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to reset scene on executor' }
    });
  }
});

module.exports = router;
