/**
 * Position Monitor
 *
 * Monitors open positions for:
 * - Stop loss and take profit fills
 * - Time-based exit (72 hours)
 * - P&L tracking and updates
 * - Trailing stop activation (at 80% to target)
 */

const logger = require('../utils/logger');
const { getOrderStatus } = require('./order_manager');
const { activateTrailingStop: activateTrailingStopManager } = require('./position_manager');
const { checkTrailingStop, calculateProgressToTarget } = require('./trailing_stop');

// Dynamic imports for ES6 modules
let CoinbaseClient, dbQueries;

/**
 * Initialize ES6 module dependencies
 * @private
 */
async function initializeDependencies() {
  if (!CoinbaseClient) {
    const coinbaseModule = await import('../coinbase/client.js');
    CoinbaseClient = coinbaseModule.CoinbaseClient;
  }
  if (!dbQueries) {
    dbQueries = await import('../../database/queries.js');
  }
}

/**
 * Monitor a single position
 *
 * Checks order status, P&L, time limits, and trailing stops.
 *
 * @param {number} tradeId - Trade ID to monitor
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<Object>} Monitoring result
 */
async function monitorPosition(tradeId, coinbaseClient) {
  await initializeDependencies();

  try {
    // Get trade from database
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      logger.warn('Trade not found for monitoring', { tradeId });
      return { action: 'TRADE_NOT_FOUND' };
    }

    if (trade.status !== 'OPEN') {
      logger.debug('Trade is not open, skipping monitoring', {
        tradeId,
        status: trade.status
      });
      return { action: 'ALREADY_CLOSED' };
    }

    logger.debug('Monitoring position', {
      tradeId,
      direction: trade.direction,
      entryPrice: trade.entry_price
    });

    // ============================================================================
    // Check 1: Stop Loss Fill
    // ============================================================================
    const stopStatus = await getOrderStatus(
      coinbaseClient,
      trade.coinbase_stop_order_id
    );

    if (stopStatus.status === 'FILLED') {
      logger.info('Stop loss hit', {
        tradeId,
        stopPrice: trade.stop_loss,
        fillPrice: stopStatus.averagePrice
      });

      await closeTradeWithOutcome(
        tradeId,
        stopStatus.averagePrice,
        stopStatus.completionTime,
        'LOSS'
      );

      return {
        action: 'STOP_LOSS_HIT',
        exitPrice: stopStatus.averagePrice,
        outcome: 'LOSS'
      };
    }

    // ============================================================================
    // Check 2: Take Profit Fill
    // ============================================================================
    const tpStatus = await getOrderStatus(
      coinbaseClient,
      trade.coinbase_tp_order_id
    );

    if (tpStatus.status === 'FILLED') {
      logger.info('Take profit hit', {
        tradeId,
        tpPrice: trade.take_profit,
        fillPrice: tpStatus.averagePrice
      });

      await closeTradeWithOutcome(
        tradeId,
        tpStatus.averagePrice,
        tpStatus.completionTime,
        'WIN'
      );

      return {
        action: 'TAKE_PROFIT_HIT',
        exitPrice: tpStatus.averagePrice,
        outcome: 'WIN'
      };
    }

    // ============================================================================
    // Check 3: Time-Based Exit (72 hours)
    // ============================================================================
    const hoursOpen = calculateHoursOpen(trade.entry_time);

    if (hoursOpen > 72) {
      logger.warn('Trade open for >72 hours, forcing exit', {
        tradeId,
        hoursOpen: hoursOpen.toFixed(2)
      });

      // Close at market
      const currentPrice = await coinbaseClient.getCurrentPrice('BTC-USD');

      await closeTradeWithOutcome(
        tradeId,
        currentPrice,
        new Date(),
        null // Will be determined by P&L
      );

      return {
        action: 'TIME_EXIT',
        exitPrice: currentPrice,
        hoursOpen: hoursOpen
      };
    }

    // ============================================================================
    // Check 4: Update P&L
    // ============================================================================
    const currentPrice = await coinbaseClient.getCurrentPrice('BTC-USD');
    const pnl = calculateCurrentPnL(trade, currentPrice);

    await dbQueries.updateTrade(tradeId, {
      current_price: currentPrice,
      unrealized_pnl_usd: pnl.usd,
      unrealized_pnl_percent: pnl.percent
    });

    // ============================================================================
    // Check 5: Trailing Stop (at 80% to target)
    // ============================================================================
    const progressToTarget = calculateProgressToTarget(trade, currentPrice);
    const trailingCheck = checkTrailingStop(trade, currentPrice);

    if (trailingCheck.shouldActivate) {
      logger.info('Activating trailing stop at breakeven', {
        tradeId,
        progress: progressToTarget.toFixed(2) + '%',
        reason: trailingCheck.reason
      });

      const result = await activateTrailingStopManager(
        trade,
        coinbaseClient,
        currentPrice
      );

      return {
        action: 'TRAILING_STOP_ACTIVATED',
        progress: progressToTarget,
        newStopPrice: result.newStopPrice,
        details: result
      };
    }

    // Position is still open, continue monitoring
    return {
      action: 'MONITORING',
      currentPrice: currentPrice,
      pnl: pnl,
      progressToTarget: progressToTarget,
      hoursOpen: hoursOpen
    };
  } catch (error) {
    logger.error('Error monitoring position', {
      error: error.message,
      tradeId
    });
    throw error;
  }
}

/**
 * Monitor all open positions
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<Array>} Array of monitoring results
 */
async function monitorAllPositions(coinbaseClient) {
  await initializeDependencies();

  try {
    const openTrades = await dbQueries.getOpenTrades();

    if (openTrades.length === 0) {
      logger.debug('No open positions to monitor');
      return [];
    }

    logger.info('Monitoring open positions', { count: openTrades.length });

    const results = [];

    for (const trade of openTrades) {
      try {
        const result = await monitorPosition(trade.id, coinbaseClient);
        results.push({
          tradeId: trade.id,
          ...result
        });
      } catch (error) {
        logger.error('Failed to monitor position', {
          tradeId: trade.id,
          error: error.message
        });
        results.push({
          tradeId: trade.id,
          action: 'ERROR',
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error monitoring all positions', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Close trade with specific outcome
 *
 * @param {number} tradeId - Trade ID
 * @param {number} exitPrice - Exit price
 * @param {Date} exitTime - Exit time
 * @param {string} outcome - 'WIN', 'LOSS', or null (auto-determine)
 * @private
 */
async function closeTradeWithOutcome(tradeId, exitPrice, exitTime, outcome) {
  await initializeDependencies();

  try {
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    // Calculate P&L
    const pnl = calculatePnL(trade, exitPrice);

    // Use provided outcome or determine from P&L
    const finalOutcome = outcome || pnl.outcome;

    // Update trade in database
    await dbQueries.updateTrade(tradeId, {
      exit_price: exitPrice,
      exit_time: exitTime,
      pnl_usd: pnl.usd,
      pnl_percent: pnl.percent,
      outcome: finalOutcome,
      status: 'CLOSED'
    });

    logger.info('Trade closed', {
      tradeId,
      exitPrice,
      pnl: pnl.usd,
      outcome: finalOutcome
    });
  } catch (error) {
    logger.error('Failed to close trade with outcome', {
      error: error.message,
      tradeId
    });
    throw error;
  }
}

// Note: activateTrailingStop function moved to position_manager.js
// This module now uses the centralized position_manager for trailing stop activation

/**
 * Calculate hours since trade opened
 *
 * @param {Date} entryTime - Entry timestamp
 * @returns {number} Hours open
 * @private
 */
function calculateHoursOpen(entryTime) {
  const now = Date.now();
  const entry = new Date(entryTime).getTime();
  const msOpen = now - entry;
  return msOpen / (1000 * 60 * 60); // Convert to hours
}

/**
 * Calculate current P&L for an open trade
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @returns {Object} P&L details
 * @private
 */
function calculateCurrentPnL(trade, currentPrice) {
  const entryValue = trade.position_size_btc * trade.entry_price;
  const currentValue = trade.position_size_btc * currentPrice;

  let pnlUsd;
  if (trade.direction === 'LONG') {
    pnlUsd = currentValue - entryValue;
  } else {
    pnlUsd = entryValue - currentValue;
  }

  const pnlPercent = (pnlUsd / entryValue) * 100;

  return {
    usd: pnlUsd,
    percent: pnlPercent
  };
}

/**
 * Calculate P&L for a closed trade
 *
 * @param {Object} trade - Trade record
 * @param {number} exitPrice - Exit price
 * @returns {Object} P&L details with outcome
 * @private
 */
function calculatePnL(trade, exitPrice) {
  const entryValue = trade.position_size_btc * trade.entry_price;
  const exitValue = trade.position_size_btc * exitPrice;

  let pnlUsd;
  if (trade.direction === 'LONG') {
    pnlUsd = exitValue - entryValue;
  } else {
    pnlUsd = entryValue - exitValue;
  }

  const pnlPercent = (pnlUsd / entryValue) * 100;

  // Determine outcome
  let outcome;
  if (pnlUsd > 0) {
    outcome = 'WIN';
  } else if (pnlUsd < 0) {
    outcome = 'LOSS';
  } else {
    outcome = 'BREAKEVEN';
  }

  return {
    usd: pnlUsd,
    percent: pnlPercent,
    outcome: outcome
  };
}

// Note: calculateProgressToTarget function moved to trailing_stop.js
// This module now imports it from the dedicated trailing stop module

/**
 * Get position summary
 *
 * @param {number} tradeId - Trade ID
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<Object>} Position summary
 */
async function getPositionSummary(tradeId, coinbaseClient) {
  await initializeDependencies();

  try {
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    // Get current price
    const currentPrice = await coinbaseClient.getCurrentPrice('BTC-USD');

    // Calculate metrics
    const pnl = calculateCurrentPnL(trade, currentPrice);
    const progressToTarget = calculateProgressToTarget(trade, currentPrice);
    const hoursOpen = calculateHoursOpen(trade.entry_time);

    // Get order statuses
    const stopStatus = await getOrderStatus(
      coinbaseClient,
      trade.coinbase_stop_order_id
    );

    const tpStatus = await getOrderStatus(
      coinbaseClient,
      trade.coinbase_tp_order_id
    );

    return {
      tradeId: trade.id,
      direction: trade.direction,
      status: trade.status,
      entryPrice: trade.entry_price,
      currentPrice: currentPrice,
      stopLoss: trade.stop_loss,
      takeProfit: trade.take_profit,
      positionSizeBTC: trade.position_size_btc,
      positionSizeUSD: trade.position_size_usd,
      pnl: pnl,
      progressToTarget: progressToTarget,
      hoursOpen: hoursOpen,
      trailingStopActivated: trade.trailing_stop_activated || false,
      stopOrderStatus: stopStatus.status,
      tpOrderStatus: tpStatus.status,
      riskRewardRatio: trade.risk_reward_ratio,
      aiConfidence: trade.ai_confidence
    };
  } catch (error) {
    logger.error('Failed to get position summary', {
      error: error.message,
      tradeId
    });
    throw error;
  }
}

module.exports = {
  monitorPosition,
  monitorAllPositions,
  getPositionSummary,
  calculateCurrentPnL,
  calculateProgressToTarget
};
