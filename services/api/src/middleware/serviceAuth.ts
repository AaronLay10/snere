/**
 * Mythra Sentient Engine - Service-to-Service Authentication
 * Allows internal services to authenticate using a shared service token
 */

import { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';

const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN;

if (!SERVICE_AUTH_TOKEN) {
  console.warn('WARNING: SERVICE_AUTH_TOKEN not set - service-to-service authentication disabled');
}

/**
 * Middleware to authenticate internal service requests
 * Checks for X-Service-Token header and validates it
 */
export function authenticateService(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void | Response {
  const serviceToken = req.headers['x-service-token'];

  if (!serviceToken) {
    // No service token provided, continue to normal authentication
    return next();
  }

  if (!SERVICE_AUTH_TOKEN) {
    return res.status(503).json({
      success: false,
      message: 'Service authentication not configured',
    });
  }

  if (serviceToken !== SERVICE_AUTH_TOKEN) {
    return res.status(401).json({
      success: false,
      message: 'Invalid service token',
    });
  }

  // Service authenticated - create a service user context
  req.user = {
    id: '00000000-0000-0000-0000-000000000000', // System service UUID
    email: 'service@sentient.internal',
    username: 'system-service',
    role: 'system',
    client_id: null as any,
    permissions: ['*'], // All permissions for internal services
    isService: true,
  };

  // Mark request as service-authenticated
  req.isServiceAuth = true;

  next();
}

/**
 * Combined middleware that accepts either service auth or user auth
 * Use this for routes that should be accessible by both internal services and authenticated users
 */
export function authenticateServiceOrUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void | Response {
  const serviceToken = req.headers['x-service-token'];

  // Try service authentication first
  if (serviceToken) {
    return authenticateService(req, res, next);
  }

  // Fall back to normal user authentication
  const { authenticate } = require('./auth.js');
  return authenticate(req, res, next);
}
