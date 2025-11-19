import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Server as SocketIOServer } from 'socket.io';
import { loadConfig } from './config';
import { logger } from './logger';

// Scene Orchestrator Components
import { SceneRegistry } from './scenes/SceneRegistry';
import { CutsceneExecutor } from './scenes/CutsceneExecutor';
import { SafetyVerifier } from './scenes/SafetyVerifier';
import { SceneOrchestratorService } from './services/SceneOrchestratorService';
import { DatabaseClient } from './database/DatabaseClient';
import { ConfigurationLoader } from './config/ConfigurationLoader';
import type { SceneConfig } from './types';

// Legacy Components (for backward compatibility)
import { SessionManager } from './sessions/SessionManager';
import { TimerManager } from './timing/TimerManager';
import { EventBus } from './events/EventBus';
import { DeviceMonitorClient } from './clients/DeviceMonitorClient';
import { EffectsControllerClient } from './clients/EffectsControllerClient';

// Routes
import { healthRouter } from './routes/health';
import { scenesRouter } from './routes/scenes';
import { directorRouter } from './routes/director';
import { roomsRouter } from './routes/rooms';
import { configurationRouter } from './routes/configuration';
import { sessionsRouter } from './routes/sessions';
import { eventsRouter } from './routes/events';

// Legacy routes (for backward compatibility)
import { puzzlesRouter } from './routes/puzzles';
import { PuzzleEngineService } from './services/PuzzleEngineService';
import { PuzzleRegistry } from './puzzles/PuzzleRegistry';

// MQTT and Puzzle Condition Evaluation
import { MQTTClientManager } from './mqtt/MQTTClient';
import { ConditionEvaluator } from './puzzles/ConditionEvaluator';

const config = loadConfig();
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  // Use default path; Nginx will proxy /scene-executor/* to this service
  path: '/socket.io',
  cors: {
    origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

const startedAt = Date.now();

// ============================================================================
// Initialize Core Services
// ============================================================================

logger.info('Initializing Scene Orchestrator...');

// Database
const database = new DatabaseClient(config.DATABASE_URL);

// Configuration Loader
const configLoader = new ConfigurationLoader(config.CONFIG_PATH, database);

// Scene Registry
const scenes = new SceneRegistry();

// Cutscene Executor
const cutsceneExecutor = new CutsceneExecutor();

// Device Monitor Client
let deviceMonitorClient: DeviceMonitorClient | undefined;
if (config.DEVICE_MONITOR_URL) {
  deviceMonitorClient = new DeviceMonitorClient(config.DEVICE_MONITOR_URL, 5_000);
}

// Safety Verifier
const safetyVerifier = new SafetyVerifier(deviceMonitorClient);

// Effects Controller Client
let effectsControllerClient: EffectsControllerClient | undefined;
if (config.EFFECTS_CONTROLLER_URL) {
  effectsControllerClient = new EffectsControllerClient(config.EFFECTS_CONTROLLER_URL, 5_000);
}

// Session Manager and Timers (for puzzle tracking)
const sessions = new SessionManager(scenes as unknown as PuzzleRegistry);
const timers = new TimerManager(config.TICK_INTERVAL_MS);

// Event Bus
const bus = new EventBus();

// MQTT Client for sensor monitoring
let mqttClient: MQTTClientManager | undefined;
if (config.MQTT_URL) {
  mqttClient = new MQTTClientManager({
    url: config.MQTT_URL,
    username: config.MQTT_USERNAME,
    password: config.MQTT_PASSWORD?.trim(),
    clientId: 'scene-orchestrator',
    topicFilter: config.MQTT_TOPIC_FILTER || 'paragon/#',
  });
}

// Puzzle Condition Evaluator
const conditionEvaluator = new ConditionEvaluator();

// Scene Orchestrator Service
const orchestrator = new SceneOrchestratorService(
  scenes,
  cutsceneExecutor,
  safetyVerifier,
  sessions,
  timers,
  deviceMonitorClient,
  effectsControllerClient,
  mqttClient,
  database
);

// Legacy Puzzle Engine (for backward compatibility)
const legacyPuzzleRegistry = new PuzzleRegistry();
const legacyEngine = new PuzzleEngineService(
  legacyPuzzleRegistry,
  sessions,
  timers,
  deviceMonitorClient,
  effectsControllerClient
);

// ============================================================================
// Event Handlers
// ============================================================================

// Timer expiration
timers.on('timer-expired', (timer) => {
  if (timer.id.startsWith('scene-')) {
    const sceneId = timer.id.replace('scene-', '');
    orchestrator.completeScene(sceneId, 'timeout');
  }
  // Legacy support
  if (timer.id.startsWith('puzzle-')) {
    const puzzleId = timer.id.replace('puzzle-', '');
    legacyEngine.completePuzzle(puzzleId, 'timeout');
  }
});

// Device events
bus.on('device-event', async (event) => {
  await orchestrator.handleDeviceEvent(event);
});

// MQTT sensor data monitoring
if (mqttClient) {
  mqttClient.on('sensor-data', (message) => {
    // Update condition evaluator cache
    conditionEvaluator.updateSensorData(message);

    // Evaluate all active puzzles
    const activePuzzles = scenes.list().filter((s) => s.type === 'puzzle' && s.state === 'active');

    for (const puzzle of activePuzzles) {
      const isSolved = conditionEvaluator.evaluatePuzzle(puzzle);

      if (isSolved) {
        logger.info(
          { puzzleId: puzzle.id, name: puzzle.name, deviceId: message.deviceId },
          'Puzzle win condition met - marking as solved'
        );

        // Mark puzzle as solved
        orchestrator.completeScene(puzzle.id, 'solved').catch((error) => {
          logger.error(
            { puzzleId: puzzle.id, error },
            'Failed to complete puzzle after win condition met'
          );
        });
      }
    }
  });

  mqttClient.on('device-state', (message) => {
    // Also update state changes in condition evaluator
    conditionEvaluator.updateSensorData(message);
  });

  mqttClient.on('connected', () => {
    logger.info('MQTT sensor monitoring active - Scene Orchestrator ready to evaluate puzzles');
  });

  mqttClient.on('disconnected', (error) => {
    if (error) {
      logger.error({ error }, 'MQTT sensor monitoring disconnected with error');
    } else {
      logger.warn('MQTT sensor monitoring disconnected');
    }
  });
}

// Scene updates -> WebSocket broadcast
scenes.on('scene-updated', (scene) => {
  io.emit('scene-updated', scene);
  logger.debug({ sceneId: scene.id, state: scene.state }, 'Scene update broadcast');
});

scenes.on('scene-started', (scene) => {
  io.emit('scene-started', scene);
  logger.info({ sceneId: scene.id, name: scene.name }, 'Scene started broadcast');
});

scenes.on('scene-completed', (scene) => {
  io.emit('scene-completed', scene);
  logger.info(
    { sceneId: scene.id, name: scene.name, state: scene.state },
    'Scene completed broadcast'
  );
});

// Session updates
sessions.on('session-updated', (session) => {
  io.emit('session-updated', session);
});

// Cutscene action events
cutsceneExecutor.on('action-executed', (sceneId, action, index) => {
  io.emit('cutscene-action', { sceneId, action, index });
  logger.debug({ sceneId, actionIndex: index }, 'Cutscene action broadcast');
});

// Cutscene action waiting events (when step has delayAfterMs)
cutsceneExecutor.on('action-waiting', (sceneId, action, index, delayMs) => {
  io.emit('step-waiting', { sceneId, action, stepIndex: index, delayMs, timestamp: Date.now() });
  logger.debug({ sceneId, actionIndex: index, delayMs }, 'Step waiting broadcast');
});

// Legacy puzzle updates
legacyPuzzleRegistry.on('puzzle-updated', (puzzle) => {
  io.emit('puzzle-updated', puzzle);
});

// Timeline executor events (for new puzzle timeline system)
const timelineExecutor = orchestrator.getTimelineExecutor();

timelineExecutor.on('timeline-block-started', (data) => {
  io.emit('timeline-block-started', data);
  logger.debug(
    { sceneId: data.sceneId, blockId: data.block.id },
    'Timeline block started broadcast'
  );
});

timelineExecutor.on('timeline-block-active', (data) => {
  io.emit('timeline-block-active', data);
  // High-frequency event - don't log every time
});

timelineExecutor.on('timeline-block-completed', (data) => {
  io.emit('timeline-block-completed', data);
  logger.debug(
    { sceneId: data.sceneId, blockId: data.blockId },
    'Timeline block completed broadcast'
  );
});

timelineExecutor.on('timeline-completed', (data) => {
  io.emit('timeline-completed', data);
  logger.info({ sceneId: data.sceneId }, 'Timeline completed broadcast');
});

timelineExecutor.on('timeline-error', (data) => {
  io.emit('timeline-error', data);
  logger.error({ sceneId: data.sceneId, blockId: data.blockId }, 'Timeline error broadcast');
});

// ============================================================================
// Express Middleware
// ============================================================================

// CORS must come first, before helmet
app.use(
  cors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  pinoHttp({
    logger,
  } as any)
);

// ============================================================================
// Routes
// ============================================================================

app.get('/', (_req, res) => {
  res.json({
    service: config.SERVICE_NAME,
    version: '2.0.0',
    status: 'ok',
    features: {
      sceneOrchestrator: true,
      cutscenes: true,
      directorControls: true,
      safetyChecks: true,
    },
    stats: {
      scenes: scenes.list().length,
      puzzles: scenes.listByType('puzzle').length,
      cutscenes: scenes.listByType('cutscene').length,
      sessions: sessions.list().length,
    },
  });
});

// Health check
app.use(
  '/health',
  healthRouter({ puzzles: scenes as unknown as PuzzleRegistry, sessions, startedAt })
);

// Scene Orchestrator Routes
app.use('/scenes', scenesRouter(scenes, orchestrator));
app.use('/director', directorRouter(orchestrator, database));
app.use('/rooms', roomsRouter(scenes, orchestrator));
app.use('/configuration', configurationRouter(configLoader, scenes));

// Legacy Routes (for backward compatibility)
app.use('/puzzles', puzzlesRouter(legacyPuzzleRegistry, legacyEngine));
app.use('/sessions', sessionsRouter(sessions));
app.use('/events', eventsRouter(bus));

// ============================================================================
// WebSocket
// ============================================================================

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });

  // Director can subscribe to specific rooms
  socket.on('subscribe-room', (roomId: string) => {
    socket.join(`room:${roomId}`);
    logger.info({ socketId: socket.id, roomId }, 'Subscribed to room');
  });

  socket.on('unsubscribe-room', (roomId: string) => {
    socket.leave(`room:${roomId}`);
    logger.info({ socketId: socket.id, roomId }, 'Unsubscribed from room');
  });
});

// ============================================================================
// Startup
// ============================================================================

const startup = async () => {
  try {
    logger.info('Starting Scene Orchestrator...');

    // Initialize database
    logger.info('Initializing database...');
    await database.initialize();

    // Load configurations from JSON files (production source of truth)
    logger.info('Loading scene configurations from JSON files...');
    const roomConfigs = await configLoader.loadAllRooms();

    // Flatten all room scenes into a single array
    const allScenes: SceneConfig[] = [];
    for (const [roomId, roomScenes] of roomConfigs.entries()) {
      allScenes.push(...roomScenes);
      logger.info({ roomId, sceneCount: roomScenes.length }, 'Room scenes loaded');
    }

    logger.info({ totalScenes: allScenes.length }, 'All scenes loaded from JSON files');

    // Register scenes in runtime registry
    logger.info('Registering scenes...');
    scenes.registerMany(allScenes);
    logger.info('Scenes registered successfully');

    logger.info(
      {
        totalScenes: allScenes.length,
        puzzles: allScenes.filter((s) => s.type === 'puzzle').length,
        cutscenes: allScenes.filter((s) => s.type === 'cutscene').length,
      },
      'Scenes loaded into registry'
    );

    // Start MQTT client for sensor monitoring
    if (mqttClient) {
      logger.info('Starting MQTT sensor monitoring...');
      await mqttClient.start();
      const stats = conditionEvaluator.getCacheStats();
      logger.info({ ...stats }, 'Puzzle condition evaluator initialized');
    } else {
      logger.warn(
        'MQTT_URL not configured - sensor monitoring disabled (puzzles will not auto-solve)'
      );
    }

    // Start HTTP server
    server.listen(config.SERVICE_PORT, () => {
      logger.info(
        { port: config.SERVICE_PORT, service: config.SERVICE_NAME },
        'Scene Orchestrator is ready'
      );
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start Scene Orchestrator');
    process.exit(1);
  }
};

// ============================================================================
// Shutdown
// ============================================================================

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down Scene Orchestrator');

  // Stop all running cutscenes
  cutsceneExecutor.stopAll();

  // Stop timers
  timers.removeAllListeners();

  // Stop MQTT client
  if (mqttClient) {
    logger.info('Stopping MQTT sensor monitoring');
    await mqttClient.stop();
  }

  // Close WebSocket
  io.close();

  // Close database
  await database.close();

  // Close HTTP server
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Error closing HTTP server');
      process.exit(1);
    }
    logger.info('Scene Orchestrator shut down cleanly');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the service
startup();
