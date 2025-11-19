/**
 * Structured Logging with Winston
 * Provides centralized logging for the trading bot
 */

import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const customFormat = printf(({ level, message, timestamp, module, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;

  if (module) {
    msg += ` [${module}]`;
  }

  msg += `: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

/**
 * Create Winston logger instance
 * @param {string} module - Module name for log context
 * @returns {Object} Winston logger
 */
export function createLogger(module = 'app') {
  const logLevel = process.env.LOG_LEVEL || 'info';

  const logger = winston.createLogger({
    level: logLevel,
    format: combine(
      errors({ stack: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      customFormat
    ),
    defaultMeta: { module },
    transports: [
      // Console output
      new winston.transports.Console({
        format: combine(
          colorize(),
          customFormat
        )
      }),

      // File output for errors
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),

      // File output for all logs
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      })
    ]
  });

  return logger;
}

/**
 * Default logger instance
 */
export const logger = createLogger();

export default createLogger;
