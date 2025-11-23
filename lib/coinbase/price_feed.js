/**
 * Price Feed Manager
 * High-level API for real-time BTC-USD price updates
 */

import { CoinbaseWebSocket } from './websocket.js';
import { WS_CHANNELS, PRODUCTS } from './endpoints.js';
import { TypedEventEmitter } from '../utils/event_emitter.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('price-feed');

/**
 * Price Feed Manager
 * Provides simple API for real-time price updates
 */
export class PriceFeed extends TypedEventEmitter {
  constructor(options = {}) {
    super();

    this.productId = options.productId || PRODUCTS.BTC_USD;
    this.ws = new CoinbaseWebSocket(options);

    // Price cache
    this.currentPrice = null;
    this.lastUpdate = null;
    this.priceHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;

    // Stats
    this.updateCount = 0;
    this.connectionStartTime = null;

    // Setup WebSocket event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.ws.on('connected', () => {
      this.connectionStartTime = Date.now();
      logger.info('Price feed connected');
      this.emit('connected');
    });

    this.ws.on('disconnected', (data) => {
      logger.warn('Price feed disconnected', data);
      this.emit('disconnected', data);
    });

    this.ws.on('ticker', (message) => {
      this.handleTicker(message);
    });

    this.ws.on('heartbeat', () => {
      this.emit('heartbeat');
    });

    this.ws.on('error', (error) => {
      logger.error('Price feed error', { error: error.message });
      this.emit('error', error);
    });

    this.ws.on('reconnect_warning', (data) => {
      logger.warn('Multiple reconnection attempts', data);
      this.emit('reconnect_warning', data);
    });

    this.ws.on('reconnect_failed', () => {
      logger.error('Price feed reconnection failed');
      this.emit('reconnect_failed');
    });

    this.ws.on('heartbeat_timeout', () => {
      logger.warn('Price feed heartbeat timeout');
      this.emit('heartbeat_timeout');
    });
  }

  /**
   * Connect to price feed
   * @returns {Promise<void>}
   */
  async connect() {
    logger.info('Starting price feed', { productId: this.productId });

    await this.ws.connect();

    // Subscribe to ticker channel
    await this.ws.subscribe([
      {
        name: WS_CHANNELS.TICKER,
        product_ids: [this.productId]
      }
    ]);

    logger.info('Price feed started successfully');
  }

  /**
   * Disconnect from price feed
   */
  disconnect() {
    logger.info('Stopping price feed');
    this.ws.disconnect();
  }

  /**
   * Handle ticker message
   * @param {Object} message - Ticker message
   */
  handleTicker(message) {
    // Filter for our product
    if (message.product_id !== this.productId) {
      return;
    }

    const price = parseFloat(message.price);
    const timestamp = new Date(message.time || Date.now());

    // Update current price
    const previousPrice = this.currentPrice;
    this.currentPrice = price;
    this.lastUpdate = timestamp;
    this.updateCount++;

    // Add to history
    this.priceHistory.push({
      price,
      timestamp,
      volume_24h: parseFloat(message.volume_24_h || 0),
      low_24h: parseFloat(message.low_24_h || 0),
      high_24h: parseFloat(message.high_24_h || 0)
    });

    // Trim history
    if (this.priceHistory.length > this.maxHistorySize) {
      this.priceHistory.shift();
    }

    // Calculate change
    const change = previousPrice ? price - previousPrice : 0;
    const changePercent = previousPrice ? (change / previousPrice) * 100 : 0;

    // Emit price update
    const update = {
      price,
      timestamp,
      change,
      changePercent,
      product_id: this.productId,
      volume_24h: parseFloat(message.volume_24_h || 0),
      low_24h: parseFloat(message.low_24_h || 0),
      high_24h: parseFloat(message.high_24_h || 0),
      best_bid: parseFloat(message.best_bid || 0),
      best_ask: parseFloat(message.best_ask || 0)
    };

    logger.debug('Price update', {
      price,
      change: change.toFixed(2),
      changePercent: changePercent.toFixed(4)
    });

    this.emit('price_update', update);
  }

  /**
   * Get current price
   * @returns {number|null} Current price or null if not available
   */
  getCurrentPrice() {
    return this.currentPrice;
  }

  /**
   * Get last update timestamp
   * @returns {Date|null} Last update time
   */
  getLastUpdate() {
    return this.lastUpdate;
  }

  /**
   * Get price history
   * @param {number} [count] - Number of entries to return
   * @returns {Array} Price history
   */
  getHistory(count) {
    if (count) {
      return this.priceHistory.slice(-count);
    }
    return [...this.priceHistory];
  }

  /**
   * Get feed statistics
   * @returns {Object} Feed stats
   */
  getStats() {
    const now = Date.now();
    const uptime = this.connectionStartTime
      ? now - this.connectionStartTime
      : 0;

    return {
      connected: this.ws.connected,
      currentPrice: this.currentPrice,
      lastUpdate: this.lastUpdate,
      updateCount: this.updateCount,
      historySize: this.priceHistory.length,
      uptime,
      updatesPerMinute: uptime > 0
        ? Math.round((this.updateCount / uptime) * 60000)
        : 0
    };
  }

  /**
   * Check if feed is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.ws.connected;
  }

  /**
   * Wait for next price update
   * @param {number} [timeout] - Timeout in ms
   * @returns {Promise<Object>} Price update
   */
  async waitForUpdate(timeout = 10000) {
    return this.waitFor('price_update', timeout);
  }

  /**
   * Get average price from history
   * @param {number} [count] - Number of entries to average
   * @returns {number|null} Average price
   */
  getAveragePrice(count = 10) {
    const history = this.getHistory(count);
    if (history.length === 0) return null;

    const sum = history.reduce((acc, entry) => acc + entry.price, 0);
    return sum / history.length;
  }

  /**
   * Get price volatility (standard deviation)
   * @param {number} [count] - Number of entries
   * @returns {number|null} Standard deviation
   */
  getVolatility(count = 20) {
    const history = this.getHistory(count);
    if (history.length < 2) return null;

    const prices = history.map(h => h.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;

    return Math.sqrt(variance);
  }
}

// Export singleton factory
let instance = null;

export function getPriceFeed(options) {
  if (!instance) {
    instance = new PriceFeed(options);
  }
  return instance;
}

export function resetPriceFeed() {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}

export default PriceFeed;
