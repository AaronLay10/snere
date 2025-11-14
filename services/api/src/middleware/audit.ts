/**
 * Mythra Sentient Engine - Audit Logging Middleware
 * Records all API actions for compliance and debugging
 */

import { NextFunction, Response } from 'express';
import db from '../config/database.js';
import type { AuthenticatedRequest } from '../types/express.js';

/**
 * Determine action type from HTTP method and path
 */
function determineActionType(method: string, path: string): string {
  const methodMap: Record<string, string> = {
    GET: 'read',
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  // Special cases
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (path.includes('/reset')) return 'reset';
  if (path.includes('/override')) return 'override';
  if (path.includes('/emergency')) return 'emergency_stop';

  return methodMap[method] || 'unknown';
}

/**
 * Determine resource type from path
 */
function determineResourceType(path: string): string {
  const pathParts = path.split('/').filter((p) => p.length > 0);

  // Look for resource identifiers in path
  const resourceTypes = [
    'clients',
    'rooms',
    'scenes',
    'devices',
    'puzzles',
    'controllers',
    'users',
    'configs',
    'logs',
    'sessions',
    'emergency-stops',
    'audit',
  ];

  for (const part of pathParts) {
    if (resourceTypes.includes(part)) {
      return part.replace('-', '_');
    }
  }

  return 'unknown';
}

/**
 * Extract resource ID from request
 */
function extractResourceId(req: AuthenticatedRequest): string | null {
  // Check common ID parameters
  const idParams = [
    'id',
    'client_id',
    'room_id',
    'scene_id',
    'device_id',
    'puzzle_id',
    'user_id',
    'session_id',
  ];

  for (const param of idParams) {
    if (req.params[param]) {
      return req.params[param];
    }
  }

  // Check body for ID
  if (req.body && req.body.id) {
    return req.body.id;
  }

  return null;
}

/**
 * Sanitize request body - remove sensitive fields
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Audit logging middleware - records all API actions
 */
export function auditLog(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Skip audit logging for certain paths
  const skipPaths = ['/health', '/status', '/metrics', '/favicon.ico'];
  if (skipPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Capture original response methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Store response data
  let responseData: any = null;
  let statusCode: number | null = null;

  // Override res.json to capture response
  res.json = function (data: any) {
    responseData = data;
    statusCode = res.statusCode;
    return originalJson(data);
  };

  // Override res.send to capture response
  res.send = function (data: any) {
    if (!responseData) {
      responseData = data;
      statusCode = res.statusCode;
    }
    return originalSend(data);
  };

  // When response is finished, write audit log
  res.on('finish', async () => {
    try {
      // Use originalUrl to get full path including base URL
      const fullPath = req.originalUrl?.split('?')[0] || req.path;
      const actionType = determineActionType(req.method, fullPath);
      const resourceType = determineResourceType(fullPath);
      const resourceId = extractResourceId(req);

      // Prepare audit log entry
      const logEntry = {
        userId: req.user ? req.user.id : null,
        username: req.user ? req.user.username : 'anonymous',
        client_id: req.user ? req.user.client_id : null,
        actionType: actionType,
        resourceType: resourceType,
        resourceId: resourceId,
        method: req.method,
        path: fullPath,
        query: req.query,
        body: sanitizeBody(req.body),
        statusCode: statusCode || res.statusCode,
        success: (statusCode || res.statusCode) < 400,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        interface: req.interface || 'unknown',
        timestamp: new Date(),
      };

      // Write to audit_log table (note: singular, not plural)
      // Map to actual database columns: action, entity_type, entity_id
      await db.query(
        `INSERT INTO audit_log (
          user_id, action, entity_type, entity_id,
          ip_address, user_agent, success,
          changes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          logEntry.userId,
          logEntry.actionType,
          logEntry.resourceType,
          logEntry.resourceId,
          logEntry.ipAddress,
          logEntry.userAgent,
          logEntry.success,
          JSON.stringify({
            method: logEntry.method,
            path: logEntry.path,
            query: logEntry.query,
            body: logEntry.body,
            statusCode: logEntry.statusCode,
            interface: logEntry.interface,
            username: logEntry.username,
            client_id: logEntry.client_id,
          }),
        ]
      );
    } catch (error) {
      // Don't fail the request if audit logging fails
      console.error('Audit logging error:', (error as Error).message);
    }
  });

  next();
}

/**
 * Create a manual audit log entry (for actions not triggered by API)
 */
export async function createAuditLog(entry: {
  userId?: string | null;
  username?: string;
  client_id?: string | null;
  actionType: string;
  resourceType: string;
  resourceId?: string | null;
  description?: string | null;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await db.query(
      `INSERT INTO audit_log (
        user_id, action, entity_type, entity_id,
        reason, changes
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.userId || null,
        entry.actionType,
        entry.resourceType,
        entry.resourceId || null,
        entry.description || null,
        JSON.stringify({
          username: entry.username || 'system',
          client_id: entry.client_id || null,
          metadata: entry.metadata || {},
        }),
      ]
    );
  } catch (error) {
    console.error('Manual audit log creation error:', (error as Error).message);
    // Don't throw - audit logging should not block business logic
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  filters: {
    userId?: string;
    client_id?: string;
    actionType?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  let conditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (filters.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.userId);
  }

  if (filters.actionType) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.actionType);
  }

  if (filters.resourceType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.resourceType);
  }

  if (filters.resourceId) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.resourceId);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  if (filters.success !== undefined) {
    conditions.push(`success = $${paramIndex++}`);
    params.push(filters.success);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  const query = `
    SELECT * FROM audit_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(
  filters: {
    client_id?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<any[]> {
  let conditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT
      COUNT(*) as total_actions,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_actions,
      SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_actions,
      action,
      COUNT(*) as count
    FROM audit_log
    ${whereClause}
    GROUP BY action
  `;

  const result = await db.query(query, params);
  return result.rows;
}
