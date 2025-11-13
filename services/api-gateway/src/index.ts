import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Server as SocketIOServer } from 'socket.io';
import createError from 'http-errors';
import { loadConfig } from './config';
import { logger } from './logger';
import { ServiceRegistry } from './registry/ServiceRegistry';
import { devicesRouter } from './routes/devices';
import { systemRouter } from './routes/system';
import { puzzlesRouter } from './routes/puzzles';
import { mqttRouter } from './routes/mqtt';
import { DeviceMonitorClient } from './clients/DeviceMonitorClient';

const config = loadConfig();
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST']
  }
});

const registry = new ServiceRegistry({
  refreshIntervalMs: config.SERVICE_REGISTRY_REFRESH_MS,
  timeoutMs: config.DOWNSTREAM_TIMEOUT_MS
});

let deviceMonitorClient: DeviceMonitorClient | undefined;
if (config.DEVICE_MONITOR_URL) {
  const service = registry.register('device-monitor', config.DEVICE_MONITOR_URL);
  deviceMonitorClient = new DeviceMonitorClient(config.DEVICE_MONITOR_URL, config.DOWNSTREAM_TIMEOUT_MS);
  logger.info({ service }, 'Device Monitor registered with API Gateway');
}

if (config.PUZZLE_ENGINE_URL) {
  registry.register('executor-engine', config.PUZZLE_ENGINE_URL);
}

if (config.EFFECTS_CONTROLLER_URL) {
  registry.register('effects-controller', config.EFFECTS_CONTROLLER_URL);
}

if (config.ALERT_ENGINE_URL) {
  registry.register('alert-engine', config.ALERT_ENGINE_URL);
}

registry.on('service-status', (service) => {
  io.emit('service-status', service);
});

registry.start();

app.use(express.json());
app.use(
  cors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(',')
  })
);
app.use(helmet());
app.use(
  pinoHttp({
    logger
  } as any)
);

app.get('/', (_req, res) => {
  res.json({
    service: config.SERVICE_NAME,
    status: 'ok',
    services: registry.list()
  });
});

app.use('/system', systemRouter(registry));
app.use('/devices', devicesRouter(deviceMonitorClient));
app.use('/puzzles', puzzlesRouter(config.PUZZLE_ENGINE_URL));
app.use('/api/mqtt', mqttRouter(config.MQTT_BROKER_URL));

app.use((req, _res, next) => {
  next(createError(404, `Route ${req.path} not found`));
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, 'Unhandled error');
  res.status(error.status || 500).json({
    success: false,
    error: {
      code: error.status || 500,
      message: error.message || 'Internal Server Error'
    }
  });
});

io.on('connection', (socket) => {
  logger.info({ id: socket.id }, 'WebSocket client connected');
  socket.emit('service-status-snapshot', registry.list());
  socket.on('disconnect', () => {
    logger.info({ id: socket.id }, 'WebSocket client disconnected');
  });
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down API Gateway');
  registry.stop();
  io.close();
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error shutting down HTTP server');
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(config.SERVICE_PORT, () => {
  logger.info({ port: config.SERVICE_PORT }, 'API Gateway listening');
});
