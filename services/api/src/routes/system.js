/**
 * System Information Routes
 * Health checks and service status for all microservices
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// Service URLs (internal Docker network)
// Use environment variable to determine dev vs prod services
const ENV_SUFFIX = process.env.NODE_ENV === 'development' || process.env.ENVIRONMENT === 'development' ? '-dev' : '';
const API_PORT = ENV_SUFFIX ? '4000' : '3000';
const MONITOR_PORT = ENV_SUFFIX ? '4003' : '3003';
const EXECUTOR_PORT = ENV_SUFFIX ? '4004' : '3004';

const SERVICES = {
  api: { url: `http://localhost:${API_PORT}/health`, name: 'API' },
  deviceMonitor: { url: `http://sentient-monitor${ENV_SUFFIX}:${MONITOR_PORT}/health`, name: 'Device Monitor' },
  sceneExecutor: { url: `http://sentient-executor${ENV_SUFFIX}:${EXECUTOR_PORT}/health`, name: 'Scene Executor' },
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

    const services = serviceStatuses.map((result) => result.value);

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

module.exports = router;
