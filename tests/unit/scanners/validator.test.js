/**
 * Validator Unit Tests
 * Tests for pattern validation and confluence completeness checks
 */

import { describe, it, expect } from 'vitest';
import {
  validateConfluence,
  validateState,
  isCorrectSequence,
  isExpired,
  isPriceActionValid,
  getTimeRemaining,
  getTimeElapsed,
  isExpiringSoon,
  CONFLUENCE_TIMEOUT_MS
} from '../../../lib/scanners/validator.js';

describe('Validator', () => {
  describe('validateConfluence', () => {
    it('should pass validation for complete valid confluence', () => {
      const state = createValidConfluenceState();

      const result = validateConfluence(state);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when CHoCH not detected', () => {
      const state = createValidConfluenceState();
      state.choch_detected = false;

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CHoCH'))).toBe(true);
    });

    it('should fail when FVG not detected', () => {
      const state = createValidConfluenceState();
      state.fvg_detected = false;

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('FVG'))).toBe(true);
    });

    it('should fail when BOS not detected', () => {
      const state = createValidConfluenceState();
      state.bos_detected = false;

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('BOS'))).toBe(true);
    });

    it('should fail when sequence is incorrect', () => {
      const state = createValidConfluenceState();
      // Make FVG happen before CHoCH
      state.fvg_fill_time = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      state.choch_time = new Date(Date.now() - 4 * 60 * 1000).toISOString();

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Sequence'))).toBe(true);
    });

    it('should fail when confluence has expired', () => {
      const state = createValidConfluenceState();
      state.created_at = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(); // 13 hours ago

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('expired'))).toBe(true);
    });

    it('should fail when price action invalid for BULLISH bias', () => {
      const state = createValidConfluenceState();
      state.bias = 'BULLISH';
      state.bos_price = '89000'; // BOS lower than CHoCH (invalid for bullish)
      state.choch_price = '90000';

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Price action'))).toBe(true);
    });

    it('should fail when state is null', () => {
      const result = validateConfluence(null);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('null'))).toBe(true);
    });
  });

  describe('isCorrectSequence', () => {
    it('should validate correct sequence order', () => {
      const state = {
        choch_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
        fvg_fill_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
        bos_time: new Date(Date.now() - 1 * 60 * 1000).toISOString() // 1 min ago
      };

      const result = isCorrectSequence(state);

      expect(result.valid).toBe(true);
    });

    it('should fail when CHoCH comes after FVG', () => {
      const state = {
        choch_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        fvg_fill_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        bos_time: new Date(Date.now() - 1 * 60 * 1000).toISOString()
      };

      const result = isCorrectSequence(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('CHoCH must occur before FVG');
    });

    it('should fail when FVG comes after BOS', () => {
      const state = {
        choch_time: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        fvg_fill_time: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        bos_time: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      };

      const result = isCorrectSequence(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('FVG fill must occur before BOS');
    });

    it('should fail when timestamps are missing', () => {
      const state = {
        choch_time: new Date().toISOString(),
        fvg_fill_time: null,
        bos_time: new Date().toISOString()
      };

      const result = isCorrectSequence(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing timestamps');
    });

    it('should fail when timestamps are equal', () => {
      const sameTime = new Date().toISOString();
      const state = {
        choch_time: sameTime,
        fvg_fill_time: sameTime,
        bos_time: sameTime
      };

      const result = isCorrectSequence(state);

      expect(result.valid).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return false for recent confluence', () => {
      const state = {
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      };

      expect(isExpired(state)).toBe(false);
    });

    it('should return true for old confluence', () => {
      const state = {
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() // 13 hours ago
      };

      expect(isExpired(state)).toBe(true);
    });

    it('should return true just past 12 hour boundary', () => {
      // Create timestamp just over 12 hours ago
      const twelveHoursAgoPlus = Date.now() - (12 * 60 * 60 * 1000 + 1000);
      const state = {
        created_at: new Date(twelveHoursAgoPlus).toISOString()
      };

      expect(isExpired(state)).toBe(true);
    });

    it('should return true when created_at is missing', () => {
      const state = { id: 1 };

      expect(isExpired(state)).toBe(true);
    });
  });

  describe('isPriceActionValid', () => {
    it('should validate BULLISH price action', () => {
      const state = {
        bias: 'BULLISH',
        choch_price: '89000',
        fvg_zone_low: '89200',
        fvg_zone_high: '89500',
        bos_price: '90000' // BOS higher than CHoCH
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(true);
    });

    it('should validate BEARISH price action', () => {
      const state = {
        bias: 'BEARISH',
        choch_price: '91000',
        fvg_zone_low: '90500',
        fvg_zone_high: '90800',
        bos_price: '90000' // BOS lower than CHoCH
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(true);
    });

    it('should fail BULLISH when BOS below CHoCH', () => {
      const state = {
        bias: 'BULLISH',
        choch_price: '90000',
        fvg_zone_low: '89800',
        fvg_zone_high: '90100',
        bos_price: '89500' // Invalid: BOS below CHoCH for bullish
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('BULLISH');
    });

    it('should fail BEARISH when BOS above CHoCH', () => {
      const state = {
        bias: 'BEARISH',
        choch_price: '89000',
        fvg_zone_low: '89200',
        fvg_zone_high: '89500',
        bos_price: '90000' // Invalid: BOS above CHoCH for bearish
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('BEARISH');
    });

    it('should fail when bias is missing', () => {
      const state = {
        choch_price: '90000',
        fvg_zone_low: '89800',
        fvg_zone_high: '90100',
        bos_price: '90500'
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Bias not set');
    });

    it('should fail when price data is missing', () => {
      const state = {
        bias: 'BULLISH',
        choch_price: '90000'
        // Missing FVG and BOS prices
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing price data');
    });

    it('should fail when bias is invalid', () => {
      const state = {
        bias: 'SIDEWAYS',
        choch_price: '90000',
        fvg_zone_low: '89800',
        fvg_zone_high: '90100',
        bos_price: '90500'
      };

      const result = isPriceActionValid(state);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid bias');
    });
  });

  describe('validateState', () => {
    it('should validate complete state structure', () => {
      const state = {
        id: 1,
        sweep_id: 10,
        current_state: 'WAITING_FVG',
        bias: 'BULLISH',
        created_at: new Date().toISOString()
      };

      const result = validateState(state);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when state is null', () => {
      const result = validateState(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('null');
    });

    it('should fail when required fields missing', () => {
      const state = {
        id: 1
        // Missing other required fields
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail when current_state is invalid', () => {
      const state = {
        id: 1,
        sweep_id: 10,
        current_state: 'INVALID_STATE',
        bias: 'BULLISH',
        created_at: new Date().toISOString()
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid state'))).toBe(true);
    });

    it('should fail when bias is invalid', () => {
      const state = {
        id: 1,
        sweep_id: 10,
        current_state: 'WAITING_FVG',
        bias: 'NEUTRAL',
        created_at: new Date().toISOString()
      };

      const result = validateState(state);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid bias'))).toBe(true);
    });

    it('should validate all valid state values', () => {
      const validStates = ['WAITING_CHOCH', 'WAITING_FVG', 'WAITING_BOS', 'COMPLETE', 'EXPIRED'];

      for (const stateName of validStates) {
        const state = {
          id: 1,
          sweep_id: 10,
          current_state: stateName,
          bias: 'BULLISH',
          created_at: new Date().toISOString()
        };

        const result = validateState(state);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('getTimeRemaining', () => {
    it('should return remaining time for recent confluence', () => {
      const state = {
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      };

      const remaining = getTimeRemaining(state);

      // Should be approximately 10 hours in milliseconds
      expect(remaining).toBeGreaterThan(9.5 * 60 * 60 * 1000);
      expect(remaining).toBeLessThan(10.5 * 60 * 60 * 1000);
    });

    it('should return 0 for expired confluence', () => {
      const state = {
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() // 13 hours ago
      };

      const remaining = getTimeRemaining(state);

      expect(remaining).toBe(0);
    });

    it('should return 0 when created_at missing', () => {
      const state = { id: 1 };

      const remaining = getTimeRemaining(state);

      expect(remaining).toBe(0);
    });
  });

  describe('getTimeElapsed', () => {
    it('should return elapsed time', () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const state = {
        created_at: new Date(twoHoursAgo).toISOString()
      };

      const elapsed = getTimeElapsed(state);

      // Should be approximately 2 hours in milliseconds
      expect(elapsed).toBeGreaterThan(1.9 * 60 * 60 * 1000);
      expect(elapsed).toBeLessThan(2.1 * 60 * 60 * 1000);
    });

    it('should return 0 when created_at missing', () => {
      const state = { id: 1 };

      const elapsed = getTimeElapsed(state);

      expect(elapsed).toBe(0);
    });
  });

  describe('isExpiringSoon', () => {
    it('should return true when expiring within 1 hour', () => {
      const state = {
        created_at: new Date(Date.now() - 11.5 * 60 * 60 * 1000).toISOString() // 11.5 hours ago
      };

      expect(isExpiringSoon(state)).toBe(true);
    });

    it('should return false when plenty of time remaining', () => {
      const state = {
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      };

      expect(isExpiringSoon(state)).toBe(false);
    });

    it('should return false when already expired', () => {
      const state = {
        created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() // 13 hours ago
      };

      expect(isExpiringSoon(state)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle FVG zone validation', () => {
      const state = createValidConfluenceState();

      // Test FVG zone boundaries
      state.fvg_zone_low = '90000';
      state.fvg_zone_high = '89000'; // Invalid: low > high

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
    });

    it('should handle zero prices', () => {
      const state = createValidConfluenceState();
      state.choch_price = '0';

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
    });

    it('should handle negative prices', () => {
      const state = createValidConfluenceState();
      state.bos_price = '-100';

      const result = validateConfluence(state);

      expect(result.valid).toBe(false);
    });

    it('should handle malformed timestamps', () => {
      const state = createValidConfluenceState();
      state.choch_time = null; // Explicitly null timestamp

      const result = validateConfluence(state);

      // Should fail because CHoCH timestamp is missing
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CHoCH'))).toBe(true);
    });
  });
});

/**
 * Helper function to create a valid confluence state for testing
 */
function createValidConfluenceState() {
  const now = Date.now();

  return {
    id: 1,
    sweep_id: 10,
    current_state: 'COMPLETE',
    bias: 'BULLISH',

    // CHoCH
    choch_detected: true,
    choch_time: new Date(now - 10 * 60 * 1000).toISOString(), // 10 min ago
    choch_price: '89000',

    // FVG
    fvg_detected: true,
    fvg_zone_low: '89200',
    fvg_zone_high: '89500',
    fvg_fill_price: '89350',
    fvg_fill_time: new Date(now - 5 * 60 * 1000).toISOString(), // 5 min ago

    // BOS
    bos_detected: true,
    bos_time: new Date(now - 1 * 60 * 1000).toISOString(), // 1 min ago
    bos_price: '90000',

    // Metadata
    sequence_valid: true,
    created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updated_at: new Date(now - 1 * 60 * 1000).toISOString()
  };
}
