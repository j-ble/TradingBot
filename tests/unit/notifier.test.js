/**
 * Unit tests for Telegram Notifier
 *
 * Tests all notification types and message formatting
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const notifier = require('../../lib/utils/notifier');
const TelegramClient = require('../../lib/utils/telegram');

// Mock Telegram client
class MockTelegramClient {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.messages = [];
    this.enabled = true;
  }

  async sendMessage(text, options = {}) {
    this.messages.push({ text, options, type: 'message' });
    return { ok: true, result: { message_id: this.messages.length } };
  }

  async sendSilent(text, options = {}) {
    this.messages.push({ text, options: { ...options, silent: true }, type: 'silent' });
    return { ok: true, result: { message_id: this.messages.length } };
  }

  async testConnection() {
    return true;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }

  clearMessages() {
    this.messages = [];
  }

  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
}

describe('Notifier', () => {
  let mockTelegram;

  beforeEach(() => {
    mockTelegram = new MockTelegramClient('test-token', 'test-chat-id');
    notifier.telegram = mockTelegram;
    notifier.initialized = true;
  });

  afterEach(() => {
    mockTelegram.clearMessages();
  });

  describe('Trade Opened Notification', () => {
    it('should send trade opened notification with all details', async () => {
      const trade = {
        id: 'trade-123',
        direction: 'LONG',
        entry_price: 90000.50,
        stop_loss: 87300.00,
        stop_loss_source: '5M_SWING',
        take_profit: 95400.00,
        risk_reward_ratio: 2.0,
        position_size_btc: 0.037,
        position_size_usd: 3330.00,
        ai_confidence: 85,
        ai_reasoning: 'Strong confluence with clean 5M structure after 4H low sweep',
        entry_time: new Date('2024-01-01T12:00:00Z')
      };

      await notifier.notifyTradeOpened(trade);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /🚀 \*Trade Opened\*/);
      assert.match(message.text, /Direction: \*LONG\*/);
      assert.match(message.text, /Entry: \$90000\.50/);
      assert.match(message.text, /Stop Loss: \$87300\.00 \(5M_SWING\)/);
      assert.match(message.text, /Take Profit: \$95400\.00/);
      assert.match(message.text, /R\/R Ratio: 2:1/);
      assert.match(message.text, /Size: 0\.03700000 BTC/);
      assert.match(message.text, /Confidence: 85%/);
      assert.match(message.text, /Trade ID: `trade-123`/);
    });

    it('should handle missing optional fields', async () => {
      const trade = {
        id: 'trade-456',
        direction: 'SHORT',
        entry_price: 90000,
        stop_loss: 92700,
        take_profit: 84600,
        position_size_btc: 0.05,
        position_size_usd: 4500,
        entry_time: new Date()
      };

      await notifier.notifyTradeOpened(trade);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /R\/R Ratio: N\/A:1/);
      assert.match(message.text, /\(UNKNOWN\)/);
      assert.match(message.text, /Confidence: N\/A%/);
    });
  });

  describe('Trade Closed Notification', () => {
    it('should send WIN notification with correct emoji', async () => {
      const trade = {
        id: 'trade-789',
        direction: 'LONG',
        entry_price: 90000,
        exit_price: 95400,
        outcome: 'WIN',
        pnl_usd: 200,
        pnl_percent: 2.0,
        entry_time: new Date('2024-01-01T12:00:00Z'),
        exit_time: new Date('2024-01-01T18:30:00Z')
      };

      await notifier.notifyTradeClosed(trade);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /✅ \*Trade Closed - WIN\*/);
      assert.match(message.text, /P&L: \+\$200\.00 \(\+2\.00%\)/);
      assert.match(message.text, /Duration: 6h 30m/);
    });

    it('should send LOSS notification with correct emoji', async () => {
      const trade = {
        id: 'trade-101',
        direction: 'SHORT',
        entry_price: 90000,
        exit_price: 92700,
        outcome: 'LOSS',
        pnl_usd: -100,
        pnl_percent: -1.0,
        entry_time: new Date('2024-01-01T12:00:00Z'),
        exit_time: new Date('2024-01-01T14:15:00Z')
      };

      await notifier.notifyTradeClosed(trade);

      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /❌ \*Trade Closed - LOSS\*/);
      assert.match(message.text, /P&L: -\$100\.00 \(-1\.00%\)/);
      assert.match(message.text, /Duration: 2h 15m/);
    });

    it('should include win rate if provided', async () => {
      const trade = {
        id: 'trade-102',
        direction: 'LONG',
        entry_price: 90000,
        exit_price: 95400,
        outcome: 'WIN',
        pnl_usd: 200,
        pnl_percent: 2.0,
        current_win_rate: 87.5,
        entry_time: new Date(),
        exit_time: new Date()
      };

      await notifier.notifyTradeClosed(trade);

      assert.strictEqual(mockTelegram.messages.length, 2);
      const winRateMsg = mockTelegram.messages[1];
      assert.match(winRateMsg.text, /Current Win Rate: 87\.50%/);
      assert.strictEqual(winRateMsg.type, 'silent');
    });
  });

  describe('Confluence Complete Notification', () => {
    it('should send confluence complete notification', async () => {
      const confluence = {
        sweep_id: 'sweep-555',
        bias: 'BULLISH',
        choch_time: new Date('2024-01-01T12:00:00Z'),
        fvg_fill_time: new Date('2024-01-01T12:15:00Z'),
        bos_time: new Date('2024-01-01T12:30:00Z')
      };

      await notifier.notifyConfluenceComplete(confluence);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /🎯 \*Confluence Complete\*/);
      assert.match(message.text, /Bias: \*BULLISH\*/);
      assert.match(message.text, /CHoCH: ✅/);
      assert.match(message.text, /FVG Fill: ✅/);
      assert.match(message.text, /BOS: ✅/);
      assert.match(message.text, /Waiting for AI decision\.\.\./);
      assert.strictEqual(message.type, 'silent');
    });
  });

  describe('4H Sweep Notification', () => {
    it('should send 4H sweep notification', async () => {
      const sweep = {
        id: 'sweep-777',
        sweep_type: 'LOW',
        bias: 'BULLISH',
        price: 88500.00,
        swing_level: 88450.00,
        timestamp: new Date('2024-01-01T12:00:00Z')
      };

      await notifier.notify4HSweep(sweep);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /⚡ \*4H Liquidity Sweep Detected\*/);
      assert.match(message.text, /Type: LOW swept/);
      assert.match(message.text, /Bias: \*BULLISH\*/);
      assert.match(message.text, /Price: \$88500\.00/);
      assert.strictEqual(message.type, 'silent');
    });
  });

  describe('Emergency Alert', () => {
    it('should send emergency alert (not silent)', async () => {
      const alert = {
        type: 'EMERGENCY_STOP',
        message: 'API connection lost',
        action: 'All positions closed, trading stopped'
      };

      await notifier.notifyEmergency(alert);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /🚨 \*EMERGENCY ALERT\*/);
      assert.match(message.text, /Type: EMERGENCY_STOP/);
      assert.match(message.text, /Message: API connection lost/);
      assert.match(message.text, /Action: All positions closed/);
      assert.strictEqual(message.type, 'message'); // Not silent
    });
  });

  describe('Daily Summary', () => {
    it('should send daily summary report', async () => {
      const summary = {
        date: '2024-01-01',
        total_trades: 10,
        wins: 9,
        losses: 1,
        win_rate: 90.0,
        total_pnl: 1500,
        pnl_percent: 15.0,
        largest_win: 500,
        largest_loss: -100,
        ending_balance: 11500,
        balance_change: 1500,
        balance_change_percent: 15.0
      };

      await notifier.sendDailySummary(summary);

      assert.strictEqual(mockTelegram.messages.length, 1);
      const message = mockTelegram.getLastMessage();

      assert.match(message.text, /📈 \*Daily Summary\*/);
      assert.match(message.text, /Trades: 10/);
      assert.match(message.text, /Wins: 9 \| Losses: 1/);
      assert.match(message.text, /Win Rate: 90\.00%/);
      assert.match(message.text, /P&L: \$1500\.00/);
      assert.match(message.text, /Account Balance: \$11500\.00/);
    });
  });

  describe('Utility Functions', () => {
    it('should format prices correctly', () => {
      assert.strictEqual(notifier.formatPrice(90000.123), '90000.12');
      assert.strictEqual(notifier.formatPrice(0.5), '0.50');
      assert.strictEqual(notifier.formatPrice(null), 'N/A');
    });

    it('should format BTC amounts correctly', () => {
      assert.strictEqual(notifier.formatBTC(0.12345678), '0.12345678');
      assert.strictEqual(notifier.formatBTC(1.1), '1.10000000');
      assert.strictEqual(notifier.formatBTC(null), 'N/A');
    });

    it('should calculate duration correctly', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2024-01-01T14:30:00Z');

      assert.strictEqual(notifier.calculateDuration(start, end), '2h 30m');
    });

    it('should calculate duration over 24 hours', () => {
      const start = new Date('2024-01-01T12:00:00Z');
      const end = new Date('2024-01-03T14:00:00Z');

      assert.strictEqual(notifier.calculateDuration(start, end), '2d 2h');
    });

    it('should truncate long text', () => {
      const longText = 'A'.repeat(300);
      const truncated = notifier.truncateText(longText, 100);

      assert.strictEqual(truncated.length, 100);
      assert.match(truncated, /\.\.\.$/);
    });

    it('should not truncate short text', () => {
      const shortText = 'Short message';
      const result = notifier.truncateText(shortText, 100);

      assert.strictEqual(result, shortText);
    });
  });

  describe('Notifier State', () => {
    it('should report ready when initialized', () => {
      assert.strictEqual(notifier.isReady(), true);
    });

    it('should not send messages when not ready', async () => {
      notifier.initialized = false;

      const trade = {
        id: 'test',
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        position_size_usd: 3330,
        entry_time: new Date()
      };

      await notifier.notifyTradeOpened(trade);

      // Should not send message
      assert.strictEqual(mockTelegram.messages.length, 0);

      // Reset
      notifier.initialized = true;
    });

    it('should enable/disable notifications', () => {
      notifier.disable();
      assert.strictEqual(mockTelegram.isEnabled(), false);

      notifier.enable();
      assert.strictEqual(mockTelegram.isEnabled(), true);
    });
  });
});

describe('TelegramClient', () => {
  it('should throw error if bot token or chat ID missing', () => {
    assert.throws(() => {
      new TelegramClient(null, 'chat-id');
    }, /bot token and chat ID are required/);

    assert.throws(() => {
      new TelegramClient('token', null);
    }, /bot token and chat ID are required/);
  });

  it('should construct API URL correctly', () => {
    const client = new TelegramClient('test-token-123', 'chat-456');
    assert.strictEqual(client.apiUrl, 'https://api.telegram.org/bottest-token-123');
  });

  it('should be enabled by default', () => {
    const client = new TelegramClient('token', 'chat');
    assert.strictEqual(client.isEnabled(), true);
  });

  it('should disable/enable correctly', () => {
    const client = new TelegramClient('token', 'chat');

    client.disable();
    assert.strictEqual(client.isEnabled(), false);

    client.enable();
    assert.strictEqual(client.isEnabled(), true);
  });
});
