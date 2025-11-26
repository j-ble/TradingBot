/**
 * Stop Loss Calculator Tests
 * Unit tests for swing-based stop loss calculation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateStopWithBuffer,
  calculateDistance,
  isValidStop,
  isStopOnCorrectSide,
  calculateMinimumTakeProfit,
  calculateStopLoss,
  calculateStopLossWithDetails,
  CONFIG
} from '../../../lib/trading/stop_loss_calculator.js';
import * as swingSelector from '../../../lib/trading/swing_selector.js';

// Mock the swing selector module
vi.mock('../../../lib/trading/swing_selector.js');

describe('Stop Loss Calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateStopWithBuffer', () => {
    it('should calculate LONG stop with 0.2% buffer below swing low', () => {
      const swingPrice = 90000;
      const direction = 'LONG';
      const expectedStop = 90000 * (1 - 0.002); // 89820

      const result = calculateStopWithBuffer(swingPrice, direction);

      expect(result).toBeCloseTo(89820, 2);
    });

    it('should calculate SHORT stop with 0.3% buffer above swing high', () => {
      const swingPrice = 90000;
      const direction = 'SHORT';
      const expectedStop = 90000 * (1 + 0.003); // 90270

      const result = calculateStopWithBuffer(swingPrice, direction);

      expect(result).toBeCloseTo(90270, 2);
    });

    it('should throw error for invalid swing price', () => {
      expect(() => calculateStopWithBuffer(null, 'LONG')).toThrow('Invalid swing price');
      expect(() => calculateStopWithBuffer('not a number', 'LONG')).toThrow('Invalid swing price');
    });

    it('should throw error for invalid direction', () => {
      expect(() => calculateStopWithBuffer(90000, 'INVALID')).toThrow('Invalid direction');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance as percentage', () => {
      const entryPrice = 90000;
      const stopPrice = 87300; // 3% away

      const result = calculateDistance(entryPrice, stopPrice);

      expect(result).toBeCloseTo(3.0, 1);
    });

    it('should calculate distance for LONG trade', () => {
      const entryPrice = 90000;
      const stopPrice = 89100; // 1% below

      const result = calculateDistance(entryPrice, stopPrice);

      expect(result).toBeCloseTo(1.0, 1);
    });

    it('should calculate distance for SHORT trade', () => {
      const entryPrice = 90000;
      const stopPrice = 91800; // 2% above

      const result = calculateDistance(entryPrice, stopPrice);

      expect(result).toBeCloseTo(2.0, 1);
    });
  });

  describe('isValidStop', () => {
    it('should validate stop within 0.5%-3% range', () => {
      const entryPrice = 90000;
      const stopPrice = 88200; // 2% away

      const result = isValidStop(entryPrice, stopPrice);

      expect(result.valid).toBe(true);
      expect(result.distance).toBeCloseTo(2.0, 1);
    });

    it('should reject stop too close (<0.5%)', () => {
      const entryPrice = 90000;
      const stopPrice = 89820; // 0.2% away

      const result = isValidStop(entryPrice, stopPrice);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Stop too close');
    });

    it('should reject stop too far (>3%)', () => {
      const entryPrice = 90000;
      const stopPrice = 86400; // 4% away

      const result = isValidStop(entryPrice, stopPrice);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Stop too far');
    });

    it('should accept stop at minimum threshold (0.5%)', () => {
      const entryPrice = 90000;
      const stopPrice = 89550; // 0.5% away

      const result = isValidStop(entryPrice, stopPrice);

      expect(result.valid).toBe(true);
    });

    it('should accept stop at maximum threshold (3%)', () => {
      const entryPrice = 90000;
      const stopPrice = 87300; // 3% away

      const result = isValidStop(entryPrice, stopPrice);

      expect(result.valid).toBe(true);
    });
  });

  describe('isStopOnCorrectSide', () => {
    it('should validate LONG stop is below entry', () => {
      const entryPrice = 90000;
      const stopPrice = 88000;
      const direction = 'LONG';

      const result = isStopOnCorrectSide(entryPrice, stopPrice, direction);

      expect(result).toBe(true);
    });

    it('should reject LONG stop above entry', () => {
      const entryPrice = 90000;
      const stopPrice = 92000;
      const direction = 'LONG';

      const result = isStopOnCorrectSide(entryPrice, stopPrice, direction);

      expect(result).toBe(false);
    });

    it('should validate SHORT stop is above entry', () => {
      const entryPrice = 90000;
      const stopPrice = 92000;
      const direction = 'SHORT';

      const result = isStopOnCorrectSide(entryPrice, stopPrice, direction);

      expect(result).toBe(true);
    });

    it('should reject SHORT stop below entry', () => {
      const entryPrice = 90000;
      const stopPrice = 88000;
      const direction = 'SHORT';

      const result = isStopOnCorrectSide(entryPrice, stopPrice, direction);

      expect(result).toBe(false);
    });
  });

  describe('calculateMinimumTakeProfit', () => {
    it('should calculate 2:1 R/R take profit for LONG', () => {
      const entryPrice = 90000;
      const stopPrice = 88200; // 1800 away (2%)
      const direction = 'LONG';

      const result = calculateMinimumTakeProfit(entryPrice, stopPrice, direction);

      // Target should be 2x stop distance = 3600 away
      expect(result).toBeCloseTo(93600, 0);
    });

    it('should calculate 2:1 R/R take profit for SHORT', () => {
      const entryPrice = 90000;
      const stopPrice = 91800; // 1800 away (2%)
      const direction = 'SHORT';

      const result = calculateMinimumTakeProfit(entryPrice, stopPrice, direction);

      // Target should be 2x stop distance = 3600 away
      expect(result).toBeCloseTo(86400, 0);
    });

    it('should throw error for invalid direction', () => {
      expect(() => calculateMinimumTakeProfit(90000, 88000, 'INVALID')).toThrow('Invalid direction');
    });
  });

  describe('calculateStopLoss', () => {
    it('should use 5M swing when valid', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 89000,
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).not.toBeNull();
      expect(result.source).toBe('5M_SWING');
      expect(result.swingPrice).toBe(89000);
      expect(result.valid).toBe(true);
      expect(result.distance).toBeGreaterThan(0);
    });

    it('should fallback to 4H swing when 5M invalid', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      // 5M swing too close
      const swing5M = {
        price: 89950, // Only 0.05% away - too close
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      // 4H swing valid
      const swing4H = {
        price: 88800, // ~1.3% away - valid
        timestamp: new Date().toISOString(),
        timeframe: '4H',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).not.toBeNull();
      expect(result.source).toBe('4H_SWING');
      expect(result.swingPrice).toBe(88800);
      expect(result.valid).toBe(true);
    });

    it('should return null when no valid swing found', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M: null,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).toBeNull();
    });

    it('should return null when both swings too close', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 89970, // Too close
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      const swing4H = {
        price: 89980, // Also too close
        timestamp: new Date().toISOString(),
        timeframe: '4H',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).toBeNull();
    });

    it('should return null when both swings too far', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 86000, // >4% away - too far
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      const swing4H = {
        price: 85000, // >5% away - too far
        timestamp: new Date().toISOString(),
        timeframe: '4H',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).toBeNull();
    });

    it('should reject when direction does not match bias', async () => {
      const entryPrice = 90000;
      const direction = 'SHORT'; // Mismatch!
      const bias = 'BULLISH';

      await expect(
        calculateStopLoss(entryPrice, direction, bias)
      ).rejects.toThrow('Direction SHORT does not match bias BULLISH');
    });

    it('should work for SHORT trades', async () => {
      const entryPrice = 90000;
      const direction = 'SHORT';
      const bias = 'BEARISH';

      const swing5M = {
        price: 91000, // Swing high above entry
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'HIGH'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).not.toBeNull();
      expect(result.source).toBe('5M_SWING');
      expect(result.price).toBeGreaterThan(entryPrice); // Stop above entry for SHORT
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateStopLossWithDetails', () => {
    it('should return success with valid stop', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 89000,
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLossWithDetails(entryPrice, direction, bias);

      expect(result.success).toBe(true);
      expect(result.stopLoss).not.toBeNull();
      expect(result.rejectionReasons).toEqual([]);
    });

    it('should return failure with rejection reasons when no valid stop', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M: null,
        swing4H: null
      });

      const result = await calculateStopLossWithDetails(entryPrice, direction, bias);

      expect(result.success).toBe(false);
      expect(result.stopLoss).toBeNull();
      expect(result.rejectionReasons).toContain('No swing levels found (neither 5M nor 4H)');
    });

    it('should provide detailed rejection reasons for invalid swings', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 89970, // Too close
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      const swing4H = {
        price: 86000, // Too far
        timestamp: new Date().toISOString(),
        timeframe: '4H',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H
      });

      const result = await calculateStopLossWithDetails(entryPrice, direction, bias);

      expect(result.success).toBe(false);
      expect(result.rejectionReasons.length).toBeGreaterThan(0);
      expect(result.rejectionReasons.some(r => r.includes('5M swing'))).toBe(true);
      expect(result.rejectionReasons.some(r => r.includes('4H swing'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle entry price at exact swing level', async () => {
      const entryPrice = 90000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 90000, // Same as entry
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      // Stop with buffer should still be below entry
      expect(result).not.toBeNull();
      expect(result.price).toBeLessThan(entryPrice);
    });

    it('should handle very small price values', async () => {
      const entryPrice = 0.001;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 0.0009,
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).not.toBeNull();
      expect(result.price).toBeLessThan(entryPrice);
    });

    it('should handle very large price values', async () => {
      const entryPrice = 1000000;
      const direction = 'LONG';
      const bias = 'BULLISH';

      const swing5M = {
        price: 980000, // ~2% below
        timestamp: new Date().toISOString(),
        timeframe: '5M',
        swing_type: 'LOW'
      };

      vi.spyOn(swingSelector, 'getAllSwings').mockResolvedValue({
        swing5M,
        swing4H: null
      });

      const result = await calculateStopLoss(entryPrice, direction, bias);

      expect(result).not.toBeNull();
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThan(3);
    });
  });

  describe('Configuration', () => {
    it('should expose configuration constants', () => {
      expect(CONFIG.BUFFER_BELOW_LOW).toBe(0.002);
      expect(CONFIG.BUFFER_ABOVE_HIGH).toBe(0.003);
      expect(CONFIG.MIN_STOP_DISTANCE_PERCENT).toBe(0.5);
      expect(CONFIG.MAX_STOP_DISTANCE_PERCENT).toBe(3.0);
      expect(CONFIG.MIN_RR_RATIO).toBe(2.0);
    });
  });
});
