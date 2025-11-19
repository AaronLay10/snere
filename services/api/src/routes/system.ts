/**
 * System Information Routes
 * Health checks and service status for all microservices
 */

import { Router } from 'express';
const router = Router();
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';

// Service URLs (internal Docker network)
const SERVICES = {
  api: { url: `http://localhost:3000/health`, name: 'API' },
  deviceMonitor: { url: `http://device-monitor:3003/health`, name: 'Device Monitor' },
  sceneExecutor: { url: `http://executor-engine:3004/health`, name: 'Scene Executor' },
};

/**
 * GET /api/system/status
 * Get status and versions of all services
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const serviceStatuses = await Promise.allSettled(
      Object.entries(SERVICES).map(async ([key, service]) => {
        try {
          const response = await axios.get(service.url, { timeout: 3000 });
          return {
            service: key,
            name: service.name,
            status: 'ok',
            version: response.data.version || 'unknown',
            uptime: response.data.uptimeMs || response.data.uptime || null,
          };
        } catch (error) {
          return {
            service: key,
            name: service.name,
            status: 'error',
            version: 'unknown',
            error: error.message,
          };
        }
      })
    );

    const services = serviceStatuses
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map((result) => result.value);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      services,
    });
  } catch (error) {
    console.error('System status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve system status',
    });
  }
});

export default router;
