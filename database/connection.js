/**
 * Database Connection Pool
 * PostgreSQL connection management using pg library
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { createLogger } from '../lib/utils/logger.js';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Initialize logger
const logger = createLogger('database');

/**
 * PostgreSQL Connection Pool Configuration
 */
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'trading_bot',
  user: process.env.DB_USER || 'trading_bot_user',
  password: process.env.DB_PASSWORD || 'changeme_in_production',

  // Pool settings
  max: 20, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if no connection available
};

/**
 * Create connection pool
 */
const pool = new Pool(poolConfig);

/**
 * Pool event handlers
 */
pool.on('connect', (client) => {
  logger.info('New database client connected to pool');
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

pool.on('remove', (client) => {
  logger.debug('Database client removed from pool');
});

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();

    logger.info('Database connection test successful', {
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version
    });

    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
}

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params) {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      text: text.substring(0, 100), // Log first 100 chars
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    logger.error('Query execution failed', {
      text: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
}

/**
 * Get a client from the pool (for transactions)
 * @returns {Promise<Object>} Database client
 */
export async function getClient() {
  try {
    const client = await pool.connect();
    logger.debug('Client acquired from pool');

    // Add release method tracking
    const originalRelease = client.release.bind(client);
    client.release = () => {
      logger.debug('Client released back to pool');
      return originalRelease();
    };

    return client;
  } catch (error) {
    logger.error('Failed to get client from pool', { error: error.message });
    throw error;
  }
}

/**
 * Execute a transaction
 * @param {Function} callback - Async function that receives client and executes queries
 * @returns {Promise<any>} Result from callback
 */
export async function transaction(callback) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    logger.debug('Transaction BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug('Transaction COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction ROLLBACK', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all connections in the pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool', { error: error.message });
    throw error;
  }
}

/**
 * Get pool status
 * @returns {Object} Pool statistics
 */
export function getPoolStatus() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Export pool for direct access if needed
export { pool };

// Default export
export default {
  query,
  getClient,
  transaction,
  testConnection,
  closePool,
  getPoolStatus,
  pool
};
