/**
 * Mythra Sentient Engine - REST API Server
 * Main Express server with authentication, RBAC, and audit logging
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

const db = require('./config/database');
const { auditLog } = require('./middleware/audit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE || './logs/sentient-api.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Trust proxy (for rate limiting and IP detection behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'];

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Interface']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/status';
  }
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Audit logging middleware (after authentication)
app.use(auditLog);

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await db.healthCheck();

    res.json({
      status: 'ok',
      service: 'sentient-api',
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'sentient-api',
      message: 'Service unavailable',
      error: error.message
    });
  }
});

// API root
app.get('/', (req, res) => {
  res.json({
    service: 'Mythra Sentient Engine - REST API',
    version: '1.1.0',
    description: 'Multi-tenant escape room control system',
    documentation: '/api/docs',
    health: '/health',
    interfaces: {
      sentient: {
        description: 'Configuration and administration interface',
        basePath: '/api/sentient',
        users: ['admin', 'editor', 'viewer', 'technician', 'creative_director']
      },
      mythra: {
        description: 'Game master operational interface',
        basePath: '/api/mythra',
        users: ['game_master', 'admin']
      }
    }
  });
});

// Mount route modules
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sentient/clients', require('./routes/clients'));
app.use('/api/sentient/rooms', require('./routes/rooms'));
app.use('/api/sentient/scenes', require('./routes/scenes'));
app.use('/api/sentient/scene-steps', require('./routes/scene-steps'));
app.use('/api/sentient/devices', require('./routes/devices'));
app.use('/api/sentient/device-commands', require('./routes/device-commands'));
app.use('/api/sentient/controllers', require('./routes/controllers'));
app.use('/api/sentient/puzzles', require('./routes/puzzles'));
app.use('/api/sentient/users', require('./routes/users'));
app.use('/api/mythra', require('./routes/mythra'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/mqtt', require('./routes/mqtt'));
app.use('/api/system', require('./routes/system'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      '/health',
      '/api/auth/login',
      '/api/sentient/*',
      '/api/mythra/*'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.name || 'Internal server error',
    message: err.message || 'An unexpected error occurred',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Sentient API server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason,
    promise: promise
  });
});

module.exports = app;
