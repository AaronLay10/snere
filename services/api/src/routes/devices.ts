/**
 * Mythra Sentient Engine - Devices Routes
 * Manages hardware device configurations
 */

import { Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/rbac.js';
const router = Router();

/**
 * Device validation schema (using snake_case to match database)
 */
const deviceSchema = Joi.object({
  room_id: Joi.string().uuid().required(),
  device_id: Joi.string().required(),
  puzzle_id: Joi.string().allow('', null).optional(),
  friendly_name: Joi.string().allow('', null).optional(),
  device_type: Joi.string().optional(),
  device_category: Joi.string()
    .valid(
      'mechanical_movement',
      'sensor',
      'switchable_on_off',
      'variable_control',
      'media_playback'
    )
    .required(),
  physical_location: Joi.string().allow('', null).optional(),
  mqtt_topic: Joi.string().required(),
  ip_address: Joi.string().allow('', null).optional(),
  mac_address: Joi.string().allow('', null).optional(),
  hardware_type: Joi.string().allow('', null).optional(),
  hardware_version: Joi.string().allow('', null).optional(),
  firmware_version: Joi.string().allow('', null).optional(),
  controller_id: Joi.string().uuid().allow('', null).optional(),
  serial_number: Joi.string().allow('', null).optional(),
  network_segment: Joi.string().allow('', null).optional(),
  capabilities: Joi.object().optional(),
  emergency_stop_required: Joi.boolean().required(),
  emergency_stop_config: Joi.object().optional(),
  safety_classification: Joi.string().allow('', null).optional(),
  config: Joi.object().optional(),
  state: Joi.object().optional(),
  status: Joi.string().valid('active', 'inactive', 'error', 'maintenance').optional(),
  last_seen: Joi.date().optional(),
  last_heartbeat: Joi.date().optional(),
  uptime_seconds: Joi.number().optional(),
  error_count: Joi.number().optional(),
  created_by: Joi.string().uuid().optional(),
  updated_by: Joi.string().uuid().optional(),
});

/**
 * GET /api/sentient/devices
 * List devices
 */
router.get('/', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { room_id, category, emergency_stop_required } = req.query;

    let query = `
      SELECT
        d.*,
        r.name as room_name,
        r.client_id,
        c.friendly_name as controller_name,
        c.controller_id as controller_identifier,
        (
          SELECT ARRAY_AGG(dc.command_name)
          FROM device_commands dc
          WHERE dc.device_id = d.id AND dc.enabled = true
        ) AS command_names
      FROM devices d
      INNER JOIN rooms r ON d.room_id = r.id
      LEFT JOIN controllers c ON d.controller_id = c.id
    `;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Filter by client for non-admins
    if (req.user.role !== 'admin') {
      conditions.push(`r.client_id = $${paramIndex++}`);
      params.push(req.user.client_id);
    }

    if (room_id) {
      conditions.push(`d.room_id = $${paramIndex++}`);
      params.push(room_id);
    }

    if (category) {
      conditions.push(`d.device_category = $${paramIndex++}`);
      params.push(category);
    }

    if (emergency_stop_required !== undefined) {
      conditions.push(`d.emergency_stop_required = $${paramIndex++}`);
      params.push(emergency_stop_required === 'true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY d.friendly_name ASC';

    const result = await db.query(query, params);

    // Enrich capabilities - merge commands from device_commands table
    const devices = result.rows.map((row) => {
      let capabilities = row.capabilities;

      // Parse capabilities if it's a JSON string
      if (capabilities && typeof capabilities === 'string') {
        try {
          capabilities = JSON.parse(capabilities);
        } catch (_) {
          capabilities = {};
        }
      }
      if (!capabilities || typeof capabilities !== 'object') {
        capabilities = {};
      }

      // Get commands from device_commands table
      const commandsFromTable = Array.isArray(row.command_names)
        ? row.command_names.filter(Boolean)
        : [];

      // Only use commands from device_commands table if capabilities doesn't already have commands
      if (
        !capabilities.commands ||
        !Array.isArray(capabilities.commands) ||
        capabilities.commands.length === 0
      ) {
        capabilities.commands = commandsFromTable;
      }

      // Assign back parsed capabilities
      row.capabilities = capabilities;

      // Remove the temporary field
      delete row.command_names;

      return row;
    });

    res.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve devices',
    });
  }
});

/**
 * GET /api/sentient/devices/:id
 * Get device details
 */
router.get('/:id', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
         d.*,
         r.name as room_name,
         r.client_id,
         c.friendly_name as controller_name,
         c.controller_id as controller_identifier,
         (
           SELECT ARRAY_AGG(dc.command_name)
           FROM device_commands dc
           WHERE dc.device_id = d.id
         ) AS command_names
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       LEFT JOIN controllers c ON d.controller_id = c.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    const device = result.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && device.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    // Enrich capabilities with commands
    const commandsFromTable = Array.isArray(device.command_names)
      ? device.command_names.filter(Boolean)
      : [];
    let capabilities = device.capabilities;
    if (capabilities && typeof capabilities === 'string') {
      try {
        capabilities = JSON.parse(capabilities);
      } catch (_) {
        capabilities = {};
      }
    }
    if (!capabilities || typeof capabilities !== 'object') {
      capabilities = {};
    }
    // Only use commands from device_commands table if capabilities doesn't already have commands
    if (
      !capabilities.commands ||
      !Array.isArray(capabilities.commands) ||
      capabilities.commands.length === 0
    ) {
      capabilities.commands = commandsFromTable;
    }
    device.capabilities = capabilities;
    delete device.command_names;

    res.json({
      success: true,
      device: device,
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve device',
    });
  }
});

/**
 * POST /api/sentient/devices
 * Create new device
 */
router.post('/', authenticate, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { error, value } = deviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    const {
      room_id,
      device_id,
      friendly_name,
      device_category,
      emergency_stop_required,
      mqtt_topic,
      config,
    } = value;

    // Verify room exists and user has access
    const roomResult = await db.query('SELECT client_id FROM rooms WHERE id = $1', [room_id]);

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

    // Create device
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO devices (
        id, room_id, device_id, friendly_name, device_category,
        emergency_stop_required, mqtt_topic, config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        room_id,
        device_id,
        friendly_name,
        device_category,
        emergency_stop_required,
        mqtt_topic,
        JSON.stringify(config),
      ]
    );

    res.status(201).json({
      success: true,
      device: result.rows[0],
    });
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create device',
    });
  }
});

/**
 * PUT /api/sentient/devices/:id
 * Update device
 */
router.put('/:id', authenticate, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device exists and user has access
    const existing = await db.query(
      `SELECT d.room_id, r.client_id
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       WHERE d.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    if (req.user.role !== 'admin' && existing.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    const updateSchema = deviceSchema.fork(
      ['room_id', 'device_id', 'mqtt_topic', 'device_category', 'emergency_stop_required'],
      (schema) => schema.optional()
    );
    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    // Build update query (no conversion needed - using snake_case directly)
    const updates = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined && key !== 'room_id') {
        // Convert empty strings to null for PostgreSQL special types
        let paramValue = val;
        if (val === '' && (key === 'ip_address' || key === 'mac_address')) {
          paramValue = null;
        } else if (typeof val === 'object') {
          paramValue = JSON.stringify(val);
        }

        updates.push(`${key} = $${paramIndex++}`);
        params.push(paramValue);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No fields to update',
      });
    }

    // Add updated_by
    updates.push(`updated_by = $${paramIndex++}`);
    params.push(req.user?.id || null);

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `UPDATE devices SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.query(query, params);

    res.json({
      success: true,
      device: result.rows[0],
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update device',
    });
  }
});

/**
 * DELETE /api/sentient/devices/:id
 * Delete device
 */
router.delete('/:id', authenticate, requireCapability('manage_devices'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access
    const existing = await db.query(
      `SELECT d.id, r.client_id
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       WHERE d.id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    if (req.user.role !== 'admin' && existing.rows[0].client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    await db.query('DELETE FROM devices WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete device',
    });
  }
});

/**
 * GET /api/sentient/devices/:id/sensors
 * Get recent sensor readings for a device
 */
router.get('/:id/sensors', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;
    const { sensorName, limit = 100 } = req.query;

    // Verify device access
    const deviceResult = await db.query(
      `SELECT d.id, r.client_id
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       WHERE d.id = $1`,
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    const device = deviceResult.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && device.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    // Query sensor data
    let query = `
      SELECT sensor_name, value, received_at
      FROM device_sensor_data
      WHERE device_id = $1
    `;

    const params = [id];

    if (sensorName) {
      query += ` AND sensor_name = $2`;
      params.push(sensorName);
    }

    query += ` ORDER BY received_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit, 10));

    const result = await db.query(query, params);

    res.json({
      success: true,
      device_id: id,
      sensor_name: sensorName || 'all',
      readings: result.rows,
    });
  } catch (error) {
    console.error('Get device sensors error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve sensor data',
    });
  }
});

/**
 * GET /api/sentient/devices/:id/state
 * Get current device state
 */
router.get('/:id/state', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device access and get state
    const result = await db.query(
      `SELECT d.id, d.state, d.updated_at, r.client_id
       FROM devices d
       INNER JOIN rooms r ON d.room_id = r.id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Device not found',
      });
    }

    const device = result.rows[0];

    // Check client access
    if (req.user.role !== 'admin' && device.client_id !== req.user.client_id) {
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    res.json({
      success: true,
      device_id: id,
      state: device.state || {},
      updated_at: device.updated_at,
    });
  } catch (error) {
    console.error('Get device state error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve device state',
    });
  }
});

/**
 * GET /api/devices/:id/sensor-data
 * Get recent sensor data for a device
 */
router.get('/:id/sensor-data', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Get recent sensor data for this device
    const query = `
      SELECT
        sensor_name,
        value,
        received_at
      FROM device_sensor_data
      WHERE device_id = $1
      ORDER BY received_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [id, limit]);

    res.json({
      device_id: id,
      sensorData: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get sensor data error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve sensor data',
    });
  }
});

export default router;
