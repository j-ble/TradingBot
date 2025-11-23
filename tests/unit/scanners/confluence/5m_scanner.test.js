/**
 * 5M Scanner State Machine Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scanner5M, CONFLUENCE_TIMEOUT_MS } from '../../../../lib/scanners/5m_scanner.js';

// Mock the database queries
vi.mock('../../../../database/queries.js', () => ({
  get5MCandles: vi.fn(),
  getActiveConfluenceStates: vi.fn(),
  getConfluenceState: vi.fn(),
  updateConfluenceState: vi.fn(),
  expireConfluenceState: vi.fn(),
  completeConfluenceState: vi.fn()
}));

import {
  get5MCandles,
  getActiveConfluenceStates,
  getConfluenceState,
  updateConfluenceState,
  expireConfluenceState,
  completeConfluenceState
} from '../../../../database/queries.js';

describe('Scanner5M', () => {
  let scanner;

  beforeEach(() => {
    scanner = new Scanner5M();
    vi.clearAllMocks();
  });

  describe('isExpired', () => {
    it('should return true when confluence is older than 12 hours', () => {
      const oldState = {
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() // 13 hours ago
      };

      expect(scanner.isExpired(oldState)).toBe(true);
    });

    it('should return false when confluence is within 12 hours', () => {
      const newState = {
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      };

      expect(scanner.isExpired(newState)).toBe(false);
    });
  });

  describe('getTimeRemaining', () => {
    it('should return remaining time before expiration', () => {
      const state = {
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      };

      const remaining = scanner.getTimeRemaining(state);
      // Should be approximately 10 hours in milliseconds
      expect(remaining).toBeGreaterThan(9 * 60 * 60 * 1000);
      expect(remaining).toBeLessThan(11 * 60 * 60 * 1000);
    });

    it('should return 0 for expired states', () => {
      const state = {
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() // 13 hours ago
      };

      const remaining = scanner.getTimeRemaining(state);
      expect(remaining).toBe(0);
    });
  });

  describe('scan', () => {
    it('should skip scan when no active confluence states', async () => {
      getActiveConfluenceStates.mockResolvedValue([]);

      await scanner.scan();

      expect(get5MCandles).not.toHaveBeenCalled();
    });

    it('should skip scan when not enough candles', async () => {
      getActiveConfluenceStates.mockResolvedValue([{ id: 1, current_state: 'WAITING_CHOCH', bias: 'BULLISH' }]);
      get5MCandles.mockResolvedValue([{ high: '90000', low: '89500', close: '89800' }]);

      await scanner.scan();

      expect(updateConfluenceState).not.toHaveBeenCalled();
    });

    it('should expire old confluence states', async () => {
      const oldState = {
        id: 1,
        current_state: 'WAITING_CHOCH',
        bias: 'BULLISH',
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString()
      };

      getActiveConfluenceStates.mockResolvedValue([oldState]);
      get5MCandles.mockResolvedValue(generateCandles(50));

      await scanner.scan();

      expect(expireConfluenceState).toHaveBeenCalledWith(1);
    });

    it('should process WAITING_CHOCH state and detect CHoCH', async () => {
      const state = {
        id: 1,
        current_state: 'WAITING_CHOCH',
        bias: 'BULLISH',
        created_at: new Date().toISOString()
      };

      // Generate candles with a breakout at the end
      const candles = generateCandles(50);
      // Make last candle break above recent highs
      candles[candles.length - 1].close = '91000';

      getActiveConfluenceStates.mockResolvedValue([state]);
      get5MCandles.mockResolvedValue(candles);

      await scanner.scan();

      expect(updateConfluenceState).toHaveBeenCalledWith(1, expect.objectContaining({
        current_state: 'WAITING_FVG',
        choch_detected: true
      }));
    });

    it('should process WAITING_BOS state and complete confluence', async () => {
      const state = {
        id: 1,
        current_state: 'WAITING_BOS',
        bias: 'BULLISH',
        choch_price: '90000',
        created_at: new Date().toISOString()
      };

      // Generate candles with BOS break
      const candles = generateCandles(50);
      candles[candles.length - 1].close = '90200'; // Breaks above choch_price * 1.001

      getActiveConfluenceStates.mockResolvedValue([state]);
      get5MCandles.mockResolvedValue(candles);

      await scanner.scan();

      expect(updateConfluenceState).toHaveBeenCalledWith(1, expect.objectContaining({
        bos_detected: true
      }));
      expect(completeConfluenceState).toHaveBeenCalledWith(1);
    });
  });

  describe('getStatus', () => {
    it('should return formatted status', async () => {
      const state = {
        id: 1,
        current_state: 'WAITING_FVG',
        bias: 'BULLISH',
        sweep_type: 'LOW',
        sweep_price: '89000',
        choch_detected: true,
        choch_price: '89500',
        choch_time: '2024-01-01T00:10:00Z',
        fvg_detected: false,
        bos_detected: false,
        sequence_valid: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      getConfluenceState.mockResolvedValue(state);

      const status = await scanner.getStatus(1);

      expect(status.id).toBe(1);
      expect(status.currentState).toBe('WAITING_FVG');
      expect(status.bias).toBe('BULLISH');
      expect(status.choch.detected).toBe(true);
      expect(status.fvg.detected).toBe(false);
      expect(status.bos.detected).toBe(false);
      expect(status.isExpired).toBe(false);
    });

    it('should return null for non-existent confluence', async () => {
      getConfluenceState.mockResolvedValue(null);

      const status = await scanner.getStatus(999);
      expect(status).toBeNull();
    });
  });
});

/**
 * Helper to generate test candles
 */
function generateCandles(count) {
  const candles = [];
  let basePrice = 90000;

  for (let i = 0; i < count; i++) {
    const variation = (Math.random() - 0.5) * 200;
    const open = basePrice + variation;
    const close = open + (Math.random() - 0.5) * 100;
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;

    candles.push({
      timestamp: new Date(Date.now() - (count - i) * 5 * 60 * 1000).toISOString(),
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      close: close.toFixed(2),
      volume: (Math.random() * 100).toFixed(8)
    });

    basePrice = parseFloat(close);
  }

  return candles;
}
