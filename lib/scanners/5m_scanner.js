/**
 * 5M Confluence State Machine
 * Orchestrates the confluence detection sequence: CHoCH → FVG Fill → BOS
 *
 * State Flow:
 * WAITING_CHOCH → WAITING_FVG → WAITING_BOS → COMPLETE
 *
 * Timeout: Expire after 12 hours of inactivity
 */

import { createLogger } from '../utils/logger.js';
import { detectCHoCH, getCHoCHReferenceLevel } from './choch.js';
import { detectFVG, detectFVGFill, scanForFVG } from './fvg.js';
import { detectBOS, detectBOSFromCandle } from './bos.js';
import { validateConfluence, validateState } from './validator.js';
import {
  get5MCandles,
  getActiveConfluenceStates,
  getConfluenceState,
  updateConfluenceState,
  expireConfluenceState,
  completeConfluenceState
} from '../../database/queries.js';

const logger = createLogger('5m_scanner');

// Timeout for confluence completion (12 hours in ms)
const CONFLUENCE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Number of candles to analyze
const CANDLE_LOOKBACK = 50;

/**
 * Main Scanner class for 5M confluence detection
 */
export class Scanner5M {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Run the scanner for all active confluence states
   */
  async scan() {
    if (this.isRunning) {
      logger.warn('5M scanner already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting 5M confluence scan');

    try {
      // Get all active confluence states
      const activeStates = await getActiveConfluenceStates();

      if (!activeStates || activeStates.length === 0) {
        logger.debug('No active confluence states to scan');
        return;
      }

      // Get recent 5M candles
      const candles = await get5MCandles(CANDLE_LOOKBACK);

      if (!candles || candles.length < 10) {
        logger.warn('Not enough 5M candles for scanning', { count: candles?.length });
        return;
      }

      // Process each active confluence state
      for (const state of activeStates) {
        await this.processConfluenceState(state, candles);
      }

      logger.info('5M confluence scan completed', { processed: activeStates.length });
    } catch (error) {
      logger.error('5M scanner error', { error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single confluence state through the state machine
   * @param {Object} state - The confluence state to process
   * @param {Array} candles - 5M candles
   */
  async processConfluenceState(state, candles) {
    logger.debug('Processing confluence state', {
      id: state.id,
      currentState: state.current_state,
      bias: state.bias
    });

    // Validate state structure
    const stateValidation = validateState(state);
    if (!stateValidation.valid) {
      logger.error('Invalid state structure', {
        id: state.id,
        errors: stateValidation.errors
      });
      await expireConfluenceState(state.id);
      return;
    }

    // Check for timeout
    if (this.isExpired(state)) {
      logger.info('Confluence state expired', { id: state.id });
      await expireConfluenceState(state.id);
      return;
    }

    // Process based on current state
    switch (state.current_state) {
      case 'WAITING_CHOCH':
        await this.processWaitingCHoCH(state, candles);
        break;
      case 'WAITING_FVG':
        await this.processWaitingFVG(state, candles);
        break;
      case 'WAITING_BOS':
        await this.processWaitingBOS(state, candles);
        break;
      default:
        logger.warn('Unknown confluence state', { state: state.current_state });
    }
  }

  /**
   * Process WAITING_CHOCH state - look for Change of Character
   */
  async processWaitingCHoCH(state, candles) {
    const choch = detectCHoCH(candles, state.bias);

    if (choch && choch.detected) {
      logger.info('CHoCH detected, transitioning to WAITING_FVG', {
        confluenceId: state.id,
        price: choch.price
      });

      await updateConfluenceState(state.id, {
        current_state: 'WAITING_FVG',
        choch_detected: true,
        choch_time: choch.timestamp,
        choch_price: choch.price
      });
    }
  }

  /**
   * Process WAITING_FVG state - look for FVG and fill
   */
  async processWaitingFVG(state, candles) {
    // If no FVG zone stored yet, scan for one
    if (!state.fvg_zone_low || !state.fvg_zone_high) {
      const fvg = scanForFVG(candles, state.bias);

      if (fvg) {
        logger.info('FVG zone identified', {
          confluenceId: state.id,
          top: fvg.top,
          bottom: fvg.bottom
        });

        await updateConfluenceState(state.id, {
          fvg_zone_low: fvg.bottom,
          fvg_zone_high: fvg.top
        });

        // Refresh state with new FVG zone
        state.fvg_zone_low = fvg.bottom;
        state.fvg_zone_high = fvg.top;
      } else {
        // No FVG found yet
        return;
      }
    }

    // Check for FVG fill
    const fvgZone = {
      top: parseFloat(state.fvg_zone_high),
      bottom: parseFloat(state.fvg_zone_low)
    };

    const currentCandle = candles[candles.length - 1];
    const fill = detectFVGFill(currentCandle, fvgZone, state.bias);

    if (fill && fill.filled) {
      logger.info('FVG filled, transitioning to WAITING_BOS', {
        confluenceId: state.id,
        fillPrice: fill.fillPrice
      });

      await updateConfluenceState(state.id, {
        current_state: 'WAITING_BOS',
        fvg_detected: true,
        fvg_fill_price: fill.fillPrice,
        fvg_fill_time: fill.timestamp
      });
    }
  }

  /**
   * Process WAITING_BOS state - look for Break of Structure
   */
  async processWaitingBOS(state, candles) {
    if (!state.choch_price) {
      logger.error('No CHoCH price for BOS detection', { confluenceId: state.id });
      return;
    }

    const currentCandle = candles[candles.length - 1];
    const bos = detectBOSFromCandle(currentCandle, state.choch_price, state.bias);

    if (bos && bos.detected) {
      logger.info('BOS detected, validating complete confluence', {
        confluenceId: state.id,
        price: bos.price
      });

      // Update state with BOS data
      await updateConfluenceState(state.id, {
        bos_detected: true,
        bos_time: bos.timestamp,
        bos_price: bos.price
      });

      // Fetch updated state for validation
      const updatedState = await getConfluenceState(state.id);

      // Validate complete confluence before marking as complete
      const validation = validateConfluence(updatedState);

      if (!validation.valid) {
        logger.error('Confluence validation failed', {
          confluenceId: state.id,
          errors: validation.errors
        });
        await expireConfluenceState(state.id);
        return;
      }

      // Mark as complete
      await completeConfluenceState(state.id);

      // Log the complete confluence for trade signal
      logger.info('CONFLUENCE COMPLETE - Ready for AI decision', {
        confluenceId: state.id,
        bias: updatedState.bias,
        chochPrice: updatedState.choch_price,
        fvgZone: `${updatedState.fvg_zone_low} - ${updatedState.fvg_zone_high}`,
        bosPrice: bos.price,
        validationPassed: true
      });
    }
  }

  /**
   * Check if confluence state has expired (>12 hours)
   * @param {Object} state - Confluence state
   * @returns {boolean} True if expired
   */
  isExpired(state) {
    const createdAt = new Date(state.created_at).getTime();
    const now = Date.now();
    return (now - createdAt) > CONFLUENCE_TIMEOUT_MS;
  }

  /**
   * Get the status of a specific confluence
   * @param {number} confluenceId - Confluence state ID
   * @returns {Object} Status with all details
   */
  async getStatus(confluenceId) {
    const state = await getConfluenceState(confluenceId);

    if (!state) {
      return null;
    }

    return {
      id: state.id,
      currentState: state.current_state,
      bias: state.bias,
      sweepType: state.sweep_type,
      sweepPrice: state.sweep_price,
      choch: {
        detected: state.choch_detected,
        price: state.choch_price,
        time: state.choch_time
      },
      fvg: {
        detected: state.fvg_detected,
        zoneLow: state.fvg_zone_low,
        zoneHigh: state.fvg_zone_high,
        fillPrice: state.fvg_fill_price,
        fillTime: state.fvg_fill_time
      },
      bos: {
        detected: state.bos_detected,
        price: state.bos_price,
        time: state.bos_time
      },
      sequenceValid: state.sequence_valid,
      createdAt: state.created_at,
      updatedAt: state.updated_at,
      isExpired: this.isExpired(state),
      timeRemaining: this.getTimeRemaining(state)
    };
  }

  /**
   * Get time remaining before confluence expires
   * @param {Object} state - Confluence state
   * @returns {number} Milliseconds remaining
   */
  getTimeRemaining(state) {
    const createdAt = new Date(state.created_at).getTime();
    const expiresAt = createdAt + CONFLUENCE_TIMEOUT_MS;
    const remaining = expiresAt - Date.now();
    return Math.max(0, remaining);
  }
}

// Singleton instance
let scannerInstance = null;

/**
 * Get or create the scanner instance
 * @returns {Scanner5M}
 */
export function getScanner() {
  if (!scannerInstance) {
    scannerInstance = new Scanner5M();
  }
  return scannerInstance;
}

/**
 * Run a single scan cycle
 */
export async function runScan() {
  const scanner = getScanner();
  return scanner.scan();
}

export default {
  Scanner5M,
  getScanner,
  runScan,
  CONFLUENCE_TIMEOUT_MS,
  CANDLE_LOOKBACK
};
