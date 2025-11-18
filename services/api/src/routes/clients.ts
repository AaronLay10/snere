/**
 * Mythra Sentient Engine - Clients Routes
 * Manages client/tenant records
 */

import { Router } from 'express';
import fs from 'fs/promises';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { requireClientAccess, requireRole } from '../middleware/rbac.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  },
});

/**
 * Client validation schema
 */
const clientSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  slug: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z0-9_-]+$/)
    .optional()
    .allow('', null),
  description: Joi.string().max(1000).optional().allow('', null),
  mqttNamespace: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z0-9_]+$/)
    .optional()
    .allow('', null),
  mqtt_namespace: Joi.string()
    .min(1)
    .max(100)
    .pattern(/^[a-z0-9_]+$/)
    .optional()
    .allow('', null),
  contactEmail: Joi.string().email().optional().allow('', null),
  contact_email: Joi.string().email().optional().allow('', null),
  contactPhone: Joi.string().optional().allow('', null),
  contact_phone: Joi.string().optional().allow('', null),
  address: Joi.string().optional().allow('', null),
  timezone: Joi.string().optional(),
  settings: Joi.object().optional(),
  status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
  isActive: Joi.boolean().optional(),
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
    const countQuery =
      active !== undefined
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
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve clients',
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

    const result = await db.query('SELECT * FROM clients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found',
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
      users: parseInt(usersResult.rows[0].user_count),
    };

    res.json({
      success: true,
      client: client,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve client',
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
        message: error.details[0].message,
      });
    }

    const {
      name,
      slug,
      description,
      mqttNamespace,
      mqtt_namespace,
      contactEmail,
      contact_email,
      contactPhone,
      contact_phone,
      address,
      timezone,
      settings,
      status,
      isActive = true,
    } = value;

    // Auto-generate slug from name if not provided
    const finalSlug =
      slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Auto-generate mqtt_namespace from slug if not provided
    const finalMqttNamespace = mqttNamespace || mqtt_namespace || finalSlug.replace(/-/g, '_');

    // Check if slug already exists
    const existingClient = await db.query('SELECT id FROM clients WHERE slug = $1', [finalSlug]);

    if (existingClient.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A client with this slug already exists',
      });
    }

    // Create client
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO clients (
        id, name, slug, description, mqtt_namespace, contact_email, contact_phone, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        name,
        finalSlug,
        description || null,
        finalMqttNamespace,
        contactEmail || contact_email || null,
        contactPhone || contact_phone || null,
        status || 'active',
      ]
    );

    res.status(201).json({
      success: true,
      client: result.rows[0],
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create client',
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
    const updateSchema = clientSchema.fork(['name', 'slug'], (schema) => schema.optional());

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    // Check if client exists
    const existing = await db.query('SELECT * FROM clients WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found',
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
        message: 'No fields to update',
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
      client: result.rows[0],
    });
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update client',
    });
  }
});

/**
 * DELETE /api/sentient/clients/:id
 * Delete client (admin only, soft delete)
 * Query params: cascade=true to also delete all associated rooms/devices/users
 */
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cascade } = req.query;

    // Check if client has rooms
    const roomsResult = await db.query('SELECT COUNT(*) as count FROM rooms WHERE client_id = $1', [
      id,
    ]);

    const roomCount = parseInt(roomsResult.rows[0].count);

    // If client has rooms and cascade is not enabled, return error with room count
    if (roomCount > 0 && cascade !== 'true') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete client with existing rooms. Use cascade=true to delete all associated data.',
        roomCount: roomCount,
        hint: 'Add ?cascade=true to delete this client and all associated rooms, devices, and users',
      });
    }

    // If cascade is enabled, delete all associated data in correct order
    if (cascade === 'true' && roomCount > 0) {
      // Start transaction
      const client = await db.getClient();
      
      try {
        await client.query('BEGIN');

        // Delete in correct order to handle foreign key constraints
        // 1. Device sensor data
        await client.query(
          `DELETE FROM device_sensor_data WHERE device_id IN (
            SELECT d.id FROM devices d
            JOIN rooms r ON d.room_id = r.id
            WHERE r.client_id = $1
          )`,
          [id]
        );

        // 2. Device commands
        await client.query(
          `DELETE FROM device_commands WHERE device_id IN (
            SELECT d.id FROM devices d
            JOIN rooms r ON d.room_id = r.id
            WHERE r.client_id = $1
          )`,
          [id]
        );

        // 3. Devices
        await client.query(
          `DELETE FROM devices WHERE room_id IN (
            SELECT id FROM rooms WHERE client_id = $1
          )`,
          [id]
        );

        // 4. Controllers
        await client.query(
          `DELETE FROM controllers WHERE room_id IN (
            SELECT id FROM rooms WHERE client_id = $1
          )`,
          [id]
        );

        // 5. Scenes
        await client.query('DELETE FROM scenes WHERE client_id = $1', [id]);

        // 6. Rooms
        await client.query('DELETE FROM rooms WHERE client_id = $1', [id]);

        // 7. Users associated with this client
        await client.query('DELETE FROM users WHERE client_id = $1', [id]);

        // 8. Finally, soft delete the client
        const result = await client.query(
          `UPDATE clients
           SET is_active = false, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id]
        );

        await client.query('COMMIT');
        client.release();

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Client not found',
          });
        }

        res.json({
          success: true,
          message: 'Client and all associated data deleted successfully',
          client: result.rows[0],
          deletedRooms: roomCount,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }
    } else {
      // Simple soft delete - no rooms to cascade
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
          message: 'Client not found',
        });
      }

      res.json({
        success: true,
        message: 'Client deactivated successfully',
        client: result.rows[0],
      });
    }
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete client',
    });
  }
});

/**
 * POST /api/sentient/clients/:id/logo
 * Upload client logo (admin only)
 */
router.post('/:id/logo', authenticate, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No logo file provided',
      });
    }

    // Check if client exists
    const existing = await db.query('SELECT id, logo_url FROM clients WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found',
      });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads/client-logos');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Delete old logo if exists
    if (existing.rows[0].logo_url) {
      const oldLogoPath = path.join(__dirname, '../..', existing.rows[0].logo_url);
      try {
        await fs.unlink(oldLogoPath);
      } catch (err) {
        // Ignore if file doesn't exist
        console.log('Old logo not found or already deleted:', err.message);
      }
    }

    // Generate unique filename
    const filename = `${id}-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);

    // Process and save image using sharp (resize to 400x400, convert to PNG with transparency)
    // rotate() with no args auto-rotates based on EXIF orientation
    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(400, 400, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toFile(filepath);

    // Update database with logo URL
    const logoUrl = `/uploads/client-logos/${filename}`;
    const result = await db.query(
      `UPDATE clients
       SET logo_url = $1, logo_filename = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, logo_url, logo_filename`,
      [logoUrl, req.file.originalname, id]
    );

    res.json({
      success: true,
      message: 'Client logo uploaded successfully',
      logoUrl: logoUrl,
      client: result.rows[0],
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to upload logo',
    });
  }
});

/**
 * DELETE /api/sentient/clients/:id/logo
 * Delete client logo (admin only)
 */
router.delete('/:id/logo', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get client logo info
    const result = await db.query('SELECT id, logo_url FROM clients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found',
      });
    }

    const client = result.rows[0];

    if (!client.logo_url) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Client has no logo to delete',
      });
    }

    // Delete file from filesystem
    const logoPath = path.join(__dirname, '../..', client.logo_url);
    try {
      await fs.unlink(logoPath);
    } catch (err) {
      console.log('Logo file not found or already deleted:', err.message);
    }

    // Update database
    await db.query(
      `UPDATE clients
       SET logo_url = NULL, logo_filename = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Client logo deleted successfully',
    });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete logo',
    });
  }
});

export default router;
