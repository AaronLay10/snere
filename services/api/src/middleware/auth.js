/**
 * Mythra Sentient Engine - JWT Authentication Middleware
 * Handles user authentication and token validation
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    clientId: user.client_id,
    permissions: user.permissions || []
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'sentient-api'
  });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'sentient-api'
    });
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} JWT token or null
 */
function extractToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authentication middleware - validates JWT and attaches user to request
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const token = extractToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Fetch fresh user data from database
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.client_id, u.is_active, u.last_login,
              c.name as client_name, c.slug as client_slug
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'User account is disabled'
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      client_id: user.client_id,
      client_name: user.client_name,
      client_slug: user.client_slug,
      is_active: user.is_active,
      last_login: user.last_login
    };

    next();
  } catch (error) {
    if (error.message === 'Invalid or expired token') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }

    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't fail if missing
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const decoded = verifyToken(token);

      const result = await db.query(
        `SELECT u.id, u.email, u.username, u.role, u.client_id, u.is_active,
                c.name as client_name, c.slug as client_slug
         FROM users u
         LEFT JOIN clients c ON u.client_id = c.id
         WHERE u.id = $1 AND u.is_active = true`,
        [decoded.id]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          client_id: user.client_id,
          client_name: user.client_name,
          client_slug: user.client_slug
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail if token is invalid, just proceed without user
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  extractToken
};
