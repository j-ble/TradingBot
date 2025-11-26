/**
 * Pattern Validation for Confluence Detection
 * Validates confluence completeness, sequence order, expiration, and price action
 *
 * Validation Rules:
 * - All three patterns detected (CHoCH, FVG, BOS)
 * - Correct sequence order: CHoCH → FVG → BOS
 * - Not expired (< 12 hours)
 * - Price action consistent with bias
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('validator');

// Confluence timeout (12 hours in milliseconds)
const CONFLUENCE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/**
 * Validate complete confluence setup
 * @param {Object} confluenceState - The confluence state to validate
 * @returns {Object} Validation result with details
 */
export function validateConfluence(confluenceState) {
  if (!confluenceState) {
    return {
      valid: false,
      errors: ['Confluence state is null or undefined']
    };
  }

  const checks = {
    chochValid: validateCHoCH(confluenceState),
    fvgValid: validateFVG(confluenceState),
    bosValid: validateBOS(confluenceState),
    sequenceValid: isCorrectSequence(confluenceState),
    timeValid: !isExpired(confluenceState),
    priceValid: isPriceActionValid(confluenceState)
  };

  const errors = [];

  if (!checks.chochValid.valid) {
    errors.push(`CHoCH validation failed: ${checks.chochValid.error}`);
  }
  if (!checks.fvgValid.valid) {
    errors.push(`FVG validation failed: ${checks.fvgValid.error}`);
  }
  if (!checks.bosValid.valid) {
    errors.push(`BOS validation failed: ${checks.bosValid.error}`);
  }
  if (!checks.sequenceValid.valid) {
    errors.push(`Sequence validation failed: ${checks.sequenceValid.error}`);
  }
  if (!checks.timeValid) {
    errors.push('Confluence has expired (>12 hours)');
  }
  if (!checks.priceValid.valid) {
    errors.push(`Price action validation failed: ${checks.priceValid.error}`);
  }

  const valid = errors.length === 0;

  if (valid) {
    logger.info('Confluence validation passed', {
      confluenceId: confluenceState.id,
      bias: confluenceState.bias
    });
  } else {
    logger.warn('Confluence validation failed', {
      confluenceId: confluenceState.id,
      errors
    });
  }

  return {
    valid,
    errors,
    checks
  };
}

/**
 * Validate CHoCH detection
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
function validateCHoCH(state) {
  if (!state.choch_detected) {
    return { valid: false, error: 'CHoCH not detected' };
  }

  if (!state.choch_time) {
    return { valid: false, error: 'CHoCH timestamp missing' };
  }

  if (!state.choch_price || parseFloat(state.choch_price) <= 0) {
    return { valid: false, error: 'CHoCH price invalid or missing' };
  }

  return { valid: true };
}

/**
 * Validate FVG detection and fill
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
function validateFVG(state) {
  if (!state.fvg_detected) {
    return { valid: false, error: 'FVG not detected' };
  }

  if (!state.fvg_zone_low || !state.fvg_zone_high) {
    return { valid: false, error: 'FVG zone boundaries missing' };
  }

  const zoneLow = parseFloat(state.fvg_zone_low);
  const zoneHigh = parseFloat(state.fvg_zone_high);

  if (zoneLow <= 0 || zoneHigh <= 0) {
    return { valid: false, error: 'FVG zone prices invalid' };
  }

  if (zoneLow >= zoneHigh) {
    return { valid: false, error: 'FVG zone bottom must be less than top' };
  }

  if (!state.fvg_fill_time) {
    return { valid: false, error: 'FVG fill timestamp missing' };
  }

  if (!state.fvg_fill_price || parseFloat(state.fvg_fill_price) <= 0) {
    return { valid: false, error: 'FVG fill price invalid or missing' };
  }

  return { valid: true };
}

/**
 * Validate BOS detection
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
function validateBOS(state) {
  if (!state.bos_detected) {
    return { valid: false, error: 'BOS not detected' };
  }

  if (!state.bos_time) {
    return { valid: false, error: 'BOS timestamp missing' };
  }

  if (!state.bos_price || parseFloat(state.bos_price) <= 0) {
    return { valid: false, error: 'BOS price invalid or missing' };
  }

  return { valid: true };
}

/**
 * Check if confluence sequence occurred in correct order
 * CHoCH must come before FVG fill, which must come before BOS
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
export function isCorrectSequence(state) {
  if (!state.choch_time || !state.fvg_fill_time || !state.bos_time) {
    return {
      valid: false,
      error: 'Missing timestamps for sequence validation'
    };
  }

  const chochTime = new Date(state.choch_time).getTime();
  const fvgTime = new Date(state.fvg_fill_time).getTime();
  const bosTime = new Date(state.bos_time).getTime();

  // Check CHoCH before FVG
  if (chochTime >= fvgTime) {
    return {
      valid: false,
      error: `CHoCH must occur before FVG fill (CHoCH: ${state.choch_time}, FVG: ${state.fvg_fill_time})`
    };
  }

  // Check FVG before BOS
  if (fvgTime >= bosTime) {
    return {
      valid: false,
      error: `FVG fill must occur before BOS (FVG: ${state.fvg_fill_time}, BOS: ${state.bos_time})`
    };
  }

  return { valid: true };
}

/**
 * Check if confluence has expired (>12 hours)
 * @param {Object} state - Confluence state
 * @returns {boolean} True if expired
 */
export function isExpired(state) {
  if (!state.created_at) {
    logger.warn('Confluence state missing created_at timestamp', { id: state.id });
    return true;
  }

  const createdAt = new Date(state.created_at).getTime();
  const now = Date.now();
  const elapsed = now - createdAt;

  return elapsed > CONFLUENCE_TIMEOUT_MS;
}

/**
 * Validate price action is consistent with bias
 * For BULLISH: prices should be ascending
 * For BEARISH: prices should be descending
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
export function isPriceActionValid(state) {
  if (!state.bias) {
    return { valid: false, error: 'Bias not set' };
  }

  if (!state.choch_price || !state.fvg_zone_low || !state.fvg_zone_high || !state.bos_price) {
    return { valid: false, error: 'Missing price data for validation' };
  }

  const chochPrice = parseFloat(state.choch_price);
  const fvgLow = parseFloat(state.fvg_zone_low);
  const fvgHigh = parseFloat(state.fvg_zone_high);
  const bosPrice = parseFloat(state.bos_price);

  if (state.bias === 'BULLISH') {
    // For bullish: CHoCH should break up, BOS should be higher
    // CHoCH price should be below or near FVG zone
    // BOS should break above CHoCH level
    if (bosPrice <= chochPrice) {
      return {
        valid: false,
        error: `BULLISH: BOS price (${bosPrice}) should be above CHoCH price (${chochPrice})`
      };
    }
  } else if (state.bias === 'BEARISH') {
    // For bearish: CHoCH should break down, BOS should be lower
    // CHoCH price should be above or near FVG zone
    // BOS should break below CHoCH level
    if (bosPrice >= chochPrice) {
      return {
        valid: false,
        error: `BEARISH: BOS price (${bosPrice}) should be below CHoCH price (${chochPrice})`
      };
    }
  } else {
    return { valid: false, error: `Invalid bias: ${state.bias}` };
  }

  return { valid: true };
}

/**
 * Validate individual state fields
 * @param {Object} state - Confluence state
 * @returns {Object} Validation result
 */
export function validateState(state) {
  if (!state) {
    return { valid: false, error: 'State is null or undefined' };
  }

  const errors = [];

  // Required fields
  if (!state.id) errors.push('Missing state ID');
  if (!state.sweep_id) errors.push('Missing sweep ID');
  if (!state.current_state) errors.push('Missing current state');
  if (!state.bias) errors.push('Missing bias');

  // Valid state values
  const validStates = ['WAITING_CHOCH', 'WAITING_FVG', 'WAITING_BOS', 'COMPLETE', 'EXPIRED'];
  if (state.current_state && !validStates.includes(state.current_state)) {
    errors.push(`Invalid state: ${state.current_state}`);
  }

  // Valid bias values
  const validBias = ['BULLISH', 'BEARISH'];
  if (state.bias && !validBias.includes(state.bias)) {
    errors.push(`Invalid bias: ${state.bias}`);
  }

  // Timestamps
  if (!state.created_at) errors.push('Missing created_at timestamp');

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get time remaining before confluence expires
 * @param {Object} state - Confluence state
 * @returns {number} Milliseconds remaining (0 if expired)
 */
export function getTimeRemaining(state) {
  if (!state.created_at) {
    return 0;
  }

  const createdAt = new Date(state.created_at).getTime();
  const expiresAt = createdAt + CONFLUENCE_TIMEOUT_MS;
  const remaining = expiresAt - Date.now();

  return Math.max(0, remaining);
}

/**
 * Get time elapsed since confluence creation
 * @param {Object} state - Confluence state
 * @returns {number} Milliseconds elapsed
 */
export function getTimeElapsed(state) {
  if (!state.created_at) {
    return 0;
  }

  const createdAt = new Date(state.created_at).getTime();
  return Date.now() - createdAt;
}

/**
 * Check if confluence is close to expiring (within 1 hour)
 * @param {Object} state - Confluence state
 * @returns {boolean} True if expiring soon
 */
export function isExpiringSoon(state) {
  const remaining = getTimeRemaining(state);
  const oneHour = 60 * 60 * 1000;
  return remaining > 0 && remaining < oneHour;
}

export default {
  validateConfluence,
  validateState,
  isCorrectSequence,
  isExpired,
  isPriceActionValid,
  getTimeRemaining,
  getTimeElapsed,
  isExpiringSoon,
  CONFLUENCE_TIMEOUT_MS
};
