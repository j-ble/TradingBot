/**
 * 4H Liquidity Sweep Scanner
 * Detects when price sweeps 4H swing highs/lows and sets market bias
 */

import {
  detectHighSweep,
  detectLowSweep,
  createSweepObject,
  isSweepValid,
  SWEEP_TYPES,
  BIAS_TYPES
} from './sweep_detector.js';
import { SwingTracker, TIMEFRAMES } from './swing_tracker.js';
import {
  insertLiquiditySweep,
  getActiveSweep,
  deactivateSweep,
  getRecentSwing,
  createConfluenceState
} from '../../database/queries.js';
import { PriceFeed } from '../coinbase/price_feed.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('4h-scanner');

// Constants
const SWEEP_EXPIRY_HOURS = 24;

/**
 * 4H Liquidity Sweep Scanner
 */
export class Scanner4H {
  constructor(options = {}) {
    this.swingTracker = new SwingTracker();
    this.priceFeed = options.priceFeed || null;
    this.isMonitoring = false;
    this.checkInterval = null;
  }

  /**
   * Check current price against 4H swing levels for sweeps
   * @param {number} currentPrice - Current market price
   * @returns {Promise<Object|null>} Sweep object if detected, null otherwise
   */
  async checkForSweeps(currentPrice) {
    if (!currentPrice || currentPrice <= 0) {
      logger.warn('Invalid price for sweep check', { currentPrice });
      return null;
    }

    // Get active 4H swings
    const swingHigh = await getRecentSwing(TIMEFRAMES.FOUR_HOUR, SWEEP_TYPES.HIGH);
    const swingLow = await getRecentSwing(TIMEFRAMES.FOUR_HOUR, SWEEP_TYPES.LOW);

    if (!swingHigh && !swingLow) {
      logger.debug('No active 4H swings to check');
      return null;
    }

    // Check for existing active sweep
    const existingSweep = await getActiveSweep();
    if (existingSweep && isSweepValid(existingSweep, SWEEP_EXPIRY_HOURS)) {
      logger.debug('Active sweep already exists', {
        sweepType: existingSweep.sweep_type,
        bias: existingSweep.bias
      });
      return null;
    }

    // Check for high sweep
    if (swingHigh && detectHighSweep(currentPrice, parseFloat(swingHigh.price))) {
      logger.info('4H HIGH SWEEP DETECTED', {
        price: currentPrice,
        swingHigh: swingHigh.price,
        bias: BIAS_TYPES.BEARISH
      });

      return await this.storeSweep({
        currentPrice,
        sweepType: SWEEP_TYPES.HIGH,
        swingLevel: parseFloat(swingHigh.price),
        swingLevelId: swingHigh.id
      });
    }

    // Check for low sweep
    if (swingLow && detectLowSweep(currentPrice, parseFloat(swingLow.price))) {
      logger.info('4H LOW SWEEP DETECTED', {
        price: currentPrice,
        swingLow: swingLow.price,
        bias: BIAS_TYPES.BULLISH
      });

      return await this.storeSweep({
        currentPrice,
        sweepType: SWEEP_TYPES.LOW,
        swingLevel: parseFloat(swingLow.price),
        swingLevelId: swingLow.id
      });
    }

    return null;
  }

  /**
   * Store a new sweep in database
   * @param {Object} params - Sweep parameters
   * @returns {Promise<Object>} Stored sweep
   */
  async storeSweep({ currentPrice, sweepType, swingLevel, swingLevelId }) {
    // Deactivate any existing sweep
    const existing = await getActiveSweep();
    if (existing) {
      await deactivateSweep(existing.id);
      logger.info('Deactivated previous sweep', { id: existing.id });
    }

    // Create and store new sweep
    const sweepData = createSweepObject({
      currentPrice,
      sweepType,
      swingLevel,
      swingLevelId
    });

    const sweep = await insertLiquiditySweep(sweepData);

    logger.info('Sweep stored successfully', {
      id: sweep.id,
      type: sweep.sweep_type,
      bias: sweep.bias,
      price: sweep.price
    });

    // Create confluence state for this sweep
    try {
      await createConfluenceState(sweep.id);
      logger.info('Confluence state created for sweep', { sweepId: sweep.id });
    } catch (error) {
      logger.error('Failed to create confluence state', { error: error.message });
    }

    return sweep;
  }

  /**
   * Deactivate expired sweeps (older than 24 hours)
   * @returns {Promise<number>} Number of deactivated sweeps
   */
  async deactivateExpiredSweeps() {
    const activeSweep = await getActiveSweep();

    if (!activeSweep) {
      return 0;
    }

    if (!isSweepValid(activeSweep, SWEEP_EXPIRY_HOURS)) {
      await deactivateSweep(activeSweep.id);
      logger.info('Expired sweep deactivated', {
        id: activeSweep.id,
        age: 'over 24 hours'
      });
      return 1;
    }

    return 0;
  }

  /**
   * Get current active sweep
   * @returns {Promise<Object|null>} Active sweep or null
   */
  async getActiveSweep() {
    return getActiveSweep();
  }

  /**
   * Start real-time price monitoring for sweeps
   * @returns {Promise<void>}
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Monitoring already active');
      return;
    }

    logger.info('Starting 4H sweep monitoring');

    // Initialize price feed if not provided
    if (!this.priceFeed) {
      this.priceFeed = new PriceFeed();
      await this.priceFeed.connect();
    }

    this.isMonitoring = true;

    // Listen for price updates
    this.priceFeed.on('price_update', async (update) => {
      try {
        await this.checkForSweeps(update.price);
      } catch (error) {
        logger.error('Error checking for sweeps', { error: error.message });
      }
    });

    // Periodically check for expired sweeps (every hour)
    this.checkInterval = setInterval(async () => {
      try {
        await this.deactivateExpiredSweeps();
      } catch (error) {
        logger.error('Error deactivating expired sweeps', { error: error.message });
      }
    }, 60 * 60 * 1000);

    logger.info('4H sweep monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping 4H sweep monitoring');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.priceFeed) {
      this.priceFeed.disconnect();
    }

    this.isMonitoring = false;
    logger.info('4H sweep monitoring stopped');
  }

  /**
   * Get scanner status
   * @returns {Promise<Object>} Status info
   */
  async getStatus() {
    const activeSweep = await getActiveSweep();
    const swingHigh = await getRecentSwing(TIMEFRAMES.FOUR_HOUR, SWEEP_TYPES.HIGH);
    const swingLow = await getRecentSwing(TIMEFRAMES.FOUR_HOUR, SWEEP_TYPES.LOW);

    return {
      monitoring: this.isMonitoring,
      activeSweep: activeSweep ? {
        id: activeSweep.id,
        type: activeSweep.sweep_type,
        bias: activeSweep.bias,
        price: activeSweep.price,
        timestamp: activeSweep.timestamp
      } : null,
      swingHigh: swingHigh ? {
        price: swingHigh.price,
        timestamp: swingHigh.timestamp
      } : null,
      swingLow: swingLow ? {
        price: swingLow.price,
        timestamp: swingLow.timestamp
      } : null,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const scanner4H = new Scanner4H();

// Export class for custom instances
export default Scanner4H;
