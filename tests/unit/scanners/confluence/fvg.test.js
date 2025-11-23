/**
 * FVG Detector Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { detectFVG, detectFVGFill, scanForFVG } from '../../../../lib/scanners/fvg.js';

describe('FVG Detector', () => {
  describe('detectFVG', () => {
    it('should detect bullish FVG when c3.low > c1.high', () => {
      const candles = [
        { high: '89500', low: '89000', close: '89200', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90500', low: '89400', close: '90300', timestamp: '2024-01-01T00:05:00Z' },
        { high: '91000', low: '89700', close: '90800', timestamp: '2024-01-01T00:10:00Z' }
      ];

      const result = detectFVG(candles, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.type).toBe('BULLISH');
      expect(result.top).toBe(89700);
      expect(result.bottom).toBe(89500);
      expect(result.size).toBe(200);
    });

    it('should detect bearish FVG when c3.high < c1.low', () => {
      const candles = [
        { high: '91000', low: '90500', close: '90800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90600', low: '89500', close: '89700', timestamp: '2024-01-01T00:05:00Z' },
        { high: '90200', low: '89200', close: '89400', timestamp: '2024-01-01T00:10:00Z' }
      ];

      const result = detectFVG(candles, 'BEARISH');

      expect(result).not.toBeNull();
      expect(result.type).toBe('BEARISH');
      expect(result.top).toBe(90500);
      expect(result.bottom).toBe(90200);
      expect(result.size).toBe(300);
    });

    it('should return null when gap is too small', () => {
      const candles = [
        { high: '90000', low: '89950', close: '89980', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90100', low: '89990', close: '90050', timestamp: '2024-01-01T00:05:00Z' },
        // Gap < 0.1%
        { high: '90150', low: '90010', close: '90100', timestamp: '2024-01-01T00:10:00Z' }
      ];

      const result = detectFVG(candles, 'BULLISH');
      expect(result).toBeNull();
    });

    it('should return null when no gap exists', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90200', low: '89600', close: '90000', timestamp: '2024-01-01T00:05:00Z' },
        // c3.low (89700) < c1.high (90000) - overlapping
        { high: '90400', low: '89700', close: '90200', timestamp: '2024-01-01T00:10:00Z' }
      ];

      const result = detectFVG(candles, 'BULLISH');
      expect(result).toBeNull();
    });

    it('should return null with insufficient candles', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' }
      ];

      const result = detectFVG(candles, 'BULLISH');
      expect(result).toBeNull();
    });
  });

  describe('detectFVGFill', () => {
    it('should detect bullish FVG fill when candle low enters zone', () => {
      const fvgZone = {
        top: 89700,
        bottom: 89500
      };

      const candle = {
        high: '90000',
        low: '89600', // Enters FVG zone
        close: '89800',
        timestamp: '2024-01-01T00:15:00Z'
      };

      const result = detectFVGFill(candle, fvgZone, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.filled).toBe(true);
      expect(result.fillPrice).toBe(89600);
    });

    it('should detect bearish FVG fill when candle high enters zone', () => {
      const fvgZone = {
        top: 90500,
        bottom: 90200
      };

      const candle = {
        high: '90400', // Enters FVG zone
        low: '89800',
        close: '90000',
        timestamp: '2024-01-01T00:15:00Z'
      };

      const result = detectFVGFill(candle, fvgZone, 'BEARISH');

      expect(result).not.toBeNull();
      expect(result.filled).toBe(true);
      expect(result.fillPrice).toBe(90400);
    });

    it('should return null when candle does not enter zone', () => {
      const fvgZone = {
        top: 89700,
        bottom: 89500
      };

      const candle = {
        high: '90500',
        low: '90000', // Above FVG zone
        close: '90200',
        timestamp: '2024-01-01T00:15:00Z'
      };

      const result = detectFVGFill(candle, fvgZone, 'BULLISH');
      expect(result).toBeNull();
    });
  });

  describe('scanForFVG', () => {
    it('should find FVG in candle array', () => {
      const candles = [
        { high: '89000', low: '88500', close: '88800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '89200', low: '88700', close: '89000', timestamp: '2024-01-01T00:05:00Z' },
        // FVG candles
        { high: '89500', low: '89000', close: '89200', timestamp: '2024-01-01T00:10:00Z' },
        { high: '90500', low: '89400', close: '90300', timestamp: '2024-01-01T00:15:00Z' },
        { high: '91000', low: '89700', close: '90800', timestamp: '2024-01-01T00:20:00Z' },
        // More candles after
        { high: '91200', low: '90500', close: '91000', timestamp: '2024-01-01T00:25:00Z' }
      ];

      const result = scanForFVG(candles, 'BULLISH');

      expect(result).not.toBeNull();
      expect(result.type).toBe('BULLISH');
    });

    it('should return null when no FVG exists', () => {
      const candles = [
        { high: '90000', low: '89500', close: '89800', timestamp: '2024-01-01T00:00:00Z' },
        { high: '90200', low: '89600', close: '90000', timestamp: '2024-01-01T00:05:00Z' },
        { high: '90400', low: '89700', close: '90200', timestamp: '2024-01-01T00:10:00Z' }
      ];

      const result = scanForFVG(candles, 'BULLISH');
      expect(result).toBeNull();
    });
  });
});
