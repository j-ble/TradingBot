/**
 * Coinbase Advanced Trade API Client
 * Comprehensive API wrapper with authentication, rate limiting, and retry logic
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger.js';
import { buildAuthHeaders, validateCredentials } from './auth.js';
import { parseError, isRetryable, getRetryDelay } from './errors.js';
import {
  BASE_URL,
  ENDPOINTS,
  PRODUCTS,
  ORDER_TYPES,
  ORDER_SIDES,
  TIME_IN_FORCE,
  RATE_LIMITS,
  TIMEOUTS,
  RETRY_CONFIG,
  getGranularity,
  isValidProduct,
  isValidSide
} from './endpoints.js';

dotenv.config();

const logger = createLogger('coinbase-client');

/**
 * Rate Limiter for API requests
 */
class RateLimiter {
  constructor(maxRequestsPerSecond) {
    this.maxRequests = maxRequestsPerSecond;
    this.requests = [];
    this.interval = 1000; // 1 second
  }

  /**
   * Wait if rate limit would be exceeded
   */
  async throttle() {
    const now = Date.now();

    // Remove requests older than 1 second
    this.requests = this.requests.filter(time => now - time < this.interval);

    // If we've hit the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.interval - (now - oldestRequest);

      if (waitTime > 0) {
        logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Remove the oldest request
      this.requests.shift();
    }

    // Add current request
    this.requests.push(Date.now());
  }

  /**
   * Get current request count
   */
  getRequestCount() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.interval);
    return this.requests.length;
  }
}

/**
 * Coinbase API Client
 */
export class CoinbaseClient {
  constructor(config = {}) {
    // API credentials
    this.apiKey = config.apiKey || process.env.COINBASE_API_KEY;
    this.apiSecret = config.apiSecret || process.env.COINBASE_API_SECRET;

    // Validate credentials
    if (!config.skipValidation) {
      validateCredentials(this.apiKey, this.apiSecret);
    }

    // Configuration
    this.baseURL = config.baseURL || BASE_URL;
    this.timeout = config.timeout || TIMEOUTS.DEFAULT;
    this.maxRetries = config.maxRetries || RETRY_CONFIG.MAX_RETRIES;

    // Rate limiters (separate for public and private endpoints)
    this.publicRateLimiter = new RateLimiter(RATE_LIMITS.PUBLIC);
    this.privateRateLimiter = new RateLimiter(RATE_LIMITS.PRIVATE);
    this.orderRateLimiter = new RateLimiter(RATE_LIMITS.ORDERS);

    // Request logging
    this.logRequests = config.logRequests !== false;

    logger.info('Coinbase client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Make authenticated API request with retry logic
   * @private
   */
  async request(method, path, data = null, options = {}) {
    const isPrivate = options.isPrivate !== false;
    const isOrder = options.isOrder === true;

    // Select appropriate rate limiter
    const rateLimiter = isOrder
      ? this.orderRateLimiter
      : (isPrivate ? this.privateRateLimiter : this.publicRateLimiter);

    // Apply rate limiting
    await rateLimiter.throttle();

    // Build auth headers
    const headers = buildAuthHeaders(this.apiKey, this.apiSecret, method, path);

    // Request configuration
    const config = {
      method,
      url: `${this.baseURL}${path}`,
      headers,
      timeout: options.timeout || this.timeout
    };

    // Add data for POST/PUT requests
    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    // Execute request with retry logic
    return this.executeWithRetry(config, options.retries || 0);
  }

  /**
   * Execute request with automatic retry on failure
   * @private
   */
  async executeWithRetry(config, attempt = 0) {
    try {
      const startTime = Date.now();
      const response = await axios(config);
      const duration = Date.now() - startTime;

      if (this.logRequests) {
        logger.debug('API request successful', {
          method: config.method,
          url: config.url,
          status: response.status,
          duration: `${duration}ms`
        });
      }

      return response.data;
    } catch (error) {
      const parsedError = parseError(error);

      // Check if we should retry
      if (attempt < this.maxRetries && isRetryable(parsedError)) {
        const delay = getRetryDelay(parsedError, attempt + 1);

        logger.warn('Request failed, retrying', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: parsedError.message,
          retryAfter: `${delay}ms`
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry request
        return this.executeWithRetry(config, attempt + 1);
      }

      // Max retries exceeded or non-retryable error
      logger.error('API request failed', {
        method: config.method,
        url: config.url,
        error: parsedError.message,
        attempt: attempt + 1
      });

      throw parsedError;
    }
  }

  // ============================================================================
  // Market Data Methods
  // ============================================================================

  /**
   * Get historical candles for a product
   * @param {string} productId - Product ID (e.g., 'BTC-PERP-INTX')
   * @param {string|number} granularity - Candle size ('5M', '1H', or seconds)
   * @param {Date|string|number} start - Start time
   * @param {Date|string|number} end - End time
   * @returns {Promise<Array>} - Array of candles
   */
  async getCandles(productId, granularity, start, end) {
    // Validate product
    if (!isValidProduct(productId)) {
      throw new Error(`Invalid product ID: ${productId}`);
    }

    // Convert granularity if string
    if (typeof granularity === 'string') {
      granularity = getGranularity(granularity);
    }

    // Convert dates to Unix timestamps
    const startTime = this.toUnixTimestamp(start);
    const endTime = this.toUnixTimestamp(end);

    const params = {
      granularity,
      start: startTime,
      end: endTime
    };

    const response = await this.request(
      'GET',
      ENDPOINTS.PRODUCT_CANDLES(productId),
      params,
      { isPrivate: false }
    );

    return this.parseCandles(response.candles || []);
  }

  /**
   * Get current price for a product
   * @param {string} productId - Product ID
   * @returns {Promise<number>} - Current price
   */
  async getCurrentPrice(productId) {
    if (!isValidProduct(productId)) {
      throw new Error(`Invalid product ID: ${productId}`);
    }

    const response = await this.request(
      'GET',
      ENDPOINTS.PRODUCT_TICKER(productId),
      null,
      { isPrivate: false }
    );

    return parseFloat(response.price);
  }

  /**
   * Get product details
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Product information
   */
  async getProduct(productId) {
    const response = await this.request(
      'GET',
      ENDPOINTS.PRODUCT(productId),
      null,
      { isPrivate: false }
    );

    return response;
  }

  // ============================================================================
  // Account Methods
  // ============================================================================

  /**
   * Get all accounts
   * @returns {Promise<Array>} - Array of accounts
   */
  async getAccounts() {
    const response = await this.request('GET', ENDPOINTS.ACCOUNTS);
    return response.accounts || [];
  }

  /**
   * Get account balance
   * @param {string} accountId - Optional account ID
   * @returns {Promise<Object>} - Account balance information
   */
  async getAccountBalance(accountId = null) {
    if (accountId) {
      return this.request('GET', ENDPOINTS.ACCOUNT(accountId));
    }

    // Get all accounts and sum balances
    const accounts = await this.getAccounts();

    let totalBalance = 0;
    let availableBalance = 0;

    accounts.forEach(account => {
      totalBalance += parseFloat(account.available_balance?.value || 0);
      availableBalance += parseFloat(account.available_balance?.value || 0);
    });

    return {
      total_balance: totalBalance,
      available_balance: availableBalance,
      accounts: accounts
    };
  }

  // ============================================================================
  // Order Methods
  // ============================================================================

  /**
   * Place a market order
   * @param {string} productId - Product ID
   * @param {string} side - 'BUY' or 'SELL'
   * @param {number} size - Order size in base currency
   * @returns {Promise<Object>} - Order response
   */
  async placeMarketOrder(productId, side, size) {
    if (!isValidProduct(productId)) {
      throw new Error(`Invalid product ID: ${productId}`);
    }

    if (!isValidSide(side)) {
      throw new Error(`Invalid order side: ${side}`);
    }

    const orderConfig = {
      client_order_id: this.generateOrderId(),
      product_id: productId,
      side,
      order_configuration: {
        market_market_ioc: {
          base_size: size.toString()
        }
      }
    };

    logger.info('Placing market order', { productId, side, size });

    return this.request('POST', ENDPOINTS.ORDERS, orderConfig, { isOrder: true });
  }

  /**
   * Place a stop loss order
   * @param {string} productId - Product ID
   * @param {string} side - 'BUY' or 'SELL'
   * @param {number} size - Order size
   * @param {number} stopPrice - Stop trigger price
   * @returns {Promise<Object>} - Order response
   */
  async placeStopLossOrder(productId, side, size, stopPrice) {
    if (!isValidProduct(productId)) {
      throw new Error(`Invalid product ID: ${productId}`);
    }

    if (!isValidSide(side)) {
      throw new Error(`Invalid order side: ${side}`);
    }

    const orderConfig = {
      client_order_id: this.generateOrderId(),
      product_id: productId,
      side,
      order_configuration: {
        stop_limit_stop_limit: {
          base_size: size.toString(),
          limit_price: stopPrice.toString(),
          stop_price: stopPrice.toString(),
          stop_direction: side === 'SELL' ? 'STOP_DIRECTION_STOP_DOWN' : 'STOP_DIRECTION_STOP_UP'
        }
      }
    };

    logger.info('Placing stop loss order', { productId, side, size, stopPrice });

    return this.request('POST', ENDPOINTS.ORDERS, orderConfig, { isOrder: true });
  }

  /**
   * Place a take profit order (limit order)
   * @param {string} productId - Product ID
   * @param {string} side - 'BUY' or 'SELL'
   * @param {number} size - Order size
   * @param {number} limitPrice - Limit price
   * @returns {Promise<Object>} - Order response
   */
  async placeTakeProfitOrder(productId, side, size, limitPrice) {
    if (!isValidProduct(productId)) {
      throw new Error(`Invalid product ID: ${productId}`);
    }

    if (!isValidSide(side)) {
      throw new Error(`Invalid order side: ${side}`);
    }

    const orderConfig = {
      client_order_id: this.generateOrderId(),
      product_id: productId,
      side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: size.toString(),
          limit_price: limitPrice.toString(),
          post_only: false
        }
      }
    };

    logger.info('Placing take profit order', { productId, side, size, limitPrice });

    return this.request('POST', ENDPOINTS.ORDERS, orderConfig, { isOrder: true });
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Order details
   */
  async getOrder(orderId) {
    return this.request('GET', ENDPOINTS.ORDER(orderId));
  }

  /**
   * Cancel order by ID
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Cancellation response
   */
  async cancelOrder(orderId) {
    const cancelData = {
      order_ids: [orderId]
    };

    logger.info('Cancelling order', { orderId });

    return this.request('POST', ENDPOINTS.CANCEL_ORDERS, cancelData, { isOrder: true });
  }

  /**
   * List orders
   * @param {string} productId - Optional product ID filter
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>} - Array of orders
   */
  async listOrders(productId = null, status = null) {
    const params = {};

    if (productId) {
      params.product_id = productId;
    }

    if (status) {
      params.order_status = status;
    }

    const response = await this.request('GET', ENDPOINTS.ORDERS, params);
    return response.orders || [];
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate unique client order ID
   * @private
   */
  generateOrderId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Convert date to Unix timestamp
   * @private
   */
  toUnixTimestamp(date) {
    if (typeof date === 'number') {
      return date;
    }

    if (typeof date === 'string') {
      return Math.floor(new Date(date).getTime() / 1000);
    }

    if (date instanceof Date) {
      return Math.floor(date.getTime() / 1000);
    }

    throw new Error('Invalid date format');
  }

  /**
   * Parse candles from API response
   * @private
   */
  parseCandles(candles) {
    return candles.map(candle => ({
      timestamp: new Date(parseInt(candle.start) * 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume)
    }));
  }

  /**
   * Get rate limiter status
   * @returns {Object} - Rate limiter stats
   */
  getRateLimiterStatus() {
    return {
      public: {
        requestsPerSecond: this.publicRateLimiter.getRequestCount(),
        limit: RATE_LIMITS.PUBLIC
      },
      private: {
        requestsPerSecond: this.privateRateLimiter.getRequestCount(),
        limit: RATE_LIMITS.PRIVATE
      },
      orders: {
        requestsPerSecond: this.orderRateLimiter.getRequestCount(),
        limit: RATE_LIMITS.ORDERS
      }
    };
  }
}

// Export default instance
export default CoinbaseClient;
