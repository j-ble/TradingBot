/**
 * Risk Manager
 *
 * Enforces risk management rules and performs pre-trade validation checks.
 * Ensures all trades comply with the bot's risk parameters.
 */

const logger = require('../utils/logger');
const { validatePositionSize, validateRiskReward } = require('./position_sizer');

// Risk limits configuration
const RISK_LIMITS = {
  MAX_POSITIONS: 1, // Maximum concurrent positions
  RISK_PER_TRADE: 0.01, // 1% risk per trade (non-negotiable)
  DAILY_LOSS_LIMIT: 0.03, // 3% daily loss limit
  CONSECUTIVE_LOSS_LIMIT: 3, // Pause after 3 consecutive losses
  MIN_ACCOUNT_BALANCE: 100, // Minimum account balance to trade
  MIN_RR_RATIO: 2.0, // Minimum risk/reward ratio
  MAX_RR_RATIO: 5.0 // Maximum risk/reward ratio (sanity check)
};

/**
 * Get current risk limits
 * @returns {Object} Risk limits configuration
 */
function getRiskLimits() {
  return { ...RISK_LIMITS };
}

/**
 * Check if position limit is reached
 *
 * @param {Object} db - Database connection
 * @returns {Promise<boolean>} True if within limit, false otherwise
 */
async function checkPositionLimit(db) {
  try {
    const result = await db.query(`
      SELECT COUNT(*) as open_positions
      FROM trades
      WHERE status = 'OPEN'
    `);

    const openPositions = parseInt(result.rows[0].open_positions);
    const withinLimit = openPositions < RISK_LIMITS.MAX_POSITIONS;

    if (!withinLimit) {
      logger.warn(`Position limit reached: ${openPositions}/${RISK_LIMITS.MAX_POSITIONS}`);
    }

    return withinLimit;
  } catch (error) {
    logger.error('Error checking position limit:', error);
    return false;
  }
}

/**
 * Check daily loss limit
 *
 * @param {Object} db - Database connection
 * @param {number} accountBalance - Current account balance
 * @returns {Promise<boolean>} True if within limit, false otherwise
 */
async function checkDailyLossLimit(db, accountBalance) {
  try {
    const result = await db.query(`
      SELECT COALESCE(SUM(pnl_usd), 0) as daily_pnl
      FROM trades
      WHERE status = 'CLOSED'
        AND exit_time >= CURRENT_DATE
        AND exit_time < CURRENT_DATE + INTERVAL '1 day'
    `);

    const dailyPnL = parseFloat(result.rows[0].daily_pnl);
    const maxDailyLoss = accountBalance * RISK_LIMITS.DAILY_LOSS_LIMIT;

    // Check if daily loss exceeds limit
    const withinLimit = dailyPnL > -maxDailyLoss;

    if (!withinLimit) {
      logger.warn(`Daily loss limit exceeded: $${dailyPnL.toFixed(2)} / -$${maxDailyLoss.toFixed(2)}`);
    }

    return withinLimit;
  } catch (error) {
    logger.error('Error checking daily loss limit:', error);
    return false;
  }
}

/**
 * Check consecutive losses
 *
 * @param {Object} db - Database connection
 * @returns {Promise<boolean>} True if within limit, false otherwise
 */
async function checkConsecutiveLosses(db) {
  try {
    const result = await db.query(`
      SELECT outcome
      FROM trades
      WHERE status = 'CLOSED'
      ORDER BY exit_time DESC
      LIMIT ${RISK_LIMITS.CONSECUTIVE_LOSS_LIMIT}
    `);

    // Count consecutive losses from most recent trades
    let consecutiveLosses = 0;
    for (const row of result.rows) {
      if (row.outcome === 'LOSS') {
        consecutiveLosses++;
      } else {
        break; // Stop at first win
      }
    }

    const withinLimit = consecutiveLosses < RISK_LIMITS.CONSECUTIVE_LOSS_LIMIT;

    if (!withinLimit) {
      logger.warn(`Consecutive loss limit reached: ${consecutiveLosses} losses`);
    }

    return withinLimit;
  } catch (error) {
    logger.error('Error checking consecutive losses:', error);
    return false;
  }
}

/**
 * Check account balance
 *
 * @param {number} accountBalance - Current account balance
 * @returns {boolean} True if balance is sufficient
 */
function checkAccountBalance(accountBalance) {
  const sufficient = accountBalance >= RISK_LIMITS.MIN_ACCOUNT_BALANCE;

  if (!sufficient) {
    logger.warn(`Account balance too low: $${accountBalance} < $${RISK_LIMITS.MIN_ACCOUNT_BALANCE}`);
  }

  return sufficient;
}

/**
 * Validate stop loss parameters
 *
 * @param {Object} tradeParams - Trade parameters
 * @returns {boolean} True if stop loss is valid
 */
function validateStopLoss(tradeParams) {
  const { entryPrice, stopLoss, direction } = tradeParams;

  // Stop loss must be on correct side
  if (direction === 'LONG' && stopLoss >= entryPrice) {
    logger.error('Invalid stop loss for LONG: must be below entry price');
    return false;
  }

  if (direction === 'SHORT' && stopLoss <= entryPrice) {
    logger.error('Invalid stop loss for SHORT: must be above entry price');
    return false;
  }

  // Stop loss distance must be within 0.5%-3%
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePercent = (stopDistance / entryPrice) * 100;

  if (stopDistancePercent < 0.5 || stopDistancePercent > 3.0) {
    logger.error(`Stop loss distance ${stopDistancePercent.toFixed(2)}% outside valid range (0.5%-3%)`);
    return false;
  }

  return true;
}

/**
 * Check Coinbase API connection
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<boolean>} True if API is connected
 */
async function checkCoinbaseAPI(coinbaseClient) {
  try {
    // Simple ping to check API connectivity
    await coinbaseClient.listAccounts();
    return true;
  } catch (error) {
    logger.error('Coinbase API connection failed:', error);
    return false;
  }
}

/**
 * Validate a trade before execution
 *
 * Performs comprehensive pre-trade checks including:
 * - Position limits
 * - Daily loss limits
 * - Consecutive loss limits
 * - Account balance
 * - Stop loss validity
 * - R/R ratio
 * - API connectivity
 *
 * @param {Object} tradeParams - Trade parameters
 * @param {Object} db - Database connection
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<Object>} Validation result
 */
async function validateTrade(tradeParams, db, coinbaseClient) {
  logger.info('Performing pre-trade validation checks...');

  const checks = {
    // Position limit
    positionLimit: await checkPositionLimit(db),

    // Daily loss limit
    dailyLoss: await checkDailyLossLimit(db, tradeParams.accountBalance),

    // Consecutive losses
    consecutiveLosses: await checkConsecutiveLosses(db),

    // Account balance
    accountBalance: checkAccountBalance(tradeParams.accountBalance),

    // Stop loss valid
    stopLossValid: validateStopLoss(tradeParams),

    // R/R ratio
    rrRatio: validateRiskReward(
      tradeParams.entryPrice,
      tradeParams.stopLoss,
      tradeParams.takeProfit,
      tradeParams.direction
    ).valid,

    // Position size parameters
    positionSizeValid: validatePositionSize({
      accountBalance: tradeParams.accountBalance,
      entryPrice: tradeParams.entryPrice,
      stopLoss: tradeParams.stopLoss,
      direction: tradeParams.direction
    }).valid,

    // API connection
    apiConnected: await checkCoinbaseAPI(coinbaseClient)
  };

  // Determine if all checks passed
  const approved = Object.values(checks).every(v => v === true);

  // Get list of failed checks
  const failedChecks = Object.keys(checks).filter(k => !checks[k]);

  const result = {
    approved: approved,
    checks: checks,
    failedChecks: failedChecks
  };

  if (approved) {
    logger.info('All pre-trade validation checks passed ✓');
  } else {
    logger.error('Pre-trade validation failed:', failedChecks);
  }

  return result;
}

/**
 * Calculate current account metrics
 *
 * @param {Object} db - Database connection
 * @param {number} accountBalance - Current account balance
 * @returns {Promise<Object>} Account metrics
 */
async function getAccountMetrics(db, accountBalance) {
  try {
    // Get open positions
    const openResult = await db.query(`
      SELECT COUNT(*) as open_positions
      FROM trades
      WHERE status = 'OPEN'
    `);

    // Get today's P&L
    const todayResult = await db.query(`
      SELECT COALESCE(SUM(pnl_usd), 0) as today_pnl
      FROM trades
      WHERE status = 'CLOSED'
        AND exit_time >= CURRENT_DATE
    `);

    // Get consecutive losses
    const lossesResult = await db.query(`
      SELECT outcome
      FROM trades
      WHERE status = 'CLOSED'
      ORDER BY exit_time DESC
      LIMIT 10
    `);

    let consecutiveLosses = 0;
    for (const row of lossesResult.rows) {
      if (row.outcome === 'LOSS') {
        consecutiveLosses++;
      } else {
        break;
      }
    }

    // Get win rate
    const winRateResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE outcome = 'WIN') as wins,
        COUNT(*) as total_trades
      FROM trades
      WHERE status = 'CLOSED'
    `);

    const wins = parseInt(winRateResult.rows[0].wins) || 0;
    const totalTrades = parseInt(winRateResult.rows[0].total_trades) || 0;
    const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;

    return {
      accountBalance: accountBalance,
      openPositions: parseInt(openResult.rows[0].open_positions),
      todayPnL: parseFloat(todayResult.rows[0].today_pnl),
      consecutiveLosses: consecutiveLosses,
      winRate: winRate.toFixed(2),
      totalTrades: totalTrades,
      maxDailyLoss: accountBalance * RISK_LIMITS.DAILY_LOSS_LIMIT,
      dailyLossRemaining: (accountBalance * RISK_LIMITS.DAILY_LOSS_LIMIT) + parseFloat(todayResult.rows[0].today_pnl)
    };
  } catch (error) {
    logger.error('Error calculating account metrics:', error);
    throw error;
  }
}

/**
 * Check if trading should be paused
 *
 * @param {Object} db - Database connection
 * @param {number} accountBalance - Current account balance
 * @returns {Promise<Object>} Pause status and reason
 */
async function shouldPauseTrading(db, accountBalance) {
  const metrics = await getAccountMetrics(db, accountBalance);

  const reasons = [];

  // Check daily loss limit
  if (metrics.todayPnL <= -metrics.maxDailyLoss) {
    reasons.push('Daily loss limit exceeded');
  }

  // Check consecutive losses
  if (metrics.consecutiveLosses >= RISK_LIMITS.CONSECUTIVE_LOSS_LIMIT) {
    reasons.push(`${RISK_LIMITS.CONSECUTIVE_LOSS_LIMIT} consecutive losses`);
  }

  // Check account balance
  if (accountBalance < RISK_LIMITS.MIN_ACCOUNT_BALANCE) {
    reasons.push('Account balance below minimum');
  }

  return {
    shouldPause: reasons.length > 0,
    reasons: reasons,
    metrics: metrics
  };
}

module.exports = {
  RISK_LIMITS,
  getRiskLimits,
  checkPositionLimit,
  checkDailyLossLimit,
  checkConsecutiveLosses,
  checkAccountBalance,
  validateStopLoss,
  checkCoinbaseAPI,
  validateTrade,
  getAccountMetrics,
  shouldPauseTrading
};
