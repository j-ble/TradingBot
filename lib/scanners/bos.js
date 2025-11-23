/**
 * BOS (Break of Structure) Detector
 * Confirms structural break after CHoCH and FVG fill on 5M timeframe
 *
 * For BULLISH: Price must break above CHoCH high
 * For BEARISH: Price must break below CHoCH low
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('bos');

// Break confirmation threshold (0.1% beyond structure)
const BREAK_THRESHOLD = 0.001;

/**
 * Detect BOS (Break of Structure) based on bias
 * @param {number} currentPrice - Current market price
 * @param {number} chochPrice - The CHoCH reference level
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} BOS detection result or null
 */
export function detectBOS(currentPrice, chochPrice, bias) {
  if (!currentPrice || !chochPrice) {
    logger.warn('Invalid prices for BOS detection', { currentPrice, chochPrice });
    return null;
  }

  currentPrice = parseFloat(currentPrice);
  chochPrice = parseFloat(chochPrice);

  if (bias === 'BULLISH') {
    return detectBullishBOS(currentPrice, chochPrice);
  } else if (bias === 'BEARISH') {
    return detectBearishBOS(currentPrice, chochPrice);
  }

  logger.error('Invalid bias for BOS detection', { bias });
  return null;
}

/**
 * Detect Bullish BOS - price breaks above CHoCH high
 * @param {number} currentPrice - Current price
 * @param {number} chochHigh - The CHoCH high level to break
 * @returns {Object|null} Detection result
 */
function detectBullishBOS(currentPrice, chochHigh) {
  const breakLevel = chochHigh * (1 + BREAK_THRESHOLD);

  if (currentPrice > breakLevel) {
    const breakPercent = ((currentPrice - chochHigh) / chochHigh * 100).toFixed(3);

    logger.info('Bullish BOS detected', {
      currentPrice,
      chochHigh,
      breakLevel,
      breakPercent: breakPercent + '%'
    });

    return {
      detected: true,
      type: 'BULLISH',
      price: currentPrice,
      structureLevel: chochHigh,
      breakPercent: parseFloat(breakPercent)
    };
  }

  return null;
}

/**
 * Detect Bearish BOS - price breaks below CHoCH low
 * @param {number} currentPrice - Current price
 * @param {number} chochLow - The CHoCH low level to break
 * @returns {Object|null} Detection result
 */
function detectBearishBOS(currentPrice, chochLow) {
  const breakLevel = chochLow * (1 - BREAK_THRESHOLD);

  if (currentPrice < breakLevel) {
    const breakPercent = ((chochLow - currentPrice) / chochLow * 100).toFixed(3);

    logger.info('Bearish BOS detected', {
      currentPrice,
      chochLow,
      breakLevel,
      breakPercent: breakPercent + '%'
    });

    return {
      detected: true,
      type: 'BEARISH',
      price: currentPrice,
      structureLevel: chochLow,
      breakPercent: parseFloat(breakPercent)
    };
  }

  return null;
}

/**
 * Detect BOS using candle data
 * @param {Object} candle - Current candle
 * @param {number} chochPrice - CHoCH reference level
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} BOS detection result
 */
export function detectBOSFromCandle(candle, chochPrice, bias) {
  if (!candle) {
    return null;
  }

  const price = parseFloat(candle.close);
  const result = detectBOS(price, chochPrice, bias);

  if (result) {
    result.timestamp = candle.timestamp;
  }

  return result;
}

export default {
  detectBOS,
  detectBOSFromCandle,
  BREAK_THRESHOLD
};
