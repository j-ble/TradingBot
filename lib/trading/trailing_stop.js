/**
 * Trailing Stop Logic
 *
 * Manages trailing stop loss functionality to lock in profits as trades move favorably.
 * Activates at 80% progress to target and moves stop to breakeven (entry price).
 */

const logger = require('../utils/logger');

/**
 * Check if trailing stop should be activated
 *
 * Trailing stop activates when:
 * - Progress to target >= 80%
 * - Trailing stop not already activated
 * - Trade is moving in profitable direction
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @returns {Object} Trailing stop decision
 */
function checkTrailingStop(trade, currentPrice) {
  // Skip if already activated
  if (trade.trailing_stop_activated) {
    return {
      shouldActivate: false,
      reason: 'ALREADY_ACTIVATED',
      currentStop: trade.trailing_stop_price || trade.stop_loss
    };
  }

  // Calculate progress to target
  const progress = calculateProgressToTarget(trade, currentPrice);

  // Check activation threshold
  if (progress >= 80) {
    logger.info('Trailing stop threshold reached', {
      tradeId: trade.id,
      progress: progress.toFixed(2) + '%',
      currentPrice,
      targetPrice: trade.take_profit
    });

    return {
      shouldActivate: true,
      reason: 'THRESHOLD_REACHED',
      progress: progress,
      currentPrice: currentPrice,
      newStopPrice: trade.entry_price, // Move to breakeven
      previousStop: trade.stop_loss
    };
  }

  return {
    shouldActivate: false,
    reason: 'THRESHOLD_NOT_REACHED',
    progress: progress,
    threshold: 80
  };
}

/**
 * Calculate progress toward take profit target
 *
 * Returns percentage of distance covered from entry to take profit.
 * Returns 0 if trade is currently losing money.
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @returns {number} Progress percentage (0-100+)
 */
function calculateProgressToTarget(trade, currentPrice) {
  const targetDistance = Math.abs(trade.take_profit - trade.entry_price);
  const currentDistance = Math.abs(currentPrice - trade.entry_price);

  // Check if moving in the right direction
  const isMovingRight = trade.direction === 'LONG'
    ? currentPrice > trade.entry_price
    : currentPrice < trade.entry_price;

  if (!isMovingRight) {
    return 0; // Trade is currently losing
  }

  const progress = (currentDistance / targetDistance) * 100;
  return Math.min(progress, 100); // Cap at 100%
}

/**
 * Calculate new stop loss price for trailing stop
 *
 * Default strategy: Move to breakeven (entry price)
 * This ensures trade cannot result in a loss once trailing activates.
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @param {Object} options - Trailing stop options
 * @returns {Object} New stop loss details
 */
function calculateTrailingStopPrice(trade, currentPrice, options = {}) {
  const { strategy = 'BREAKEVEN', buffer = 0 } = options;

  let newStopPrice;

  switch (strategy) {
    case 'BREAKEVEN':
      // Move stop to entry price (no loss, no gain if hit)
      newStopPrice = trade.entry_price;
      break;

    case 'BREAKEVEN_PLUS_BUFFER':
      // Move stop slightly past entry to guarantee small profit
      if (trade.direction === 'LONG') {
        newStopPrice = trade.entry_price * (1 + buffer); // e.g., +0.1%
      } else {
        newStopPrice = trade.entry_price * (1 - buffer); // e.g., -0.1%
      }
      break;

    case 'DYNAMIC':
      // Move stop to lock in a percentage of current profit
      const lockInPercent = options.lockInPercent || 0.5; // Lock in 50% of profit
      const unrealizedProfit = trade.direction === 'LONG'
        ? currentPrice - trade.entry_price
        : trade.entry_price - currentPrice;

      const lockedProfit = unrealizedProfit * lockInPercent;

      if (trade.direction === 'LONG') {
        newStopPrice = trade.entry_price + lockedProfit;
      } else {
        newStopPrice = trade.entry_price - lockedProfit;
      }
      break;

    default:
      newStopPrice = trade.entry_price;
  }

  return {
    price: newStopPrice,
    strategy: strategy,
    previousStop: trade.stop_loss,
    improvement: Math.abs(newStopPrice - trade.stop_loss),
    improvementPercent: (Math.abs(newStopPrice - trade.stop_loss) / trade.entry_price) * 100
  };
}

/**
 * Validate trailing stop activation
 *
 * Ensures trailing stop parameters are safe and valid before activation.
 *
 * @param {Object} trade - Trade record
 * @param {number} newStopPrice - Proposed new stop price
 * @returns {Object} Validation result
 */
function validateTrailingStop(trade, newStopPrice) {
  const errors = [];

  // Check 1: New stop should be better than old stop
  if (trade.direction === 'LONG') {
    if (newStopPrice <= trade.stop_loss) {
      errors.push('New stop must be higher than current stop for LONG');
    }
  } else {
    if (newStopPrice >= trade.stop_loss) {
      errors.push('New stop must be lower than current stop for SHORT');
    }
  }

  // Check 2: New stop should be on the safe side of entry
  if (trade.direction === 'LONG') {
    if (newStopPrice > trade.entry_price * 1.005) {
      // Allow small buffer above entry (0.5%)
      errors.push('Stop too far above entry for LONG');
    }
    if (newStopPrice < trade.entry_price * 0.995) {
      errors.push('Stop should be at or above entry for trailing LONG');
    }
  } else {
    if (newStopPrice < trade.entry_price * 0.995) {
      errors.push('Stop too far below entry for SHORT');
    }
    if (newStopPrice > trade.entry_price * 1.005) {
      errors.push('Stop should be at or below entry for trailing SHORT');
    }
  }

  // Check 3: New stop should not be beyond current price
  if (trade.direction === 'LONG') {
    if (newStopPrice > trade.current_price * 0.999) {
      errors.push('Stop cannot be above current price for LONG');
    }
  } else {
    if (newStopPrice < trade.current_price * 1.001) {
      errors.push('Stop cannot be below current price for SHORT');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get trailing stop status for a trade
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @returns {Object} Trailing stop status
 */
function getTrailingStopStatus(trade, currentPrice) {
  const progress = calculateProgressToTarget(trade, currentPrice);
  const check = checkTrailingStop(trade, currentPrice);

  return {
    activated: trade.trailing_stop_activated || false,
    currentStop: trade.trailing_stop_activated
      ? (trade.trailing_stop_price || trade.entry_price)
      : trade.stop_loss,
    originalStop: trade.stop_loss,
    progressToTarget: progress,
    shouldActivate: check.shouldActivate,
    activationThreshold: 80,
    canActivate: !trade.trailing_stop_activated && progress >= 80
  };
}

/**
 * Calculate potential profit protection from trailing stop
 *
 * Shows how much profit is protected vs. original risk.
 *
 * @param {Object} trade - Trade record
 * @param {number} newStopPrice - New trailing stop price
 * @returns {Object} Profit protection metrics
 */
function calculateProfitProtection(trade, newStopPrice) {
  const originalRisk = Math.abs(trade.entry_price - trade.stop_loss);
  const originalRiskUSD = originalRisk * trade.position_size_btc;

  const protectedProfit = trade.direction === 'LONG'
    ? (newStopPrice - trade.entry_price) * trade.position_size_btc
    : (trade.entry_price - newStopPrice) * trade.position_size_btc;

  const riskReduction = trade.direction === 'LONG'
    ? (newStopPrice - trade.stop_loss) * trade.position_size_btc
    : (trade.stop_loss - newStopPrice) * trade.position_size_btc;

  const riskReductionPercent = (riskReduction / originalRiskUSD) * 100;

  return {
    originalRiskUSD: originalRiskUSD,
    protectedProfitUSD: protectedProfit,
    riskReductionUSD: riskReduction,
    riskReductionPercent: riskReductionPercent,
    newStopPrice: newStopPrice,
    isBreakeven: Math.abs(newStopPrice - trade.entry_price) < (trade.entry_price * 0.001) // Within 0.1%
  };
}

module.exports = {
  checkTrailingStop,
  calculateProgressToTarget,
  calculateTrailingStopPrice,
  validateTrailingStop,
  getTrailingStopStatus,
  calculateProfitProtection
};
