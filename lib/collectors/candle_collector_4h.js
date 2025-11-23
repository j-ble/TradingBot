/**
 * 4H Candle Collector
 * Fetches and stores 4-hour candlestick data from Coinbase
 *
 * Note: Coinbase doesn't have 4H granularity, using SIX_HOUR as fallback
 */

import { CoinbaseClient } from '../coinbase/client.js';
import { GRANULARITIES } from '../coinbase/endpoints.js';
import { insert4HCandle, get4HCandles } from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';
import { retry } from '../utils/async.js';
import { getCandle4HTimestamp, hoursToMs } from '../utils/time.js';

const logger = createLogger('collector:4h');

// Constants
const PRODUCT_ID = 'BTC-USD';
const GRANULARITY = GRANULARITIES.SIX_HOUR; // Coinbase fallback for 4H
const MAX_CANDLES_PER_REQUEST = 300; // Coinbase limit
const DEFAULT_BACKFILL_COUNT = 200; // ~33 days of 4H candles

/**
 * Create a new 4H candle collector
 * @param {CoinbaseClient} [client] - Optional client instance
 */
export class CandleCollector4H {
  constructor(client = null) {
    this.client = client || new CoinbaseClient();
    this.productId = PRODUCT_ID;
  }

  /**
   * Fetch candles from Coinbase API
   * @param {Date|number} start - Start time
   * @param {Date|number} end - End time
   * @returns {Promise<Array>} Array of candle objects
   */
  async fetchCandles(start, end) {
    const startTs = Math.floor(new Date(start).getTime() / 1000);
    const endTs = Math.floor(new Date(end).getTime() / 1000);

    logger.info('Fetching 4H candles', {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });

    try {
      const candles = await retry(
        () => this.client.getCandles(this.productId, GRANULARITY, startTs, endTs),
        3,
        2000
      );

      logger.info(`Fetched ${candles.length} candles from API`);
      // Client already returns properly formatted candles
      return candles;
    } catch (error) {
      logger.error('Failed to fetch candles', { error: error.message });
      throw error;
    }
  }

  /**
   * Transform API response to database format
   * @param {Array} apiCandles - Raw API candles
   * @returns {Array} Transformed candles
   */
  transformCandles(apiCandles) {
    return apiCandles.map((candle) => {
      // Coinbase returns start as ISO string or Unix timestamp
      let timestamp;
      if (typeof candle.start === 'string') {
        timestamp = candle.start; // Already ISO string
      } else {
        timestamp = new Date(candle.start * 1000).toISOString();
      }

      return {
        timestamp,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
      };
    });
  }

  /**
   * Validate candle data
   * @param {Object} candle - Candle to validate
   * @returns {boolean} True if valid
   */
  validateCandle(candle) {
    // Check required fields
    if (!candle.timestamp || !candle.open || !candle.high || !candle.low || !candle.close) {
      return false;
    }

    // Check OHLC relationships
    if (candle.high < candle.open || candle.high < candle.close ||
        candle.high < candle.low || candle.low > candle.open || candle.low > candle.close) {
      return false;
    }

    // Check positive values
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Store candles in database
   * @param {Array} candles - Candles to store
   * @returns {Promise<Object>} Insert results
   */
  async storeCandles(candles) {
    let inserted = 0;
    let skipped = 0;
    let invalid = 0;

    for (const candle of candles) {
      if (!this.validateCandle(candle)) {
        invalid++;
        logger.warn('Invalid candle skipped', { candle });
        continue;
      }

      try {
        const result = await insert4HCandle(candle);
        if (result) {
          inserted++;
        } else {
          skipped++; // Duplicate timestamp
        }
      } catch (error) {
        logger.error('Failed to insert candle', { error: error.message, candle });
        skipped++;
      }
    }

    logger.info('Candle storage complete', { inserted, skipped, invalid });
    return { inserted, skipped, invalid };
  }

  /**
   * Backfill historical candles
   * @param {number} [count=200] - Number of candles to backfill
   * @returns {Promise<Object>} Backfill results
   */
  async backfill(count = DEFAULT_BACKFILL_COUNT) {
    logger.info(`Starting backfill of ${count} candles`);

    const now = Date.now();
    const hoursBack = count * 6; // 6H candles
    const start = now - hoursToMs(hoursBack);
    const end = now;

    const candles = await this.fetchCandles(start, end);
    const results = await this.storeCandles(candles);

    logger.info('Backfill complete', results);
    return results;
  }

  /**
   * Collect the latest closed candle
   * @returns {Promise<Object>} Collection result
   */
  async collectLatest() {
    logger.info('Collecting latest 4H candle');

    // Get the last closed candle (6 hours back to now)
    const now = Date.now();
    const start = now - hoursToMs(12); // Get last 2 candles
    const end = now;

    const candles = await this.fetchCandles(start, end);

    // Filter to only include closed candles (not current)
    const currentCandleStart = getCandle4HTimestamp(now);
    const closedCandles = candles.filter(
      (c) => new Date(c.timestamp).getTime() < currentCandleStart.getTime()
    );

    if (closedCandles.length === 0) {
      logger.info('No new closed candles to collect');
      return { inserted: 0, skipped: 0, invalid: 0 };
    }

    const results = await this.storeCandles(closedCandles);
    logger.info('Latest candle collection complete', results);
    return results;
  }

  /**
   * Detect gaps in candle data
   * @returns {Promise<Array>} Array of missing timestamps
   */
  async detectGaps() {
    const candles = await get4HCandles(200);

    if (candles.length < 2) {
      return [];
    }

    const gaps = [];
    const sixHoursMs = hoursToMs(6);

    for (let i = 1; i < candles.length; i++) {
      const prevTime = new Date(candles[i - 1].timestamp).getTime();
      const currTime = new Date(candles[i].timestamp).getTime();
      const expectedTime = prevTime + sixHoursMs;

      // Check for gap (allow 1 minute tolerance)
      if (currTime - expectedTime > 60000) {
        // Generate missing timestamps
        let gapTime = expectedTime;
        while (gapTime < currTime) {
          gaps.push(new Date(gapTime).toISOString());
          gapTime += sixHoursMs;
        }
      }
    }

    if (gaps.length > 0) {
      logger.warn(`Detected ${gaps.length} gaps in candle data`, { gaps });
    }

    return gaps;
  }

  /**
   * Fill detected gaps
   * @returns {Promise<Object>} Fill results
   */
  async fillGaps() {
    const gaps = await this.detectGaps();

    if (gaps.length === 0) {
      logger.info('No gaps to fill');
      return { filled: 0 };
    }

    logger.info(`Filling ${gaps.length} gaps`);

    let filled = 0;

    // Group gaps into ranges for efficient fetching
    const sortedGaps = gaps.sort();
    const firstGap = new Date(sortedGaps[0]).getTime();
    const lastGap = new Date(sortedGaps[sortedGaps.length - 1]).getTime();

    // Fetch candles for the gap range
    const candles = await this.fetchCandles(
      firstGap - hoursToMs(6),
      lastGap + hoursToMs(6)
    );

    // Store fetched candles
    const results = await this.storeCandles(candles);
    filled = results.inserted;

    logger.info(`Gap filling complete: ${filled} candles inserted`);
    return { filled };
  }

  /**
   * Get collection status
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    const candles = await get4HCandles(1);
    const latestCandle = candles[0];

    const allCandles = await get4HCandles(200);
    const gaps = await this.detectGaps();

    return {
      totalCandles: allCandles.length,
      latestTimestamp: latestCandle?.timestamp,
      gapCount: gaps.length,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const collector4H = new CandleCollector4H();

// Export class for custom instances
export default CandleCollector4H;
