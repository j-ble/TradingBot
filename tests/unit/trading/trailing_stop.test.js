/**
 * Trailing Stop Tests
 * Unit tests for trailing stop loss functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkTrailingStop,
  calculateProgressToTarget,
  calculateTrailingStopPrice,
  validateTrailingStop,
  getTrailingStopStatus,
  calculateProfitProtection
} from '../../../lib/trading/trailing_stop.js';

describe('Trailing Stop Module', () => {
  let mockTradeLong;
  let mockTradeShort;

  beforeEach(() => {
    // Mock LONG trade
    mockTradeLong = {
      id: 1,
      direction: 'LONG',
      entry_price: 90000,
      stop_loss: 87300, // 3% below entry
      take_profit: 95400, // 6% above entry (2:1 R/R)
      position_size_btc: 0.01,
      trailing_stop_activated: false,
      trailing_stop_price: null
    };

    // Mock SHORT trade
    mockTradeShort = {
      id: 2,
      direction: 'SHORT',
      entry_price: 90000,
      stop_loss: 92700, // 3% above entry
      take_profit: 84600, // 6% below entry (2:1 R/R)
      position_size_btc: 0.01,
      trailing_stop_activated: false,
      trailing_stop_price: null
    };
  });

  describe('calculateProgressToTarget', () => {
    it('should calculate 0% progress when price equals entry (LONG)', () => {
      const currentPrice = 90000;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(0);
    });

    it('should calculate 50% progress when halfway to target (LONG)', () => {
      // Entry: 90000, Target: 95400 (difference: 5400)
      // Halfway: 90000 + 2700 = 92700
      const currentPrice = 92700;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBeCloseTo(50, 1);
    });

    it('should calculate 80% progress at trailing threshold (LONG)', () => {
      // Entry: 90000, Target: 95400 (difference: 5400)
      // 80%: 90000 + (5400 * 0.8) = 94320
      const currentPrice = 94320;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBeCloseTo(80, 1);
    });

    it('should calculate 100% progress when at target (LONG)', () => {
      const currentPrice = 95400;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(100);
    });

    it('should cap progress at 100% even if price exceeds target (LONG)', () => {
      const currentPrice = 96000; // Beyond target
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(100);
    });

    it('should return 0% when price is below entry (losing LONG)', () => {
      const currentPrice = 89000; // Below entry
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(0);
    });

    it('should calculate 80% progress for SHORT trade', () => {
      // Entry: 90000, Target: 84600 (difference: 5400)
      // 80%: 90000 - (5400 * 0.8) = 85680
      const currentPrice = 85680;
      const result = calculateProgressToTarget(mockTradeShort, currentPrice);

      expect(result).toBeCloseTo(80, 1);
    });

    it('should return 0% when SHORT price is above entry', () => {
      const currentPrice = 91000;
      const result = calculateProgressToTarget(mockTradeShort, currentPrice);

      expect(result).toBe(0);
    });
  });

  describe('checkTrailingStop', () => {
    it('should recommend activation when progress >= 80%', () => {
      const currentPrice = 94320; // 80% to target
      const result = checkTrailingStop(mockTradeLong, currentPrice);

      expect(result.shouldActivate).toBe(true);
      expect(result.reason).toBe('THRESHOLD_REACHED');
      expect(result.progress).toBeGreaterThanOrEqual(80);
      expect(result.newStopPrice).toBe(90000); // Breakeven
    });

    it('should NOT activate when progress < 80%', () => {
      const currentPrice = 92700; // 50% to target
      const result = checkTrailingStop(mockTradeLong, currentPrice);

      expect(result.shouldActivate).toBe(false);
      expect(result.reason).toBe('THRESHOLD_NOT_REACHED');
      expect(result.progress).toBeLessThan(80);
    });

    it('should NOT activate if already activated', () => {
      const activatedTrade = {
        ...mockTradeLong,
        trailing_stop_activated: true,
        trailing_stop_price: 90000
      };

      const currentPrice = 94320;
      const result = checkTrailingStop(activatedTrade, currentPrice);

      expect(result.shouldActivate).toBe(false);
      expect(result.reason).toBe('ALREADY_ACTIVATED');
      expect(result.currentStop).toBe(90000);
    });

    it('should activate for SHORT trade at 80%', () => {
      const currentPrice = 85680; // 80% to target
      const result = checkTrailingStop(mockTradeShort, currentPrice);

      expect(result.shouldActivate).toBe(true);
      expect(result.newStopPrice).toBe(90000); // Breakeven
    });
  });

  describe('calculateTrailingStopPrice', () => {
    it('should calculate breakeven stop by default', () => {
      const currentPrice = 94320;
      const result = calculateTrailingStopPrice(mockTradeLong, currentPrice);

      expect(result.price).toBe(90000); // Entry price
      expect(result.strategy).toBe('BREAKEVEN');
      expect(result.previousStop).toBe(87300);
    });

    it('should calculate stop with buffer for LONG', () => {
      const currentPrice = 94320;
      const options = {
        strategy: 'BREAKEVEN_PLUS_BUFFER',
        buffer: 0.001 // 0.1%
      };

      const result = calculateTrailingStopPrice(mockTradeLong, currentPrice, options);

      expect(result.price).toBeCloseTo(90090, 2); // 90000 * 1.001
      expect(result.strategy).toBe('BREAKEVEN_PLUS_BUFFER');
    });

    it('should calculate stop with buffer for SHORT', () => {
      const currentPrice = 85680;
      const options = {
        strategy: 'BREAKEVEN_PLUS_BUFFER',
        buffer: 0.001 // 0.1%
      };

      const result = calculateTrailingStopPrice(mockTradeShort, currentPrice, options);

      expect(result.price).toBeCloseTo(89910, 2); // 90000 * 0.999
      expect(result.strategy).toBe('BREAKEVEN_PLUS_BUFFER');
    });

    it('should calculate dynamic stop locking 50% profit (LONG)', () => {
      const currentPrice = 94320; // 4320 profit
      const options = {
        strategy: 'DYNAMIC',
        lockInPercent: 0.5 // Lock in 50% of profit
      };

      const result = calculateTrailingStopPrice(mockTradeLong, currentPrice, options);

      // Unrealized profit: 4320
      // Lock in 50%: 2160
      // New stop: 90000 + 2160 = 92160
      expect(result.price).toBeCloseTo(92160, 2);
      expect(result.strategy).toBe('DYNAMIC');
    });

    it('should calculate dynamic stop locking 50% profit (SHORT)', () => {
      const currentPrice = 85680; // 4320 profit
      const options = {
        strategy: 'DYNAMIC',
        lockInPercent: 0.5
      };

      const result = calculateTrailingStopPrice(mockTradeShort, currentPrice, options);

      // Unrealized profit: 4320
      // Lock in 50%: 2160
      // New stop: 90000 - 2160 = 87840
      expect(result.price).toBeCloseTo(87840, 2);
    });

    it('should calculate improvement metrics', () => {
      const currentPrice = 94320;
      const result = calculateTrailingStopPrice(mockTradeLong, currentPrice);

      expect(result.improvement).toBeCloseTo(2700, 2); // 90000 - 87300
      expect(result.improvementPercent).toBeCloseTo(3.0, 2); // 2700 / 90000 * 100
    });
  });

  describe('validateTrailingStop', () => {
    it('should validate LONG trailing stop at breakeven', () => {
      const newStopPrice = 90000; // Entry price
      const result = validateTrailingStop(mockTradeLong, newStopPrice);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate SHORT trailing stop at breakeven', () => {
      const newStopPrice = 90000;
      const result = validateTrailingStop(mockTradeShort, newStopPrice);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject LONG stop below current stop', () => {
      const newStopPrice = 87000; // Worse than current 87300
      const result = validateTrailingStop(mockTradeLong, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('New stop must be higher than current stop for LONG');
    });

    it('should reject SHORT stop above current stop', () => {
      const newStopPrice = 93000; // Worse than current 92700
      const result = validateTrailingStop(mockTradeShort, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('New stop must be lower than current stop for SHORT');
    });

    it('should reject LONG stop too far below entry', () => {
      const newStopPrice = 89000; // More than 0.5% below entry
      const result = validateTrailingStop(mockTradeLong, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop should be at or above entry for trailing LONG');
    });

    it('should reject SHORT stop too far above entry', () => {
      const newStopPrice = 91000; // More than 0.5% above entry
      const result = validateTrailingStop(mockTradeShort, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop should be at or below entry for trailing SHORT');
    });

    it('should reject LONG stop above current price', () => {
      const tradeWithCurrentPrice = {
        ...mockTradeLong,
        current_price: 92000
      };

      const newStopPrice = 92500; // Above current price
      const result = validateTrailingStop(tradeWithCurrentPrice, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop cannot be above current price for LONG');
    });

    it('should reject SHORT stop below current price', () => {
      const tradeWithCurrentPrice = {
        ...mockTradeShort,
        current_price: 88000
      };

      const newStopPrice = 87000; // Below current price
      const result = validateTrailingStop(tradeWithCurrentPrice, newStopPrice);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Stop cannot be below current price for SHORT');
    });
  });

  describe('getTrailingStopStatus', () => {
    it('should return status for inactive trailing stop', () => {
      const currentPrice = 92700; // 50% progress
      const result = getTrailingStopStatus(mockTradeLong, currentPrice);

      expect(result.activated).toBe(false);
      expect(result.currentStop).toBe(87300); // Original stop
      expect(result.shouldActivate).toBe(false);
      expect(result.canActivate).toBe(false);
      expect(result.progressToTarget).toBeCloseTo(50, 1);
    });

    it('should show canActivate at 80% threshold', () => {
      const currentPrice = 94320; // 80% progress
      const result = getTrailingStopStatus(mockTradeLong, currentPrice);

      expect(result.activated).toBe(false);
      expect(result.shouldActivate).toBe(true);
      expect(result.canActivate).toBe(true);
      expect(result.progressToTarget).toBeCloseTo(80, 1);
    });

    it('should return status for activated trailing stop', () => {
      const activatedTrade = {
        ...mockTradeLong,
        trailing_stop_activated: true,
        trailing_stop_price: 90000
      };

      const currentPrice = 94320;
      const result = getTrailingStopStatus(activatedTrade, currentPrice);

      expect(result.activated).toBe(true);
      expect(result.currentStop).toBe(90000);
      expect(result.originalStop).toBe(87300);
      expect(result.shouldActivate).toBe(false); // Already activated
      expect(result.canActivate).toBe(false);
    });
  });

  describe('calculateProfitProtection', () => {
    it('should calculate profit protection for LONG breakeven stop', () => {
      const newStopPrice = 90000; // Breakeven
      const result = calculateProfitProtection(mockTradeLong, newStopPrice);

      expect(result.originalRiskUSD).toBeCloseTo(27, 2); // 2700 * 0.01
      expect(result.protectedProfitUSD).toBe(0); // Breakeven
      expect(result.riskReductionUSD).toBeCloseTo(27, 2); // Full risk eliminated
      expect(result.riskReductionPercent).toBeCloseTo(100, 1);
      expect(result.isBreakeven).toBe(true);
    });

    it('should calculate profit protection for SHORT breakeven stop', () => {
      const newStopPrice = 90000;
      const result = calculateProfitProtection(mockTradeShort, newStopPrice);

      expect(result.originalRiskUSD).toBeCloseTo(27, 2);
      expect(result.protectedProfitUSD).toBe(0);
      expect(result.riskReductionPercent).toBeCloseTo(100, 1);
      expect(result.isBreakeven).toBe(true);
    });

    it('should calculate profit protection for LONG dynamic stop', () => {
      const newStopPrice = 92160; // Locks in profit
      const result = calculateProfitProtection(mockTradeLong, newStopPrice);

      expect(result.protectedProfitUSD).toBeCloseTo(21.6, 2); // 2160 * 0.01
      expect(result.isBreakeven).toBe(false);
    });

    it('should calculate risk reduction percentage', () => {
      const newStopPrice = 90000;
      const result = calculateProfitProtection(mockTradeLong, newStopPrice);

      // Original risk: 2700 (90000 - 87300)
      // New risk: 0 (90000 - 90000)
      // Reduction: 2700 (100%)
      expect(result.riskReductionPercent).toBeCloseTo(100, 1);
    });

    it('should handle partial risk reduction', () => {
      const newStopPrice = 89000; // Halfway between original and entry
      const result = calculateProfitProtection(mockTradeLong, newStopPrice);

      // Original risk: 2700
      // New risk: 1000 (90000 - 89000)
      // Reduction: 1700 (63%)
      expect(result.riskReductionPercent).toBeCloseTo(63, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small position sizes', () => {
      const smallTrade = {
        ...mockTradeLong,
        position_size_btc: 0.0001 // Very small
      };

      const newStopPrice = 90000;
      const result = calculateProfitProtection(smallTrade, newStopPrice);

      expect(result.originalRiskUSD).toBeCloseTo(0.27, 4);
      expect(result.protectedProfitUSD).toBe(0);
    });

    it('should handle price at exact entry', () => {
      const currentPrice = 90000;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(0);
    });

    it('should handle price at exact target', () => {
      const currentPrice = 95400;
      const result = calculateProgressToTarget(mockTradeLong, currentPrice);

      expect(result).toBe(100);
    });

    it('should handle very close to 80% threshold', () => {
      const currentPrice = 94319; // Just under 80%
      let result = checkTrailingStop(mockTradeLong, currentPrice);
      expect(result.shouldActivate).toBe(false);

      const currentPrice2 = 94321; // Just over 80%
      result = checkTrailingStop(mockTradeLong, currentPrice2);
      expect(result.shouldActivate).toBe(true);
    });
  });
});
