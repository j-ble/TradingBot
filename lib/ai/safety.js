/**
 * AI Decision Safety Checks and Overrides
 *
 * Provides safety mechanisms to override AI decisions when market conditions
 * are unsafe or abnormal, protecting against edge cases and extreme scenarios.
 */

const logger = require('../utils/logger');

/**
 * Applies safety overrides to AI decision based on market conditions
 * Will force decision to "NO" if any critical safety condition is violated
 *
 * @param {Object} decision - AI trading decision
 * @param {Object} marketConditions - Current market conditions
 * @param {number} marketConditions.volatility - Current volatility (decimal, e.g., 0.05 = 5%)
 * @param {number} marketConditions.volume - Current 24h volume
 * @param {number} marketConditions.avgVolume - Average 24h volume
 * @param {number} marketConditions.spread - Current bid-ask spread (decimal)
 * @param {number} marketConditions.price - Current BTC price
 * @param {boolean} marketConditions.majorEventSoon - Major economic event in next 2 hours
 * @param {number} marketConditions.priceChange24h - 24h price change percentage
 * @returns {Object} Decision with safety overrides applied
 */
function applySafetyOverrides(decision, marketConditions) {
  const overrides = [];
  const warnings = [];
  let originalDecision = decision.trade_decision;

  // 1. Extreme volatility check (>5% hourly volatility)
  if (marketConditions.volatility > 0.05) {
    overrides.push({
      rule: 'EXTREME_VOLATILITY',
      message: `Volatility ${(marketConditions.volatility * 100).toFixed(2)}% exceeds 5% threshold`,
      severity: 'CRITICAL'
    });
    decision.trade_decision = 'NO';
  }

  // 2. Low liquidity check (volume < 30% of average)
  if (marketConditions.volume && marketConditions.avgVolume) {
    const volumeRatio = marketConditions.volume / marketConditions.avgVolume;

    if (volumeRatio < 0.3) {
      overrides.push({
        rule: 'LOW_LIQUIDITY',
        message: `Volume ${marketConditions.volume} is ${(volumeRatio * 100).toFixed(0)}% of average (threshold: 30%)`,
        severity: 'CRITICAL'
      });
      decision.trade_decision = 'NO';
    } else if (volumeRatio < 0.5) {
      warnings.push({
        rule: 'REDUCED_LIQUIDITY',
        message: `Volume is ${(volumeRatio * 100).toFixed(0)}% of average - proceed with caution`,
        severity: 'WARNING'
      });
    }
  }

  // 3. Spread too wide check (>0.1%)
  if (marketConditions.spread > 0.001) {
    overrides.push({
      rule: 'WIDE_SPREAD',
      message: `Bid-ask spread ${(marketConditions.spread * 100).toFixed(3)}% exceeds 0.1% threshold`,
      severity: 'CRITICAL'
    });
    decision.trade_decision = 'NO';
  }

  // 4. Major economic event approaching
  if (marketConditions.majorEventSoon) {
    overrides.push({
      rule: 'MAJOR_EVENT',
      message: 'Major economic event within 2 hours - avoiding new positions',
      severity: 'HIGH'
    });
    decision.trade_decision = 'NO';
  }

  // 5. Extreme 24h price movement (>15%)
  if (marketConditions.priceChange24h && Math.abs(marketConditions.priceChange24h) > 15) {
    overrides.push({
      rule: 'EXTREME_PRICE_MOVEMENT',
      message: `24h price change ${marketConditions.priceChange24h.toFixed(2)}% exceeds ±15% threshold`,
      severity: 'HIGH'
    });
    decision.trade_decision = 'NO';
  }

  // 6. Price validation - reject if price appears incorrect
  if (marketConditions.price) {
    // BTC should be between $10,000 and $500,000 (sanity check)
    if (marketConditions.price < 10000 || marketConditions.price > 500000) {
      overrides.push({
        rule: 'INVALID_PRICE',
        message: `Price $${marketConditions.price} outside expected range ($10,000-$500,000)`,
        severity: 'CRITICAL'
      });
      decision.trade_decision = 'NO';
    }
  }

  // Log override actions
  if (overrides.length > 0) {
    logger.warn('Safety overrides applied to AI decision', {
      originalDecision,
      newDecision: decision.trade_decision,
      overrideCount: overrides.length,
      overrides: overrides.map(o => o.rule),
      marketConditions
    });
  }

  if (warnings.length > 0) {
    logger.info('Safety warnings for AI decision', {
      warnings: warnings.map(w => w.rule),
      marketConditions
    });
  }

  return {
    decision,
    overridden: overrides.length > 0,
    overrides,
    warnings,
    summary: overrides.length > 0
      ? `Decision overridden due to ${overrides.length} safety violation(s)`
      : warnings.length > 0
        ? `Decision allowed with ${warnings.length} warning(s)`
        : 'No safety issues detected'
  };
}

/**
 * Checks if current market conditions are safe for trading
 * Returns detailed breakdown of safety checks
 *
 * @param {Object} marketConditions - Current market conditions
 * @returns {Object} Safety check results
 */
function checkMarketSafety(marketConditions) {
  const checks = {
    volatility: {
      passed: marketConditions.volatility <= 0.05,
      value: marketConditions.volatility,
      threshold: 0.05,
      message: marketConditions.volatility <= 0.05
        ? 'Volatility within acceptable range'
        : 'Volatility too high'
    },
    liquidity: {
      passed: !marketConditions.avgVolume ||
              (marketConditions.volume / marketConditions.avgVolume) >= 0.3,
      value: marketConditions.avgVolume
        ? (marketConditions.volume / marketConditions.avgVolume)
        : null,
      threshold: 0.3,
      message: !marketConditions.avgVolume
        ? 'Volume data unavailable'
        : (marketConditions.volume / marketConditions.avgVolume) >= 0.3
          ? 'Liquidity sufficient'
          : 'Liquidity too low'
    },
    spread: {
      passed: marketConditions.spread <= 0.001,
      value: marketConditions.spread,
      threshold: 0.001,
      message: marketConditions.spread <= 0.001
        ? 'Spread acceptable'
        : 'Spread too wide'
    },
    priceMovement: {
      passed: !marketConditions.priceChange24h ||
              Math.abs(marketConditions.priceChange24h) <= 15,
      value: marketConditions.priceChange24h,
      threshold: 15,
      message: !marketConditions.priceChange24h
        ? 'Price movement data unavailable'
        : Math.abs(marketConditions.priceChange24h) <= 15
          ? '24h price movement normal'
          : '24h price movement extreme'
    },
    economicEvents: {
      passed: !marketConditions.majorEventSoon,
      value: marketConditions.majorEventSoon,
      message: marketConditions.majorEventSoon
        ? 'Major event approaching - trading not recommended'
        : 'No major events scheduled'
    },
    priceValidity: {
      passed: !marketConditions.price ||
              (marketConditions.price >= 10000 && marketConditions.price <= 500000),
      value: marketConditions.price,
      message: !marketConditions.price
        ? 'Price data unavailable'
        : (marketConditions.price >= 10000 && marketConditions.price <= 500000)
          ? 'Price within expected range'
          : 'Price appears invalid'
    }
  };

  const allPassed = Object.values(checks).every(check => check.passed);
  const failedChecks = Object.entries(checks)
    .filter(([_, check]) => !check.passed)
    .map(([name, _]) => name);

  return {
    safe: allPassed,
    checks,
    failedChecks,
    summary: allPassed
      ? 'All safety checks passed - market conditions safe'
      : `Failed ${failedChecks.length} safety check(s): ${failedChecks.join(', ')}`
  };
}

/**
 * Validates trading is allowed based on time-based rules
 * (Can be extended for day-of-week, time-of-day restrictions)
 *
 * @param {Date} timestamp - Current timestamp
 * @returns {Object} Time-based validation result
 */
function validateTradingHours(timestamp = new Date()) {
  // Currently allows 24/7 trading
  // Can be extended to block weekends, specific hours, etc.

  const warnings = [];
  const hour = timestamp.getUTCHours();
  const day = timestamp.getUTCDay();

  // Example: Warn during low-liquidity hours (UTC 0-4)
  if (hour >= 0 && hour < 4) {
    warnings.push({
      rule: 'LOW_ACTIVITY_HOURS',
      message: `Trading during low-activity hours (${hour}:00 UTC)`,
      severity: 'INFO'
    });
  }

  // Example: Warn on Sundays (day 0)
  if (day === 0) {
    warnings.push({
      rule: 'SUNDAY_TRADING',
      message: 'Trading on Sunday - historically lower liquidity',
      severity: 'INFO'
    });
  }

  return {
    allowed: true, // Currently always allowed
    warnings,
    message: warnings.length > 0
      ? `Trading allowed with ${warnings.length} time-based warning(s)`
      : 'Trading hours validated - no restrictions'
  };
}

/**
 * Comprehensive safety gate - combines all safety checks
 * Returns final go/no-go decision for trade execution
 *
 * @param {Object} decision - AI decision
 * @param {Object} marketConditions - Market conditions
 * @param {Date} timestamp - Current timestamp
 * @returns {Object} Comprehensive safety result
 */
function performSafetyGate(decision, marketConditions, timestamp = new Date()) {
  // Run all safety checks
  const marketSafety = checkMarketSafety(marketConditions);
  const timeValidation = validateTradingHours(timestamp);
  const overrideResult = applySafetyOverrides(decision, marketConditions);

  const allWarnings = [
    ...overrideResult.warnings,
    ...timeValidation.warnings
  ];

  const allOverrides = overrideResult.overrides;

  const safeToTrade = marketSafety.safe &&
                      timeValidation.allowed &&
                      !overrideResult.overridden &&
                      overrideResult.decision.trade_decision === 'YES';

  logger.info('Safety gate check completed', {
    safeToTrade,
    marketSafety: marketSafety.safe,
    timeAllowed: timeValidation.allowed,
    overridden: overrideResult.overridden,
    warningCount: allWarnings.length,
    overrideCount: allOverrides.length
  });

  return {
    approved: safeToTrade,
    decision: overrideResult.decision,
    marketSafety,
    timeValidation,
    overrides: allOverrides,
    warnings: allWarnings,
    summary: safeToTrade
      ? 'Safety gate passed - trade approved'
      : 'Safety gate failed - trade blocked',
    details: {
      marketSafetyPassed: marketSafety.safe,
      timeValidationPassed: timeValidation.allowed,
      decisionOverridden: overrideResult.overridden,
      finalDecision: overrideResult.decision.trade_decision
    }
  };
}

module.exports = {
  applySafetyOverrides,
  checkMarketSafety,
  validateTradingHours,
  performSafetyGate
};
