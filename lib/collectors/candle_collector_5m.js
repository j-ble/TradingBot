/**
 * 5M Candle Collector
 * Fetches and stores 5-minute candlestick data from Coinbase
 * Includes data pruning for 7-day retention policy
 */

import { CoinbaseClient } from '../coinbase/client.js';
import { GRANULARITIES } from '../coinbase/endpoints.js';
import { insert5MCandle, get5MCandles, prune5MCandles } from '../../database/queries.js';
import { createLogger } from '../utils/logger.js';
import { retry } from '../utils/async.js';
import { getCandle5MTimestamp, minutesToMs } from '../utils/time.js';

const logger = createLogger('collector:5m');

// Constants
const PRODUCT_ID = 'BTC-USD';
const GRANULARITY = GRANULARITIES.FIVE_MINUTE;
const MAX_CANDLES_PER_REQUEST = 300; // Coinbase limit
const DEFAULT_BACKFILL_COUNT = 500; // ~42 hours of 5M candles
const FIVE_MINUTES_MS = minutesToMs(5);

/**
 * Create a new 5M candle collector
 * @param {CoinbaseClient} [client] - Optional client instance
 */
export class CandleCollector5M {
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

    logger.info('Fetching 5M candles', {
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
      let timestamp;
      if (typeof candle.start === 'string') {
        timestamp = candle.start;
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
        const result = await insert5MCandle(candle);
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
   * @param {number} [count=500] - Number of candles to backfill
   * @returns {Promise<Object>} Backfill results
   */
  async backfill(count = DEFAULT_BACKFILL_COUNT) {
    logger.info(`Starting backfill of ${count} candles`);

    const now = Date.now();
    const minutesBack = count * 5; // 5M candles
    const start = now - minutesToMs(minutesBack);
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
    logger.info('Collecting latest 5M candle');

    // Get the last closed candles (20 minutes back to now)
    const now = Date.now();
    const start = now - minutesToMs(20); // Get last 4 candles
    const end = now;

    const candles = await this.fetchCandles(start, end);

    // Filter to only include closed candles (not current)
    const currentCandleStart = getCandle5MTimestamp(now);
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
    const candles = await get5MCandles(500);

    if (candles.length < 2) {
      return [];
    }

    const gaps = [];

    for (let i = 1; i < candles.length; i++) {
      const prevTime = new Date(candles[i - 1].timestamp).getTime();
      const currTime = new Date(candles[i].timestamp).getTime();
      const expectedTime = prevTime + FIVE_MINUTES_MS;

      // Check for gap (allow 1 minute tolerance)
      if (currTime - expectedTime > 60000) {
        // Generate missing timestamps
        let gapTime = expectedTime;
        while (gapTime < currTime) {
          gaps.push(new Date(gapTime).toISOString());
          gapTime += FIVE_MINUTES_MS;
        }
      }
    }

    if (gaps.length > 0) {
      logger.warn(`Detected ${gaps.length} gaps in candle data`, { gaps: gaps.slice(0, 10) });
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
      firstGap - FIVE_MINUTES_MS,
      lastGap + FIVE_MINUTES_MS
    );

    // Store fetched candles
    const results = await this.storeCandles(candles);
    filled = results.inserted;

    logger.info(`Gap filling complete: ${filled} candles inserted`);
    return { filled };
  }

  /**
   * Prune old candles (7-day retention)
   * @returns {Promise<number>} Number of candles deleted
   */
  async pruneOldCandles() {
    logger.info('Pruning old 5M candles (>7 days)');
    const deleted = await prune5MCandles();
    logger.info(`Pruned ${deleted} old candles`);
    return deleted;
  }

  /**
   * Get collection status
   * @returns {Promise<Object>} Status information
   */
  async getStatus() {
    const candles = await get5MCandles(1);
    const latestCandle = candles[0];

    const allCandles = await get5MCandles(1000);
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
export const collector5M = new CandleCollector5M();

// Export class for custom instances
export default CandleCollector5M;
