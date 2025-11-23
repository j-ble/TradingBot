/**
 * 5M Swing Detector
 * Detects swing highs/lows on 5-minute timeframe
 */

import { SwingTracker, TIMEFRAMES } from './swing_tracker.js';
import { get5MCandles } from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('swing-detector:5m');

// Constants
const DEFAULT_CANDLE_COUNT = 100; // Analyze last 100 5M candles

/**
 * 5M Swing Detector
 */
export class SwingDetector5M {
  constructor() {
    this.tracker = new SwingTracker();
    this.timeframe = TIMEFRAMES.FIVE_MINUTE;
  }

  /**
   * Scan for swings in 5M candles
   * @param {number} [count] - Number of candles to analyze
   * @returns {Promise<Object>} Detection results
   */
  async scan(count = DEFAULT_CANDLE_COUNT) {
    logger.info('Starting 5M swing detection', { count });

    try {
      // Get candles from database
      const candles = await get5MCandles(count);

      if (candles.length < 5) {
        logger.warn('Not enough 5M candles for detection', {
          available: candles.length
        });
        return { detected: 0, stored: 0, skipped: 0 };
      }

      // Scan for swings
      const swings = this.tracker.scanForSwings(candles, this.timeframe);

      logger.info('5M swing scan complete', {
        candles: candles.length,
        swingsDetected: swings.length
      });

      // Process and store swings
      const results = await this.tracker.processSwings(swings, this.timeframe);

      logger.info('5M swing processing complete', results);

      return {
        detected: swings.length,
        ...results
      };
    } catch (error) {
      logger.error('5M swing detection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get current active swings for 5M
   * @returns {Promise<Object>} { high, low }
   */
  async getActiveSwings() {
    return this.tracker.getActiveSwings(this.timeframe);
  }

  /**
   * Get detection status
   * @returns {Promise<Object>} Status info
   */
  async getStatus() {
    const swings = await this.getActiveSwings();

    return {
      timeframe: this.timeframe,
      activeHigh: swings.high ? {
        price: swings.high.price,
        timestamp: swings.high.timestamp
      } : null,
      activeLow: swings.low ? {
        price: swings.low.price,
        timestamp: swings.low.timestamp
      } : null,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const swingDetector5M = new SwingDetector5M();

// Export class for custom instances
export default SwingDetector5M;
