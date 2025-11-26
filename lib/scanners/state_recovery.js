/**
 * State Recovery for Confluence Detection
 * Recovers and resumes active confluence states after system restart
 *
 * Features:
 * - Loads incomplete confluence states from database
 * - Expires stale states (>12 hours)
 * - Resumes monitoring for valid active states
 * - Cleans up old expired states
 */

import { createLogger } from '../utils/logger.js';
import {
  getActiveConfluenceStates,
  expireConfluenceState,
  updateConfluenceState
} from '../../database/queries.js';
import { isExpired, validateState, getTimeRemaining } from './validator.js';

const logger = createLogger('state_recovery');

/**
 * Recover all active confluence states on system startup
 * @returns {Object} Recovery summary
 */
export async function recoverActiveStates() {
  logger.info('Starting confluence state recovery');

  try {
    // Get all active (incomplete) confluence states
    const activeStates = await getActiveConfluenceStates();

    if (!activeStates || activeStates.length === 0) {
      logger.info('No active confluence states to recover');
      return {
        total: 0,
        recovered: 0,
        expired: 0,
        invalid: 0
      };
    }

    logger.info(`Found ${activeStates.length} active confluence states`);

    let recovered = 0;
    let expired = 0;
    let invalid = 0;

    // Process each state
    for (const state of activeStates) {
      const result = await processStateRecovery(state);

      if (result === 'recovered') {
        recovered++;
      } else if (result === 'expired') {
        expired++;
      } else if (result === 'invalid') {
        invalid++;
      }
    }

    const summary = {
      total: activeStates.length,
      recovered,
      expired,
      invalid
    };

    logger.info('Confluence state recovery complete', summary);

    return summary;
  } catch (error) {
    logger.error('State recovery failed', { error: error.message });
    throw error;
  }
}

/**
 * Process recovery for a single confluence state
 * @param {Object} state - Confluence state to recover
 * @returns {string} Recovery result: 'recovered', 'expired', or 'invalid'
 */
async function processStateRecovery(state) {
  logger.debug('Processing state recovery', {
    id: state.id,
    currentState: state.current_state,
    bias: state.bias,
    age: getStateAge(state)
  });

  // Validate state structure
  const validation = validateState(state);
  if (!validation.valid) {
    logger.warn('Invalid state structure during recovery', {
      id: state.id,
      errors: validation.errors
    });
    return 'invalid';
  }

  // Check for expiration
  if (isExpired(state)) {
    logger.info('Expiring stale state during recovery', {
      id: state.id,
      age: getStateAge(state)
    });
    await expireConfluenceState(state.id);
    return 'expired';
  }

  // State is valid and not expired - resume monitoring
  await resumeStateMonitoring(state);
  return 'recovered';
}

/**
 * Resume monitoring for a recovered state
 * @param {Object} state - Confluence state to resume
 */
export async function resumeStateMonitoring(state) {
  logger.info('Resuming monitoring for confluence state', {
    id: state.id,
    currentState: state.current_state,
    bias: state.bias,
    timeRemaining: formatTimeRemaining(getTimeRemaining(state))
  });

  // Mark that state was recovered (optional metadata)
  // This could be useful for tracking system restarts
  // await updateConfluenceState(state.id, {
  //   last_recovery: new Date().toISOString()
  // });

  // The 5M scanner will pick up this state in its next scan cycle
  // No additional action needed here
}

/**
 * Expire all stale confluence states (older than 12 hours)
 * Run this periodically as a cleanup job
 * @returns {number} Number of states expired
 */
export async function expireStaleStates() {
  logger.info('Starting stale state cleanup');

  try {
    const activeStates = await getActiveConfluenceStates();

    if (!activeStates || activeStates.length === 0) {
      logger.debug('No active states to clean up');
      return 0;
    }

    let expiredCount = 0;

    for (const state of activeStates) {
      if (isExpired(state)) {
        logger.info('Expiring stale state', {
          id: state.id,
          age: getStateAge(state)
        });
        await expireConfluenceState(state.id);
        expiredCount++;
      }
    }

    logger.info('Stale state cleanup complete', { expired: expiredCount });

    return expiredCount;
  } catch (error) {
    logger.error('Stale state cleanup failed', { error: error.message });
    throw error;
  }
}

/**
 * Validate a restored state is still valid for monitoring
 * @param {Object} state - Restored state
 * @returns {Object} Validation result
 */
export function validateRestoredState(state) {
  const validation = validateState(state);

  if (!validation.valid) {
    return validation;
  }

  // Additional checks for restored states
  const errors = [];

  // Check not expired
  if (isExpired(state)) {
    errors.push('State has expired');
  }

  // Check state is in a valid monitoring state
  const monitorableStates = ['WAITING_CHOCH', 'WAITING_FVG', 'WAITING_BOS'];
  if (!monitorableStates.includes(state.current_state)) {
    errors.push(`State ${state.current_state} is not monitorable`);
  }

  // Check sweep_id references exist
  if (!state.sweep_id) {
    errors.push('Missing sweep reference');
  }

  return {
    valid: errors.length === 0,
    errors: [...validation.errors, ...errors]
  };
}

/**
 * Get state age in milliseconds
 * @param {Object} state - Confluence state
 * @returns {number} Age in milliseconds
 */
function getStateAge(state) {
  if (!state.created_at) {
    return 0;
  }
  const createdAt = new Date(state.created_at).getTime();
  return Date.now() - createdAt;
}

/**
 * Format time remaining as human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time
 */
function formatTimeRemaining(ms) {
  if (ms <= 0) {
    return 'expired';
  }

  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get recovery statistics from database
 * @returns {Object} Recovery statistics
 */
export async function getRecoveryStats() {
  try {
    const activeStates = await getActiveConfluenceStates();

    if (!activeStates || activeStates.length === 0) {
      return {
        totalActive: 0,
        byState: {},
        byBias: {},
        expiringSoon: 0
      };
    }

    const stats = {
      totalActive: activeStates.length,
      byState: {},
      byBias: {},
      expiringSoon: 0
    };

    // Count by state
    for (const state of activeStates) {
      // Count by current state
      if (!stats.byState[state.current_state]) {
        stats.byState[state.current_state] = 0;
      }
      stats.byState[state.current_state]++;

      // Count by bias
      if (!stats.byBias[state.bias]) {
        stats.byBias[state.bias] = 0;
      }
      stats.byBias[state.bias]++;

      // Count expiring soon (within 1 hour)
      const remaining = getTimeRemaining(state);
      if (remaining > 0 && remaining < 60 * 60 * 1000) {
        stats.expiringSoon++;
      }
    }

    return stats;
  } catch (error) {
    logger.error('Failed to get recovery stats', { error: error.message });
    throw error;
  }
}

/**
 * Perform health check on all active states
 * Identifies states that may need attention
 * @returns {Object} Health check results
 */
export async function healthCheckActiveStates() {
  logger.info('Performing health check on active states');

  try {
    const activeStates = await getActiveConfluenceStates();

    if (!activeStates || activeStates.length === 0) {
      return {
        healthy: true,
        totalStates: 0,
        warnings: []
      };
    }

    const warnings = [];
    let healthyCount = 0;

    for (const state of activeStates) {
      // Check if expired
      if (isExpired(state)) {
        warnings.push({
          id: state.id,
          issue: 'State has expired',
          severity: 'high'
        });
        continue;
      }

      // Check if expiring soon
      const remaining = getTimeRemaining(state);
      if (remaining < 60 * 60 * 1000) {
        warnings.push({
          id: state.id,
          issue: `Expiring soon (${formatTimeRemaining(remaining)} remaining)`,
          severity: 'medium'
        });
      }

      // Check if stuck in same state for too long
      const age = getStateAge(state);
      if (age > 6 * 60 * 60 * 1000) { // 6 hours
        warnings.push({
          id: state.id,
          issue: `State ${state.current_state} for ${formatTimeRemaining(age)}`,
          severity: 'low'
        });
      }

      healthyCount++;
    }

    return {
      healthy: warnings.length === 0,
      totalStates: activeStates.length,
      healthyStates: healthyCount,
      warnings
    };
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    throw error;
  }
}

export default {
  recoverActiveStates,
  resumeStateMonitoring,
  expireStaleStates,
  validateRestoredState,
  getRecoveryStats,
  healthCheckActiveStates
};
