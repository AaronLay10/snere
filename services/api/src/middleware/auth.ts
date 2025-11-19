/**
 * Mythra Sentient Engine - JWT Authentication Middleware
 * Handles user authentication and token validation
 */

import bcrypt from 'bcrypt';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import type { AuthenticatedRequest, AuthenticatedUser, JwtPayload } from '../types/auth.js';
import type { User } from '../types/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: User | AuthenticatedUser): string {
  const payload: JwtPayload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    clientId: user.client_id,
    permissions: [],
  };

  return jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'sentient-api',
  } as jwt.SignOptions);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET!, {
      issuer: 'sentient-api',
    }) as JwtPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
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
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
      return;
    }

    // Verify token
    const decoded = verifyToken(token);

    // Fetch fresh user data from database
    const result = await query<User & { client_name: string; client_slug: string }>(
      `SELECT u.id, u.email, u.username, u.role, u.client_id, u.is_active, u.last_login,
              c.name as client_name, c.slug as client_slug
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
      return;
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      res.status(403).json({
        error: 'Access denied',
        message: 'User account is disabled',
      });
      return;
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
      last_login: user.last_login,
    };

    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid or expired token') {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
      return;
    }

    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional authentication - attaches user if token is valid, but doesn't fail if missing
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      const decoded = verifyToken(token);

      const result = await query<User & { client_name: string; client_slug: string }>(
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
          client_slug: user.client_slug,
          is_active: user.is_active,
          last_login: user.last_login,
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail if token is invalid, just proceed without user
    next();
  }
}
