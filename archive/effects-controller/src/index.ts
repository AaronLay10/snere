import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { MQTTPublisher } from './mqtt/MQTTPublisher.js';
import { SequenceRegistry } from './effects/SequenceRegistry.js';
import { SequenceExecutor } from './effects/SequenceExecutor.js';
import { ALL_SEQUENCES } from './effects/sequences.js';
import { healthRouter } from './routes/health.js';
import { sequencesRouter } from './routes/sequences.js';
import { executionsRouter } from './routes/executions.js';

const config = loadConfig();
const app = express();
const startedAt = Date.now();

// Initialize MQTT publisher
const mqttPublisher = new MQTTPublisher({
  url: config.MQTT_URL,
  username: config.MQTT_USERNAME,
  password: config.MQTT_PASSWORD,
  clientId: config.MQTT_CLIENT_ID
});

// Initialize sequence system
const registry = new SequenceRegistry();
const executor = new SequenceExecutor(mqttPublisher);

// Register built-in sequences
registry.registerMany(ALL_SEQUENCES);

// Log sequence events
executor.on('sequence-started', (execution) => {
  logger.info({ executionId: execution.id, sequenceId: execution.sequenceId }, 'Sequence started');
});

executor.on('sequence-completed', (execution) => {
  const duration = execution.completedAt! - execution.startedAt;
  logger.info({ executionId: execution.id, durationMs: duration }, 'Sequence completed');
});

executor.on('sequence-failed', ({ execution, error }) => {
  logger.error({ executionId: execution.id, err: error }, 'Sequence failed');
});

executor.on('sequence-step', ({ execution, step }) => {
  logger.debug(
    {
      executionId: execution.id,
      step: execution.currentStep,
      total: execution.totalSteps,
      action: step.action
    },
    'Executing step'
  );
});

// Express middleware
app.use(express.json());
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(',')
  })
);
app.use(
  pinoHttp({
    logger
  } as any)
);

// Routes
app.get('/', (_req, res) => {
  res.json({
    service: config.SERVICE_NAME,
    status: 'ok',
    sequences: registry.list().length,
    activeExecutions: executor.getActiveExecutions().length
  });
});

app.use('/health', healthRouter({ registry, executor, startedAt }));
app.use('/sequences', sequencesRouter({ registry, executor }));
app.use('/executions', executionsRouter({ executor }));

// Start MQTT
mqttPublisher.on('connected', () => {
  logger.info('Effects Controller MQTT publisher ready');
});

mqttPublisher.on('error', (error) => {
  logger.error({ err: error }, 'MQTT publisher error');
});

mqttPublisher.start().catch((error) => {
  logger.error({ err: error }, 'Failed to start MQTT publisher');
  process.exit(1);
});

// Start HTTP server
const server = app.listen(config.SERVICE_PORT, () => {
  logger.info({ port: config.SERVICE_PORT }, 'Effects Controller listening');
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down Effects Controller');

  await mqttPublisher.stop().catch((error) => {
    logger.error({ err: error }, 'Error stopping MQTT publisher');
  });

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
