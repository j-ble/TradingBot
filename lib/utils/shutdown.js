/**
 * Graceful Shutdown Handler
 * Handles SIGTERM/SIGINT signals for clean shutdown
 */

import { createLogger } from './logger.js';

const logger = createLogger('shutdown');

// Track registered cleanup handlers
const cleanupHandlers = [];

// Track if shutdown is in progress
let isShuttingDown = false;

/**
 * Register a cleanup handler to run on shutdown
 * @param {string} name - Handler name for logging
 * @param {Function} handler - Async cleanup function
 */
export function registerCleanupHandler(name, handler) {
  cleanupHandlers.push({ name, handler });
  logger.debug(`Registered cleanup handler: ${name}`);
}

/**
 * Execute all cleanup handlers
 * @param {string} signal - Signal that triggered shutdown
 */
async function executeCleanup(signal) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  const startTime = Date.now();

  for (const { name, handler } of cleanupHandlers) {
    try {
      logger.info(`Running cleanup: ${name}`);
      await handler();
      logger.info(`Cleanup complete: ${name}`);
    } catch (error) {
      logger.error(`Cleanup failed: ${name}`, { error: error.message });
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`Graceful shutdown complete in ${duration}ms`);
}

/**
 * Initialize shutdown handlers
 * Call this once at application startup
 */
export function initializeShutdownHandlers() {
  // Handle SIGTERM (e.g., docker stop, kubernetes)
  process.on('SIGTERM', async () => {
    await executeCleanup('SIGTERM');
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    await executeCleanup('SIGINT');
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    await executeCleanup('uncaughtException');
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
    await executeCleanup('unhandledRejection');
    process.exit(1);
  });

  logger.info('Shutdown handlers initialized');
}

/**
 * Check if shutdown is in progress
 * @returns {boolean}
 */
export function isShutdownInProgress() {
  return isShuttingDown;
}

/**
 * Trigger manual shutdown
 * @param {string} reason - Reason for shutdown
 * @param {number} [exitCode=0] - Exit code
 */
export async function triggerShutdown(reason, exitCode = 0) {
  logger.info(`Manual shutdown triggered: ${reason}`);
  await executeCleanup(`manual: ${reason}`);
  process.exit(exitCode);
}
