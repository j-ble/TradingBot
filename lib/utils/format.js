/**
 * Formatting Utilities
 * Format prices, amounts, and percentages for display
 */

/**
 * Format price with commas and decimals
 * @param {number} price - Price to format
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted price (e.g., "90,123.45")
 */
export function formatPrice(price, decimals = 2) {
  if (typeof price !== 'number' || isNaN(price)) {
    return '0.00';
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format BTC amount
 * @param {number} amount - BTC amount
 * @param {number} [decimals=8] - Number of decimal places
 * @returns {string} Formatted BTC (e.g., "0.00123456")
 */
export function formatBTC(amount, decimals = 8) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '0.00000000';
  }
  return amount.toFixed(decimals);
}

/**
 * Format percentage with sign
 * @param {number} value - Percentage value (e.g., 5.5 for 5.5%)
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted percentage (e.g., "+5.50%" or "-2.30%")
 */
export function formatPercentage(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00%';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format USD currency
 * @param {number} amount - Amount in USD
 * @param {boolean} [showCents=true] - Show cents
 * @returns {string} Formatted USD (e.g., "$1,234.56")
 */
export function formatUSD(amount, showCents = true) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00';
  }
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/**
 * Format number with K/M/B suffix
 * @param {number} num - Number to format
 * @param {number} [decimals=1] - Decimal places
 * @returns {string} Formatted number (e.g., "1.2M")
 */
export function formatCompact(num, decimals = 1) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0';
  }

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1e9) {
    return `${sign}${(absNum / 1e9).toFixed(decimals)}B`;
  }
  if (absNum >= 1e6) {
    return `${sign}${(absNum / 1e6).toFixed(decimals)}M`;
  }
  if (absNum >= 1e3) {
    return `${sign}${(absNum / 1e3).toFixed(decimals)}K`;
  }
  return `${sign}${absNum.toFixed(decimals)}`;
}

/**
 * Format R/R ratio
 * @param {number} ratio - R/R ratio
 * @returns {string} Formatted ratio (e.g., "2.5:1")
 */
export function formatRiskReward(ratio) {
  if (typeof ratio !== 'number' || isNaN(ratio)) {
    return '0:1';
  }
  return `${ratio.toFixed(1)}:1`;
}

/**
 * Format trade direction with emoji
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {string} Direction with emoji
 */
export function formatDirection(direction) {
  if (direction === 'LONG') {
    return 'LONG';
  } else if (direction === 'SHORT') {
    return 'SHORT';
  }
  return direction;
}

/**
 * Format trade outcome
 * @param {string} outcome - 'WIN', 'LOSS', or 'BREAKEVEN'
 * @returns {string} Formatted outcome
 */
export function formatOutcome(outcome) {
  switch (outcome) {
    case 'WIN':
      return 'WIN';
    case 'LOSS':
      return 'LOSS';
    case 'BREAKEVEN':
      return 'BREAKEVEN';
    default:
      return outcome;
  }
}

/**
 * Format confidence score
 * @param {number} confidence - Confidence 0-100
 * @returns {string} Formatted confidence (e.g., "85%")
 */
export function formatConfidence(confidence) {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return '0%';
  }
  return `${Math.round(confidence)}%`;
}

/**
 * Format order ID (truncate for display)
 * @param {string} orderId - Full order ID
 * @param {number} [length=8] - Display length
 * @returns {string} Truncated ID
 */
export function formatOrderId(orderId, length = 8) {
  if (!orderId || typeof orderId !== 'string') {
    return '';
  }
  if (orderId.length <= length) {
    return orderId;
  }
  return `${orderId.substring(0, length)}...`;
}

/**
 * Pad number with leading zeros
 * @param {number} num - Number to pad
 * @param {number} length - Total length
 * @returns {string} Padded number
 */
export function padNumber(num, length) {
  return String(num).padStart(length, '0');
}
