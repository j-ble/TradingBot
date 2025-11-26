/**
 * Position Sizer
 *
 * Calculates position sizes based on 1% fixed risk per trade.
 * The position size is determined by the distance to the stop loss.
 */

const logger = require('../utils/logger');

/**
 * Calculate position size based on account balance and stop loss distance
 *
 * Formula: Position Size = (Account Balance * Risk%) / Stop Distance
 *
 * @param {number} accountBalance - Total account balance in USD
 * @param {number} entryPrice - Entry price for the trade
 * @param {number} stopLoss - Stop loss price
 * @returns {Object} Position size details
 *
 * @example
 * // Balance: $10,000, Entry: $90,000, Stop: $87,300 (3% away)
 * // Risk: $100 (1%), Stop Distance: $2,700
 * // Position: $100 / $2,700 = 0.037 BTC = $3,333 USD
 */
function calculatePositionSize(accountBalance, entryPrice, stopLoss) {
  // Validate inputs
  if (!accountBalance || accountBalance <= 0) {
    throw new Error('Invalid account balance');
  }
  if (!entryPrice || entryPrice <= 0) {
    throw new Error('Invalid entry price');
  }
  if (!stopLoss || stopLoss <= 0) {
    throw new Error('Invalid stop loss price');
  }

  // Calculate 1% risk amount
  const riskAmount = accountBalance * 0.01; // 1% risk (non-negotiable)

  // Calculate stop distance in USD
  const stopDistance = Math.abs(entryPrice - stopLoss);

  // Ensure stop distance is not zero
  if (stopDistance === 0) {
    throw new Error('Stop loss cannot equal entry price');
  }

  // Calculate position size in BTC
  const positionSizeBTC = riskAmount / stopDistance;

  // Calculate position size in USD
  const positionSizeUSD = positionSizeBTC * entryPrice;

  // Calculate stop distance as percentage
  const stopDistancePercent = (stopDistance / entryPrice) * 100;

  const result = {
    btc: positionSizeBTC,
    usd: positionSizeUSD,
    riskAmount: riskAmount,
    stopDistance: stopDistance,
    stopDistancePercent: stopDistancePercent
  };

  logger.debug('Position size calculated:', result);

  return result;
}

/**
 * Validate risk/reward ratio for a trade
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @param {number} takeProfit - Take profit price
 * @param {string} direction - Trade direction ('LONG' or 'SHORT')
 * @returns {Object} Validation result with R/R ratio
 */
function validateRiskReward(entryPrice, stopLoss, takeProfit, direction) {
  // Validate inputs
  if (!entryPrice || !stopLoss || !takeProfit || !direction) {
    throw new Error('Missing required parameters for R/R validation');
  }

  if (!['LONG', 'SHORT'].includes(direction)) {
    throw new Error('Direction must be LONG or SHORT');
  }

  // Calculate stop distance (risk)
  const stopDistance = Math.abs(entryPrice - stopLoss);

  // Calculate target distance (reward)
  const targetDistance = Math.abs(takeProfit - entryPrice);

  // Calculate R/R ratio
  const rrRatio = targetDistance / stopDistance;

  // Calculate minimum target for 2:1 R/R
  const minTarget = direction === 'LONG'
    ? entryPrice + (stopDistance * 2)
    : entryPrice - (stopDistance * 2);

  const result = {
    valid: rrRatio >= 2.0,
    ratio: rrRatio,
    stopDistance: stopDistance,
    targetDistance: targetDistance,
    minTarget: minTarget,
    actualTarget: takeProfit
  };

  if (!result.valid) {
    logger.warn(`R/R ratio ${rrRatio.toFixed(2)}:1 is below 2:1 minimum`);
  }

  return result;
}

/**
 * Calculate take profit price for a given risk/reward ratio
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @param {string} direction - Trade direction ('LONG' or 'SHORT')
 * @param {number} rrRatio - Desired risk/reward ratio (default: 2.0)
 * @returns {number} Take profit price
 */
function calculateTakeProfit(entryPrice, stopLoss, direction, rrRatio = 2.0) {
  // Validate inputs
  if (!entryPrice || !stopLoss || !direction) {
    throw new Error('Missing required parameters for take profit calculation');
  }

  if (rrRatio < 2.0) {
    throw new Error('R/R ratio must be at least 2:1');
  }

  // Calculate stop distance
  const stopDistance = Math.abs(entryPrice - stopLoss);

  // Calculate target distance based on R/R ratio
  const targetDistance = stopDistance * rrRatio;

  // Calculate take profit based on direction
  let takeProfit;
  if (direction === 'LONG') {
    takeProfit = entryPrice + targetDistance;
  } else if (direction === 'SHORT') {
    takeProfit = entryPrice - targetDistance;
  } else {
    throw new Error('Direction must be LONG or SHORT');
  }

  return takeProfit;
}

/**
 * Validate position size parameters
 *
 * @param {Object} params - Position parameters
 * @returns {Object} Validation result
 */
function validatePositionSize(params) {
  const errors = [];

  // Check account balance
  if (!params.accountBalance || params.accountBalance < 100) {
    errors.push('Account balance must be at least $100');
  }

  // Check entry price
  if (!params.entryPrice || params.entryPrice <= 0) {
    errors.push('Entry price must be positive');
  }

  // Check stop loss
  if (!params.stopLoss || params.stopLoss <= 0) {
    errors.push('Stop loss must be positive');
  }

  // Check direction
  if (!params.direction || !['LONG', 'SHORT'].includes(params.direction)) {
    errors.push('Direction must be LONG or SHORT');
  }

  // Validate stop loss is on correct side
  if (params.direction === 'LONG' && params.stopLoss >= params.entryPrice) {
    errors.push('Stop loss must be below entry price for LONG positions');
  }

  if (params.direction === 'SHORT' && params.stopLoss <= params.entryPrice) {
    errors.push('Stop loss must be above entry price for SHORT positions');
  }

  // Validate stop distance is within acceptable range (0.5% - 3%)
  const stopDistance = Math.abs(params.entryPrice - params.stopLoss);
  const stopDistancePercent = (stopDistance / params.entryPrice) * 100;

  if (stopDistancePercent < 0.5 || stopDistancePercent > 3.0) {
    errors.push(`Stop distance ${stopDistancePercent.toFixed(2)}% is outside acceptable range (0.5%-3%)`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

module.exports = {
  calculatePositionSize,
  validateRiskReward,
  calculateTakeProfit,
  validatePositionSize
};
