/**
 * Mythra Sentient Engine - Clients Routes
 * Manages client/tenant records
 */

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireRole, requireCapability, requireClientAccess } = require('../middleware/rbac');

/**
 * Client validation schema
 */
const clientSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  slug: Joi.string().min(1).max(100).pattern(/^[a-z0-9-]+$/).required(),
  mqttNamespace: Joi.string().min(1).max(100).pattern(/^[a-z0-9_]+$/).optional(),
  contactEmail: Joi.string().email().optional(),
  contactPhone: Joi.string().optional(),
  address: Joi.string().optional(),
  timezone: Joi.string().optional(),
  settings: Joi.object().optional(),
  isActive: Joi.boolean().optional()
});

/**
 * GET /api/sentient/clients
 * List all clients (admin only)
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, active } = req.query;

    let query = 'SELECT * FROM clients';
    let params = [];
    let paramIndex = 1;

    // Filter by active status if provided
    if (active !== undefined) {
      query += ` WHERE status = $${paramIndex++}`;
      params.push(active === 'true' ? 'active' : 'inactive');
    }

    query += ` ORDER BY name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    const countQuery = active !== undefined
      ? 'SELECT COUNT(*) FROM clients WHERE status = $1'
      : 'SELECT COUNT(*) FROM clients';
    const countParams = active !== undefined ? [active === 'true' ? 'active' : 'inactive'] : [];
    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      clients: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve clients'
    });
  }
});

/**
 * GET /api/sentient/clients/:id
 * Get single client details
 */
router.get('/:id', authenticate, requireClientAccess('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    // Get client statistics
    const roomsResult = await db.query(
      'SELECT COUNT(*) as room_count FROM rooms WHERE client_id = $1',
      [id]
    );

    const devicesResult = await db.query(
      `SELECT COUNT(*) as device_count FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       WHERE r.client_id = $1`,
      [id]
    );

    const usersResult = await db.query(
      'SELECT COUNT(*) as user_count FROM users WHERE client_id = $1',
      [id]
    );

    const client = result.rows[0];
    client.statistics = {
      rooms: parseInt(roomsResult.rows[0].room_count),
      devices: parseInt(devicesResult.rows[0].device_count),
      users: parseInt(usersResult.rows[0].user_count)
    };

    res.json({
      success: true,
      client: client
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve client'
    });
  }
});

/**
 * POST /api/sentient/clients
 * Create new client (admin only)
 */
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = clientSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const {
      name,
      slug,
      mqttNamespace,
      contactEmail,
      contactPhone,
      address,
      timezone,
      settings,
      isActive = true
    } = value;

    // Check if slug already exists
    const existingClient = await db.query(
      'SELECT id FROM clients WHERE slug = $1',
      [slug]
    );

    if (existingClient.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A client with this slug already exists'
      });
    }

    // Create client
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO clients (
        id, name, slug, mqtt_namespace, contact_email, contact_phone,
        address, timezone, settings, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        id,
        name,
        slug,
        mqttNamespace || slug,
        contactEmail,
        contactPhone,
        address,
        timezone || 'America/New_York',
        JSON.stringify(settings || {}),
        isActive
      ]
    );

    res.status(201).json({
      success: true,
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create client'
    });
  }
});

/**
 * PUT /api/sentient/clients/:id
 * Update client (admin only)
 */
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body (all fields optional for update)
    const updateSchema = clientSchema.fork(
      ['name', 'slug'],
      (schema) => schema.optional()
    );

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // Check if client exists
    const existing = await db.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        updates.push(`${dbKey} = $${paramIndex++}`);
        params.push(typeof val === 'object' ? JSON.stringify(val) : val);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE clients
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update client'
    });
  }
});

/**
 * DELETE /api/sentient/clients/:id
 * Delete client (admin only, soft delete)
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if client has rooms
    const roomsResult = await db.query(
      'SELECT COUNT(*) as count FROM rooms WHERE client_id = $1',
      [id]
    );

    if (parseInt(roomsResult.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete client with existing rooms',
        roomCount: parseInt(roomsResult.rows[0].count)
      });
    }

    // Soft delete - mark as inactive
    const result = await db.query(
      `UPDATE clients
       SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      message: 'Client deactivated successfully',
      client: result.rows[0]
    });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete client'
    });
  }
});

module.exports = router;
