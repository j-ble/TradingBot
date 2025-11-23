/**
 * BOS Detector Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { detectBOS, detectBOSFromCandle } from '../../../../lib/scanners/bos.js';

describe('BOS Detector', () => {
  describe('detectBOS', () => {
    it('should detect bullish BOS when price breaks above CHoCH high', () => {
      const currentPrice = 90200;
      const chochPrice = 90000;
      // Break level = 90000 * 1.001 = 90090

      const result = detectBOS(currentPrice, chochPrice, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.type).toBe('BULLISH');
      expect(result.price).toBe(90200);
      expect(result.structureLevel).toBe(90000);
    });

    it('should detect bearish BOS when price breaks below CHoCH low', () => {
      const currentPrice = 89800;
      const chochPrice = 90000;
      // Break level = 90000 * 0.999 = 89910

      const result = detectBOS(currentPrice, chochPrice, 'BEARISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.type).toBe('BEARISH');
      expect(result.price).toBe(89800);
      expect(result.structureLevel).toBe(90000);
    });

    it('should return null when bullish break is not significant enough', () => {
      const currentPrice = 90050;
      const chochPrice = 90000;
      // Break level = 90000 * 1.001 = 90090, price below

      const result = detectBOS(currentPrice, chochPrice, 'BULLISH');
      expect(result).toBeNull();
    });

    it('should return null when bearish break is not significant enough', () => {
      const currentPrice = 89950;
      const chochPrice = 90000;
      // Break level = 90000 * 0.999 = 89910, price above

      const result = detectBOS(currentPrice, chochPrice, 'BEARISH');
      expect(result).toBeNull();
    });

    it('should handle string prices', () => {
      const currentPrice = '90200';
      const chochPrice = '90000';

      const result = detectBOS(currentPrice, chochPrice, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
    });

    it('should return null for invalid bias', () => {
      const result = detectBOS(90200, 90000, 'INVALID');
      expect(result).toBeNull();
    });

    it('should return null for missing prices', () => {
      expect(detectBOS(null, 90000, 'BULLISH')).toBeNull();
      expect(detectBOS(90200, null, 'BULLISH')).toBeNull();
    });
  });

  describe('detectBOSFromCandle', () => {
    it('should detect BOS from candle data', () => {
      const candle = {
        high: '90500',
        low: '89800',
        close: '90200',
        timestamp: '2024-01-01T00:25:00Z'
      };
      const chochPrice = 90000;

      const result = detectBOSFromCandle(candle, chochPrice, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.timestamp).toBe('2024-01-01T00:25:00Z');
    });

    it('should return null for null candle', () => {
      const result = detectBOSFromCandle(null, 90000, 'BULLISH');
      expect(result).toBeNull();
    });
  });
});
