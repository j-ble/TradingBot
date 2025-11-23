/**
 * Swing Level Tracker
 * Detects and tracks swing highs/lows for both 4H and 5M timeframes
 */

import {
  insertSwingLevel,
  getRecentSwing,
  deactivatePreviousSwings
} from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('swing-tracker');

// Constants
const TIMEFRAMES = {
  FOUR_HOUR: '4H',
  FIVE_MINUTE: '5M'
};

const SWING_TYPES = {
  HIGH: 'HIGH',
  LOW: 'LOW'
};

/**
 * Swing Level Tracker
 * Core logic for detecting and storing swing levels
 */
export class SwingTracker {
  constructor() {
    // Track detection stats
    this.stats = {
      detected: 0,
      stored: 0,
      skipped: 0
    };
  }

  /**
   * Detect swing high using 3-candle pattern
   * Current candle's high must be higher than 2 candles before and after
   * @param {Array} candles - Array of candles in chronological order
   * @param {number} index - Index of candle to check
   * @returns {boolean} True if swing high detected
   */
  detectSwingHigh(candles, index) {
    // Need at least 2 candles before and after
    if (index < 2 || index >= candles.length - 2) {
      return false;
    }

    const current = candles[index];
    const before = candles[index - 2];
    const after = candles[index + 2];

    return current.high > before.high && current.high > after.high;
  }

  /**
   * Detect swing low using 3-candle pattern
   * Current candle's low must be lower than 2 candles before and after
   * @param {Array} candles - Array of candles in chronological order
   * @param {number} index - Index of candle to check
   * @returns {boolean} True if swing low detected
   */
  detectSwingLow(candles, index) {
    // Need at least 2 candles before and after
    if (index < 2 || index >= candles.length - 2) {
      return false;
    }

    const current = candles[index];
    const before = candles[index - 2];
    const after = candles[index + 2];

    return current.low < before.low && current.low < after.low;
  }

  /**
   * Scan candles for swing levels
   * @param {Array} candles - Array of candles in chronological order
   * @param {string} timeframe - '4H' or '5M'
   * @returns {Array} Array of detected swings
   */
  scanForSwings(candles, timeframe) {
    if (!candles || candles.length < 5) {
      logger.warn('Not enough candles for swing detection', {
        count: candles?.length || 0,
        required: 5
      });
      return [];
    }

    const swings = [];

    // Scan from index 2 to length-3 (need 2 candles on each side)
    for (let i = 2; i < candles.length - 2; i++) {
      const candle = candles[i];

      // Check for swing high
      if (this.detectSwingHigh(candles, i)) {
        swings.push({
          timestamp: candle.timestamp,
          timeframe,
          swing_type: SWING_TYPES.HIGH,
          price: parseFloat(candle.high),
          candle_index: i
        });
      }

      // Check for swing low
      if (this.detectSwingLow(candles, i)) {
        swings.push({
          timestamp: candle.timestamp,
          timeframe,
          swing_type: SWING_TYPES.LOW,
          price: parseFloat(candle.low),
          candle_index: i
        });
      }
    }

    logger.debug('Swing scan complete', {
      timeframe,
      candles: candles.length,
      swings: swings.length
    });

    return swings;
  }

  /**
   * Find the most recent swing from an array
   * @param {Array} swings - Array of swings
   * @param {string} swingType - 'HIGH' or 'LOW'
   * @returns {Object|null} Most recent swing of type
   */
  findMostRecentSwing(swings, swingType) {
    const filtered = swings.filter(s => s.swing_type === swingType);
    if (filtered.length === 0) return null;

    // Return the last one (most recent in chronological array)
    return filtered[filtered.length - 1];
  }

  /**
   * Store a new swing level
   * Deactivates previous swings of same type/timeframe
   * @param {Object} swing - Swing to store
   * @returns {Promise<Object|null>} Stored swing or null if duplicate
   */
  async storeSwing(swing) {
    try {
      // First deactivate previous swings of same type/timeframe
      await deactivatePreviousSwings(swing.timeframe, swing.swing_type);

      // Insert new swing
      const result = await insertSwingLevel({
        timestamp: swing.timestamp,
        timeframe: swing.timeframe,
        swing_type: swing.swing_type,
        price: swing.price,
        active: true
      });

      if (result) {
        this.stats.stored++;
        logger.info('Swing level stored', {
          timeframe: swing.timeframe,
          type: swing.swing_type,
          price: swing.price
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to store swing', {
        error: error.message,
        swing
      });
      throw error;
    }
  }

  /**
   * Process detected swings - store only the most recent of each type
   * @param {Array} swings - Array of detected swings
   * @param {string} timeframe - Timeframe
   * @returns {Promise<Object>} Results { stored, skipped }
   */
  async processSwings(swings, timeframe) {
    let stored = 0;
    let skipped = 0;

    // Find most recent swing high
    const recentHigh = this.findMostRecentSwing(swings, SWING_TYPES.HIGH);
    if (recentHigh) {
      // Check if different from current active swing
      const currentHigh = await getRecentSwing(timeframe, SWING_TYPES.HIGH);

      if (!currentHigh ||
          new Date(currentHigh.timestamp).getTime() !== new Date(recentHigh.timestamp).getTime()) {
        await this.storeSwing(recentHigh);
        stored++;
      } else {
        skipped++;
      }
    }

    // Find most recent swing low
    const recentLow = this.findMostRecentSwing(swings, SWING_TYPES.LOW);
    if (recentLow) {
      // Check if different from current active swing
      const currentLow = await getRecentSwing(timeframe, SWING_TYPES.LOW);

      if (!currentLow ||
          new Date(currentLow.timestamp).getTime() !== new Date(recentLow.timestamp).getTime()) {
        await this.storeSwing(recentLow);
        stored++;
      } else {
        skipped++;
      }
    }

    return { stored, skipped };
  }

  /**
   * Get active swings for a timeframe
   * @param {string} timeframe - '4H' or '5M'
   * @returns {Promise<Object>} { high, low }
   */
  async getActiveSwings(timeframe) {
    const high = await getRecentSwing(timeframe, SWING_TYPES.HIGH);
    const low = await getRecentSwing(timeframe, SWING_TYPES.LOW);

    return { high, low };
  }

  /**
   * Get tracker status
   * @returns {Object} Status info
   */
  getStatus() {
    return {
      ...this.stats,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Reset stats
   */
  resetStats() {
    this.stats = {
      detected: 0,
      stored: 0,
      skipped: 0
    };
  }
}

// Export constants
export { TIMEFRAMES, SWING_TYPES };

// Export singleton instance
export const swingTracker = new SwingTracker();

// Export class for custom instances
export default SwingTracker;
