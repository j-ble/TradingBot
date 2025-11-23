/**
 * CHoCH Detector Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { detectCHoCH, getCHoCHReferenceLevel } from '../../../../lib/scanners/choch.js';

describe('CHoCH Detector', () => {
  describe('detectCHoCH', () => {
    it('should detect bullish CHoCH when price breaks above recent highs', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '89800', low: '89200', close: '89400', timestamp: '2024-01-01T00:05:00Z' },
        { high: '89600', low: '89000', close: '89200', timestamp: '2024-01-01T00:10:00Z' },
        { high: '89500', low: '89100', close: '89300', timestamp: '2024-01-01T00:15:00Z' },
        { high: '89700', low: '89200', close: '89500', timestamp: '2024-01-01T00:20:00Z' },
        // Current candle breaks above all recent highs (90000 * 1.001 = 90090)
        { high: '90500', low: '89800', close: '90200', timestamp: '2024-01-01T00:25:00Z' }
      ];

      const result = detectCHoCH(candles, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.type).toBe('BULLISH');
      expect(result.price).toBe(90200);
      expect(result.structureLevel).toBe(90000);
    });

    it('should detect bearish CHoCH when price breaks below recent lows', () => {
      const candles = [
        { high: '90500', low: '90000', close: '90200', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90300', low: '90100', close: '90200', timestamp: '2024-01-01T00:05:00Z' },
        { high: '90400', low: '90200', close: '90300', timestamp: '2024-01-01T00:10:00Z' },
        { high: '90200', low: '90050', close: '90100', timestamp: '2024-01-01T00:15:00Z' },
        { high: '90150', low: '90000', close: '90050', timestamp: '2024-01-01T00:20:00Z' },
        // Current candle breaks below all recent lows (90000 * 0.999 = 89910)
        { high: '89950', low: '89700', close: '89800', timestamp: '2024-01-01T00:25:00Z' }
      ];

      const result = detectCHoCH(candles, 'BEARISH');

      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.type).toBe('BEARISH');
      expect(result.price).toBe(89800);
      expect(result.structureLevel).toBe(90000);
    });

    it('should return null when no CHoCH detected', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '89900', low: '89600', close: '89700', timestamp: '2024-01-01T00:05:00Z' },
        { high: '89800', low: '89500', close: '89600', timestamp: '2024-01-01T00:10:00Z' },
        { high: '89700', low: '89400', close: '89500', timestamp: '2024-01-01T00:15:00Z' },
        { high: '89600', low: '89300', close: '89400', timestamp: '2024-01-01T00:20:00Z' },
        // Still in downtrend, no break above
        { high: '89500', low: '89200', close: '89300', timestamp: '2024-01-01T00:25:00Z' }
      ];

      const result = detectCHoCH(candles, 'BULLISH');
      expect(result).toBeNull();
    });

    it('should return null with insufficient candles', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' }
      ];

      const result = detectCHoCH(candles, 'BULLISH');
      expect(result).toBeNull();
    });

    it('should return null for invalid bias', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '89900', low: '89600', close: '89700', timestamp: '2024-01-01T00:05:00Z' },
        { high: '89800', low: '89500', close: '89600', timestamp: '2024-01-01T00:10:00Z' },
        { high: '89700', low: '89400', close: '89500', timestamp: '2024-01-01T00:15:00Z' },
        { high: '89600', low: '89300', close: '89400', timestamp: '2024-01-01T00:20:00Z' },
        { high: '89500', low: '89200', close: '89300', timestamp: '2024-01-01T00:25:00Z' }
      ];

      const result = detectCHoCH(candles, 'INVALID');
      expect(result).toBeNull();
    });
  });

  describe('getCHoCHReferenceLevel', () => {
    it('should return max high for bullish bias', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800' },
        { high: '89800', low: '89200', close: '89400' },
        { high: '90500', low: '89000', close: '89200' },
        { high: '89500', low: '89100', close: '89300' },
        { high: '89700', low: '89200', close: '89500' }
      ];

      const result = getCHoCHReferenceLevel(candles, 'BULLISH');
      expect(result).toBe(90500);
    });

    it('should return min low for bearish bias', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800' },
        { high: '89800', low: '89200', close: '89400' },
        { high: '90500', low: '89000', close: '89200' },
        { high: '89500', low: '89100', close: '89300' },
        { high: '89700', low: '89200', close: '89500' }
      ];

      const result = getCHoCHReferenceLevel(candles, 'BEARISH');
      expect(result).toBe(89000);
    });
  });
});
