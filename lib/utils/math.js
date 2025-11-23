/**
 * Mathematical Utilities
 * Calculations for trading operations
 */

/**
 * Calculate percentage change between two values
 * @param {number} oldValue - Original value
 * @param {number} newValue - New value
 * @returns {number} Percentage change (e.g., 5.5 for 5.5%)
 */
export function calculatePercentageChange(oldValue, newValue) {
  if (oldValue === 0) {
    throw new Error('Cannot calculate percentage change from zero');
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Round number to specified decimal places
 * @param {number} number - Number to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded number
 */
export function roundToDecimals(number, decimals) {
  if (typeof number !== 'number' || isNaN(number)) {
    throw new Error('Invalid number');
  }
  const factor = Math.pow(10, decimals);
  return Math.round(number * factor) / factor;
}

/**
 * Calculate risk/reward ratio
 * @param {number} entry - Entry price
 * @param {number} stop - Stop loss price
 * @param {number} target - Take profit price
 * @returns {number} R/R ratio (e.g., 2.5 for 2.5:1)
 */
export function calculateRiskReward(entry, stop, target) {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);

  if (risk === 0) {
    throw new Error('Risk cannot be zero');
  }

  return roundToDecimals(reward / risk, 2);
}

/**
 * Calculate position size based on risk
 * @param {number} balance - Account balance in USD
 * @param {number} riskPercent - Risk percentage (e.g., 0.01 for 1%)
 * @param {number} stopDistance - Stop distance in USD
 * @returns {object} Position size details
 */
export function calculatePositionSize(balance, riskPercent, stopDistance) {
  if (stopDistance === 0) {
    throw new Error('Stop distance cannot be zero');
  }

  const riskAmount = balance * riskPercent;
  const positionSizeUSD = riskAmount / stopDistance * balance;

  // For BTC, divide by entry price (stopDistance is percentage)
  const positionSizeBTC = riskAmount / stopDistance;

  return {
    riskAmount: roundToDecimals(riskAmount, 2),
    positionSizeUSD: roundToDecimals(positionSizeUSD, 2),
    positionSizeBTC: roundToDecimals(positionSizeBTC, 8),
  };
}

/**
 * Calculate position size for BTC trading
 * @param {number} balance - Account balance in USD
 * @param {number} riskPercent - Risk percentage (e.g., 0.01 for 1%)
 * @param {number} entry - Entry price
 * @param {number} stop - Stop loss price
 * @returns {object} Position size details
 */
export function calculateBTCPositionSize(balance, riskPercent, entry, stop) {
  const riskAmount = balance * riskPercent;
  const stopDistanceUSD = Math.abs(entry - stop);

  if (stopDistanceUSD === 0) {
    throw new Error('Stop distance cannot be zero');
  }

  const positionSizeBTC = riskAmount / stopDistanceUSD;
  const positionSizeUSD = positionSizeBTC * entry;

  return {
    riskAmount: roundToDecimals(riskAmount, 2),
    positionSizeBTC: roundToDecimals(positionSizeBTC, 8),
    positionSizeUSD: roundToDecimals(positionSizeUSD, 2),
    stopDistanceUSD: roundToDecimals(stopDistanceUSD, 2),
    stopDistancePercent: roundToDecimals((stopDistanceUSD / entry) * 100, 2),
  };
}

/**
 * Calculate stop distance as percentage
 * @param {number} entry - Entry price
 * @param {number} stop - Stop loss price
 * @returns {number} Distance as percentage (e.g., 1.5 for 1.5%)
 */
export function calculateStopDistance(entry, stop) {
  return roundToDecimals(Math.abs(entry - stop) / entry * 100, 2);
}

/**
 * Calculate target price for given R/R ratio
 * @param {number} entry - Entry price
 * @param {number} stop - Stop loss price
 * @param {number} rrRatio - Desired R/R ratio
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {number} Target price
 */
export function calculateTargetPrice(entry, stop, rrRatio, direction) {
  const stopDistance = Math.abs(entry - stop);
  const targetDistance = stopDistance * rrRatio;

  if (direction === 'LONG') {
    return roundToDecimals(entry + targetDistance, 2);
  } else if (direction === 'SHORT') {
    return roundToDecimals(entry - targetDistance, 2);
  } else {
    throw new Error('Direction must be LONG or SHORT');
  }
}

/**
 * Calculate P&L for a trade
 * @param {number} entry - Entry price
 * @param {number} exit - Exit price
 * @param {number} size - Position size in BTC
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {object} P&L details
 */
export function calculatePnL(entry, exit, size, direction) {
  let pnlUSD;

  if (direction === 'LONG') {
    pnlUSD = (exit - entry) * size;
  } else if (direction === 'SHORT') {
    pnlUSD = (entry - exit) * size;
  } else {
    throw new Error('Direction must be LONG or SHORT');
  }

  const pnlPercent = (pnlUSD / (entry * size)) * 100;

  return {
    pnlUSD: roundToDecimals(pnlUSD, 2),
    pnlPercent: roundToDecimals(pnlPercent, 2),
  };
}

/**
 * Calculate mid-point price from bid/ask
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {number} Mid-point price
 */
export function calculateMidPrice(bid, ask) {
  return roundToDecimals((bid + ask) / 2, 2);
}

/**
 * Calculate spread percentage
 * @param {number} bid - Bid price
 * @param {number} ask - Ask price
 * @returns {number} Spread as percentage
 */
export function calculateSpread(bid, ask) {
  const mid = (bid + ask) / 2;
  return roundToDecimals(((ask - bid) / mid) * 100, 4);
}
