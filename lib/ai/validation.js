/**
 * AI Decision Validation Module
 *
 * Validates AI trading decisions against rules and constraints before execution.
 * Ensures all decisions meet safety, risk management, and trading strategy requirements.
 */

const logger = require('../utils/logger');
const { calculatePositionSize } = require('../trading/position_sizer');

/**
 * Validates an AI trading decision against all required criteria
 *
 * @param {Object} decision - AI decision object
 * @param {string} decision.trade_decision - "YES" or "NO"
 * @param {string} decision.direction - "LONG" or "SHORT"
 * @param {number} decision.entry_price - Proposed entry price
 * @param {number} decision.stop_loss - Stop loss price
 * @param {string} decision.stop_loss_source - "5M_SWING" or "4H_SWING"
 * @param {number} decision.take_profit - Take profit price
 * @param {number} decision.position_size_btc - Position size in BTC
 * @param {number} decision.risk_reward_ratio - R/R ratio
 * @param {number} decision.confidence - Confidence score (0-100)
 * @param {string} decision.reasoning - AI reasoning
 * @param {Object} setupData - Market setup data for validation
 * @param {string} setupData.bias - Market bias ("BULLISH" or "BEARISH")
 * @param {number} setupData.currentPrice - Current BTC price
 * @param {number} setupData.accountBalance - Account balance in USD
 * @returns {Object} Validation result with valid flag and error list
 */
function validateAIDecision(decision, setupData) {
  const errors = [];

  // 1. Trade decision must be YES or NO
  if (!['YES', 'NO'].includes(decision.trade_decision)) {
    errors.push('Invalid trade_decision value - must be YES or NO');
  }

  // Skip further validation if decision is NO
  if (decision.trade_decision === 'NO') {
    return {
      valid: true,
      errors: [],
      warnings: [],
      message: 'AI decided not to trade - validation skipped'
    };
  }

  // 2. Direction must match bias
  const expectedDirection = setupData.bias === 'BULLISH' ? 'LONG' : 'SHORT';
  if (decision.direction !== expectedDirection) {
    errors.push(`Direction ${decision.direction} doesn't match bias ${setupData.bias} (expected ${expectedDirection})`);
  }

  // 3. Entry price within 0.5% of current
  const entryDiff = Math.abs(decision.entry_price - setupData.currentPrice) / setupData.currentPrice;
  if (entryDiff > 0.005) {
    errors.push(`Entry price $${decision.entry_price} is ${(entryDiff * 100).toFixed(2)}% away from current price $${setupData.currentPrice} (max 0.5%)`);
  }

  // 4. Stop loss on correct side
  if (decision.direction === 'LONG' && decision.stop_loss >= decision.entry_price) {
    errors.push(`Stop loss $${decision.stop_loss} must be below entry $${decision.entry_price} for LONG position`);
  }
  if (decision.direction === 'SHORT' && decision.stop_loss <= decision.entry_price) {
    errors.push(`Stop loss $${decision.stop_loss} must be above entry $${decision.entry_price} for SHORT position`);
  }

  // 5. Stop loss distance 0.5%-3%
  const stopDistance = Math.abs(decision.entry_price - decision.stop_loss) / decision.entry_price;
  const stopDistancePercent = stopDistance * 100;

  if (stopDistance < 0.005) {
    errors.push(`Stop distance ${stopDistancePercent.toFixed(2)}% is too tight (minimum 0.5%)`);
  }
  if (stopDistance > 0.03) {
    errors.push(`Stop distance ${stopDistancePercent.toFixed(2)}% is too wide (maximum 3%)`);
  }

  // 6. Take profit on correct side
  if (decision.direction === 'LONG' && decision.take_profit <= decision.entry_price) {
    errors.push(`Take profit $${decision.take_profit} must be above entry $${decision.entry_price} for LONG position`);
  }
  if (decision.direction === 'SHORT' && decision.take_profit >= decision.entry_price) {
    errors.push(`Take profit $${decision.take_profit} must be below entry $${decision.entry_price} for SHORT position`);
  }

  // 7. R/R ratio >= 2:1
  if (decision.risk_reward_ratio < 2.0) {
    errors.push(`R/R ratio ${decision.risk_reward_ratio.toFixed(2)}:1 is below 2:1 minimum`);
  }

  // Validate R/R ratio calculation
  const actualStopDistance = Math.abs(decision.entry_price - decision.stop_loss);
  const actualTargetDistance = Math.abs(decision.take_profit - decision.entry_price);
  const actualRRRatio = actualTargetDistance / actualStopDistance;

  if (Math.abs(actualRRRatio - decision.risk_reward_ratio) > 0.1) {
    errors.push(`R/R ratio mismatch: reported ${decision.risk_reward_ratio.toFixed(2)}, calculated ${actualRRRatio.toFixed(2)}`);
  }

  // 8. Confidence >= 70
  if (decision.confidence < 70) {
    errors.push(`Confidence ${decision.confidence} is below 70 threshold`);
  }

  // 9. Confidence <= 100
  if (decision.confidence > 100) {
    errors.push(`Confidence ${decision.confidence} exceeds 100 maximum`);
  }

  // 10. Position size reasonable (within 5% of expected)
  const expectedSize = calculatePositionSize(
    setupData.accountBalance,
    decision.entry_price,
    decision.stop_loss
  );

  const sizeDiff = Math.abs(decision.position_size_btc - expectedSize.btc) / expectedSize.btc;
  if (sizeDiff > 0.05) {
    errors.push(`Position size ${decision.position_size_btc.toFixed(8)} BTC differs from expected ${expectedSize.btc.toFixed(8)} BTC by ${(sizeDiff * 100).toFixed(2)}% (max 5%)`);
  }

  // 11. Stop loss source must be valid
  if (!['5M_SWING', '4H_SWING'].includes(decision.stop_loss_source)) {
    errors.push(`Invalid stop_loss_source: ${decision.stop_loss_source} (must be 5M_SWING or 4H_SWING)`);
  }

  // 12. Reasoning must be provided and substantial
  if (!decision.reasoning || decision.reasoning.length < 50) {
    errors.push('AI reasoning is missing or too brief (minimum 50 characters)');
  }

  // 13. All required fields present
  const requiredFields = [
    'trade_decision', 'direction', 'entry_price', 'stop_loss',
    'stop_loss_source', 'take_profit', 'position_size_btc',
    'risk_reward_ratio', 'confidence', 'reasoning'
  ];

  const missingFields = requiredFields.filter(field => !(field in decision));
  if (missingFields.length > 0) {
    errors.push(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Log validation results
  if (errors.length > 0) {
    logger.warn('AI decision validation failed', {
      errors,
      decision,
      setupData
    });
  } else {
    logger.info('AI decision validation passed', {
      direction: decision.direction,
      entry: decision.entry_price,
      stop: decision.stop_loss,
      tp: decision.take_profit,
      rr: decision.risk_reward_ratio,
      confidence: decision.confidence
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: [],
    message: errors.length === 0
      ? 'AI decision validated successfully'
      : `Validation failed with ${errors.length} error(s)`
  };
}

/**
 * Validates that the decision structure has all required fields
 * (Used before full validation to ensure parseability)
 *
 * @param {Object} decision - AI decision object
 * @returns {Object} Structure validation result
 */
function validateDecisionStructure(decision) {
  const errors = [];

  if (!decision || typeof decision !== 'object') {
    errors.push('Decision must be a valid object');
    return { valid: false, errors };
  }

  const requiredFields = {
    trade_decision: 'string',
    direction: 'string',
    entry_price: 'number',
    stop_loss: 'number',
    stop_loss_source: 'string',
    take_profit: 'number',
    position_size_btc: 'number',
    risk_reward_ratio: 'number',
    confidence: 'number',
    reasoning: 'string'
  };

  for (const [field, expectedType] of Object.entries(requiredFields)) {
    if (!(field in decision)) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof decision[field] !== expectedType) {
      errors.push(`Field ${field} must be ${expectedType}, got ${typeof decision[field]}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates swing-based stop loss is within acceptable range
 *
 * @param {Object} decision - AI decision
 * @param {Object} swingData - Swing level data
 * @param {number} swingData.swing5MPrice - 5M swing price (if available)
 * @param {number} swingData.swing4HPrice - 4H swing price (if available)
 * @returns {Object} Validation result
 */
function validateSwingBasedStop(decision, swingData) {
  const errors = [];
  const warnings = [];

  // Verify stop loss is near a swing level
  const stopPrice = decision.stop_loss;
  const swing5M = swingData.swing5MPrice;
  const swing4H = swingData.swing4HPrice;

  if (decision.stop_loss_source === '5M_SWING' && swing5M) {
    // Check stop is within 0.2-0.5% of 5M swing
    const deviation = Math.abs(stopPrice - swing5M) / swing5M;

    if (deviation > 0.005) {
      warnings.push(`Stop $${stopPrice} is ${(deviation * 100).toFixed(2)}% away from 5M swing $${swing5M} (expected <0.5%)`);
    }
  } else if (decision.stop_loss_source === '4H_SWING' && swing4H) {
    // Check stop is within 0.2-0.5% of 4H swing
    const deviation = Math.abs(stopPrice - swing4H) / swing4H;

    if (deviation > 0.005) {
      warnings.push(`Stop $${stopPrice} is ${(deviation * 100).toFixed(2)}% away from 4H swing $${swing4H} (expected <0.5%)`);
    }
  } else {
    errors.push(`Cannot verify swing-based stop: ${decision.stop_loss_source} swing data not available`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateAIDecision,
  validateDecisionStructure,
  validateSwingBasedStop
};
