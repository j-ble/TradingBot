/**
 * CHoCH (Change of Character) Detector
 * Detects structural changes in price action on 5M timeframe
 *
 * For BULLISH bias (after low sweep): Price breaks above recent highs
 * For BEARISH bias (after high sweep): Price breaks below recent lows
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('choch');

// Number of candles to look back for recent structure
const LOOKBACK_PERIOD = 5;

// Minimum break threshold (0.1% above/below structure)
const BREAK_THRESHOLD = 0.001;

/**
 * Detect CHoCH (Change of Character) based on bias
 * @param {Array} candles - Recent 5M candles (chronological order)
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} CHoCH detection result or null
 */
export function detectCHoCH(candles, bias) {
  if (!candles || candles.length < LOOKBACK_PERIOD + 1) {
    logger.warn('Not enough candles for CHoCH detection', {
      required: LOOKBACK_PERIOD + 1,
      received: candles?.length
    });
    return null;
  }

  const currentCandle = candles[candles.length - 1];
  const recentCandles = candles.slice(-LOOKBACK_PERIOD - 1, -1);

  if (bias === 'BULLISH') {
    return detectBullishCHoCH(currentCandle, recentCandles);
  } else if (bias === 'BEARISH') {
    return detectBearishCHoCH(currentCandle, recentCandles);
  }

  logger.error('Invalid bias for CHoCH detection', { bias });
  return null;
}

/**
 * Detect Bullish CHoCH - price breaks above recent highs after downtrend
 * @param {Object} currentCandle - Current candle
 * @param {Array} recentCandles - Recent candles for structure
 * @returns {Object|null} Detection result
 */
function detectBullishCHoCH(currentCandle, recentCandles) {
  // Find the highest high in recent candles
  const recentHighs = recentCandles.map(c => parseFloat(c.high));
  const maxRecentHigh = Math.max(...recentHighs);

  const currentClose = parseFloat(currentCandle.close);
  const breakLevel = maxRecentHigh * (1 + BREAK_THRESHOLD);

  // Check if current close breaks above recent structure
  if (currentClose > breakLevel) {
    logger.info('Bullish CHoCH detected', {
      currentClose,
      maxRecentHigh,
      breakLevel,
      breakPercent: ((currentClose - maxRecentHigh) / maxRecentHigh * 100).toFixed(3)
    });

    return {
      detected: true,
      type: 'BULLISH',
      price: currentClose,
      structureLevel: maxRecentHigh,
      timestamp: currentCandle.timestamp
    };
  }

  return null;
}

/**
 * Detect Bearish CHoCH - price breaks below recent lows after uptrend
 * @param {Object} currentCandle - Current candle
 * @param {Array} recentCandles - Recent candles for structure
 * @returns {Object|null} Detection result
 */
function detectBearishCHoCH(currentCandle, recentCandles) {
  // Find the lowest low in recent candles
  const recentLows = recentCandles.map(c => parseFloat(c.low));
  const minRecentLow = Math.min(...recentLows);

  const currentClose = parseFloat(currentCandle.close);
  const breakLevel = minRecentLow * (1 - BREAK_THRESHOLD);

  // Check if current close breaks below recent structure
  if (currentClose < breakLevel) {
    logger.info('Bearish CHoCH detected', {
      currentClose,
      minRecentLow,
      breakLevel,
      breakPercent: ((minRecentLow - currentClose) / minRecentLow * 100).toFixed(3)
    });

    return {
      detected: true,
      type: 'BEARISH',
      price: currentClose,
      structureLevel: minRecentLow,
      timestamp: currentCandle.timestamp
    };
  }

  return null;
}

/**
 * Get the CHoCH reference level for BOS detection
 * @param {Array} candles - Candles around CHoCH detection
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {number} Reference level (high for bullish, low for bearish)
 */
export function getCHoCHReferenceLevel(candles, bias) {
  if (!candles || candles.length < LOOKBACK_PERIOD) {
    return null;
  }

  const recentCandles = candles.slice(-LOOKBACK_PERIOD);

  if (bias === 'BULLISH') {
    // For bullish CHoCH, track the high that was broken
    return Math.max(...recentCandles.map(c => parseFloat(c.high)));
  } else {
    // For bearish CHoCH, track the low that was broken
    return Math.min(...recentCandles.map(c => parseFloat(c.low)));
  }
}

export default {
  detectCHoCH,
  getCHoCHReferenceLevel,
  LOOKBACK_PERIOD,
  BREAK_THRESHOLD
};
