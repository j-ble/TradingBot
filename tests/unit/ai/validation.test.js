/**
 * Unit Tests for AI Decision Validation and Safety Checks
 *
 * Tests validation logic, safety overrides, and edge cases
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');
const {
  validateAIDecision,
  validateDecisionStructure,
  validateSwingBasedStop
} = require('../../../lib/ai/validation');
const {
  applySafetyOverrides,
  checkMarketSafety,
  validateTradingHours,
  performSafetyGate
} = require('../../../lib/ai/safety');

describe('AI Decision Validation', () => {
  let validDecision;
  let validSetupData;

  beforeEach(() => {
    // Valid LONG decision template
    validDecision = {
      trade_decision: 'YES',
      direction: 'LONG',
      entry_price: 90000,
      stop_loss: 88200, // 2% below entry
      stop_loss_source: '5M_SWING',
      take_profit: 93600, // 4% above entry (2:1 R/R)
      position_size_btc: 0.0555,
      risk_reward_ratio: 2.0,
      confidence: 85,
      reasoning: 'All 4 confluences aligned: 4H low sweep (bullish bias), 5M CHoCH confirmed upward momentum, FVG filled at optimal zone, BOS broke above structure. Swing-based stop at recent 5M low provides tight 2% risk with clear 4% target.'
    };

    validSetupData = {
      bias: 'BULLISH',
      currentPrice: 90000,
      accountBalance: 10000
    };
  });

  describe('validateDecisionStructure', () => {
    it('should pass for valid decision structure', () => {
      const result = validateDecisionStructure(validDecision);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail if decision is not an object', () => {
      const result = validateDecisionStructure(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Decision must be a valid object');
    });

    it('should fail if required fields are missing', () => {
      const incomplete = { trade_decision: 'YES' };
      const result = validateDecisionStructure(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail if field types are incorrect', () => {
      const wrongTypes = {
        ...validDecision,
        entry_price: '90000', // Should be number
        confidence: '85' // Should be number
      };
      const result = validateDecisionStructure(wrongTypes);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAIDecision', () => {
    it('should pass for valid LONG decision', () => {
      const result = validateAIDecision(validDecision, validSetupData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for valid SHORT decision', () => {
      const shortDecision = {
        trade_decision: 'YES',
        direction: 'SHORT',
        entry_price: 90000,
        stop_loss: 91800, // 2% above entry
        stop_loss_source: '4H_SWING',
        take_profit: 86400, // 4% below entry (2:1 R/R)
        position_size_btc: 0.0555,
        risk_reward_ratio: 2.0,
        confidence: 80,
        reasoning: 'Bearish setup with 4H high sweep, all 5M confluences complete, swing-based stop provides optimal risk management.'
      };

      const shortSetup = {
        bias: 'BEARISH',
        currentPrice: 90000,
        accountBalance: 10000
      };

      const result = validateAIDecision(shortDecision, shortSetup);
      expect(result.valid).toBe(true);
    });

    it('should skip validation if decision is NO', () => {
      const noDecision = { ...validDecision, trade_decision: 'NO' };
      const result = validateAIDecision(noDecision, validSetupData);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('validation skipped');
    });

    it('should fail if trade_decision is invalid', () => {
      const invalid = { ...validDecision, trade_decision: 'MAYBE' };
      const result = validateAIDecision(invalid, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid trade_decision'))).toBe(true);
    });

    it('should fail if direction does not match bias', () => {
      const mismatch = { ...validDecision, direction: 'SHORT' };
      const result = validateAIDecision(mismatch, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("doesn't match bias"))).toBe(true);
    });

    it('should fail if entry price is too far from current price', () => {
      const farEntry = { ...validDecision, entry_price: 91000 }; // >1% away
      const result = validateAIDecision(farEntry, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('away from current price'))).toBe(true);
    });

    it('should fail if LONG stop loss is above entry', () => {
      const wrongStop = { ...validDecision, stop_loss: 91000 };
      const result = validateAIDecision(wrongStop, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be below entry'))).toBe(true);
    });

    it('should fail if SHORT stop loss is below entry', () => {
      const shortDecision = {
        ...validDecision,
        direction: 'SHORT',
        stop_loss: 89000 // Below entry
      };
      const shortSetup = { ...validSetupData, bias: 'BEARISH' };
      const result = validateAIDecision(shortDecision, shortSetup);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be above entry'))).toBe(true);
    });

    it('should fail if stop distance is too tight (<0.5%)', () => {
      const tightStop = { ...validDecision, stop_loss: 89600 }; // 0.44%
      const result = validateAIDecision(tightStop, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too tight'))).toBe(true);
    });

    it('should fail if stop distance is too wide (>3%)', () => {
      const wideStop = {
        ...validDecision,
        stop_loss: 87000, // 3.33%
        take_profit: 96000 // Adjust TP to maintain R/R
      };
      const result = validateAIDecision(wideStop, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too wide'))).toBe(true);
    });

    it('should fail if R/R ratio is below 2:1', () => {
      const lowRR = {
        ...validDecision,
        take_profit: 91500, // Only 1.67:1 R/R
        risk_reward_ratio: 1.67
      };
      const result = validateAIDecision(lowRR, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('below 2:1 minimum'))).toBe(true);
    });

    it('should fail if confidence is below 70', () => {
      const lowConfidence = { ...validDecision, confidence: 65 };
      const result = validateAIDecision(lowConfidence, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('below 70 threshold'))).toBe(true);
    });

    it('should fail if confidence exceeds 100', () => {
      const highConfidence = { ...validDecision, confidence: 105 };
      const result = validateAIDecision(highConfidence, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds 100'))).toBe(true);
    });

    it('should fail if stop_loss_source is invalid', () => {
      const invalidSource = { ...validDecision, stop_loss_source: 'RANDOM' };
      const result = validateAIDecision(invalidSource, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid stop_loss_source'))).toBe(true);
    });

    it('should fail if reasoning is too brief', () => {
      const brief = { ...validDecision, reasoning: 'Good setup' };
      const result = validateAIDecision(brief, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too brief'))).toBe(true);
    });

    it('should fail if take profit is on wrong side for LONG', () => {
      const wrongTP = { ...validDecision, take_profit: 88000 };
      const result = validateAIDecision(wrongTP, validSetupData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be above entry'))).toBe(true);
    });
  });

  describe('validateSwingBasedStop', () => {
    it('should pass if stop is near 5M swing', () => {
      const swingData = {
        swing5MPrice: 88300,
        swing4HPrice: 87000
      };
      const result = validateSwingBasedStop(validDecision, swingData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn if stop deviates from swing', () => {
      const decision = { ...validDecision, stop_loss: 87500 };
      const swingData = {
        swing5MPrice: 88300,
        swing4HPrice: 87000
      };
      const result = validateSwingBasedStop(decision, swingData);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should fail if swing data is missing', () => {
      const swingData = {};
      const result = validateSwingBasedStop(validDecision, swingData);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('swing data not available'))).toBe(true);
    });
  });
});

describe('Safety Checks and Overrides', () => {
  let validDecision;
  let safeMarketConditions;

  beforeEach(() => {
    validDecision = {
      trade_decision: 'YES',
      direction: 'LONG',
      entry_price: 90000,
      stop_loss: 88200,
      confidence: 85
    };

    safeMarketConditions = {
      volatility: 0.02, // 2%
      volume: 1000,
      avgVolume: 1200,
      spread: 0.0005, // 0.05%
      price: 90000,
      majorEventSoon: false,
      priceChange24h: 5
    };
  });

  describe('checkMarketSafety', () => {
    it('should pass for safe market conditions', () => {
      const result = checkMarketSafety(safeMarketConditions);
      expect(result.safe).toBe(true);
      expect(result.failedChecks).toHaveLength(0);
    });

    it('should fail for high volatility', () => {
      const highVol = { ...safeMarketConditions, volatility: 0.08 };
      const result = checkMarketSafety(highVol);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('volatility');
    });

    it('should fail for low liquidity', () => {
      const lowLiq = { ...safeMarketConditions, volume: 200 }; // <30% of avg
      const result = checkMarketSafety(lowLiq);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('liquidity');
    });

    it('should fail for wide spread', () => {
      const wideSpread = { ...safeMarketConditions, spread: 0.002 };
      const result = checkMarketSafety(wideSpread);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('spread');
    });

    it('should fail for extreme price movement', () => {
      const extremeMove = { ...safeMarketConditions, priceChange24h: 20 };
      const result = checkMarketSafety(extremeMove);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('priceMovement');
    });

    it('should fail for major event approaching', () => {
      const eventSoon = { ...safeMarketConditions, majorEventSoon: true };
      const result = checkMarketSafety(eventSoon);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('economicEvents');
    });

    it('should fail for invalid price', () => {
      const invalidPrice = { ...safeMarketConditions, price: 5000 };
      const result = checkMarketSafety(invalidPrice);
      expect(result.safe).toBe(false);
      expect(result.failedChecks).toContain('priceValidity');
    });
  });

  describe('applySafetyOverrides', () => {
    it('should not override safe conditions', () => {
      const result = applySafetyOverrides(validDecision, safeMarketConditions);
      expect(result.overridden).toBe(false);
      expect(result.decision.trade_decision).toBe('YES');
    });

    it('should override for extreme volatility', () => {
      const highVol = { ...safeMarketConditions, volatility: 0.06 };
      const result = applySafetyOverrides(validDecision, highVol);
      expect(result.overridden).toBe(true);
      expect(result.decision.trade_decision).toBe('NO');
      expect(result.overrides.some(o => o.rule === 'EXTREME_VOLATILITY')).toBe(true);
    });

    it('should override for low liquidity', () => {
      const lowLiq = { ...safeMarketConditions, volume: 300 };
      const result = applySafetyOverrides(validDecision, lowLiq);
      expect(result.overridden).toBe(true);
      expect(result.decision.trade_decision).toBe('NO');
      expect(result.overrides.some(o => o.rule === 'LOW_LIQUIDITY')).toBe(true);
    });

    it('should override for wide spread', () => {
      const wideSpread = { ...safeMarketConditions, spread: 0.0015 };
      const result = applySafetyOverrides(validDecision, wideSpread);
      expect(result.overridden).toBe(true);
      expect(result.decision.trade_decision).toBe('NO');
      expect(result.overrides.some(o => o.rule === 'WIDE_SPREAD')).toBe(true);
    });

    it('should override for major event', () => {
      const eventSoon = { ...safeMarketConditions, majorEventSoon: true };
      const result = applySafetyOverrides(validDecision, eventSoon);
      expect(result.overridden).toBe(true);
      expect(result.decision.trade_decision).toBe('NO');
      expect(result.overrides.some(o => o.rule === 'MAJOR_EVENT')).toBe(true);
    });

    it('should warn for reduced liquidity', () => {
      const reducedLiq = { ...safeMarketConditions, volume: 550 }; // 45% of avg
      const result = applySafetyOverrides(validDecision, reducedLiq);
      expect(result.overridden).toBe(false);
      expect(result.warnings.some(w => w.rule === 'REDUCED_LIQUIDITY')).toBe(true);
    });

    it('should handle multiple overrides', () => {
      const dangerous = {
        volatility: 0.08,
        volume: 200,
        avgVolume: 1000,
        spread: 0.002,
        price: 90000,
        majorEventSoon: true,
        priceChange24h: 20
      };
      const result = applySafetyOverrides(validDecision, dangerous);
      expect(result.overridden).toBe(true);
      expect(result.overrides.length).toBeGreaterThan(1);
    });
  });

  describe('validateTradingHours', () => {
    it('should allow trading at normal hours', () => {
      const normalTime = new Date('2024-01-15T12:00:00Z'); // Monday noon
      const result = validateTradingHours(normalTime);
      expect(result.allowed).toBe(true);
    });

    it('should warn during low-activity hours', () => {
      const lowActivity = new Date('2024-01-15T02:00:00Z'); // 2 AM UTC
      const result = validateTradingHours(lowActivity);
      expect(result.allowed).toBe(true);
      expect(result.warnings.some(w => w.rule === 'LOW_ACTIVITY_HOURS')).toBe(true);
    });

    it('should warn on Sundays', () => {
      const sunday = new Date('2024-01-14T12:00:00Z'); // Sunday
      const result = validateTradingHours(sunday);
      expect(result.allowed).toBe(true);
      expect(result.warnings.some(w => w.rule === 'SUNDAY_TRADING')).toBe(true);
    });
  });

  describe('performSafetyGate', () => {
    it('should approve safe trade', () => {
      const result = performSafetyGate(
        validDecision,
        safeMarketConditions,
        new Date('2024-01-15T12:00:00Z')
      );
      expect(result.approved).toBe(true);
      expect(result.summary).toContain('approved');
    });

    it('should block unsafe trade', () => {
      const unsafeConditions = {
        ...safeMarketConditions,
        volatility: 0.08
      };
      const result = performSafetyGate(
        validDecision,
        unsafeConditions,
        new Date('2024-01-15T12:00:00Z')
      );
      expect(result.approved).toBe(false);
      expect(result.summary).toContain('blocked');
    });

    it('should block if AI says NO', () => {
      const noDecision = { ...validDecision, trade_decision: 'NO' };
      const result = performSafetyGate(
        noDecision,
        safeMarketConditions,
        new Date('2024-01-15T12:00:00Z')
      );
      expect(result.approved).toBe(false);
    });

    it('should include all safety check results', () => {
      const result = performSafetyGate(
        validDecision,
        safeMarketConditions,
        new Date('2024-01-15T12:00:00Z')
      );
      expect(result.marketSafety).toBeDefined();
      expect(result.timeValidation).toBeDefined();
      expect(result.details).toBeDefined();
    });
  });
});

describe('Edge Cases and Integration', () => {
  it('should handle missing optional market data gracefully', () => {
    const minimalConditions = {
      volatility: 0.02,
      spread: 0.0005,
      price: 90000
    };
    const result = checkMarketSafety(minimalConditions);
    expect(result).toBeDefined();
  });

  it('should handle zero values correctly', () => {
    const zeroValues = {
      volatility: 0,
      volume: 0,
      avgVolume: 1000,
      spread: 0,
      price: 90000,
      priceChange24h: 0
    };
    const result = checkMarketSafety(zeroValues);
    expect(result).toBeDefined();
  });

  it('should validate complete workflow', () => {
    const decision = {
      trade_decision: 'YES',
      direction: 'LONG',
      entry_price: 90000,
      stop_loss: 88200,
      stop_loss_source: '5M_SWING',
      take_profit: 93600,
      position_size_btc: 0.0555,
      risk_reward_ratio: 2.0,
      confidence: 85,
      reasoning: 'Complete confluence setup with all 4 requirements met. Swing-based stop provides optimal risk management with 2:1 reward ratio.'
    };

    const setupData = {
      bias: 'BULLISH',
      currentPrice: 90000,
      accountBalance: 10000
    };

    const marketConditions = {
      volatility: 0.02,
      volume: 1000,
      avgVolume: 1200,
      spread: 0.0005,
      price: 90000,
      majorEventSoon: false,
      priceChange24h: 3
    };

    // Step 1: Structure validation
    const structureResult = validateDecisionStructure(decision);
    expect(structureResult.valid).toBe(true);

    // Step 2: Decision validation
    const validationResult = validateAIDecision(decision, setupData);
    expect(validationResult.valid).toBe(true);

    // Step 3: Safety gate
    const safetyResult = performSafetyGate(decision, marketConditions);
    expect(safetyResult.approved).toBe(true);
  });
});
