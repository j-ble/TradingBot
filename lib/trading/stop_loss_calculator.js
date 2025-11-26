/**
 * Stop Loss Calculator
 * Swing-based stop loss calculation with priority logic and constraints
 *
 * CRITICAL RULES:
 * 1. Stop loss MUST be at swing levels (5M or 4H)
 * 2. Priority: 5M swing → 4H swing → Reject trade
 * 3. Buffer: 0.2-0.3% beyond swing level
 * 4. Distance constraint: 0.5%-3% from entry
 * 5. Must allow minimum 2:1 R/R ratio
 */

import { getSwingWithFallback, getAllSwings } from './swing_selector.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('stop_loss_calculator');

// Stop loss configuration
const CONFIG = {
  // Buffer beyond swing level
  BUFFER_BELOW_LOW: 0.002,  // 0.2% below swing low for LONG
  BUFFER_ABOVE_HIGH: 0.003, // 0.3% above swing high for SHORT

  // Distance constraints
  MIN_STOP_DISTANCE_PERCENT: 0.5,  // 0.5% minimum
  MAX_STOP_DISTANCE_PERCENT: 3.0,  // 3% maximum

  // Risk/Reward
  MIN_RR_RATIO: 2.0
};

/**
 * Calculate stop loss with buffer
 *
 * @param {number} swingPrice - The swing level price
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {number} Stop loss price with buffer applied
 */
export function calculateStopWithBuffer(swingPrice, direction) {
  if (!swingPrice || typeof swingPrice !== 'number') {
    throw new Error('Invalid swing price');
  }

  if (direction === 'LONG') {
    // Stop below swing low - 0.2% buffer
    const stopLoss = swingPrice * (1 - CONFIG.BUFFER_BELOW_LOW);
    logger.debug('Calculated LONG stop with buffer', {
      swingPrice,
      buffer: CONFIG.BUFFER_BELOW_LOW,
      stopLoss
    });
    return stopLoss;
  } else if (direction === 'SHORT') {
    // Stop above swing high + 0.3% buffer
    const stopLoss = swingPrice * (1 + CONFIG.BUFFER_ABOVE_HIGH);
    logger.debug('Calculated SHORT stop with buffer', {
      swingPrice,
      buffer: CONFIG.BUFFER_ABOVE_HIGH,
      stopLoss
    });
    return stopLoss;
  } else {
    throw new Error(`Invalid direction: ${direction}`);
  }
}

/**
 * Calculate stop loss distance as percentage
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopPrice - Stop loss price
 * @returns {number} Distance as percentage (e.g., 1.5 for 1.5%)
 */
export function calculateDistance(entryPrice, stopPrice) {
  const distance = Math.abs(entryPrice - stopPrice);
  const distancePercent = (distance / entryPrice) * 100;
  return distancePercent;
}

/**
 * Validate stop loss distance is within constraints
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopPrice - Stop loss price
 * @returns {Object} { valid: boolean, distance: number, reason: string }
 */
export function isValidStop(entryPrice, stopPrice) {
  const distancePercent = calculateDistance(entryPrice, stopPrice);

  if (distancePercent < CONFIG.MIN_STOP_DISTANCE_PERCENT) {
    return {
      valid: false,
      distance: distancePercent,
      reason: `Stop too close: ${distancePercent.toFixed(2)}% < ${CONFIG.MIN_STOP_DISTANCE_PERCENT}%`
    };
  }

  if (distancePercent > CONFIG.MAX_STOP_DISTANCE_PERCENT) {
    return {
      valid: false,
      distance: distancePercent,
      reason: `Stop too far: ${distancePercent.toFixed(2)}% > ${CONFIG.MAX_STOP_DISTANCE_PERCENT}%`
    };
  }

  return {
    valid: true,
    distance: distancePercent,
    reason: 'Stop distance within constraints'
  };
}

/**
 * Validate stop is on correct side of entry
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopPrice - Stop loss price
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {boolean} True if stop is on correct side
 */
export function isStopOnCorrectSide(entryPrice, stopPrice, direction) {
  if (direction === 'LONG') {
    // Stop must be below entry for LONG
    return stopPrice < entryPrice;
  } else if (direction === 'SHORT') {
    // Stop must be above entry for SHORT
    return stopPrice > entryPrice;
  }
  return false;
}

/**
 * Calculate minimum take profit for 2:1 R/R ratio
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopPrice - Stop loss price
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {number} Minimum take profit price
 */
export function calculateMinimumTakeProfit(entryPrice, stopPrice, direction) {
  const stopDistance = Math.abs(entryPrice - stopPrice);
  const targetDistance = stopDistance * CONFIG.MIN_RR_RATIO;

  if (direction === 'LONG') {
    return entryPrice + targetDistance;
  } else if (direction === 'SHORT') {
    return entryPrice - targetDistance;
  }

  throw new Error(`Invalid direction: ${direction}`);
}

/**
 * Main function: Calculate swing-based stop loss
 * Priority logic: 5M swing → 4H swing → null (reject trade)
 *
 * @param {number} entryPrice - Expected entry price
 * @param {string} direction - 'LONG' or 'SHORT'
 * @param {string} bias - 'BULLISH' or 'BEARISH' (for validation)
 * @returns {Promise<Object|null>} Stop loss details or null if no valid stop
 */
export async function calculateStopLoss(entryPrice, direction, bias) {
  logger.info('Calculating swing-based stop loss', {
    entryPrice,
    direction,
    bias
  });

  // Validate direction matches bias
  const expectedDirection = bias === 'BULLISH' ? 'LONG' : 'SHORT';
  if (direction !== expectedDirection) {
    logger.error('Direction does not match bias', {
      direction,
      expectedDirection,
      bias
    });
    throw new Error(`Direction ${direction} does not match bias ${bias}`);
  }

  // Get all available swings
  const { swing5M, swing4H } = await getAllSwings(direction);

  // Try 5M swing first
  if (swing5M) {
    logger.info('Trying 5M swing for stop loss', {
      swingPrice: swing5M.price,
      timestamp: swing5M.timestamp
    });

    const stop5M = calculateStopWithBuffer(swing5M.price, direction);
    const validation = isValidStop(entryPrice, stop5M);

    if (validation.valid && isStopOnCorrectSide(entryPrice, stop5M, direction)) {
      const minTP = calculateMinimumTakeProfit(entryPrice, stop5M, direction);

      logger.info('5M swing stop loss valid', {
        stopPrice: stop5M,
        distance: validation.distance,
        minTakeProfit: minTP
      });

      return {
        price: stop5M,
        source: '5M_SWING',
        swingPrice: swing5M.price,
        swingTimestamp: swing5M.timestamp,
        distance: validation.distance,
        distancePercent: validation.distance,
        minimumTakeProfit: minTP,
        valid: true
      };
    } else {
      logger.warn('5M swing stop invalid', {
        stopPrice: stop5M,
        validation,
        correctSide: isStopOnCorrectSide(entryPrice, stop5M, direction)
      });
    }
  }

  // Fallback to 4H swing
  if (swing4H) {
    logger.info('Trying 4H swing for stop loss (fallback)', {
      swingPrice: swing4H.price,
      timestamp: swing4H.timestamp
    });

    const stop4H = calculateStopWithBuffer(swing4H.price, direction);
    const validation = isValidStop(entryPrice, stop4H);

    if (validation.valid && isStopOnCorrectSide(entryPrice, stop4H, direction)) {
      const minTP = calculateMinimumTakeProfit(entryPrice, stop4H, direction);

      logger.info('4H swing stop loss valid', {
        stopPrice: stop4H,
        distance: validation.distance,
        minTakeProfit: minTP
      });

      return {
        price: stop4H,
        source: '4H_SWING',
        swingPrice: swing4H.price,
        swingTimestamp: swing4H.timestamp,
        distance: validation.distance,
        distancePercent: validation.distance,
        minimumTakeProfit: minTP,
        valid: true
      };
    } else {
      logger.warn('4H swing stop invalid', {
        stopPrice: stop4H,
        validation,
        correctSide: isStopOnCorrectSide(entryPrice, stop4H, direction)
      });
    }
  }

  // No valid swing found
  logger.error('No valid swing-based stop loss found', {
    entryPrice,
    direction,
    swing5M: swing5M ? swing5M.price : null,
    swing4H: swing4H ? swing4H.price : null
  });

  return null;
}

/**
 * Calculate stop loss with detailed validation
 * Returns full details including why trade was rejected if no valid stop
 *
 * @param {number} entryPrice - Expected entry price
 * @param {string} direction - 'LONG' or 'SHORT'
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Promise<Object>} Detailed stop loss result
 */
export async function calculateStopLossWithDetails(entryPrice, direction, bias) {
  const result = await calculateStopLoss(entryPrice, direction, bias);

  if (result) {
    return {
      success: true,
      stopLoss: result,
      rejectionReasons: []
    };
  }

  // Gather rejection reasons
  const { swing5M, swing4H } = await getAllSwings(direction);
  const rejectionReasons = [];

  if (!swing5M && !swing4H) {
    rejectionReasons.push('No swing levels found (neither 5M nor 4H)');
  }

  if (swing5M) {
    const stop5M = calculateStopWithBuffer(swing5M.price, direction);
    const validation = isValidStop(entryPrice, stop5M);
    if (!validation.valid) {
      rejectionReasons.push(`5M swing: ${validation.reason}`);
    }
    if (!isStopOnCorrectSide(entryPrice, stop5M, direction)) {
      rejectionReasons.push('5M swing: Stop on wrong side of entry');
    }
  }

  if (swing4H) {
    const stop4H = calculateStopWithBuffer(swing4H.price, direction);
    const validation = isValidStop(entryPrice, stop4H);
    if (!validation.valid) {
      rejectionReasons.push(`4H swing: ${validation.reason}`);
    }
    if (!isStopOnCorrectSide(entryPrice, stop4H, direction)) {
      rejectionReasons.push('4H swing: Stop on wrong side of entry');
    }
  }

  return {
    success: false,
    stopLoss: null,
    rejectionReasons
  };
}

export default {
  calculateStopLoss,
  calculateStopLossWithDetails,
  calculateStopWithBuffer,
  calculateDistance,
  isValidStop,
  isStopOnCorrectSide,
  calculateMinimumTakeProfit,
  CONFIG
};
