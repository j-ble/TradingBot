/**
 * Position Manager
 *
 * Centralized position update management including stop loss updates,
 * P&L tracking, and position state modifications.
 */

const logger = require('../utils/logger');
const { updateStopLoss } = require('./order_manager');
const {
  checkTrailingStop,
  calculateTrailingStopPrice,
  validateTrailingStop,
  calculateProfitProtection
} = require('./trailing_stop');

// Dynamic imports for ES6 modules
let dbQueries;

/**
 * Initialize ES6 module dependencies
 * @private
 */
async function initializeDependencies() {
  if (!dbQueries) {
    dbQueries = await import('../../database/queries.js');
  }
}

/**
 * Activate trailing stop for a trade
 *
 * Moves stop loss to breakeven (entry price) when trade reaches 80% to target.
 *
 * @param {Object} trade - Trade record
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {number} currentPrice - Current market price
 * @param {Object} options - Trailing stop options
 * @returns {Promise<Object>} Updated trade with new stop
 */
async function activateTrailingStop(trade, coinbaseClient, currentPrice, options = {}) {
  await initializeDependencies();

  try {
    logger.info('Activating trailing stop', {
      tradeId: trade.id,
      currentPrice,
      currentStop: trade.stop_loss
    });

    // Check if should activate
    const check = checkTrailingStop(trade, currentPrice);

    if (!check.shouldActivate) {
      logger.warn('Trailing stop activation check failed', {
        tradeId: trade.id,
        reason: check.reason,
        progress: check.progress
      });

      return {
        success: false,
        reason: check.reason,
        trade: trade
      };
    }

    // Calculate new stop price
    const stopDetails = calculateTrailingStopPrice(trade, currentPrice, options);

    // Validate new stop
    const validation = validateTrailingStop(trade, stopDetails.price);

    if (!validation.valid) {
      logger.error('Trailing stop validation failed', {
        tradeId: trade.id,
        errors: validation.errors,
        newStopPrice: stopDetails.price
      });

      throw new Error(`Trailing stop validation failed: ${validation.errors.join(', ')}`);
    }

    // Calculate profit protection metrics
    const protection = calculateProfitProtection(trade, stopDetails.price);

    logger.info('Trailing stop details calculated', {
      tradeId: trade.id,
      newStopPrice: stopDetails.price,
      previousStop: trade.stop_loss,
      improvement: stopDetails.improvement,
      protectedProfitUSD: protection.protectedProfitUSD,
      riskReductionPercent: protection.riskReductionPercent.toFixed(2) + '%'
    });

    // Update stop loss order on Coinbase
    const stopSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';

    const newStopOrder = await updateStopLoss(
      coinbaseClient,
      trade.coinbase_stop_order_id,
      {
        productId: 'BTC-USD',
        side: stopSide,
        size: trade.position_size_btc,
        stopPrice: stopDetails.price
      }
    );

    logger.info('Stop loss order updated on exchange', {
      tradeId: trade.id,
      oldOrderId: trade.coinbase_stop_order_id,
      newOrderId: newStopOrder.orderId,
      newStopPrice: stopDetails.price
    });

    // Update trade in database
    const updatedTrade = await dbQueries.updateTrade(trade.id, {
      stop_loss: stopDetails.price,
      trailing_stop_activated: true,
      trailing_stop_price: stopDetails.price,
      coinbase_stop_order_id: newStopOrder.orderId,
      updated_at: new Date()
    });

    logger.info('Trailing stop activated successfully', {
      tradeId: trade.id,
      newStopPrice: stopDetails.price,
      protectedProfit: protection.protectedProfitUSD,
      isBreakeven: protection.isBreakeven
    });

    return {
      success: true,
      trade: updatedTrade,
      stopOrder: newStopOrder,
      stopDetails: stopDetails,
      protection: protection,
      oldStopPrice: trade.stop_loss,
      newStopPrice: stopDetails.price
    };
  } catch (error) {
    logger.error('Failed to activate trailing stop', {
      error: error.message,
      tradeId: trade.id,
      currentPrice
    });
    throw error;
  }
}

/**
 * Update position P&L
 *
 * Updates unrealized P&L for an open position.
 *
 * @param {number} tradeId - Trade ID
 * @param {number} currentPrice - Current market price
 * @returns {Promise<Object>} Updated P&L details
 */
async function updatePositionPnL(tradeId, currentPrice) {
  await initializeDependencies();

  try {
    // Get trade
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    if (trade.status !== 'OPEN') {
      logger.debug('Trade is not open, skipping P&L update', {
        tradeId,
        status: trade.status
      });
      return { skipped: true, reason: 'NOT_OPEN' };
    }

    // Calculate P&L
    const pnl = calculateCurrentPnL(trade, currentPrice);

    // Update in database
    await dbQueries.updateTrade(tradeId, {
      current_price: currentPrice,
      unrealized_pnl_usd: pnl.usd,
      unrealized_pnl_percent: pnl.percent,
      updated_at: new Date()
    });

    logger.debug('P&L updated', {
      tradeId,
      currentPrice,
      unrealizedPnL: pnl.usd,
      unrealizedPercent: pnl.percent.toFixed(2) + '%'
    });

    return {
      success: true,
      tradeId: tradeId,
      currentPrice: currentPrice,
      pnl: pnl
    };
  } catch (error) {
    logger.error('Failed to update position P&L', {
      error: error.message,
      tradeId,
      currentPrice
    });
    throw error;
  }
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
    percent: pnlPercent,
    btc: pnlUsd / currentPrice
  };
}

/**
 * Update position status
 *
 * @param {number} tradeId - Trade ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} Updated trade
 */
async function updatePositionStatus(tradeId, status, additionalData = {}) {
  await initializeDependencies();

  try {
    logger.info('Updating position status', {
      tradeId,
      newStatus: status
    });

    const updatedTrade = await dbQueries.updateTrade(tradeId, {
      status: status,
      updated_at: new Date(),
      ...additionalData
    });

    logger.info('Position status updated', {
      tradeId,
      status: status
    });

    return updatedTrade;
  } catch (error) {
    logger.error('Failed to update position status', {
      error: error.message,
      tradeId,
      status
    });
    throw error;
  }
}

/**
 * Get position metrics
 *
 * Returns comprehensive metrics for an open position including P&L,
 * progress to target, trailing stop status, etc.
 *
 * @param {Object} trade - Trade record
 * @param {number} currentPrice - Current market price
 * @returns {Object} Position metrics
 */
function getPositionMetrics(trade, currentPrice) {
  const pnl = calculateCurrentPnL(trade, currentPrice);

  const targetDistance = Math.abs(trade.take_profit - trade.entry_price);
  const currentDistance = Math.abs(currentPrice - trade.entry_price);
  const progressToTarget = (currentDistance / targetDistance) * 100;

  const hoursOpen = (Date.now() - new Date(trade.entry_time).getTime()) / (1000 * 60 * 60);

  // Risk metrics
  const stopDistance = Math.abs(trade.entry_price - trade.stop_loss);
  const stopDistanceUSD = stopDistance * trade.position_size_btc;
  const targetDistanceUSD = targetDistance * trade.position_size_btc;

  return {
    // Price metrics
    entryPrice: trade.entry_price,
    currentPrice: currentPrice,
    stopLoss: trade.stop_loss,
    takeProfit: trade.take_profit,

    // P&L
    unrealizedPnL: pnl.usd,
    unrealizedPnLPercent: pnl.percent,

    // Progress
    progressToTarget: progressToTarget,
    distanceToTarget: Math.abs(trade.take_profit - currentPrice),
    distanceToTargetPercent: ((Math.abs(trade.take_profit - currentPrice) / currentPrice) * 100),

    // Risk
    riskRewardRatio: trade.risk_reward_ratio,
    currentRisk: stopDistanceUSD,
    potentialReward: targetDistanceUSD,

    // Trailing stop
    trailingStopActivated: trade.trailing_stop_activated || false,
    trailingStopPrice: trade.trailing_stop_price || null,
    canActivateTrailing: !trade.trailing_stop_activated && progressToTarget >= 80,

    // Time
    hoursOpen: hoursOpen,
    timeToExpiry: 72 - hoursOpen, // 72 hour max duration

    // Direction
    isWinning: pnl.usd > 0,
    isLosing: pnl.usd < 0,
    isBreakeven: Math.abs(pnl.usd) < 1 // Within $1
  };
}

/**
 * Batch update positions
 *
 * Update multiple positions at once (P&L, trailing stops, etc.)
 *
 * @param {Array<Object>} trades - Array of trade records
 * @param {number} currentPrice - Current market price
 * @param {Object} coinbaseClient - Coinbase API client (optional, for trailing stops)
 * @returns {Promise<Array>} Update results
 */
async function batchUpdatePositions(trades, currentPrice, coinbaseClient = null) {
  await initializeDependencies();

  logger.info('Batch updating positions', {
    count: trades.length,
    currentPrice
  });

  const results = [];

  for (const trade of trades) {
    try {
      // Update P&L
      const pnlUpdate = await updatePositionPnL(trade.id, currentPrice);

      // Check and activate trailing stop if applicable
      let trailingUpdate = null;
      if (coinbaseClient && !trade.trailing_stop_activated) {
        const check = checkTrailingStop(trade, currentPrice);

        if (check.shouldActivate) {
          trailingUpdate = await activateTrailingStop(
            trade,
            coinbaseClient,
            currentPrice
          );
        }
      }

      results.push({
        tradeId: trade.id,
        success: true,
        pnlUpdate: pnlUpdate,
        trailingUpdate: trailingUpdate
      });
    } catch (error) {
      logger.error('Failed to update position in batch', {
        tradeId: trade.id,
        error: error.message
      });

      results.push({
        tradeId: trade.id,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  logger.info('Batch update completed', {
    total: trades.length,
    successful: successCount,
    failed: trades.length - successCount
  });

  return results;
}

module.exports = {
  activateTrailingStop,
  updatePositionPnL,
  updatePositionStatus,
  getPositionMetrics,
  batchUpdatePositions,
  calculateCurrentPnL
};
