/**
 * Integration Tests for Trade Execution Engine
 *
 * Tests the complete trade execution flow including:
 * - Order placement (market, stop loss, take profit)
 * - Position monitoring
 * - Trade closure
 */

const { executeTrade, closeTrade, getOpenTrades } = require('../../../lib/trading/executor');
const { monitorPosition, monitorAllPositions } = require('../../../lib/trading/monitor');
const { CoinbaseClient } = require('../../../lib/coinbase/client');
const db = require('../../../database/connection');

// Mock Coinbase client for testing
class MockCoinbaseClient {
  constructor() {
    this.currentPrice = 90000;
    this.orders = new Map();
    this.orderIdCounter = 1;
  }

  async getCurrentPrice(productId) {
    return this.currentPrice;
  }

  async placeMarketOrder(productId, side, size) {
    const orderId = `order-${this.orderIdCounter++}`;
    const order = {
      order_id: orderId,
      client_order_id: `client-${orderId}`,
      product_id: productId,
      side: side,
      size: size,
      status: 'FILLED',
      average_filled_price: this.currentPrice,
      filled_size: size,
      completion_time: new Date().toISOString()
    };

    this.orders.set(orderId, order);
    return order;
  }

  async placeStopLossOrder(productId, side, size, stopPrice) {
    const orderId = `stop-${this.orderIdCounter++}`;
    const order = {
      order_id: orderId,
      client_order_id: `client-${orderId}`,
      product_id: productId,
      side: side,
      size: size,
      stop_price: stopPrice,
      status: 'PENDING'
    };

    this.orders.set(orderId, order);
    return order;
  }

  async placeTakeProfitOrder(productId, side, size, limitPrice) {
    const orderId = `tp-${this.orderIdCounter++}`;
    const order = {
      order_id: orderId,
      client_order_id: `client-${orderId}`,
      product_id: productId,
      side: side,
      size: size,
      limit_price: limitPrice,
      status: 'PENDING'
    };

    this.orders.set(orderId, order);
    return order;
  }

  async getOrder(orderId) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    return order;
  }

  async cancelOrder(orderId) {
    const order = this.orders.get(orderId);
    if (order) {
      order.status = 'CANCELLED';
    }
    return { result: ['success'] };
  }

  async cancelOrders(orderIds) {
    orderIds.forEach(id => {
      const order = this.orders.get(id);
      if (order) {
        order.status = 'CANCELLED';
      }
    });
    return { results: orderIds.map(() => ({ success: true })) };
  }

  async listAccounts() {
    return [
      {
        uuid: 'test-account',
        available_balance: { value: '10000' }
      }
    ];
  }

  // Helper methods for testing
  setCurrentPrice(price) {
    this.currentPrice = price;
  }

  fillStopLoss(orderId) {
    const order = this.orders.get(orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'FILLED';
      order.average_filled_price = order.stop_price;
      order.filled_size = order.size;
      order.completion_time = new Date().toISOString();
    }
  }

  fillTakeProfit(orderId) {
    const order = this.orders.get(orderId);
    if (order && order.status === 'PENDING') {
      order.status = 'FILLED';
      order.average_filled_price = order.limit_price;
      order.filled_size = order.size;
      order.completion_time = new Date().toISOString();
    }
  }
}

describe('Trade Execution Integration Tests', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = new MockCoinbaseClient();
  });

  describe('executeTrade', () => {
    test('should execute a LONG trade successfully', async () => {
      const tradeDecision = {
        confluence_id: 1,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300, // 3% stop
        take_profit: 95400, // 6% target (2:1 R/R)
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test trade execution',
        stop_loss_source: '5M_SWING'
      };

      const result = await executeTrade(tradeDecision, mockClient, db);

      expect(result.success).toBe(true);
      expect(result.trade).toBeDefined();
      expect(result.trade.status).toBe('OPEN');
      expect(result.trade.direction).toBe('LONG');
      expect(result.entryOrder).toBeDefined();
      expect(result.stopOrder).toBeDefined();
      expect(result.tpOrder).toBeDefined();
    }, 30000);

    test('should execute a SHORT trade successfully', async () => {
      const tradeDecision = {
        confluence_id: 2,
        direction: 'SHORT',
        entry_price: 90000,
        stop_loss: 92700, // 3% stop
        take_profit: 84600, // 6% target (2:1 R/R)
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 80,
        reasoning: 'Test SHORT trade execution',
        stop_loss_source: '4H_SWING'
      };

      const result = await executeTrade(tradeDecision, mockClient, db);

      expect(result.success).toBe(true);
      expect(result.trade.direction).toBe('SHORT');
      expect(result.trade.status).toBe('OPEN');
    }, 30000);

    test('should fail execution if price differs too much', async () => {
      mockClient.setCurrentPrice(91000); // 1.1% difference

      const tradeDecision = {
        confluence_id: 3,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test price validation',
        stop_loss_source: '5M_SWING'
      };

      await expect(
        executeTrade(tradeDecision, mockClient, db)
      ).rejects.toThrow();
    }, 30000);

    test('should rollback orders on execution failure', async () => {
      const tradeDecision = {
        confluence_id: 4,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 1.5, // Below 2:1 minimum
        confidence: 75,
        reasoning: 'Test rollback',
        stop_loss_source: '5M_SWING'
      };

      await expect(
        executeTrade(tradeDecision, mockClient, db)
      ).rejects.toThrow();
    }, 30000);
  });

  describe('closeTrade', () => {
    test('should close a trade manually', async () => {
      // First, execute a trade
      const tradeDecision = {
        confluence_id: 5,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test manual close',
        stop_loss_source: '5M_SWING'
      };

      const executeResult = await executeTrade(tradeDecision, mockClient, db);
      const tradeId = executeResult.trade.id;

      // Set new price
      mockClient.setCurrentPrice(92000);

      // Close the trade
      const closeResult = await closeTrade(tradeId, mockClient, db);

      expect(closeResult.trade.status).toBe('CLOSED');
      expect(closeResult.trade.exit_price).toBe(92000);
      expect(closeResult.pnl).toBeDefined();
      expect(closeResult.pnl.outcome).toBe('WIN');
    }, 30000);
  });

  describe('monitorPosition', () => {
    test('should detect stop loss hit', async () => {
      // Execute a trade
      const tradeDecision = {
        confluence_id: 6,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test stop loss',
        stop_loss_source: '5M_SWING'
      };

      const executeResult = await executeTrade(tradeDecision, mockClient, db);
      const tradeId = executeResult.trade.id;
      const stopOrderId = executeResult.stopOrder.orderId;

      // Simulate stop loss fill
      mockClient.fillStopLoss(stopOrderId);

      // Monitor position
      const monitorResult = await monitorPosition(tradeId, mockClient);

      expect(monitorResult.action).toBe('STOP_LOSS_HIT');
      expect(monitorResult.outcome).toBe('LOSS');
    }, 30000);

    test('should detect take profit hit', async () => {
      // Execute a trade
      const tradeDecision = {
        confluence_id: 7,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test take profit',
        stop_loss_source: '5M_SWING'
      };

      const executeResult = await executeTrade(tradeDecision, mockClient, db);
      const tradeId = executeResult.trade.id;
      const tpOrderId = executeResult.tpOrder.orderId;

      // Simulate take profit fill
      mockClient.fillTakeProfit(tpOrderId);

      // Monitor position
      const monitorResult = await monitorPosition(tradeId, mockClient);

      expect(monitorResult.action).toBe('TAKE_PROFIT_HIT');
      expect(monitorResult.outcome).toBe('WIN');
    }, 30000);

    test('should update P&L for open position', async () => {
      // Execute a trade
      const tradeDecision = {
        confluence_id: 8,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test P&L update',
        stop_loss_source: '5M_SWING'
      };

      const executeResult = await executeTrade(tradeDecision, mockClient, db);
      const tradeId = executeResult.trade.id;

      // Set new price (up 2%)
      mockClient.setCurrentPrice(91800);

      // Monitor position
      const monitorResult = await monitorPosition(tradeId, mockClient);

      expect(monitorResult.action).toBe('MONITORING');
      expect(monitorResult.pnl).toBeDefined();
      expect(monitorResult.pnl.usd).toBeGreaterThan(0);
      expect(monitorResult.progressToTarget).toBeGreaterThan(0);
    }, 30000);
  });

  describe('monitorAllPositions', () => {
    test('should monitor multiple open positions', async () => {
      // Execute two trades
      const trade1 = {
        confluence_id: 9,
        direction: 'LONG',
        entry_price: 90000,
        stop_loss: 87300,
        take_profit: 95400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 75,
        reasoning: 'Test multiple positions 1',
        stop_loss_source: '5M_SWING'
      };

      await executeTrade(trade1, mockClient, db);

      // Set price for second trade
      mockClient.setCurrentPrice(91000);

      const trade2 = {
        confluence_id: 10,
        direction: 'SHORT',
        entry_price: 91000,
        stop_loss: 93730,
        take_profit: 85400,
        position_size_btc: 0.037,
        risk_reward_ratio: 2.0,
        confidence: 80,
        reasoning: 'Test multiple positions 2',
        stop_loss_source: '4H_SWING'
      };

      await executeTrade(trade2, mockClient, db);

      // Monitor all positions
      const results = await monitorAllPositions(mockClient);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBeDefined();
      expect(results[1].action).toBeDefined();
    }, 30000);
  });
});

// Note: These are integration tests that require:
// 1. A test database (or mocked database queries)
// 2. Mock Coinbase client (provided above)
// 3. Jest or similar test framework
//
// To run these tests:
// npm test tests/integration/trading/execution.test.js
