import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from './logger.js';
import { loadConfig } from './config.js';
import { MQTTClient } from './mqtt/MQTTClient.js';
import { OSCClient } from './osc/OSCClient.js';
import { createHealthRouter } from './routes/health.js';

const config = loadConfig();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

// Initialize clients
const mqttClient = new MQTTClient({
  url: config.MQTT_URL,
  clientId: config.MQTT_CLIENT_ID,
  username: config.MQTT_USERNAME,
  password: config.MQTT_PASSWORD,
  topicFilter: config.MQTT_TOPIC_FILTER
});

const oscClient = new OSCClient({
  remoteAddress: config.SCS_HOST,
  remotePort: config.SCS_PORT,
  backupAddress: config.SCS_HOST_BACKUP
});

// Health status provider
function getHealthStatus() {
  return {
    service: config.SERVICE_NAME,
    healthy: mqttClient.isConnected() && oscClient.isConnected(),
    mqtt: {
      connected: mqttClient.isConnected(),
      url: config.MQTT_URL,
      topicFilter: config.MQTT_TOPIC_FILTER
    },
    osc: {
      connected: oscClient.isConnected(),
      currentHost: oscClient.getCurrentHost(),
      port: config.SCS_PORT
    },
    timestamp: new Date().toISOString()
  };
}

// Routes
app.use(createHealthRouter(getHealthStatus));

// MQTT to OSC command mapping
mqttClient.on('audioCommand', ({ room, action, command }) => {
  logger.info({ room, action, command }, 'Processing audio command');

  try {
    // Check if action is a cue ID (Q1-Q41 pattern)
    if (/^Q\d+$/.test(action)) {
      // Direct cue trigger
      oscClient.playCue(action);
      logger.info({ cueId: action }, `Triggered SCS cue: ${action}`);
    } else {
      // Legacy command format
      switch (action) {
        case 'playCue':
          if (command.cueId) {
            oscClient.playCue(command.cueId);
          } else {
            logger.warn({ command }, 'playCue command missing cueId');
          }
          break;

        case 'stopCue':
          oscClient.stopCue();
          break;

        case 'pauseCue':
          oscClient.pauseCue();
          break;

        case 'resumeCue':
          oscClient.resumeCue();
          break;

        case 'go':
          oscClient.go();
          break;

        case 'fadeIn':
          if (command.durationMs) {
            oscClient.fadeIn(command.durationMs);
          } else {
            logger.warn({ command }, 'fadeIn command missing durationMs');
          }
          break;

        case 'fadeOut':
          if (command.durationMs) {
            oscClient.fadeOut(command.durationMs);
          } else {
            logger.warn({ command }, 'fadeOut command missing durationMs');
          }
          break;

        default:
          logger.warn({ action, command }, 'Unknown audio command action');
      }
    }
  } catch (error) {
    logger.error({ err: error, room, action, command }, 'Failed to execute audio command');
  }
});

// Error handlers
mqttClient.on('error', (error) => {
  logger.error({ err: error }, 'MQTT client error');
});

oscClient.on('error', (error) => {
  logger.error({ err: error }, 'OSC client error');
});

// Startup
async function start() {
  try {
    logger.info('Starting SCS Bridge service...');

    // Start OSC client
    await oscClient.start();
    logger.info('OSC client started');

    // Connect to MQTT
    await mqttClient.connect();
    logger.info('MQTT client connected');

    // Start HTTP server
    app.listen(config.SERVICE_PORT, () => {
      logger.info(
        {
          port: config.SERVICE_PORT,
          scsHost: config.SCS_HOST,
          scsBackup: config.SCS_HOST_BACKUP,
          mqttUrl: config.MQTT_URL
        },
        'SCS Bridge service ready'
      );
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start SCS Bridge service');
    process.exit(1);
  }
}

// Shutdown
async function shutdown() {
  logger.info('Shutting down SCS Bridge service...');
  await mqttClient.disconnect();
  await oscClient.stop();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
start();
