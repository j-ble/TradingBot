/**
 * Trading Bot Notification Manager
 *
 * Handles all notifications for the trading bot including:
 * - Trade opened/closed notifications
 * - Confluence detection alerts
 * - Emergency stop notifications
 * - Daily summary reports
 * - Win rate updates
 */

const TelegramClient = require('./telegram');
const logger = require('./logger');
const { getTelegramConfig, getTradingConfig } = require('../config');

class Notifier {
  constructor() {
    this.telegram = null;
    this.initialized = false;
  }

  /**
   * Initialize the notifier with Telegram configuration
   */
  async initialize() {
    try {
      const telegramConfig = getTelegramConfig();

      if (!telegramConfig) {
        logger.info('Telegram notifications are disabled');
        return;
      }

      this.telegram = new TelegramClient(
        telegramConfig.botToken,
        telegramConfig.chatId
      );

      // Test connection
      const connected = await this.telegram.testConnection();
      if (connected) {
        this.initialized = true;
        logger.info('Notifier initialized successfully');

        // Send startup message
        await this.sendStartupMessage();
      } else {
        logger.warn('Failed to connect to Telegram - notifications disabled');
      }
    } catch (error) {
      logger.error('Failed to initialize notifier', { error: error.message });
    }
  }

  /**
   * Send startup message
   */
  async sendStartupMessage() {
    if (!this.isReady()) return;

    const tradingConfig = getTradingConfig();

    const message = `
🤖 *Trading Bot Started*

Status: Online
Mode: ${tradingConfig.paperMode ? 'Paper Trading' : 'Live Trading'}
Account Balance: $${tradingConfig.accountBalance}
Time: ${new Date().toISOString()}

_System ready for trading_
`;

    await this.telegram.sendMessage(message.trim());
  }

  /**
   * Notify when a trade is opened
   * @param {Object} trade - Trade object
   */
  async notifyTradeOpened(trade) {
    if (!this.isReady()) return;

    const rrRatio = trade.risk_reward_ratio || 'N/A';
    const stopSource = trade.stop_loss_source || 'UNKNOWN';
    const confidence = trade.ai_confidence || 'N/A';

    const message = `
🚀 *Trade Opened*

Direction: *${trade.direction}*
Entry: $${this.formatPrice(trade.entry_price)}
Stop Loss: $${this.formatPrice(trade.stop_loss)} (${stopSource})
Take Profit: $${this.formatPrice(trade.take_profit)}
R/R Ratio: ${rrRatio}:1
Size: ${this.formatBTC(trade.position_size_btc)} BTC ($${this.formatPrice(trade.position_size_usd)})
Confidence: ${confidence}%

_Reasoning:_ ${this.truncateText(trade.ai_reasoning, 200)}

Trade ID: \`${trade.id}\`
Time: ${this.formatTime(trade.entry_time)}
`;

    await this.telegram.sendMessage(message.trim());
  }

  /**
   * Notify when a trade is closed
   * @param {Object} trade - Trade object with exit information
   */
  async notifyTradeClosed(trade) {
    if (!this.isReady()) return;

    const emoji = trade.outcome === 'WIN' ? '✅' : trade.outcome === 'LOSS' ? '❌' : '➖';
    const pnlColor = trade.pnl_usd >= 0 ? '+' : '';
    const duration = this.calculateDuration(trade.entry_time, trade.exit_time);

    const message = `
${emoji} *Trade Closed - ${trade.outcome}*

Direction: ${trade.direction}
Entry: $${this.formatPrice(trade.entry_price)}
Exit: $${this.formatPrice(trade.exit_price)}
P&L: ${pnlColor}$${this.formatPrice(trade.pnl_usd)} (${pnlColor}${this.formatPrice(trade.pnl_percent)}%)
Duration: ${duration}

Trade ID: \`${trade.id}\`
Exit Time: ${this.formatTime(trade.exit_time)}
`;

    await this.telegram.sendMessage(message.trim());

    // Get and include current win rate
    if (trade.current_win_rate !== undefined) {
      const winRateMessage = `\n_Current Win Rate: ${this.formatPrice(trade.current_win_rate)}%_`;
      await this.telegram.sendSilent(winRateMessage);
    }
  }

  /**
   * Notify when confluence is complete and ready for AI decision
   * @param {Object} confluence - Confluence state object
   */
  async notifyConfluenceComplete(confluence) {
    if (!this.isReady()) return;

    const message = `
🎯 *Confluence Complete*

Timeframe: 5M
Bias: *${confluence.bias}*
CHoCH: ✅ (${this.formatTime(confluence.choch_time)})
FVG Fill: ✅ (${this.formatTime(confluence.fvg_fill_time)})
BOS: ✅ (${this.formatTime(confluence.bos_time)})

_Waiting for AI decision..._

Sweep ID: \`${confluence.sweep_id}\`
`;

    await this.telegram.sendSilent(message.trim());
  }

  /**
   * Notify when 4H liquidity sweep is detected
   * @param {Object} sweep - Sweep data
   */
  async notify4HSweep(sweep) {
    if (!this.isReady()) return;

    const message = `
⚡ *4H Liquidity Sweep Detected*

Type: ${sweep.sweep_type} swept
Bias: *${sweep.bias}*
Price: $${this.formatPrice(sweep.price)}
Swing Level: $${this.formatPrice(sweep.swing_level)}

_5M confluence scanner activated_

Sweep ID: \`${sweep.id}\`
Time: ${this.formatTime(sweep.timestamp)}
`;

    await this.telegram.sendSilent(message.trim());
  }

  /**
   * Notify trailing stop activation
   * @param {Object} trade - Trade object
   */
  async notifyTrailingActivated(trade) {
    if (!this.isReady()) return;

    const message = `
📊 *Trailing Stop Activated*

Trade: ${trade.direction} @ $${this.formatPrice(trade.entry_price)}
Stop moved to: *Breakeven* ($${this.formatPrice(trade.entry_price)})
Progress: 80%+ to target

Trade ID: \`${trade.id}\`
`;

    await this.telegram.sendSilent(message.trim());
  }

  /**
   * Send emergency alert
   * @param {Object} alert - Alert object with type, message, action
   */
  async notifyEmergency(alert) {
    if (!this.isReady()) return;

    const message = `
🚨 *EMERGENCY ALERT*

Type: ${alert.type}
Message: ${alert.message}

Action: ${alert.action}
Time: ${this.formatTime(new Date())}
`;

    // Emergency alerts are never silent
    await this.telegram.sendMessage(message.trim());
  }

  /**
   * Send daily summary report
   * @param {Object} summary - Daily summary data
   */
  async sendDailySummary(summary) {
    if (!this.isReady()) return;

    const message = `
📈 *Daily Summary*

Date: ${summary.date}

Trades: ${summary.total_trades}
Wins: ${summary.wins} | Losses: ${summary.losses}
Win Rate: ${this.formatPrice(summary.win_rate)}%

P&L: $${this.formatPrice(summary.total_pnl)} (${this.formatPrice(summary.pnl_percent)}%)
Largest Win: $${this.formatPrice(summary.largest_win)}
Largest Loss: $${this.formatPrice(summary.largest_loss)}

Account Balance: $${this.formatPrice(summary.ending_balance)}
Change: ${summary.balance_change >= 0 ? '+' : ''}${this.formatPrice(summary.balance_change)} (${this.formatPrice(summary.balance_change_percent)}%)
`;

    await this.telegram.sendMessage(message.trim());
  }

  /**
   * Send risk management alert
   * @param {Object} alert - Risk alert data
   */
  async notifyRiskAlert(alert) {
    if (!this.isReady()) return;

    const message = `
⚠️ *Risk Management Alert*

Type: ${alert.type}
Message: ${alert.message}

${alert.action ? `Action: ${alert.action}` : ''}
Time: ${this.formatTime(new Date())}
`;

    await this.telegram.sendMessage(message.trim());
  }

  /**
   * Send AI decision notification
   * @param {Object} decision - AI decision object
   */
  async notifyAIDecision(decision) {
    if (!this.isReady()) return;

    const emoji = decision.trade_decision === 'YES' ? '✅' : '❌';

    const message = `
🤖 *AI Decision: ${emoji} ${decision.trade_decision}*

${decision.trade_decision === 'YES' ? `
Direction: *${decision.direction}*
Entry: $${this.formatPrice(decision.entry_price)}
Stop: $${this.formatPrice(decision.stop_loss)}
Target: $${this.formatPrice(decision.take_profit)}
R/R: ${decision.risk_reward_ratio}:1
Confidence: ${decision.confidence}%
` : `
Reason: ${this.truncateText(decision.reasoning, 200)}
`}
`;

    await this.telegram.sendSilent(message.trim());
  }

  /**
   * Check if notifier is ready to send messages
   * @returns {boolean}
   */
  isReady() {
    return this.initialized && this.telegram && this.telegram.isEnabled();
  }

  /**
   * Enable notifications
   */
  enable() {
    if (this.telegram) {
      this.telegram.enable();
    }
  }

  /**
   * Disable notifications
   */
  disable() {
    if (this.telegram) {
      this.telegram.disable();
    }
  }

  /**
   * Format price with 2 decimal places
   * @param {number} price
   * @returns {string}
   */
  formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    return Number(price).toFixed(2);
  }

  /**
   * Format BTC amount with 8 decimal places
   * @param {number} amount
   * @returns {string}
   */
  formatBTC(amount) {
    if (amount === null || amount === undefined) return 'N/A';
    return Number(amount).toFixed(8);
  }

  /**
   * Format timestamp to readable string
   * @param {Date|string} timestamp
   * @returns {string}
   */
  formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  /**
   * Calculate duration between two timestamps
   * @param {Date|string} start
   * @param {Date|string} end
   * @returns {string}
   */
  calculateDuration(start, end) {
    if (!start || !end) return 'N/A';

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }

    return `${hours}h ${minutes}m`;
  }

  /**
   * Truncate text to specified length
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

// Export singleton instance
module.exports = new Notifier();
