/**
 * 4H Swing Detector
 * Detects swing highs/lows on 4-hour timeframe
 */

import { SwingTracker, TIMEFRAMES } from './swing_tracker.js';
import { get4HCandles } from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('swing-detector:4h');

// Constants
const DEFAULT_CANDLE_COUNT = 50; // Analyze last 50 4H candles

/**
 * 4H Swing Detector
 */
export class SwingDetector4H {
  constructor() {
    this.tracker = new SwingTracker();
    this.timeframe = TIMEFRAMES.FOUR_HOUR;
  }

  /**
   * Scan for swings in 4H candles
   * @param {number} [count] - Number of candles to analyze
   * @returns {Promise<Object>} Detection results
   */
  async scan(count = DEFAULT_CANDLE_COUNT) {
    logger.info('Starting 4H swing detection', { count });

    try {
      // Get candles from database
      const candles = await get4HCandles(count);

      if (candles.length < 5) {
        logger.warn('Not enough 4H candles for detection', {
          available: candles.length
        });
        return { detected: 0, stored: 0, skipped: 0 };
      }

      // Scan for swings
      const swings = this.tracker.scanForSwings(candles, this.timeframe);

      logger.info('4H swing scan complete', {
        candles: candles.length,
        swingsDetected: swings.length
      });

      // Process and store swings
      const results = await this.tracker.processSwings(swings, this.timeframe);

      logger.info('4H swing processing complete', results);

      return {
        detected: swings.length,
        ...results
      };
    } catch (error) {
      logger.error('4H swing detection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get current active swings for 4H
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
export const swingDetector4H = new SwingDetector4H();

// Export class for custom instances
export default SwingDetector4H;
