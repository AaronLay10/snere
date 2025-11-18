/**
 * Mythra Sentient Engine - Authentication Routes
 * Handles login, logout, password reset, and token refresh
 */

import express from 'express';
import { Router, Request, Response } from 'express';
const router = Router();
import Joi from 'joi';
import db from '../config/database.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  authenticate
} from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';

/**
 * Login validation schema
 */
const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
  interface: Joi.string().valid('sentient', 'mythra').optional()
});

/**
 * Password reset validation schema
 */
const passwordResetSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(12)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]+$/)
    .required()
    .messages({
      'string.min': 'Password must be at least 12 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const { email, password, interface: interfaceType } = value;

    // Find user by email
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.password_hash, u.role, u.client_id, u.is_active,
              c.name as client_name, c.slug as client_slug, c.logo_url as client_logo_url
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your account has been disabled'
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    // Check interface access
    if (interfaceType === 'mythra') {
      if (!['game_master', 'admin'].includes(user.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to the Mythra interface',
          allowedRoles: ['game_master', 'admin']
        });
      }
    } else if (interfaceType === 'sentient') {
      if (!['admin', 'editor', 'viewer', 'technician', 'creative_director'].includes(user.role)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to the Sentient interface',
          allowedRoles: ['admin', 'editor', 'viewer', 'technician', 'creative_director']
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user);

    // Update last login timestamp
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Create audit log
    await createAuditLog({
      userId: user.id,
      username: user.username,
      client_id: user.client_id,
      actionType: 'login',
      resourceType: 'auth',
      description: `User logged in via ${interfaceType || 'unknown'} interface`,
      metadata: {
        interface: interfaceType,
        ip: req.ip
      }
    });

    // Return token and user info
    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        client_id: user.client_id,
        client_name: user.client_name,
        client_slug: user.client_slug,
        client_logo_url: user.client_logo_url
      },
      interface: interfaceType || 'unknown'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate token on client side)
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      client_id: req.user.client_id,
      actionType: 'logout',
      resourceType: 'auth',
      description: 'User logged out'
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Logout failed'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    // Fetch complete user profile
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.client_id, u.is_active,
              u.created_at, u.last_login,
              c.name as client_name, c.slug as client_slug, c.logo_url as client_logo_url
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        client_id: user.client_id,
        client_name: user.client_name,
        client_slug: user.client_slug,
        client_logo_url: user.client_logo_url,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user information'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    // Validate request body
    const { error, value } = passwordResetSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    const { currentPassword, newPassword } = value;

    // Fetch user with password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      client_id: req.user.client_id,
      actionType: 'update',
      resourceType: 'users',
      resourceId: req.user.id,
      description: 'User changed password'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to change password'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    // Generate new token with current user data
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.client_id, u.is_active
       FROM users u
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your account has been disabled'
      });
    }

    // Generate new token
    const token = generateToken(user);

    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to refresh token'
    });
  }
});

export default router;
