/**
 * Mythra Sentient Engine - Users Routes
 * Manages user accounts and roles
 */

import { Router } from 'express';
import fs from 'fs/promises';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import { authenticate, hashPassword } from '../middleware/auth.js';
import { canManageRole, requireCapability } from '../middleware/rbac.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().min(3).max(50).optional(),
  password: Joi.string()
    .min(12)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]+$/
    )
    .required()
    .messages({
      'string.min': 'Password must be at least 12 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),
  role: Joi.string()
    .valid('admin', 'editor', 'viewer', 'game_master', 'creative_director', 'technician')
    .required(),
  client_id: Joi.string().uuid().optional(),
  first_name: Joi.string().max(100).allow('', null).optional(),
  last_name: Joi.string().max(100).allow('', null).optional(),
  phone: Joi.string().max(50).allow('', null).optional(),
  is_active: Joi.boolean().optional(),
  email_verified: Joi.boolean().optional(),
});

router.get('/', authenticate, requireCapability('manage_users'), async (req, res) => {
  try {
    const { client_id, role, active } = req.query;

    let query = `
      SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.phone,
             u.role, u.client_id, u.is_active, u.email_verified,
             u.created_at, u.updated_at, u.last_login, u.created_by, u.updated_by,
             c.name as client_name
      FROM users u
      LEFT JOIN clients c ON u.client_id = c.id
    `;

    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Non-admins can only see users in their client
    if (req.user.role !== 'admin') {
      conditions.push(`u.client_id = $${paramIndex++}`);
      params.push(req.user.client_id);
    } else if (client_id) {
      conditions.push(`u.client_id = $${paramIndex++}`);
      params.push(client_id);
    }

    if (role) {
      conditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }

    if (active !== undefined) {
      conditions.push(`u.is_active = $${paramIndex++}`);
      params.push(active === 'true');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY u.username ASC';

    const result = await db.query(query, params);

    // Remove password hashes from response
    const users = result.rows.map((user) => {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json({
      success: true,
      users: users,
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve users',
    });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can view their own profile, admins can view all
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own profile',
      });
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.phone,
              u.role, u.client_id, u.is_active, u.email_verified,
              u.created_at, u.updated_at, u.last_login, u.created_by, u.updated_by,
              c.name as client_name
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user',
    });
  }
});

router.post('/', authenticate, requireCapability('manage_users'), async (req, res) => {
  try {
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    const { email, username, password, role, client_id, is_active = true } = value;

    // Auto-generate username from full email if not provided (ensures uniqueness)
    const final_username = username || email.toLowerCase().replace(/[@\.]/g, '_');

    // Check if actor can create this role
    if (!canManageRole(req.user.role, role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `You cannot create users with role '${role}'`,
      });
    }

    // Non-admins can only create users in their client
    let final_client_id = client_id;
    if (req.user.role !== 'admin') {
      if (client_id && client_id !== req.user.client_id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only create users within your client',
        });
      }
      final_client_id = req.user.client_id;
    }

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A user with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO users (id, email, username, password_hash, role, client_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, username, role, client_id, is_active, created_at`,
      [id, email.toLowerCase(), final_username, passwordHash, role, final_client_id, is_active]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create user',
    });
  }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can update their own profile, admins can update all
    const isSelfUpdate = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile',
      });
    }

    // Get existing user
    const existing = await db.query('SELECT role, client_id FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    // Build update allowed fields based on permissions
    // Admins can update all fields, even when editing themselves
    const updateSchema = isAdmin
      ? Joi.object({
          email: Joi.string().email().optional(),
          username: Joi.string().min(3).max(50).optional(),
          password: Joi.string().min(8).optional(),
          role: Joi.string()
            .valid('admin', 'editor', 'viewer', 'game_master', 'creative_director', 'technician')
            .optional(),
          client_id: Joi.string().uuid().allow('', null).optional(),
          first_name: Joi.string().max(100).allow('', null).optional(),
          last_name: Joi.string().max(100).allow('', null).optional(),
          phone: Joi.string().max(50).allow('', null).optional(),
          is_active: Joi.boolean().optional(),
          email_verified: Joi.boolean().optional(),
        }).unknown(false)
      : Joi.object({
          username: Joi.string().min(3).max(50).optional(),
          email: Joi.string().email().optional(),
          first_name: Joi.string().max(100).allow('', null).optional(),
          last_name: Joi.string().max(100).allow('', null).optional(),
          phone: Joi.string().max(50).allow('', null).optional(),
          password: Joi.string().min(8).optional(),
        }).unknown(false);

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', {
        isSelfUpdate,
        userId: id,
        requestUserId: req.user.id,
        body: req.body,
        error: error.details[0],
      });
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message,
      });
    }

    // Check role change permissions
    if (value.role && value.role !== existing.rows[0].role) {
      if (!canManageRole(req.user.role, value.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: `You cannot assign role '${value.role}'`,
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, val] of Object.entries(value)) {
      if (val !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        // Handle password separately (needs hashing)
        if (key === 'password') {
          const passwordHash = await hashPassword(val);
          updates.push(`password_hash = $${paramIndex++}`);
          params.push(passwordHash);
        } else if (key === 'email') {
          updates.push(`${dbKey} = $${paramIndex++}`);
          params.push(val.toLowerCase());
        } else {
          updates.push(`${dbKey} = $${paramIndex++}`);
          params.push(val);
        }
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No fields to update',
      });
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, username, role, client_id, is_active, updated_at
    `;

    const result = await db.query(query, params);

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user',
    });
  }
});

router.delete('/:id', authenticate, requireCapability('manage_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete self
    if (req.user.id === id) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'You cannot delete your own account',
      });
    }

    // Get user to check permissions
    const existing = await db.query('SELECT role FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    // Check if actor can delete this role
    if (!canManageRole(req.user.role, existing.rows[0].role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `You cannot delete users with role '${existing.rows[0].role}'`,
      });
    }

    // Check for dependencies that would prevent deletion
    const depsCheck = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM room_sessions WHERE game_master_id = $1) as room_sessions_count,
        (SELECT COUNT(*) FROM emergency_stop_events WHERE triggered_by_user_id = $1 OR inspected_by_user_id = $1 OR reset_by_user_id = $1) as emergency_stop_count,
        (SELECT COUNT(*) FROM configuration_versions WHERE approved_by_user_id = $1 OR created_by = $1) as config_versions_count`,
      [id]
    );

    const deps = depsCheck.rows[0];
    const hasDependencies = Object.values(deps).some((count) => parseInt(count) > 0);

    if (hasDependencies) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Cannot delete user: User has associated records in the system',
        details: {
          roomSessions: parseInt(deps.room_sessions_count),
          emergencyStops: parseInt(deps.emergency_stop_count),
          configVersions: parseInt(deps.config_versions_count),
        },
      });
    }

    // Hard delete - permanently remove user
    // user_sessions and audit_logs have CASCADE/SET NULL so they're safe
    const result = await db.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, email, username, role`,
      [id]
    );

    res.json({
      success: true,
      message: 'User permanently deleted',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user',
    });
  }
});

// Configure multer for memory storage (we'll process with sharp)
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

// Upload profile photo endpoint
router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;

    // Users can upload their own photo, admins can upload for any user
    const isSelfUpdate = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only update your own profile photo',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'No photo file provided',
      });
    }

    // Check if user exists
    const existing = await db.query('SELECT id, profile_photo_url FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads/profile-photos');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Delete old photo if exists
    if (existing.rows[0].profile_photo_url) {
      const oldPhotoPath = path.join(__dirname, '../..', existing.rows[0].profile_photo_url);
      try {
        await fs.unlink(oldPhotoPath);
      } catch (err) {
        // Ignore if file doesn't exist
        console.log('Old photo not found or already deleted:', err.message);
      }
    }

    // Generate unique filename
    const filename = `${id}-${Date.now()}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    // Process and save image using sharp (resize to 400x400, convert to JPEG)
    // rotate() with no args auto-rotates based on EXIF orientation
    await sharp(req.file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toFile(filepath);

    // Update database with photo URL (use full URL for development CORS)
    // In production, nginx will proxy both API and uploads from same domain
    const photoUrl = `/uploads/profile-photos/${filename}`;
    const result = await db.query(
      `UPDATE users
       SET profile_photo_url = $1, profile_photo_filename = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, profile_photo_url, profile_photo_filename`,
      [photoUrl, req.file.originalname, id]
    );

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      photoUrl: photoUrl,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to upload photo',
    });
  }
});

// Delete profile photo endpoint
router.delete('/:id/photo', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Users can delete their own photo, admins can delete any photo
    const isSelfUpdate = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelfUpdate && !isAdmin) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only delete your own profile photo',
      });
    }

    // Get user and current photo
    const existing = await db.query('SELECT id, profile_photo_url FROM users WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found',
      });
    }

    if (!existing.rows[0].profile_photo_url) {
      return res.status(404).json({
        error: 'Not found',
        message: 'No profile photo to delete',
      });
    }

    // Delete file from filesystem
    const photoPath = path.join(__dirname, '../..', existing.rows[0].profile_photo_url);
    try {
      await fs.unlink(photoPath);
    } catch (err) {
      console.log('Photo file not found:', err.message);
    }

    // Update database
    await db.query(
      `UPDATE users
       SET profile_photo_url = NULL, profile_photo_filename = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete photo',
    });
  }
});

export default router;
