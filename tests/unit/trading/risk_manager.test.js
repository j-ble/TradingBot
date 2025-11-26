/**
 * Risk Manager Tests
 *
 * Comprehensive unit tests for risk management and position sizing
 */

const {
  calculatePositionSize,
  validateRiskReward,
  calculateTakeProfit,
  validatePositionSize
} = require('../../../lib/trading/position_sizer');

const {
  RISK_LIMITS,
  getRiskLimits,
  checkAccountBalance,
  validateStopLoss,
  checkPositionLimit,
  checkDailyLossLimit,
  checkConsecutiveLosses,
  getAccountMetrics,
  shouldPauseTrading,
  validateTrade
} = require('../../../lib/trading/risk_manager');

// Mock database
const createMockDb = (queryResults = {}) => {
  return {
    query: jest.fn((sql) => {
      // Return appropriate mock data based on query
      if (sql.includes('COUNT(*) as open_positions')) {
        return Promise.resolve({
          rows: [{ open_positions: queryResults.openPositions || '0' }]
        });
      }
      if (sql.includes('daily_pnl')) {
        return Promise.resolve({
          rows: [{ daily_pnl: queryResults.dailyPnl || '0' }]
        });
      }
      if (sql.includes('outcome')) {
        return Promise.resolve({
          rows: queryResults.outcomes || []
        });
      }
      if (sql.includes('wins')) {
        return Promise.resolve({
          rows: [{
            wins: queryResults.wins || '0',
            total_trades: queryResults.totalTrades || '0'
          }]
        });
      }
      if (sql.includes('today_pnl')) {
        return Promise.resolve({
          rows: [{ today_pnl: queryResults.todayPnl || '0' }]
        });
      }
      return Promise.resolve({ rows: [] });
    })
  };
};

// Mock Coinbase client
const createMockCoinbaseClient = (shouldFail = false) => {
  return {
    listAccounts: jest.fn(() => {
      if (shouldFail) {
        return Promise.reject(new Error('API connection failed'));
      }
      return Promise.resolve([{ id: '123', balance: 10000 }]);
    })
  };
};

describe('Position Sizer', () => {
  describe('calculatePositionSize', () => {
    test('calculates correct position size for LONG trade', () => {
      // Balance: $10,000, Entry: $90,000, Stop: $87,300 (3% away)
      const result = calculatePositionSize(10000, 90000, 87300);

      expect(result.riskAmount).toBe(100); // 1% of $10,000
      expect(result.stopDistance).toBe(2700); // $90,000 - $87,300
      expect(result.stopDistancePercent).toBeCloseTo(3.0, 1);
      expect(result.btc).toBeCloseTo(0.037, 3); // $100 / $2,700
      expect(result.usd).toBeCloseTo(3333.33, 0); // 0.037 * $90,000
    });

    test('calculates correct position size for SHORT trade', () => {
      // Balance: $5,000, Entry: $90,000, Stop: $91,800 (2% away)
      const result = calculatePositionSize(5000, 90000, 91800);

      expect(result.riskAmount).toBe(50); // 1% of $5,000
      expect(result.stopDistance).toBe(1800); // $91,800 - $90,000
      expect(result.stopDistancePercent).toBeCloseTo(2.0, 1);
      expect(result.btc).toBeCloseTo(0.0278, 3); // $50 / $1,800
    });

    test('throws error for invalid account balance', () => {
      expect(() => calculatePositionSize(0, 90000, 87300)).toThrow('Invalid account balance');
      expect(() => calculatePositionSize(-1000, 90000, 87300)).toThrow('Invalid account balance');
    });

    test('throws error for invalid entry price', () => {
      expect(() => calculatePositionSize(10000, 0, 87300)).toThrow('Invalid entry price');
      expect(() => calculatePositionSize(10000, -90000, 87300)).toThrow('Invalid entry price');
    });

    test('throws error when stop equals entry', () => {
      expect(() => calculatePositionSize(10000, 90000, 90000)).toThrow('Stop loss cannot equal entry price');
    });
  });

  describe('validateRiskReward', () => {
    test('validates 2:1 R/R ratio for LONG trade', () => {
      const result = validateRiskReward(90000, 87300, 95400, 'LONG');

      expect(result.valid).toBe(true);
      expect(result.ratio).toBeCloseTo(2.0, 1);
      expect(result.stopDistance).toBe(2700);
      expect(result.targetDistance).toBe(5400);
    });

    test('validates 3:1 R/R ratio for SHORT trade', () => {
      const result = validateRiskReward(90000, 91800, 84600, 'SHORT');

      expect(result.valid).toBe(true);
      expect(result.ratio).toBeCloseTo(3.0, 1);
    });

    test('rejects R/R ratio below 2:1', () => {
      const result = validateRiskReward(90000, 87300, 92500, 'LONG');

      expect(result.valid).toBe(false);
      expect(result.ratio).toBeLessThan(2.0);
    });

    test('calculates minimum target for 2:1 R/R', () => {
      const result = validateRiskReward(90000, 87300, 92500, 'LONG');

      expect(result.minTarget).toBe(95400); // 90000 + (2700 * 2)
    });

    test('throws error for invalid direction', () => {
      expect(() => validateRiskReward(90000, 87300, 95400, 'INVALID')).toThrow('Direction must be LONG or SHORT');
    });
  });

  describe('calculateTakeProfit', () => {
    test('calculates take profit for LONG with 2:1 R/R', () => {
      const takeProfit = calculateTakeProfit(90000, 87300, 'LONG', 2.0);

      expect(takeProfit).toBe(95400); // 90000 + (2700 * 2)
    });

    test('calculates take profit for SHORT with 3:1 R/R', () => {
      const takeProfit = calculateTakeProfit(90000, 91800, 'SHORT', 3.0);

      expect(takeProfit).toBe(84600); // 90000 - (1800 * 3)
    });

    test('throws error for R/R below 2:1', () => {
      expect(() => calculateTakeProfit(90000, 87300, 'LONG', 1.5)).toThrow('R/R ratio must be at least 2:1');
    });
  });

  describe('validatePositionSize', () => {
    test('validates correct position parameters for LONG', () => {
      const result = validatePositionSize({
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 87300,
        direction: 'LONG'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects stop loss above entry for LONG', () => {
      const result = validatePositionSize({
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 92000,
        direction: 'LONG'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop loss must be below entry price for LONG positions');
    });

    test('rejects stop loss below entry for SHORT', () => {
      const result = validatePositionSize({
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 88000,
        direction: 'SHORT'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop loss must be above entry price for SHORT positions');
    });

    test('rejects stop distance below 0.5%', () => {
      const result = validatePositionSize({
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 89700, // 0.33% away
        direction: 'LONG'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('outside acceptable range'))).toBe(true);
    });

    test('rejects stop distance above 3%', () => {
      const result = validatePositionSize({
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 86000, // 4.44% away
        direction: 'LONG'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('outside acceptable range'))).toBe(true);
    });

    test('rejects account balance below $100', () => {
      const result = validatePositionSize({
        accountBalance: 50,
        entryPrice: 90000,
        stopLoss: 87300,
        direction: 'LONG'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Account balance must be at least $100');
    });
  });
});

describe('Risk Manager', () => {
  describe('getRiskLimits', () => {
    test('returns risk limits configuration', () => {
      const limits = getRiskLimits();

      expect(limits.MAX_POSITIONS).toBe(1);
      expect(limits.RISK_PER_TRADE).toBe(0.01);
      expect(limits.DAILY_LOSS_LIMIT).toBe(0.03);
      expect(limits.CONSECUTIVE_LOSS_LIMIT).toBe(3);
      expect(limits.MIN_ACCOUNT_BALANCE).toBe(100);
      expect(limits.MIN_RR_RATIO).toBe(2.0);
    });
  });

  describe('checkAccountBalance', () => {
    test('approves sufficient balance', () => {
      expect(checkAccountBalance(10000)).toBe(true);
      expect(checkAccountBalance(100)).toBe(true);
    });

    test('rejects insufficient balance', () => {
      expect(checkAccountBalance(99)).toBe(false);
      expect(checkAccountBalance(50)).toBe(false);
    });
  });

  describe('validateStopLoss', () => {
    test('validates correct stop loss for LONG', () => {
      const result = validateStopLoss({
        entryPrice: 90000,
        stopLoss: 87300,
        direction: 'LONG'
      });

      expect(result).toBe(true);
    });

    test('validates correct stop loss for SHORT', () => {
      const result = validateStopLoss({
        entryPrice: 90000,
        stopLoss: 91800,
        direction: 'SHORT'
      });

      expect(result).toBe(true);
    });

    test('rejects stop loss on wrong side for LONG', () => {
      const result = validateStopLoss({
        entryPrice: 90000,
        stopLoss: 92000,
        direction: 'LONG'
      });

      expect(result).toBe(false);
    });

    test('rejects stop loss too close', () => {
      const result = validateStopLoss({
        entryPrice: 90000,
        stopLoss: 89800, // 0.22% away
        direction: 'LONG'
      });

      expect(result).toBe(false);
    });

    test('rejects stop loss too far', () => {
      const result = validateStopLoss({
        entryPrice: 90000,
        stopLoss: 86000, // 4.44% away
        direction: 'LONG'
      });

      expect(result).toBe(false);
    });
  });

  describe('checkPositionLimit', () => {
    test('approves when no open positions', async () => {
      const db = createMockDb({ openPositions: '0' });
      const result = await checkPositionLimit(db);

      expect(result).toBe(true);
    });

    test('rejects when position limit reached', async () => {
      const db = createMockDb({ openPositions: '1' });
      const result = await checkPositionLimit(db);

      expect(result).toBe(false);
    });
  });

  describe('checkDailyLossLimit', () => {
    test('approves when within daily loss limit', async () => {
      const db = createMockDb({ dailyPnl: '-200' }); // -$200 loss
      const result = await checkDailyLossLimit(db, 10000); // Max loss: $300

      expect(result).toBe(true);
    });

    test('rejects when daily loss limit exceeded', async () => {
      const db = createMockDb({ dailyPnl: '-350' }); // -$350 loss
      const result = await checkDailyLossLimit(db, 10000); // Max loss: $300

      expect(result).toBe(false);
    });

    test('approves positive P&L day', async () => {
      const db = createMockDb({ dailyPnl: '500' });
      const result = await checkDailyLossLimit(db, 10000);

      expect(result).toBe(true);
    });
  });

  describe('checkConsecutiveLosses', () => {
    test('approves with no consecutive losses', async () => {
      const db = createMockDb({
        outcomes: [
          { outcome: 'WIN' },
          { outcome: 'LOSS' },
          { outcome: 'WIN' }
        ]
      });

      const result = await checkConsecutiveLosses(db);
      expect(result).toBe(true);
    });

    test('approves with 2 consecutive losses', async () => {
      const db = createMockDb({
        outcomes: [
          { outcome: 'LOSS' },
          { outcome: 'LOSS' },
          { outcome: 'WIN' }
        ]
      });

      const result = await checkConsecutiveLosses(db);
      expect(result).toBe(true);
    });

    test('rejects with 3 consecutive losses', async () => {
      const db = createMockDb({
        outcomes: [
          { outcome: 'LOSS' },
          { outcome: 'LOSS' },
          { outcome: 'LOSS' }
        ]
      });

      const result = await checkConsecutiveLosses(db);
      expect(result).toBe(false);
    });
  });

  describe('getAccountMetrics', () => {
    test('calculates account metrics correctly', async () => {
      const db = createMockDb({
        openPositions: '1',
        todayPnl: '-150',
        outcomes: [
          { outcome: 'LOSS' },
          { outcome: 'LOSS' }
        ],
        wins: '8',
        totalTrades: '10'
      });

      const metrics = await getAccountMetrics(db, 10000);

      expect(metrics.accountBalance).toBe(10000);
      expect(metrics.openPositions).toBe(1);
      expect(metrics.todayPnL).toBe(-150);
      expect(metrics.consecutiveLosses).toBe(2);
      expect(metrics.winRate).toBe('80.00');
      expect(metrics.maxDailyLoss).toBe(300); // 3% of $10,000
    });
  });

  describe('shouldPauseTrading', () => {
    test('does not pause with good metrics', async () => {
      const db = createMockDb({
        openPositions: '0',
        todayPnl: '100',
        outcomes: [{ outcome: 'WIN' }],
        wins: '9',
        totalTrades: '10'
      });

      const result = await shouldPauseTrading(db, 10000);

      expect(result.shouldPause).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    test('pauses on daily loss limit', async () => {
      const db = createMockDb({
        openPositions: '0',
        todayPnl: '-350',
        outcomes: [],
        wins: '0',
        totalTrades: '0'
      });

      const result = await shouldPauseTrading(db, 10000);

      expect(result.shouldPause).toBe(true);
      expect(result.reasons).toContain('Daily loss limit exceeded');
    });

    test('pauses on 3 consecutive losses', async () => {
      const db = createMockDb({
        openPositions: '0',
        todayPnl: '0',
        outcomes: [
          { outcome: 'LOSS' },
          { outcome: 'LOSS' },
          { outcome: 'LOSS' }
        ],
        wins: '0',
        totalTrades: '3'
      });

      const result = await shouldPauseTrading(db, 10000);

      expect(result.shouldPause).toBe(true);
      expect(result.reasons).toContain('3 consecutive losses');
    });

    test('pauses on low account balance', async () => {
      const db = createMockDb({
        openPositions: '0',
        todayPnl: '0',
        outcomes: [],
        wins: '0',
        totalTrades: '0'
      });

      const result = await shouldPauseTrading(db, 50);

      expect(result.shouldPause).toBe(true);
      expect(result.reasons).toContain('Account balance below minimum');
    });
  });

  describe('validateTrade', () => {
    test('approves valid trade', async () => {
      const db = createMockDb({
        openPositions: '0',
        dailyPnl: '0',
        outcomes: [],
        wins: '5',
        totalTrades: '5'
      });

      const coinbase = createMockCoinbaseClient();

      const tradeParams = {
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 87300,
        takeProfit: 95400,
        direction: 'LONG'
      };

      const result = await validateTrade(tradeParams, db, coinbase);

      expect(result.approved).toBe(true);
      expect(result.failedChecks).toHaveLength(0);
    });

    test('rejects trade with failed checks', async () => {
      const db = createMockDb({
        openPositions: '1', // Position limit reached
        dailyPnl: '-350', // Daily loss exceeded
        outcomes: [
          { outcome: 'LOSS' },
          { outcome: 'LOSS' },
          { outcome: 'LOSS' }
        ],
        wins: '0',
        totalTrades: '3'
      });

      const coinbase = createMockCoinbaseClient();

      const tradeParams = {
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 92000, // Wrong side for LONG
        takeProfit: 91000, // R/R < 2:1
        direction: 'LONG'
      };

      const result = await validateTrade(tradeParams, db, coinbase);

      expect(result.approved).toBe(false);
      expect(result.failedChecks.length).toBeGreaterThan(0);
    });

    test('rejects trade when API disconnected', async () => {
      const db = createMockDb({
        openPositions: '0',
        dailyPnl: '0',
        outcomes: [],
        wins: '0',
        totalTrades: '0'
      });

      const coinbase = createMockCoinbaseClient(true); // API fails

      const tradeParams = {
        accountBalance: 10000,
        entryPrice: 90000,
        stopLoss: 87300,
        takeProfit: 95400,
        direction: 'LONG'
      };

      const result = await validateTrade(tradeParams, db, coinbase);

      expect(result.approved).toBe(false);
      expect(result.failedChecks).toContain('apiConnected');
    });
  });
});
