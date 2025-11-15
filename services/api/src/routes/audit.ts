/**
 * Mythra Sentient Engine - Audit Log Routes
 * Query and analyze audit logs
 */

import { Router } from 'express';
import db from '../config/database.js';
import { getAuditStats, queryAuditLogs } from '../middleware/audit.js';
import { authenticate } from '../middleware/auth.js';
import { requireCapability } from '../middleware/rbac.js';
const router = Router();

/**
 * GET /api/audit/logs
 * Query audit logs with filters
 */
router.get('/logs', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const {
      userId,
      actionType,
      resourceType,
      resourceId,
      startDate,
      endDate,
      success,
      limit = 100,
      offset = 0,
    } = req.query;

    const filters: any = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    };

    // Non-admins can only see logs for their client
    if (req.user?.role !== 'admin') {
      filters.client_id = req.user?.client_id;
    }

    if (userId) filters.userId = userId;
    if (actionType) filters.actionType = actionType;
    if (resourceType) filters.resourceType = resourceType;
    if (resourceId) filters.resourceId = resourceId;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (success !== undefined) filters.success = success === 'true';

    const logs = await queryAuditLogs(filters);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM audit_logs';
    const countConditions = [];
    const countParams = [];
    let paramIndex = 1;

    if (filters.client_id) {
      countConditions.push(`client_id = $${paramIndex++}`);
      countParams.push(filters.client_id);
    }
    if (filters.userId) {
      countConditions.push(`user_id = $${paramIndex++}`);
      countParams.push(filters.userId);
    }
    if (filters.actionType) {
      countConditions.push(`action_type = $${paramIndex++}`);
      countParams.push(filters.actionType);
    }

    if (countConditions.length > 0) {
      countQuery += ' WHERE ' + countConditions.join(' AND ');
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      logs: logs,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  } catch (error) {
    console.error('Query audit logs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve audit logs',
    });
  }
});

/**
 * GET /api/audit/stats
 * Get audit log statistics
 */
router.get('/stats', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filters: any = {};

    // Non-admins can only see stats for their client
    if (req.user?.role !== 'admin') {
      filters.client_id = req.user?.client_id;
    }

    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const stats = await getAuditStats(filters);

    res.json({
      success: true,
      stats: stats,
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve audit statistics',
    });
  }
});

/**
 * GET /api/audit/recent
 * Get recent audit logs (last 24 hours)
 */
router.get('/recent', authenticate, requireCapability('read'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const filters = {
      limit: parseInt(limit),
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    };

    // Non-admins can only see logs for their client
    if (req.user.role !== 'admin') {
      filters.client_id = req.user.client_id;
    }

    const logs = await queryAuditLogs(filters);

    res.json({
      success: true,
      logs: logs,
    });
  } catch (error) {
    console.error('Get recent audit logs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve recent audit logs',
    });
  }
});

/**
 * GET /api/audit/user/:userId
 * Get audit logs for specific user
 */
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Users can view their own logs, admins can view all
    if (req.user.role !== 'admin' && req.user.id !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only view your own audit logs',
      });
    }

    const filters = {
      userId: userId,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    // Non-admins can only see logs for their client
    if (req.user.role !== 'admin') {
      filters.client_id = req.user.client_id;
    }

    const logs = await queryAuditLogs(filters);

    res.json({
      success: true,
      logs: logs,
    });
  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user audit logs',
    });
  }
});

/**
 * GET /api/audit/resource/:resourceType/:resourceId
 * Get audit logs for specific resource
 */
router.get(
  '/resource/:resourceType/:resourceId',
  authenticate,
  requireCapability('read'),
  async (req, res) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const filters = {
        resourceType: resourceType,
        resourceId: resourceId,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      // Non-admins can only see logs for their client
      if (req.user.role !== 'admin') {
        filters.client_id = req.user.client_id;
      }

      const logs = await queryAuditLogs(filters);

      res.json({
        success: true,
        logs: logs,
        resource: {
          type: resourceType,
          id: resourceId,
        },
      });
    } catch (error) {
      console.error('Get resource audit logs error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve resource audit logs',
      });
    }
  }
);

export default router;
