import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { loadConfig } from './config';
import { logger } from './logger';
import { DeviceRegistry } from './devices/DeviceRegistry';
import { MQTTManager } from './mqtt/MQTTManager';
import { buildRoutes } from './routes';
import { TopicBuilder } from './mqtt/topics';
import { AlertManager } from './alerts/AlertManager';
import { PuzzleEngineBridge } from './integrations/PuzzleEngineBridge';
import { WebSocketServer } from './websocket/WebSocketServer';
import { ControllerRegistration } from './registration/ControllerRegistration';
import { SplitRegistrationHandler } from './registration/SplitRegistrationHandler';
import { DeviceStateManager } from './state/DeviceStateManager';
import { HeartbeatWriter } from './database/HeartbeatWriter';

const config = loadConfig();
const app = express();
const startedAt = Date.now();

const registry = new DeviceRegistry({
  heartbeatTimeoutMs: config.DEVICE_HEARTBEAT_TIMEOUT_MS
});
const mqtt = new MQTTManager({
  url: config.MQTT_URL,
  username: config.MQTT_USERNAME,
  password: config.MQTT_PASSWORD,
  clientId: config.MQTT_CLIENT_ID,
  topicFilter: config.MQTT_TOPIC_FILTER
});
const topicBuilder = new TopicBuilder();
const alerts = new AlertManager();

// Initialize controller registration handler (legacy single-message format)
const controllerRegistration = new ControllerRegistration({
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  serviceToken: process.env.SERVICE_AUTH_TOKEN
});

// Initialize split registration handler (v2.0.7+ format)
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required for device registration');
  process.exit(1);
}

// Will be initialized after WebSocket server is created
let splitRegistration: SplitRegistrationHandler;

// Initialize device state manager for sensor/state tracking
const stateManager = new DeviceStateManager({
  databaseUrl: process.env.DATABASE_URL || ''
});

// Initialize heartbeat writer to persist controller status to database
const heartbeatWriter = new HeartbeatWriter({
  databaseUrl: process.env.DATABASE_URL || '',
  batchSize: 50,
  flushIntervalMs: 2000 // Flush every 2 seconds
});
heartbeatWriter.start();

if (config.PUZZLE_ENGINE_URL) {
  const bridge = new PuzzleEngineBridge(registry, {
    baseUrl: config.PUZZLE_ENGINE_URL
  });
  bridge.start();
} else {
  logger.warn('PUZZLE_ENGINE_URL not set; puzzle events will not be forwarded');
}

registry.on('device-offline', ({ device }) => {
  alerts.raiseAlert({
    severity: 'high',
    message: `Device ${device.id} marked offline`,
    device: {
      id: device.id,
      roomId: device.roomId,
      puzzleId: device.puzzleId,
      status: device.status
    }
  });

  // Write offline status to database
  heartbeatWriter.queueHeartbeat(device);
});

registry.on('device-updated', ({ device }) => {
  // Write heartbeat to database when device is updated
  if (device.status === 'online' || device.status === 'offline') {
    heartbeatWriter.queueHeartbeat(device);
  }
});

app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: '*'
  })
);
app.use(
  pinoHttp({
    logger
  } as any)
);

app.use(
  buildRoutes({
    registry,
    mqtt,
    topicBuilder,
    startedAt,
    stateManager
  })
);

app.get('/', (_req, res) => {
  res.json({
    service: config.SERVICE_NAME,
    status: 'ok',
    startedAt: new Date(startedAt).toISOString()
  });
});

const server = app.listen(config.SERVICE_PORT, () => {
  logger.info({ port: config.SERVICE_PORT }, 'Device Monitor listening');
});

// Initialize WebSocket server with state manager
const wsServer = new WebSocketServer(server, registry, stateManager);

// Pass WebSocket server to registration handler for real-time updates
splitRegistration = new SplitRegistrationHandler({
  databaseUrl: config.DATABASE_URL,
  registrationTimeoutMs: 10000,
  wsServer
});

const HEALTH_SWEEP_INTERVAL = config.HEALTH_SWEEP_INTERVAL_MS;
const healthInterval = setInterval(() => registry.performHealthSweep(), HEALTH_SWEEP_INTERVAL);

mqtt.on('message', (message) => {
  // Check if this is a split controller registration message (v2.0.7+)
  if (message.topic === 'sentient/system/register/controller' || message.topic.endsWith('/system/register/controller')) {
    const controllerData = SplitRegistrationHandler.parseControllerMessage(message.payload);
    if (controllerData) {
      splitRegistration.handleControllerMessage(controllerData).catch((error) => {
        logger.error({ error: error.message }, 'Failed to process split controller registration');
      });
    }
  }
  // Check if this is a split device registration message (v2.0.7+)
  else if (message.topic === 'sentient/system/register/device' || message.topic.endsWith('/system/register/device')) {
    const deviceData = SplitRegistrationHandler.parseDeviceMessage(message.payload);
    if (deviceData) {
      splitRegistration.handleDeviceMessage(deviceData).catch((error) => {
        logger.error({ error: error.message }, 'Failed to process split device registration');
      });
    }
  }
  // Legacy single-message registration format (pre-v2.0.7)
  else if (message.topic === 'sentient/system/register' || message.topic.endsWith('/system/register')) {
    const registrationData = ControllerRegistration.parseMessage(message.payload);
    if (registrationData) {
      controllerRegistration.handleRegistration(registrationData).catch((error) => {
        logger.error({ error: error.message }, 'Failed to process controller registration');
      });
    }
  } else {
    // Regular device message
    registry.handleMessage(message);

    // Also check if this is sensor/state data
    stateManager.handleMessage(message).catch((error) => {
      logger.error({ error: error.message, topic: message.topic }, 'Failed to process sensor/state data');
    });
  }
});

mqtt.on('connected', () => {
  logger.info('Device Monitor subscribed to MQTT broker');
});

mqtt.on('disconnected', (error) => {
  if (error) {
    logger.error({ err: error }, 'MQTT connection error');
  }
});

mqtt.start().catch((error) => {
  logger.error({ err: error }, 'Failed to start MQTT manager');
  process.exit(1);
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down Device Monitor');
  clearInterval(healthInterval);

  wsServer.close();
  await heartbeatWriter.close().catch((error) => logger.error({ err: error }, 'Error closing heartbeat writer'));
  await stateManager.close().catch((error) => logger.error({ err: error }, 'Error closing state manager'));
  await mqtt.stop().catch((error) => logger.error({ err: error }, 'Error stopping MQTT manager'));

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error closing HTTP server');
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
