/**
 * Mythra Sentient Engine - Database Configuration
 * PostgreSQL connection pool and query helpers
 */

const { Pool } = require('pg');
const winston = require('winston');

// Logger for database operations
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
    })
  ]
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'sentient',
  user: process.env.DB_USER || 'sentient',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  } else {
    logger.info('Database connected successfully', {
      host: dbConfig.host,
      database: dbConfig.database,
      timestamp: res.rows[0].now
    });
  }
});

/**
 * Execute a query with error handling and logging
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Query execution failed', {
      query: text.substring(0, 100),
      error: error.message,
      params: params.length
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await pool.connect();

  // Add query method with logging
  const originalQuery = client.query.bind(client);
  client.query = async (text, params) => {
    const start = Date.now();
    try {
      const result = await originalQuery(text, params);
      const duration = Date.now() - start;
      logger.debug('Transaction query executed', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      return result;
    } catch (error) {
      logger.error('Transaction query failed', {
        query: text.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  };

  return client;
}

/**
 * Execute a function within a transaction
 * @param {Function} callback - Function to execute in transaction
 * @returns {Promise<any>} Result of callback
 */
async function transaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    logger.debug('Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.warn('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Check database health
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    return {
      healthy: true,
      timestamp: result.rows[0].time,
      version: result.rows[0].version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Close all database connections
 */
async function close() {
  await pool.end();
  logger.info('Database pool closed');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = {
  query,
  getClient,
  transaction,
  healthCheck,
  close,
  pool
};
