/**
 * MQTT Publishing Route
 * Allows authenticated users to publish messages to MQTT topics
 */

import logger from '../config/logger.js';
import mqttClient from '../config/mqtt.js';
import { authenticate } from '../middleware/auth.js';

import { Router } from 'express';
const router = Router();

/**
 * POST /api/mqtt/publish
 * Publish a message to an MQTT topic
 * Body: { topic: string, payload: object | string, qos?: number }
 */
router.post('/publish', authenticate, async (req, res) => {
  const { topic, payload, qos = 1 } = req.body;

  if (!topic) {
    return res.status(400).json({
      success: false,
      error: {
        code: 400,
        message: 'Topic is required',
      },
    });
  }

  try {
    // Use the singleton MQTT client's publishCommand method
    await mqttClient.publishCommand(topic, payload, { qos: parseInt(qos) });

    logger.info(
      {
        topic,
        payload,
        user: req.user?.username,
        client_id: req.user?.client_id,
      },
      'MQTT message published via API'
    );

    res.json({
      success: true,
      data: {
        topic,
        payload,
        timestamp: Date.now(),
        published_by: req.user?.username,
      },
    });
  } catch (error) {
    logger.error({ err: error, topic }, 'Error publishing MQTT message');
    res.status(500).json({
      success: false,
      error: {
        code: 500,
        message: 'Failed to publish message',
        details: error.message,
      },
    });
  }
});

/**
 * POST /api/mqtt/touchscreen/publish
 * Unauthenticated endpoint for touchscreen lighting control
 * Only allows publishing to lighting control topics
 * Body: { topic: string, payload: object | string }
 */
router.post('/touchscreen/publish', async (req, res) => {
  const { topic, payload } = req.body;

  if (!topic) {
    return res.status(400).json({
      success: false,
      error: {
        code: 400,
        message: 'Topic is required',
      },
    });
  }

  // Security: Only allow publishing to lighting control topics
  const allowedTopicPrefixes = ['paragon/clockwork/commands/main_lighting/'];

  const isAllowed = allowedTopicPrefixes.some((prefix) => topic.startsWith(prefix));

  if (!isAllowed) {
    logger.warn({ topic }, 'Touchscreen attempted to publish to unauthorized topic');
    return res.status(403).json({
      success: false,
      error: {
        code: 403,
        message: 'Touchscreen can only publish to lighting control topics',
      },
    });
  }

  try {
    // Use the singleton MQTT client's publishCommand method
    await mqttClient.publishCommand(topic, payload, { qos: 1 });

    logger.info(
      {
        topic,
        payload,
        source: 'touchscreen',
      },
      'MQTT message published via touchscreen'
    );

    res.json({
      success: true,
      data: {
        topic,
        payload,
        timestamp: Date.now(),
        published_by: 'touchscreen',
      },
    });
  } catch (error) {
    logger.error({ err: error, topic }, 'Error publishing MQTT message from touchscreen');
    res.status(500).json({
      success: false,
      error: {
        code: 500,
        message: 'Failed to publish message',
        details: error.message,
      },
    });
  }
});

/**
 * GET /api/mqtt/status
 * Get MQTT client connection status
 */
router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      connected: mqttClient.isConnected(),
      broker: process.env.MQTT_URL || 'mqtt://localhost:1883',
    },
  });
});

export default router;
