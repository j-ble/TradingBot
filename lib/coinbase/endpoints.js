/**
 * Coinbase Advanced Trade API Endpoints
 * Endpoint definitions and constants for Coinbase API v3
 */

/**
 * Base URL for Coinbase Advanced Trade API
 */
export const BASE_URL = 'https://api.coinbase.com';

/**
 * API version prefix
 */
export const API_PREFIX = '/api/v3/brokerage';

/**
 * WebSocket URL for real-time data
 */
export const WS_URL = 'wss://advanced-trade-ws.coinbase.com';

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  // Accounts
  ACCOUNTS: `${API_PREFIX}/accounts`,
  ACCOUNT: (accountId) => `${API_PREFIX}/accounts/${accountId}`,

  // Products
  PRODUCTS: `${API_PREFIX}/products`,
  PRODUCT: (productId) => `${API_PREFIX}/products/${productId}`,
  PRODUCT_CANDLES: (productId) => `${API_PREFIX}/products/${productId}/candles`,
  PRODUCT_TICKER: (productId) => `${API_PREFIX}/products/${productId}/ticker`,
  BEST_BID_ASK: `${API_PREFIX}/best_bid_ask`,

  // Orders
  ORDERS: `${API_PREFIX}/orders`,
  ORDER: (orderId) => `${API_PREFIX}/orders/historical/${orderId}`,
  ORDERS_HISTORY: `${API_PREFIX}/orders/historical/batch`,
  ORDER_BATCH: `${API_PREFIX}/orders/batch`,
  CANCEL_ORDERS: `${API_PREFIX}/orders/batch_cancel`,
  CLOSE_POSITION: `${API_PREFIX}/orders/close_position`,
  PREVIEW_ORDER: `${API_PREFIX}/orders/preview`,

  // Fills
  FILLS: `${API_PREFIX}/orders/historical/fills`,

  // Portfolios
  PORTFOLIOS: `${API_PREFIX}/portfolios`,
  PORTFOLIO: (portfolioId) => `${API_PREFIX}/portfolios/${portfolioId}`,

  // Transactions
  TRANSACTIONS: `${API_PREFIX}/transaction_summary`
};

/**
 * Product IDs
 * NOTE: Using spot trading products (Advanced Trade API)
 * For perpetual futures, use INTX API with separate credentials
 */
export const PRODUCTS = {
  BTC_USD: 'BTC-USD',          // BTC Spot (Primary)
  ETH_USD: 'ETH-USD',          // ETH Spot
  BTC_USDT: 'BTC-USDT',        // BTC/Tether pair
  ETH_USDT: 'ETH-USDT',        // ETH/Tether pair
  BTC_USDC: 'BTC-USDC'         // BTC/USDC pair
  // BTC_PERP: 'BTC-PERP-INTX',  // Requires INTX API credentials
  // ETH_PERP: 'ETH-PERP-INTX',  // Requires INTX API credentials
};

/**
 * Order types
 */
export const ORDER_TYPES = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT'
};

/**
 * Order sides
 */
export const ORDER_SIDES = {
  BUY: 'BUY',
  SELL: 'SELL'
};

/**
 * Order statuses
 */
export const ORDER_STATUSES = {
  OPEN: 'OPEN',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  PENDING: 'PENDING'
};

/**
 * Time in force options
 */
export const TIME_IN_FORCE = {
  GTC: 'GOOD_TILL_CANCELLED',  // Good till cancelled
  GTD: 'GOOD_TILL_DATE',       // Good till date
  IOC: 'IMMEDIATE_OR_CANCEL',  // Immediate or cancel
  FOK: 'FILL_OR_KILL'          // Fill or kill
};

/**
 * Candle granularities (API string values)
 */
export const GRANULARITIES = {
  ONE_MINUTE: 'ONE_MINUTE',
  FIVE_MINUTE: 'FIVE_MINUTE',
  FIFTEEN_MINUTE: 'FIFTEEN_MINUTE',
  THIRTY_MINUTE: 'THIRTY_MINUTE',
  ONE_HOUR: 'ONE_HOUR',
  TWO_HOUR: 'TWO_HOUR',
  SIX_HOUR: 'SIX_HOUR',
  ONE_DAY: 'ONE_DAY'
};

/**
 * Granularity mappings for readable names
 */
export const GRANULARITY_NAMES = {
  '1M': GRANULARITIES.ONE_MINUTE,
  '5M': GRANULARITIES.FIVE_MINUTE,
  '15M': GRANULARITIES.FIFTEEN_MINUTE,
  '30M': GRANULARITIES.THIRTY_MINUTE,
  '1H': GRANULARITIES.ONE_HOUR,
  '2H': GRANULARITIES.TWO_HOUR,
  '4H': GRANULARITIES.SIX_HOUR, // Note: Coinbase doesn't have 4H, using 6H
  '6H': GRANULARITIES.SIX_HOUR,
  '1D': GRANULARITIES.ONE_DAY
};

/**
 * Rate limits
 */
export const RATE_LIMITS = {
  PUBLIC: 10,      // 10 requests per second for public endpoints
  PRIVATE: 15,     // 15 requests per second for private endpoints
  ORDERS: 5        // 5 order requests per second
};

/**
 * Request timeouts (milliseconds)
 */
export const TIMEOUTS = {
  DEFAULT: 30000,   // 30 seconds
  ORDERS: 10000,    // 10 seconds for order operations
  MARKET_DATA: 5000 // 5 seconds for market data
};

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,     // 1 second
  MAX_DELAY: 30000,     // 30 seconds
  TIMEOUT_RETRIES: 2    // Number of retries for timeouts
};

/**
 * WebSocket channels
 */
export const WS_CHANNELS = {
  TICKER: 'ticker',
  LEVEL2: 'level2',
  MATCHES: 'matches',
  HEARTBEAT: 'heartbeats',
  STATUS: 'status',
  USER: 'user'
};

/**
 * Order configuration defaults
 */
export const ORDER_DEFAULTS = {
  TIME_IN_FORCE: TIME_IN_FORCE.GTC,
  POST_ONLY: false,
  SELF_TRADE_PREVENTION: 'DECREMENT_AND_CANCEL'
};

/**
 * Minimum order sizes (in base currency)
 */
export const MIN_ORDER_SIZES = {
  BTC_USD: 0.00001,   // 0.00001 BTC minimum for spot
  ETH_USD: 0.0001,    // 0.0001 ETH minimum for spot
  BTC_USDT: 0.00001,
  ETH_USDT: 0.0001
};

/**
 * API error codes
 */
export const ERROR_CODES = {
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_ORDER_TYPE: 'INVALID_ORDER_TYPE',
  INVALID_PRODUCT: 'INVALID_PRODUCT',
  SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

/**
 * Get granularity from name (e.g., '5M' -> 300)
 * @param {string} name - Granularity name
 * @returns {number} - Granularity in seconds
 */
export function getGranularity(name) {
  const granularity = GRANULARITY_NAMES[name.toUpperCase()];
  if (!granularity) {
    throw new Error(`Invalid granularity: ${name}. Valid options: ${Object.keys(GRANULARITY_NAMES).join(', ')}`);
  }
  return granularity;
}

/**
 * Validate product ID
 * @param {string} productId - Product ID to validate
 * @returns {boolean} - True if valid
 */
export function isValidProduct(productId) {
  return Object.values(PRODUCTS).includes(productId);
}

/**
 * Validate order side
 * @param {string} side - Order side
 * @returns {boolean} - True if valid
 */
export function isValidSide(side) {
  return Object.values(ORDER_SIDES).includes(side);
}

/**
 * Validate order type
 * @param {string} type - Order type
 * @returns {boolean} - True if valid
 */
export function isValidOrderType(type) {
  return Object.values(ORDER_TYPES).includes(type);
}

export default {
  BASE_URL,
  API_PREFIX,
  WS_URL,
  ENDPOINTS,
  PRODUCTS,
  ORDER_TYPES,
  ORDER_SIDES,
  ORDER_STATUSES,
  TIME_IN_FORCE,
  GRANULARITIES,
  GRANULARITY_NAMES,
  RATE_LIMITS,
  TIMEOUTS,
  RETRY_CONFIG,
  WS_CHANNELS,
  ORDER_DEFAULTS,
  MIN_ORDER_SIZES,
  ERROR_CODES,
  getGranularity,
  isValidProduct,
  isValidSide,
  isValidOrderType
};
