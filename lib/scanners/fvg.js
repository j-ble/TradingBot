/**
 * FVG (Fair Value Gap) Detector
 * Detects 3-candle gap patterns and their fills on 5M timeframe
 *
 * Bullish FVG: Gap between candle1.high and candle3.low
 * Bearish FVG: Gap between candle1.low and candle3.high
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('fvg');

// Minimum gap size as percentage of price (0.1%)
const MIN_GAP_PERCENT = 0.001;

/**
 * Detect FVG (Fair Value Gap) in recent candles
 * @param {Array} candles - Recent 5M candles (chronological order)
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} FVG zone or null
 */
export function detectFVG(candles, bias) {
  if (!candles || candles.length < 3) {
    logger.warn('Not enough candles for FVG detection', {
      required: 3,
      received: candles?.length
    });
    return null;
  }

  // Get the last 3 candles
  const c1 = candles[candles.length - 3];
  const c2 = candles[candles.length - 2];
  const c3 = candles[candles.length - 1];

  if (bias === 'BULLISH') {
    return detectBullishFVG(c1, c2, c3);
  } else if (bias === 'BEARISH') {
    return detectBearishFVG(c1, c2, c3);
  }

  logger.error('Invalid bias for FVG detection', { bias });
  return null;
}

/**
 * Detect Bullish FVG - gap between c1.high and c3.low
 * @param {Object} c1 - First candle
 * @param {Object} c2 - Middle candle (momentum)
 * @param {Object} c3 - Third candle
 * @returns {Object|null} FVG zone
 */
function detectBullishFVG(c1, c2, c3) {
  const c1High = parseFloat(c1.high);
  const c3Low = parseFloat(c3.low);
  const currentPrice = parseFloat(c3.close);

  // Check for gap: c3's low should be above c1's high
  if (c3Low > c1High) {
    const gapSize = c3Low - c1High;
    const gapPercent = gapSize / currentPrice;

    // Validate minimum gap size
    if (gapPercent >= MIN_GAP_PERCENT) {
      logger.info('Bullish FVG detected', {
        top: c3Low,
        bottom: c1High,
        gapSize,
        gapPercent: (gapPercent * 100).toFixed(3) + '%'
      });

      return {
        type: 'BULLISH',
        top: c3Low,
        bottom: c1High,
        size: gapSize,
        percent: gapPercent,
        timestamp: c3.timestamp,
        filled: false
      };
    }
  }

  return null;
}

/**
 * Detect Bearish FVG - gap between c1.low and c3.high
 * @param {Object} c1 - First candle
 * @param {Object} c2 - Middle candle (momentum)
 * @param {Object} c3 - Third candle
 * @returns {Object|null} FVG zone
 */
function detectBearishFVG(c1, c2, c3) {
  const c1Low = parseFloat(c1.low);
  const c3High = parseFloat(c3.high);
  const currentPrice = parseFloat(c3.close);

  // Check for gap: c3's high should be below c1's low
  if (c3High < c1Low) {
    const gapSize = c1Low - c3High;
    const gapPercent = gapSize / currentPrice;

    // Validate minimum gap size
    if (gapPercent >= MIN_GAP_PERCENT) {
      logger.info('Bearish FVG detected', {
        top: c1Low,
        bottom: c3High,
        gapSize,
        gapPercent: (gapPercent * 100).toFixed(3) + '%'
      });

      return {
        type: 'BEARISH',
        top: c1Low,
        bottom: c3High,
        size: gapSize,
        percent: gapPercent,
        timestamp: c3.timestamp,
        filled: false
      };
    }
  }

  return null;
}

/**
 * Detect if an FVG zone has been filled
 * @param {Object} candle - Current candle to check
 * @param {Object} fvgZone - The FVG zone to check for fill
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} Fill detection result
 */
export function detectFVGFill(candle, fvgZone, bias) {
  if (!candle || !fvgZone) {
    return null;
  }

  const candleLow = parseFloat(candle.low);
  const candleHigh = parseFloat(candle.high);

  if (bias === 'BULLISH') {
    // For bullish FVG, price needs to dip into the gap (retrace)
    // Check if candle's low enters the FVG zone
    if (candleLow <= fvgZone.top && candleLow >= fvgZone.bottom) {
      logger.info('Bullish FVG filled', {
        fillPrice: candleLow,
        fvgTop: fvgZone.top,
        fvgBottom: fvgZone.bottom
      });

      return {
        filled: true,
        fillPrice: candleLow,
        timestamp: candle.timestamp
      };
    }
  } else if (bias === 'BEARISH') {
    // For bearish FVG, price needs to rise into the gap (retrace)
    // Check if candle's high enters the FVG zone
    if (candleHigh >= fvgZone.bottom && candleHigh <= fvgZone.top) {
      logger.info('Bearish FVG filled', {
        fillPrice: candleHigh,
        fvgTop: fvgZone.top,
        fvgBottom: fvgZone.bottom
      });

      return {
        filled: true,
        fillPrice: candleHigh,
        timestamp: candle.timestamp
      };
    }
  }

  return null;
}

/**
 * Scan for FVG in a range of candles
 * @param {Array} candles - Candles to scan
 * @param {string} bias - 'BULLISH' or 'BEARISH'
 * @returns {Object|null} Most recent FVG found
 */
export function scanForFVG(candles, bias) {
  if (!candles || candles.length < 3) {
    return null;
  }

  // Scan from newest to oldest, looking for FVG
  for (let i = candles.length - 3; i >= 0; i--) {
    const threeCandles = candles.slice(i, i + 3);
    const fvg = detectFVG(threeCandles, bias);
    if (fvg) {
      return fvg;
    }
  }

  return null;
}

export default {
  detectFVG,
  detectFVGFill,
  scanForFVG,
  MIN_GAP_PERCENT
};
