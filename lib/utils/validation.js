/**
 * Input Validation Helpers
 * Reusable validators for trading operations
 */

/**
 * Validate price is a positive number
 * @param {number} price - Price to validate
 * @param {string} [label='Price'] - Label for error message
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validatePrice(price, label = 'Price') {
  if (typeof price !== 'number' || isNaN(price)) {
    throw new Error(`${label} must be a number`);
  }
  if (price <= 0) {
    throw new Error(`${label} must be positive`);
  }
  return true;
}

/**
 * Validate position size within bounds
 * @param {number} size - Position size
 * @param {number} [min=0.0001] - Minimum size
 * @param {number} [max=100] - Maximum size
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validatePositionSize(size, min = 0.0001, max = 100) {
  if (typeof size !== 'number' || isNaN(size)) {
    throw new Error('Position size must be a number');
  }
  if (size < min) {
    throw new Error(`Position size must be at least ${min}`);
  }
  if (size > max) {
    throw new Error(`Position size must not exceed ${max}`);
  }
  return true;
}

/**
 * Validate risk/reward ratio
 * @param {number} ratio - R/R ratio
 * @param {number} [min=2] - Minimum ratio
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateRiskReward(ratio, min = 2) {
  if (typeof ratio !== 'number' || isNaN(ratio)) {
    throw new Error('Risk/reward ratio must be a number');
  }
  if (ratio < min) {
    throw new Error(`Risk/reward ratio must be at least ${min}:1`);
  }
  return true;
}

/**
 * Validate stop loss distance percentage
 * @param {number} distancePercent - Distance as percentage (e.g., 1.5 for 1.5%)
 * @param {number} [min=0.5] - Minimum distance %
 * @param {number} [max=3] - Maximum distance %
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateStopDistance(distancePercent, min = 0.5, max = 3) {
  if (typeof distancePercent !== 'number' || isNaN(distancePercent)) {
    throw new Error('Stop distance must be a number');
  }
  if (distancePercent < min || distancePercent > max) {
    throw new Error(`Stop distance must be between ${min}% and ${max}%`);
  }
  return true;
}

/**
 * Validate trade direction
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateDirection(direction) {
  if (!['LONG', 'SHORT'].includes(direction)) {
    throw new Error('Direction must be LONG or SHORT');
  }
  return true;
}

/**
 * Validate order side
 * @param {string} side - 'BUY' or 'SELL'
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateSide(side) {
  if (!['BUY', 'SELL'].includes(side)) {
    throw new Error('Side must be BUY or SELL');
  }
  return true;
}

/**
 * Validate product ID format
 * @param {string} productId - e.g., 'BTC-USD'
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateProductId(productId) {
  if (typeof productId !== 'string') {
    throw new Error('Product ID must be a string');
  }
  if (!/^[A-Z]+-[A-Z]+$/.test(productId)) {
    throw new Error('Product ID must be in format XXX-YYY (e.g., BTC-USD)');
  }
  return true;
}

/**
 * Validate confidence score
 * @param {number} confidence - 0-100
 * @param {number} [min=70] - Minimum required confidence
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateConfidence(confidence, min = 70) {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    throw new Error('Confidence must be a number');
  }
  if (confidence < 0 || confidence > 100) {
    throw new Error('Confidence must be between 0 and 100');
  }
  if (confidence < min) {
    throw new Error(`Confidence must be at least ${min}%`);
  }
  return true;
}

/**
 * Validate timestamp is valid date
 * @param {string|number|Date} timestamp - Timestamp to validate
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }
  return true;
}

/**
 * Validate account balance is sufficient
 * @param {number} balance - Current balance
 * @param {number} [min=100] - Minimum required balance
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
export function validateBalance(balance, min = 100) {
  if (typeof balance !== 'number' || isNaN(balance)) {
    throw new Error('Balance must be a number');
  }
  if (balance < min) {
    throw new Error(`Balance must be at least $${min} to trade`);
  }
  return true;
}
