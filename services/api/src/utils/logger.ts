/**
 * Shared Logger Instance
 * Re-exports the winston logger for use across the application
 */

import winston from 'winston';

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

export default logger;
