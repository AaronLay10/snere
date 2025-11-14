/**
 * Mythra Sentient Engine - Rooms Routes
 * Manages escape room records
 */

import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/rbac.js';
const router = Router();

/**
 * Room validation schema
 */
const roomSchema = Joi.object({
  client_id: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  slug: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z0-9_-]+$/)
    .required(),
  short_name: Joi.string().max(50).allow('', null).optional(),
  theme: Joi.string().max(255).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  narrative: Joi.string().allow('', null).optional(),
  objective: Joi.string().allow('', null).optional(),
  min_players: Joi.number().integer().min(1).optional(),
  max_players: Joi.number().integer().min(1).optional(),
  recommended_players: Joi.number().integer().min(1).optional(),
  duration_minutes: Joi.number().integer().min(1).optional(),
  difficulty_level: Joi.string().allow('', null).optional(),
  difficulty_rating: Joi.number().integer().min(1).max(5).optional(),
  physical_difficulty: Joi.string().allow('', null).optional(),
  age_recommendation: Joi.string().allow('', null).optional(),
  wheelchair_accessible: Joi.boolean().optional(),
  hearing_impaired_friendly: Joi.boolean().optional(),
  vision_impaired_friendly: Joi.boolean().optional(),
  accessibility_notes: Joi.string().allow('', null).optional(),
  mqtt_topic_base: Joi.string().allow('', null).optional(),
  network_segment: Joi.string().allow('', null).optional(),
  status: Joi.string().valid('draft', 'testing', 'active', 'maintenance', 'archived').optional(),
  version: Joi.string().allow('', null).optional(),
  development_start_date: Joi.date().allow(null).optional(),
  testing_start_date: Joi.date().allow(null).optional(),
  expected_launch_date: Joi.date().allow(null).optional(),
  soft_launch_date: Joi.date().allow(null).optional(),
  public_launch_date: Joi.date().allow(null).optional(),
  // Legacy fields
  capacity: Joi.number().integer().min(1).optional(),
  duration: Joi.number().integer().min(1).optional(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
  config: Joi.object().optional(),
});

/**
 * GET /api/sentient/rooms
 * List rooms (filtered by user's client unless admin)
 */
router.get('/', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, client_id, status } = req.query;

    let query =
      'SELECT r.*, c.name as client_name FROM rooms r INNER JOIN clients c ON r.client_id = c.id';
    let params = [];
    let paramIndex = 1;
    let conditions = [];

    // Non-admins can only see their client's rooms
    if (req.user.role !== 'admin') {
      conditions.push(`r.client_id = $${paramIndex++}`);
      params.push(req.user.client_id);
    } else if (client_id) {
      conditions.push(`r.client_id = $${paramIndex++}`);
      params.push(client_id);
    }

    if (status) {
      conditions.push(`r.status = $${paramIndex++}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY r.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    res.json({
      success: true,
      rooms: result.rows,
    });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve rooms',
    });
  }
});

/**
 * GET /api/sentient/rooms/:id
 * Get single room details
 */
router.get('/:id', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, c.name as client_name, c.slug as client_slug
       FROM rooms r
       INNER JOIN clients c ON r.client_id = c.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found',
      });
    }

    const room = result.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && room.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access rooms within your client',
      });
    }

    // Get room statistics
    const scenesResult = await db.query('SELECT COUNT(*) as count FROM scenes WHERE room_id = $1', [
      id,
    ]);

    const devicesResult = await db.query(
      'SELECT COUNT(*) as count FROM devices WHERE room_id = $1',
      [id]
    );

    const puzzlesResult = await db.query(
      'SELECT COUNT(*) as count FROM puzzles WHERE room_id = $1',
      [id]
    );

    room.statistics = {
      scenes: parseInt(scenesResult.rows[0].count),
      devices: parseInt(devicesResult.rows[0].count),
      puzzles: parseInt(puzzlesResult.rows[0].count),
    };

    res.json({
      success: true,
      room: room,
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve room',
    });
  }
});

/**
 * POST /api/sentient/rooms
 * Create new room
 */
router.post('/', authenticate, requireCapability('write'), async (req, res) => {
  try {
    const { error, value } = roomSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    const {
      client_id,
      name,
      slug,
      description,
      mqtt_topic_base,
      capacity,
      duration,
      difficulty,
      status,
      config,
    } = value;

    // Check client access
    if (req.user.role !== 'admin' && client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only create rooms within your client',
      });
    }

    // Check if slug already exists for this client
    const existing = await db.query('SELECT id FROM rooms WHERE client_id = $1 AND slug = $2', [
      client_id,
      slug,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A room with this slug already exists for this client',
      });
    }

    // Get client info for MQTT topic
    const clientResult = await db.query('SELECT mqtt_namespace FROM clients WHERE id = $1', [
      client_id,
    ]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found',
      });
    }

    const mqttTopic = mqtt_topic_base || `sentient/${clientResult.rows[0].mqtt_namespace}/${slug}`;

    // Create room
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO rooms (
        id, client_id, name, slug, description, mqtt_topic_base,
        capacity, duration, difficulty, status, config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        id,
        client_id,
        name,
        slug,
        description,
        mqttTopic,
        capacity,
        duration,
        difficulty,
        status || 'draft',
        JSON.stringify(config || {}),
      ]
    );

    res.status(201).json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create room',
    });
  }
});

/**
 * PUT /api/sentient/rooms/:id
 * Update room
 */
router.put('/:id', authenticate, requireCapability('write'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check room exists and user has access
    const existing = await db.query('SELECT client_id FROM rooms WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found',
      });
    }

    if (req.user.role !== 'admin' && existing.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update rooms within your client',
      });
    }

    // Validate with optional fields
    const updateSchema = roomSchema.fork(['client_id', 'name', 'slug'], (schema) =>
      schema.optional()
    );

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined && key !== 'client_id') {
        // Don't allow changing client
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${dbKey} = $${paramIndex++}`);
        params.push(typeof val === 'object' ? JSON.stringify(val) : val);
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

    const query = `
      UPDATE rooms
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update room',
    });
  }
});

/**
 * DELETE /api/sentient/rooms/:id
 * Delete room (soft delete - archive)
 */
router.delete('/:id', authenticate, requireCapability('write'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE rooms
       SET status = 'archived', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Room not found',
      });
    }

    res.json({
      success: true,
      message: 'Room archived successfully',
      room: result.rows[0],
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete room',
    });
  }
});

export default router;
