/**
 * Sweep Detector
 * Core logic for detecting liquidity sweeps
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('sweep-detector');

// Constants
const SWEEP_THRESHOLD = 0.001; // 0.1%

const SWEEP_TYPES = {
  HIGH: 'HIGH',
  LOW: 'LOW'
};

const BIAS_TYPES = {
  BULLISH: 'BULLISH',
  BEARISH: 'BEARISH'
};

/**
 * Detect if price has swept a swing high
 * @param {number} currentPrice - Current market price
 * @param {number} swingHigh - Swing high price level
 * @returns {boolean} True if high was swept
 */
export function detectHighSweep(currentPrice, swingHigh) {
  if (!currentPrice || !swingHigh) return false;

  const threshold = swingHigh * (1 + SWEEP_THRESHOLD);
  const swept = currentPrice > threshold;

  if (swept) {
    logger.debug('High sweep detected', {
      price: currentPrice,
      swingHigh,
      threshold
    });
  }

  return swept;
}

/**
 * Detect if price has swept a swing low
 * @param {number} currentPrice - Current market price
 * @param {number} swingLow - Swing low price level
 * @returns {boolean} True if low was swept
 */
export function detectLowSweep(currentPrice, swingLow) {
  if (!currentPrice || !swingLow) return false;

  const threshold = swingLow * (1 - SWEEP_THRESHOLD);
  const swept = currentPrice < threshold;

  if (swept) {
    logger.debug('Low sweep detected', {
      price: currentPrice,
      swingLow,
      threshold
    });
  }

  return swept;
}

/**
 * Get trading bias based on sweep type
 * HIGH swept → BEARISH (expect reversal down)
 * LOW swept → BULLISH (expect reversal up)
 * @param {string} sweepType - 'HIGH' or 'LOW'
 * @returns {string} 'BULLISH' or 'BEARISH'
 */
export function getBias(sweepType) {
  if (sweepType === SWEEP_TYPES.HIGH) {
    return BIAS_TYPES.BEARISH;
  } else if (sweepType === SWEEP_TYPES.LOW) {
    return BIAS_TYPES.BULLISH;
  }
  throw new Error(`Invalid sweep type: ${sweepType}`);
}

/**
 * Get trading direction based on bias
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {string} 'LONG' or 'SHORT'
 */
export function getDirection(bias) {
  if (bias === BIAS_TYPES.BULLISH) {
    return 'LONG';
  } else if (bias === BIAS_TYPES.BEARISH) {
    return 'SHORT';
  }
  throw new Error(`Invalid bias: ${bias}`);
}

/**
 * Calculate sweep threshold price
 * @param {number} swingPrice - Swing level price
 * @param {string} sweepType - 'HIGH' or 'LOW'
 * @returns {number} Threshold price for sweep detection
 */
export function getSweepThreshold(swingPrice, sweepType) {
  if (sweepType === SWEEP_TYPES.HIGH) {
    return swingPrice * (1 + SWEEP_THRESHOLD);
  } else if (sweepType === SWEEP_TYPES.LOW) {
    return swingPrice * (1 - SWEEP_THRESHOLD);
  }
  throw new Error(`Invalid sweep type: ${sweepType}`);
}

/**
 * Check if a sweep is valid (not too old, price in range)
 * @param {Object} sweep - Sweep object
 * @param {number} [maxAgeHours=24] - Maximum age in hours
 * @returns {boolean} True if valid
 */
export function isSweepValid(sweep, maxAgeHours = 24) {
  if (!sweep) return false;

  const sweepTime = new Date(sweep.timestamp).getTime();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  return (now - sweepTime) < maxAge;
}

/**
 * Create sweep object for storage
 * @param {Object} params - Sweep parameters
 * @returns {Object} Formatted sweep object
 */
export function createSweepObject({
  currentPrice,
  sweepType,
  swingLevel,
  swingLevelId
}) {
  const bias = getBias(sweepType);

  return {
    timestamp: new Date().toISOString(),
    sweep_type: sweepType,
    price: currentPrice,
    bias,
    swing_level: swingLevel,
    swing_level_id: swingLevelId,
    active: true
  };
}

// Export constants
export { SWEEP_TYPES, BIAS_TYPES, SWEEP_THRESHOLD };

export default {
  detectHighSweep,
  detectLowSweep,
  getBias,
  getDirection,
  getSweepThreshold,
  isSweepValid,
  createSweepObject,
  SWEEP_TYPES,
  BIAS_TYPES,
  SWEEP_THRESHOLD
};
