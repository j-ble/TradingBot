/**
 * Coinbase WebSocket Client
 * Real-time data streaming with automatic reconnection
 */

import WebSocket from 'ws';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { WS_URL, WS_CHANNELS } from './endpoints.js';
import { TypedEventEmitter } from '../utils/event_emitter.js';
import { createLogger } from '../utils/logger.js';
import { getCoinbaseConfig } from '../config/index.js';

const logger = createLogger('coinbase-ws');

// Constants
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 60000; // 60 seconds

/**
 * Coinbase WebSocket Client
 * Handles connection, authentication, and message routing
 */
export class CoinbaseWebSocket extends TypedEventEmitter {
  constructor(options = {}) {
    super();

    const coinbaseConfig = getCoinbaseConfig();
    this.apiKey = options.apiKey || coinbaseConfig.apiKey;
    this.apiSecret = options.apiSecret || coinbaseConfig.apiSecret;
    this.wsUrl = options.wsUrl || WS_URL;

    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.heartbeatTimeout = null;
    this.subscribedChannels = [];

    // Clean up private key
    if (this.apiSecret && this.apiSecret.includes('\\n')) {
      this.apiSecret = this.apiSecret.replace(/\\n/g, '\n');
    }
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected || this.isConnecting) {
      logger.warn('Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    logger.info('Connecting to Coinbase WebSocket', { url: this.wsUrl });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          logger.info('WebSocket connected');
          this.emit('connected');
          this.startHeartbeatMonitor();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code, reason) => {
          this.handleDisconnect(code, reason.toString());
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error', { error: error.message });
          this.emit('error', error);
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        });

      } catch (error) {
        this.isConnecting = false;
        logger.error('Failed to create WebSocket', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    logger.info('Disconnecting WebSocket');

    this.clearReconnectTimeout();
    this.clearHeartbeatTimeout();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.subscribedChannels = [];
    this.emit('disconnected');
  }

  /**
   * Subscribe to channels
   * @param {Array<Object>} channels - Channels to subscribe
   */
  async subscribe(channels) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Generate JWT for WebSocket authentication
    const jwt = await this.generateWebSocketJWT();

    // For multiple channels, subscribe one at a time
    for (const channel of channels) {
      const subscribeMsg = {
        type: 'subscribe',
        product_ids: channel.product_ids || ['BTC-USD'],
        channel: channel.name || channel,
        jwt: jwt
      };

      this.send(subscribeMsg);
      this.subscribedChannels.push(channel);
      logger.info('Subscribed to channel', { channel: channel.name || channel });
    }
  }

  /**
   * Unsubscribe from channels
   * @param {Array<Object>} channels - Channels to unsubscribe
   */
  async unsubscribe(channels) {
    if (!this.isConnected) {
      return;
    }

    for (const channel of channels) {
      const message = {
        type: 'unsubscribe',
        product_ids: channel.product_ids || ['BTC-USD'],
        channel: channel.name || channel
      };

      this.send(message);
      this.subscribedChannels = this.subscribedChannels.filter(
        c => (c.name || c) !== (channel.name || channel)
      );
      logger.info('Unsubscribed from channel', { channel: channel.name || channel });
    }
  }

  /**
   * Send message to WebSocket
   * @param {Object} message - Message to send
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message: WebSocket not open');
      return;
    }

    const data = JSON.stringify(message);
    this.ws.send(data);
    logger.debug('Sent message', { type: message.type });
  }

  /**
   * Handle incoming WebSocket message
   * @param {Buffer} data - Raw message data
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());
      this.resetHeartbeatMonitor();

      logger.debug('Received message', { type: message.type, channel: message.channel });

      // Route message by type and channel
      const msgType = message.type;
      const channel = message.channel;

      // Handle ticker events
      if (channel === 'ticker' && message.events) {
        for (const event of message.events) {
          if (event.tickers) {
            for (const ticker of event.tickers) {
              this.emit('ticker', {
                type: 'ticker',
                product_id: ticker.product_id,
                price: ticker.price,
                volume_24_h: ticker.volume_24_h,
                low_24_h: ticker.low_24_h,
                high_24_h: ticker.high_24_h,
                best_bid: ticker.best_bid,
                best_ask: ticker.best_ask,
                time: message.timestamp
              });
            }
          }
        }
        return;
      }

      // Handle subscriptions channel
      if (channel === 'subscriptions') {
        logger.info('Subscription confirmed', { subscriptions: message.events });
        this.emit('subscribed', message);
        return;
      }

      // Route by type
      switch (msgType) {
        case 'ticker':
          this.emit('ticker', message);
          break;

        case 'heartbeats':
          this.emit('heartbeat', message);
          break;

        case 'subscriptions':
          logger.info('Subscription confirmed', { channels: message.channels });
          this.emit('subscribed', message);
          break;

        case 'error':
          logger.error('WebSocket error message', { message: message.message });
          this.emit('error', new Error(message.message));
          break;

        case 'l2update':
        case 'level2':
          this.emit('level2', message);
          break;

        case 'match':
          this.emit('match', message);
          break;

        default:
          logger.debug('Unhandled message type', { type: msgType, channel });
          this.emit('message', message);
      }

    } catch (error) {
      logger.error('Failed to parse WebSocket message', { error: error.message });
    }
  }

  /**
   * Handle WebSocket disconnect
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  handleDisconnect(code, reason) {
    logger.warn('WebSocket disconnected', { code, reason });

    this.isConnected = false;
    this.clearHeartbeatTimeout();
    this.emit('disconnected', { code, reason });

    // Attempt reconnection if not intentional disconnect
    if (code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempts
      });
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      delay: delay
    });

    // Alert after 5 failed attempts
    if (this.reconnectAttempts === 5) {
      logger.warn('5 reconnection attempts failed');
      this.emit('reconnect_warning', { attempts: 5 });
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        // Re-subscribe to channels
        if (this.subscribedChannels.length > 0) {
          await this.subscribe(this.subscribedChannels);
        }
      } catch (error) {
        logger.error('Reconnection failed', { error: error.message });
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Start heartbeat monitor
   */
  startHeartbeatMonitor() {
    this.resetHeartbeatMonitor();
  }

  /**
   * Reset heartbeat monitor
   */
  resetHeartbeatMonitor() {
    this.clearHeartbeatTimeout();

    this.heartbeatTimeout = setTimeout(() => {
      logger.warn('Heartbeat timeout - connection may be stale');
      this.emit('heartbeat_timeout');

      // Force reconnect on stale connection
      if (this.ws) {
        this.ws.terminate();
      }
    }, HEARTBEAT_TIMEOUT);
  }

  /**
   * Clear heartbeat timeout
   */
  clearHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Generate JWT for WebSocket authentication
   * @returns {Promise<string>} JWT token
   */
  async generateWebSocketJWT() {
    try {
      // For WebSocket connections, all request details must be null
      const token = await generateJwt({
        apiKeyId: this.apiKey,
        apiKeySecret: this.apiSecret,
        expiresIn: 120
      });

      return token;
    } catch (error) {
      logger.error('Failed to generate WebSocket JWT', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  get connected() {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton factory
export function createWebSocket(options) {
  return new CoinbaseWebSocket(options);
}

export default CoinbaseWebSocket;
