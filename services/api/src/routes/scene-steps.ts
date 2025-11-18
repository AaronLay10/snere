/**
 * Scene Steps (Timeline) Routes
 * Manages timeline steps for scenes
 */

import axios from 'axios';
import { Router } from 'express';
import Joi from 'joi';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/rbac.js';
const router = Router();

// Executor engine URL
const EXECUTOR_URL = process.env.EXECUTOR_URL || 'http://localhost:3004';

// Validation schema for scene step (accepts snake_case from frontend)
const sceneStepSchema = Joi.object({
  scene_id: Joi.string().required(), // Not UUID - scenes use custom string IDs
  step_number: Joi.number().integer().min(1).required(),
  step_type: Joi.string()
    .valid('puzzle', 'video', 'audio', 'effect', 'wait', 'stopLoop')
    .required(),
  name: Joi.string().max(255).required(),
  description: Joi.string().allow('', null).optional(),
  config: Joi.object().optional(),
  timing_config: Joi.object().optional(),
  required: Joi.boolean().optional(),
  repeatable: Joi.boolean().optional(),
  max_attempts: Joi.number().integer().min(0).optional(),
  execution_mode: Joi.string().valid('once', 'loop').optional(),
  execution_interval: Joi.number().integer().min(1).allow(null).optional(),
  loop_id: Joi.string().max(100).allow(null).optional(),
});

/**
 * GET /api/sentient/scene-steps
 * Get all scene steps (with optional filtering)
 */
router.get('/', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { sceneId } = req.query;

    let query = `
      SELECT
        id,
        scene_id,
        step_number,
        step_type,
        name,
        description,
        config,
        timing_config,
        required,
        repeatable,
        max_attempts,
        execution_mode,
        execution_interval,
        loop_id,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM scene_steps
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (sceneId) {
      query += ` AND scene_id = $${paramIndex++}`;
      params.push(sceneId);
    }

    query += ` ORDER BY step_number ASC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      steps: result.rows,
    });
  } catch (error) {
    console.error('Error fetching scene steps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scene steps',
      error: error.message,
    });
  }
});

/**
 * GET /api/sentient/scene-steps/:id
 * Get a single scene step by ID
 */
router.get('/:id', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        id,
        scene_id,
        step_number,
        step_type,
        name,
        description,
        config,
        timing_config,
        required,
        repeatable,
        max_attempts,
        execution_mode,
        execution_interval,
        loop_id,
        created_at,
        updated_at,
        created_by,
        updated_by
      FROM scene_steps
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scene step not found',
      });
    }

    res.json({
      success: true,
      step: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching scene step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scene step',
      error: error.message,
    });
  }
});

/**
 * POST /api/sentient/scene-steps
 * Create a new scene step
 */
router.post('/', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { error, value } = sceneStepSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });
    }

    const {
      scene_id,
      step_number,
      step_type,
      name,
      description,
      config,
      timing_config,
      required,
      repeatable,
      max_attempts,
      execution_mode,
      execution_interval,
      loop_id,
    } = value;

    // Check if step number already exists for this scene
    const existingCheck = await db.query(
      'SELECT id FROM scene_steps WHERE scene_id = $1 AND step_number = $2',
      [scene_id, step_number]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Step number ${step_number} already exists for this scene`,
      });
    }

    const result = await db.query(
      `INSERT INTO scene_steps (
        scene_id,
        step_number,
        step_type,
        name,
        description,
        config,
        timing_config,
        required,
        repeatable,
        max_attempts,
        execution_mode,
        execution_interval,
        loop_id,
        created_by,
        updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        scene_id,
        step_number,
        step_type,
        name,
        description || null,
        config || {},
        timing_config || {},
        required !== undefined ? required : true,
        repeatable !== undefined ? repeatable : false,
        max_attempts || null,
        execution_mode || 'once',
        execution_interval || null,
        loop_id || null,
        req.user.id,
        req.user.id,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Scene step created successfully',
      step: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating scene step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scene step',
      error: error.message,
    });
  }
});

/**
 * PUT /api/sentient/scene-steps/:id
 * Update a scene step
 */
router.put('/:id', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { id } = req.params;

    const updateSchema = sceneStepSchema.fork(
      ['scene_id', 'step_number', 'step_type', 'name'],
      (schema) => schema.optional()
    );

    const { error, value } = updateSchema.validate(req.body, {
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message),
      });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      scene_id: 'scene_id',
      step_number: 'step_number',
      step_type: 'step_type',
      name: 'name',
      description: 'description',
      config: 'config',
      timing_config: 'timing_config',
      required: 'required',
      repeatable: 'repeatable',
      max_attempts: 'max_attempts',
      execution_mode: 'execution_mode',
      execution_interval: 'execution_interval',
      loop_id: 'loop_id',
    };

    Object.keys(value).forEach((key) => {
      const dbField = fieldMapping[key];
      if (dbField) {
        updates.push(`${dbField} = $${paramIndex++}`);
        values.push(value[key]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Add updated_by and updated_at
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(req.user.id);
    updates.push(`updated_at = NOW()`);

    // Add ID for WHERE clause
    values.push(id);

    const query = `
      UPDATE scene_steps
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scene step not found',
      });
    }

    res.json({
      success: true,
      message: 'Scene step updated successfully',
      step: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating scene step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scene step',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/sentient/scene-steps/:id
 * Delete a scene step
 */
router.delete('/:id', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM scene_steps WHERE id = $1 RETURNING id, name', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scene step not found',
      });
    }

    res.json({
      success: true,
      message: 'Scene step deleted successfully',
      deletedStep: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting scene step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scene step',
      error: error.message,
    });
  }
});

/**
 * POST /api/sentient/scene-steps/reorder
 * Reorder scene steps in bulk (handles unique constraint issues)
 */
router.post('/reorder', authenticate, requireCapability('manage_scenes'), async (req, res) => {
  try {
    const { scene_id, steps } = req.body;

    if (!scene_id || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: scene_id and steps array required',
      });
    }

    // Validate steps array
    for (const step of steps) {
      if (!step.id || typeof step.step_number !== 'number' || step.step_number < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each step must have id and valid step_number (>= 1)',
        });
      }
    }

    // Use a transaction to handle the reorder atomically
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Step 1: Temporarily set all step numbers to negative values to avoid conflicts
      for (let i = 0; i < steps.length; i++) {
        const tempNumber = -(i + 10000); // Use large negative numbers
        await client.query(
          'UPDATE scene_steps SET step_number = $1, updated_by = $2, updated_at = NOW() WHERE id = $3 AND scene_id = $4',
          [tempNumber, req.user.id, steps[i].id, scene_id]
        );
      }

      // Step 2: Set to final positions
      for (const step of steps) {
        await client.query(
          'UPDATE scene_steps SET step_number = $1, updated_by = $2, updated_at = NOW() WHERE id = $3 AND scene_id = $4',
          [step.step_number, req.user.id, step.id, scene_id]
        );
      }

      await client.query('COMMIT');

      // Fetch updated steps
      const result = await client.query(
        'SELECT * FROM scene_steps WHERE scene_id = $1 ORDER BY step_number ASC',
        [scene_id]
      );

      res.json({
        success: true,
        message: 'Steps reordered successfully',
        steps: result.rows,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reordering scene steps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder scene steps',
      error: error.message,
    });
  }
});

/**
 * POST /api/sentient/scene-steps/:id/test
 * Test a scene step (trigger video playback, audio, effects, etc.)
 */
router.post('/:id/test', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get the step details
    const result = await db.query(
      `SELECT
        id,
        scene_id,
        step_type,
        name,
        config
      FROM scene_steps
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scene step not found',
      });
    }

    const step = result.rows[0];

    // Build the action string based on step type and config
    const actionData = buildStepAction(step);

    // Call executor engine to test the step
    try {
      const executorResponse = await axios.post(
        `${EXECUTOR_URL}/scenes/${step.scene_id}/test-step`,
        {
          stepId: step.id,
          action: actionData.action,
          target: actionData.target,
          duration: actionData.duration,
          parameters: actionData.parameters,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      res.json({
        success: true,
        message:
          executorResponse.data.data?.message ||
          `Test triggered for ${step.step_type} step: ${step.name}`,
        step: step,
        executorResult: executorResponse.data,
      });
    } catch (executorError) {
      console.error('Executor engine error:', executorError.message);
      // Return success anyway since the step data is valid, just log the executor error
      res.json({
        success: false,
        message: `Failed to execute step in executor: ${executorError.message}`,
        step: step,
        error: executorError.response?.data || executorError.message,
      });
    }
  } catch (error) {
    console.error('Error testing scene step:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test scene step',
      error: error.message,
    });
  }
});

/**
 * Build executor action from step data
 */
function buildStepAction(step) {
  const { step_type, config } = step;

  switch (step_type) {
    case 'video':
      return {
        action: config.video_id || 'play_video',
        target: config.device_id,
        duration: config.duration_seconds ? config.duration_seconds * 1000 : 0,
        parameters: {
          videoId: config.video_id,
          deviceId: config.device_id,
        },
      };

    case 'effect':
      return {
        action: config.action || config.command || 'effect',
        target: config.device_id,
        duration: 0,
        parameters: {
          command: config.action || config.command,
          deviceId: config.device_id,
          ...config.parameters,
        },
      };

    case 'audio':
      return {
        action: config.audio_cue || 'play_audio',
        target: undefined,
        duration: config.duration_seconds ? config.duration_seconds * 1000 : 0,
        parameters: config.audio_params || {},
      };

    case 'wait':
      return {
        action: 'wait',
        target: undefined,
        duration: config.duration_ms || 0,
        parameters: {},
      };

    case 'puzzle':
      return {
        action: 'puzzle_initialize',
        target: config.puzzle_id,
        duration: 0,
        parameters: {
          puzzleId: config.puzzle_id,
        },
      };

    case 'stopLoop':
      return {
        action: 'loop.stop',
        target: config.loop_id,
        duration: 0,
        parameters: {
          loopId: config.loop_id,
        },
      };

    default:
      return {
        action: 'unknown',
        target: undefined,
        duration: 0,
        parameters: {},
      };
  }
}

/**
 * Helper function to determine test action (legacy)
 */
function getTestAction(step) {
  const { step_type, config } = step;

  switch (step_type) {
    case 'video':
      return {
        type: 'mqtt',
        topic: config.mqtt_topic || 'sentient/video/command',
        payload: {
          action: 'play',
          video_id: config.video_id,
          device_id: config.device_id,
        },
      };

    case 'audio':
      return {
        type: 'scs',
        command: config.audio_cue || 'PLAY_AUDIO',
        params: config.audio_params || {},
      };

    case 'effect':
      return {
        type: 'mqtt',
        topic: config.effect_topic || 'sentient/effects/command',
        payload: {
          action: config.effect_action,
          params: config.effect_params || {},
        },
      };

    case 'puzzle':
      return {
        type: 'puzzle',
        puzzle_id: config.puzzle_id,
        action: 'initialize',
      };

    case 'wait':
      return {
        type: 'wait',
        duration_ms: config.duration_ms || 0,
        message: config.wait_message || 'Waiting for game master or player action',
      };

    default:
      return {
        type: 'unknown',
        message: 'Test action not defined for this step type',
      };
  }
}

export default router;
