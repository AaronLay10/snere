import { Router } from 'express';
import mqtt from 'mqtt';
import { logger } from '../logger';

export const mqttRouter = (mqttBrokerUrl: string) => {
  const router = Router();

  // Create MQTT client connection
  const mqttClient = mqtt.connect(mqttBrokerUrl, {
    clientId: `api-gateway-${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    logger.info({ broker: mqttBrokerUrl }, 'API Gateway connected to MQTT broker');
  });

  mqttClient.on('error', (err) => {
    logger.error({ err, broker: mqttBrokerUrl }, 'MQTT client error');
  });

  mqttClient.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  mqttClient.on('reconnect', () => {
    logger.info('MQTT client reconnecting');
  });

  /**
   * POST /api/mqtt/publish
   * Publishes a message to an MQTT topic
   * Body: { topic: string, payload: object | string }
   */
  router.post('/publish', async (req, res) => {
    const { topic, payload } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: 'Topic is required'
        }
      });
    }

    if (!mqttClient.connected) {
      return res.status(503).json({
        success: false,
        error: {
          code: 503,
          message: 'MQTT broker not connected'
        }
      });
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

      mqttClient.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          logger.error({ err, topic }, 'Failed to publish MQTT message');
          return res.status(500).json({
            success: false,
            error: {
              code: 500,
              message: 'Failed to publish message',
              details: err.message
            }
          });
        }

        logger.info({ topic, payload }, 'MQTT message published');
        res.json({
          success: true,
          data: {
            topic,
            payload,
            timestamp: Date.now()
          }
        });
      });
    } catch (error: any) {
      logger.error({ err: error, topic }, 'Error publishing MQTT message');
      res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: 'Internal server error',
          details: error.message
        }
      });
    }
  });

  return router;
};
