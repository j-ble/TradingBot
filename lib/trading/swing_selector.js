/**
 * Swing Selector
 * Select appropriate swing levels for stop loss calculation
 */

import { getRecentSwing } from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('swing_selector');

/**
 * Get the appropriate swing level for stop loss
 * Priority: 5M swing → 4H swing → null
 *
 * @param {string} timeframe - '5M' or '4H'
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {Promise<Object|null>} Swing level or null if not found
 */
export async function getSwingForStopLoss(timeframe, direction) {
  // Determine swing type based on direction
  // LONG trades need swing LOW for stop
  // SHORT trades need swing HIGH for stop
  const swingType = direction === 'LONG' ? 'LOW' : 'HIGH';

  try {
    const swing = await getRecentSwing(timeframe, swingType);

    if (!swing) {
      logger.debug(`No ${timeframe} ${swingType} swing found for ${direction} trade`);
      return null;
    }

    logger.info(`Found ${timeframe} ${swingType} swing at ${swing.price}`, {
      timestamp: swing.timestamp,
      swingType,
      timeframe,
      direction
    });

    return swing;
  } catch (error) {
    logger.error(`Failed to get ${timeframe} swing for stop loss`, {
      error: error.message,
      timeframe,
      direction
    });
    throw error;
  }
}

/**
 * Get swing with fallback priority
 * First tries 5M, then falls back to 4H
 *
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {Promise<Object|null>} Swing level with source or null
 */
export async function getSwingWithFallback(direction) {
  // Try 5M first
  const swing5M = await getSwingForStopLoss('5M', direction);
  if (swing5M) {
    return {
      ...swing5M,
      source: '5M_SWING'
    };
  }

  // Fallback to 4H
  logger.info('5M swing not found, falling back to 4H swing');
  const swing4H = await getSwingForStopLoss('4H', direction);
  if (swing4H) {
    return {
      ...swing4H,
      source: '4H_SWING'
    };
  }

  // No valid swing found
  logger.warn('No valid swing found for stop loss (tried 5M and 4H)');
  return null;
}

/**
 * Validate swing is recent enough (within last 24 hours for 5M, 7 days for 4H)
 *
 * @param {Object} swing - Swing level object
 * @returns {boolean} True if swing is recent enough
 */
export function isSwingRecent(swing) {
  if (!swing || !swing.timestamp) {
    return false;
  }

  const now = Date.now();
  const swingTime = new Date(swing.timestamp).getTime();
  const timeDiff = now - swingTime;

  // 5M swings should be within 24 hours
  if (swing.timeframe === '5M') {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    return timeDiff <= TWENTY_FOUR_HOURS;
  }

  // 4H swings should be within 7 days
  if (swing.timeframe === '4H') {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    return timeDiff <= SEVEN_DAYS;
  }

  return false;
}

/**
 * Get multiple swings for analysis
 *
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {Promise<Object>} Object with 5M and 4H swings
 */
export async function getAllSwings(direction) {
  const [swing5M, swing4H] = await Promise.all([
    getSwingForStopLoss('5M', direction),
    getSwingForStopLoss('4H', direction)
  ]);

  return {
    swing5M: swing5M ? { ...swing5M, source: '5M_SWING' } : null,
    swing4H: swing4H ? { ...swing4H, source: '4H_SWING' } : null
  };
}

export default {
  getSwingForStopLoss,
  getSwingWithFallback,
  isSwingRecent,
  getAllSwings
};
