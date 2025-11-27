/**
 * Telegram Bot API Client
 *
 * Provides a wrapper around the Telegram Bot API for sending notifications
 * and alerts from the trading bot.
 */

const axios = require('axios');
const logger = require('./logger');

class TelegramClient {
  /**
   * Initialize Telegram client
   * @param {string} botToken - Telegram bot token from BotFather
   * @param {string} chatId - Chat ID to send messages to
   */
  constructor(botToken, chatId) {
    if (!botToken || !chatId) {
      throw new Error('Telegram bot token and chat ID are required');
    }

    this.botToken = botToken;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.enabled = true;
  }

  /**
   * Send a message to the configured chat
   * @param {string} text - Message text (supports Markdown)
   * @param {Object} options - Message options
   * @param {string} options.parseMode - Parse mode ('Markdown' or 'HTML')
   * @param {boolean} options.silent - Send silently without notification
   * @param {boolean} options.disablePreview - Disable web page preview
   * @returns {Promise<Object>} Telegram API response
   */
  async sendMessage(text, options = {}) {
    if (!this.enabled) {
      logger.debug('Telegram notifications disabled, skipping message');
      return null;
    }

    try {
      const payload = {
        chat_id: this.chatId,
        text: text,
        parse_mode: options.parseMode || 'Markdown',
        disable_notification: options.silent || false,
        disable_web_page_preview: options.disablePreview !== false
      };

      const response = await axios.post(`${this.apiUrl}/sendMessage`, payload, {
        timeout: 10000 // 10 second timeout
      });

      logger.debug('Telegram message sent successfully', {
        message_id: response.data.result.message_id
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send Telegram message', {
        error: error.message,
        response: error.response?.data
      });

      // Don't throw - notifications should not crash the bot
      return null;
    }
  }

  /**
   * Send a message with HTML formatting
   * @param {string} text - Message text with HTML tags
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Telegram API response
   */
  async sendHTML(text, options = {}) {
    return this.sendMessage(text, { ...options, parseMode: 'HTML' });
  }

  /**
   * Send a silent notification (no sound/vibration)
   * @param {string} text - Message text
   * @param {Object} options - Message options
   * @returns {Promise<Object>} Telegram API response
   */
  async sendSilent(text, options = {}) {
    return this.sendMessage(text, { ...options, silent: true });
  }

  /**
   * Test the connection to Telegram API
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`, {
        timeout: 5000
      });

      logger.info('Telegram connection test successful', {
        bot_username: response.data.result.username
      });

      return true;
    } catch (error) {
      logger.error('Telegram connection test failed', {
        error: error.message
      });

      return false;
    }
  }

  /**
   * Enable notifications
   */
  enable() {
    this.enabled = true;
    logger.info('Telegram notifications enabled');
  }

  /**
   * Disable notifications
   */
  disable() {
    this.enabled = false;
    logger.info('Telegram notifications disabled');
  }

  /**
   * Check if notifications are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = TelegramClient;
