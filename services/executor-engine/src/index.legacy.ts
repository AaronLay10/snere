import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Server as SocketIOServer } from 'socket.io';
import { loadConfig } from './config';
import { logger } from './logger';
import { PuzzleRegistry } from './puzzles/PuzzleRegistry';
import { SessionManager } from './sessions/SessionManager';
import { TimerManager } from './timing/TimerManager';
import { EventBus } from './events/EventBus';
import { PuzzleEngineService } from './services/PuzzleEngineService';
import { DeviceMonitorClient } from './clients/DeviceMonitorClient';
import { EffectsControllerClient } from './clients/EffectsControllerClient';
import { CLOCKWORK_PUZZLES } from './puzzles/data';
import { healthRouter } from './routes/health';
import { puzzlesRouter } from './routes/puzzles';
import { sessionsRouter } from './routes/sessions';
import { eventsRouter } from './routes/events';

const config = loadConfig();
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PATCH']
  }
});

const startedAt = Date.now();
const puzzles = new PuzzleRegistry();
puzzles.registerMany(CLOCKWORK_PUZZLES);

const sessions = new SessionManager(puzzles);
const timers = new TimerManager(config.TICK_INTERVAL_MS);
const bus = new EventBus();

let deviceMonitorClient: DeviceMonitorClient | undefined;
if (config.DEVICE_MONITOR_URL) {
  deviceMonitorClient = new DeviceMonitorClient(config.DEVICE_MONITOR_URL, 5_000);
}

let effectsControllerClient: EffectsControllerClient | undefined;
if (config.EFFECTS_CONTROLLER_URL) {
  effectsControllerClient = new EffectsControllerClient(config.EFFECTS_CONTROLLER_URL, 5_000);
}

const engine = new PuzzleEngineService(
  puzzles,
  sessions,
  timers,
  deviceMonitorClient,
  effectsControllerClient
);

timers.on('timer-expired', (timer) => {
  if (timer.id.startsWith('puzzle-')) {
    const puzzleId = timer.id.replace('puzzle-', '');
    engine.completePuzzle(puzzleId, 'timeout');
  }
});

bus.on('device-event', async (event) => {
  await engine.handleDeviceEvent(event);
});

puzzles.on('puzzle-updated', (puzzle) => {
  io.emit('puzzle-updated', puzzle);
});

sessions.on('session-updated', (session) => {
  io.emit('session-updated', session);
});

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
    puzzles: puzzles.list().length,
    sessions: sessions.list().length
  });
});

app.use('/health', healthRouter({ puzzles, sessions, startedAt }));
app.use('/puzzles', puzzlesRouter(puzzles, engine));
app.use('/sessions', sessionsRouter(sessions));
app.use('/events', eventsRouter(bus));

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down Puzzle Engine');
  timers.removeAllListeners();
  io.close();
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

server.listen(config.SERVICE_PORT, () => {
  logger.info({ port: config.SERVICE_PORT }, 'Puzzle Engine listening');
});
