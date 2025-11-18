/**
 * Mythra Sentient Engine - Puzzles Routes
 * Manages puzzle configurations and logic
 */

import axios from 'axios';
import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/rbac.js';
const router = Router();

const puzzleSchema = Joi.object({
  room_id: Joi.string().uuid().required(),
  puzzle_id: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().required(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard').optional(),
  config: Joi.object().required(),
});

router.get('/', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { room_id } = req.query;

    let query = `
      SELECT p.*, r.name as room_name, r.client_id
      FROM puzzles p
      INNER JOIN rooms r ON p.room_id = r.id
    `;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (req.user.role !== 'admin') {
      conditions.push(`r.client_id = $${paramIndex++}`);
      params.push(req.user.client_id);
    }

    if (room_id) {
      conditions.push(`p.room_id = $${paramIndex++}`);
      params.push(room_id);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.name ASC';

    const result = await db.query(query, params);

    res.json({
      success: true,
      puzzles: result.rows,
    });
  } catch (error) {
    console.error('List puzzles error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve puzzles',
    });
  }
});

router.get('/:id', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT p.*, r.name as room_name, r.client_id
       FROM puzzles p
       INNER JOIN rooms r ON p.room_id = r.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Puzzle not found',
      });
    }

    const puzzle = result.rows[0];

    if (req.user.role !== 'admin' && puzzle.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      puzzle: puzzle,
    });
  } catch (error) {
    console.error('Get puzzle error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve puzzle',
    });
  }
});

router.post('/', authenticate, requireCapability('manage_puzzles'), async (req, res) => {
  try {
    const { error, value } = puzzleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    const { room_id, puzzle_id, name, type, difficulty, config } = value;

    // Convert difficulty string to rating (1-5)
    const difficultyRating = difficulty
      ? difficulty === 'easy'
        ? 2
        : difficulty === 'medium'
          ? 3
          : difficulty === 'hard'
            ? 4
            : null
      : null;

    // Verify room access and get room slug
    const roomResult = await db.query('SELECT client_id, slug FROM rooms WHERE id = $1', [room_id]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found',
      });
    }

    if (req.user.role !== 'admin' && roomResult.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    const roomSlug = roomResult.rows[0].slug;

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO puzzles (id, room_id, room_slug_old, puzzle_id, name, puzzle_type, difficulty_rating, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, room_id, roomSlug, puzzle_id, name, type, difficultyRating, JSON.stringify(config)]
    );

    res.status(201).json({
      success: true,
      puzzle: result.rows[0],
    });
  } catch (error) {
    console.error('Create puzzle error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create puzzle',
    });
  }
});

router.put('/:id', authenticate, requireCapability('manage_puzzles'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access
    const existing = await db.query(
      `SELECT p.room_id, r.client_id
       FROM puzzles p
       INNER JOIN rooms r ON p.room_id = r.id
       WHERE p.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Puzzle not found',
      });
    }

    if (req.user.role !== 'admin' && existing.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    // For updates, all fields are optional
    const updateSchema = puzzleSchema.fork(
      ['room_id', 'puzzle_id', 'name', 'type', 'difficulty', 'config'],
      (schema) => schema.optional()
    );
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    // Handle field mappings
    const fieldMappings = {
      type: 'puzzle_type',
      difficulty: 'difficulty_rating',
    };

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined && key !== 'room_id') {
        // Map frontend field names to database column names
        let dbKey = fieldMappings[key] || key;

        // Convert camelCase to snake_case if not already mapped
        if (!fieldMappings[key]) {
          dbKey = dbKey.replace(/([A-Z])/g, '_$1').toLowerCase();
        }

        // Convert difficulty string to rating
        let dbValue = val;
        if (key === 'difficulty') {
          dbValue = val === 'easy' ? 2 : val === 'medium' ? 3 : val === 'hard' ? 4 : null;
        }

        updates.push(`${dbKey} = $${paramIndex++}`);
        params.push(typeof dbValue === 'object' ? JSON.stringify(dbValue) : dbValue);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No fields to update',
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE puzzles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, params);

    res.json({
      success: true,
      puzzle: result.rows[0],
    });
  } catch (error) {
    console.error('Update puzzle error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update puzzle',
    });
  }
});

router.delete('/:id', authenticate, requireCapability('manage_puzzles'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query(
      `SELECT p.id, r.client_id
       FROM puzzles p
       INNER JOIN rooms r ON p.room_id = r.id
       WHERE p.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Puzzle not found',
      });
    }

    if (req.user.role !== 'admin' && existing.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    await db.query('DELETE FROM puzzles WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Puzzle deleted successfully',
    });
  } catch (error) {
    console.error('Delete puzzle error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete puzzle',
    });
  }
});

// Proxy endpoint for starting a puzzle on the executor
router.post('/:id/start', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;
    const { skip_safety } = req.body;

    const EXECUTOR_URL = process.env.SCENE_EXECUTOR_URL || 'http://localhost:3004';

    // Proxy request to executor engine
    const response = await axios.post(
      `${EXECUTOR_URL}/puzzles/${id}/start`,
      { skipSafety: skip_safety || false },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Puzzle executor proxy error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to start puzzle on executor' },
    });
  }
});

// Proxy endpoint for resetting a puzzle on the executor (uses director controls)
router.post('/:id/reset', authenticate, requireCapability('control_room'), async (req, res) => {
  try {
    const { id } = req.params;

    const EXECUTOR_URL = process.env.SCENE_EXECUTOR_URL || 'http://localhost:3004';

    // Use director reset endpoint (new scene orchestrator system)
    const response = await axios.post(
      `${EXECUTOR_URL}/director/scenes/${id}/reset`,
      {},
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Puzzle executor proxy error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to reset puzzle on executor' },
    });
  }
});

export default router;
