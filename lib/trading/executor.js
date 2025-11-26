/**
 * Trade Execution Engine
 *
 * Orchestrates complete trade execution workflow from order placement to monitoring.
 * Handles market entry, stop loss, take profit orders, and database tracking.
 */

const logger = require('../utils/logger');
const { validateTrade } = require('./risk_manager');
const { calculatePositionSize } = require('./position_sizer');
const {
  placeMarketOrder,
  placeStopLossOrder,
  placeTakeProfitOrder,
  cancelOrders
} = require('./order_manager');

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
 * Execute a trade based on AI decision
 *
 * Complete execution flow:
 * 1. Pre-execution validation
 * 2. Place market entry order
 * 3. Wait for fill
 * 4. Place stop loss order
 * 5. Place take profit order
 * 6. Save trade to database
 * 7. Start position monitoring
 *
 * @param {Object} tradeDecision - AI trade decision object
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} db - Database connection
 * @returns {Promise<Object>} Executed trade details
 */
async function executeTrade(tradeDecision, coinbaseClient, db) {
  await initializeDependencies();

  logger.info('Starting trade execution', {
    direction: tradeDecision.direction,
    entry: tradeDecision.entry_price,
    confidence: tradeDecision.confidence
  });

  let entryOrder = null;
  let stopOrder = null;
  let tpOrder = null;

  try {
    // ============================================================================
    // Step 1: Pre-execution validation
    // ============================================================================
    logger.info('Performing pre-execution validation...');

    const validation = await validateExecution(tradeDecision, coinbaseClient);

    if (!validation.approved) {
      const errorMsg = `Pre-execution validation failed: ${validation.failedChecks.join(', ')}`;
      logger.error(errorMsg, { checks: validation.checks });
      throw new Error(errorMsg);
    }

    logger.info('Pre-execution validation passed ✓');

    // ============================================================================
    // Step 2: Place market entry order
    // ============================================================================
    logger.info('Placing market entry order...');

    const entrySide = tradeDecision.direction === 'LONG' ? 'BUY' : 'SELL';

    entryOrder = await placeMarketOrder(coinbaseClient, {
      productId: 'BTC-USD',
      side: entrySide,
      size: tradeDecision.position_size_btc
    });

    logger.info('Market entry order filled', {
      orderId: entryOrder.orderId,
      fillPrice: entryOrder.fillPrice,
      size: entryOrder.filledSize
    });

    // ============================================================================
    // Step 3: Place stop loss order
    // ============================================================================
    logger.info('Placing stop loss order...');

    const stopSide = tradeDecision.direction === 'LONG' ? 'SELL' : 'BUY';

    stopOrder = await placeStopLossOrder(coinbaseClient, {
      productId: 'BTC-USD',
      side: stopSide,
      size: tradeDecision.position_size_btc,
      stopPrice: tradeDecision.stop_loss
    });

    logger.info('Stop loss order placed', {
      orderId: stopOrder.orderId,
      stopPrice: stopOrder.stopPrice
    });

    // ============================================================================
    // Step 4: Place take profit order
    // ============================================================================
    logger.info('Placing take profit order...');

    const tpSide = tradeDecision.direction === 'LONG' ? 'SELL' : 'BUY';

    tpOrder = await placeTakeProfitOrder(coinbaseClient, {
      productId: 'BTC-USD',
      side: tpSide,
      size: tradeDecision.position_size_btc,
      limitPrice: tradeDecision.take_profit
    });

    logger.info('Take profit order placed', {
      orderId: tpOrder.orderId,
      limitPrice: tpOrder.limitPrice
    });

    // ============================================================================
    // Step 5: Save trade to database
    // ============================================================================
    logger.info('Saving trade to database...');

    const trade = await saveTrade({
      confluence_id: tradeDecision.confluence_id,
      direction: tradeDecision.direction,
      entry_price: entryOrder.fillPrice,
      entry_time: entryOrder.timestamp,
      position_size_btc: entryOrder.filledSize,
      position_size_usd: entryOrder.filledSize * entryOrder.fillPrice,
      stop_loss: tradeDecision.stop_loss,
      stop_loss_source: tradeDecision.stop_loss_source,
      stop_loss_swing_price: tradeDecision.stop_loss_swing_price || null,
      stop_loss_distance_percent: calculateStopDistancePercent(
        entryOrder.fillPrice,
        tradeDecision.stop_loss
      ),
      take_profit: tradeDecision.take_profit,
      risk_reward_ratio: tradeDecision.risk_reward_ratio,
      coinbase_entry_order_id: entryOrder.orderId,
      coinbase_stop_order_id: stopOrder.orderId,
      coinbase_tp_order_id: tpOrder.orderId,
      ai_confidence: tradeDecision.confidence,
      ai_reasoning: tradeDecision.reasoning,
      status: 'OPEN'
    });

    logger.info('Trade saved to database', {
      tradeId: trade.id,
      status: 'OPEN'
    });

    // ============================================================================
    // Step 6: Start position monitoring
    // ============================================================================
    logger.info('Trade execution completed successfully', {
      tradeId: trade.id,
      entryPrice: entryOrder.fillPrice,
      stopLoss: tradeDecision.stop_loss,
      takeProfit: tradeDecision.take_profit
    });

    return {
      success: true,
      trade: trade,
      entryOrder: entryOrder,
      stopOrder: stopOrder,
      tpOrder: tpOrder
    };
  } catch (error) {
    logger.error('Trade execution failed', {
      error: error.message,
      direction: tradeDecision.direction
    });

    // Rollback: Cancel any placed orders
    await rollbackOrders(coinbaseClient, stopOrder, tpOrder);

    throw error;
  }
}

/**
 * Validate execution parameters before placing orders
 *
 * @param {Object} tradeDecision - Trade decision to validate
 * @param {Object} coinbaseClient - Coinbase API client
 * @returns {Promise<Object>} Validation result
 * @private
 */
async function validateExecution(tradeDecision, coinbaseClient) {
  const checks = {};

  try {
    // Get current price
    const currentPrice = await coinbaseClient.getCurrentPrice('BTC-USD');

    // Check 1: Price within 0.2% of expected entry
    const priceDiff = Math.abs(currentPrice - tradeDecision.entry_price) / tradeDecision.entry_price;
    checks.priceValid = priceDiff < 0.002; // 0.2% tolerance

    if (!checks.priceValid) {
      logger.warn('Current price differs from expected entry', {
        current: currentPrice,
        expected: tradeDecision.entry_price,
        difference: (priceDiff * 100).toFixed(2) + '%'
      });
    }

    // Check 2: Stop loss on correct side
    if (tradeDecision.direction === 'LONG') {
      checks.stopSide = tradeDecision.stop_loss < tradeDecision.entry_price;
    } else {
      checks.stopSide = tradeDecision.stop_loss > tradeDecision.entry_price;
    }

    // Check 3: Take profit achievable
    if (tradeDecision.direction === 'LONG') {
      checks.tpValid = tradeDecision.take_profit > tradeDecision.entry_price;
    } else {
      checks.tpValid = tradeDecision.take_profit < tradeDecision.entry_price;
    }

    // Check 4: Position size valid
    checks.sizeValid = tradeDecision.position_size_btc > 0;

    // Check 5: R/R ratio valid
    checks.rrRatio = tradeDecision.risk_reward_ratio >= 2.0;

    // Check 6: Confidence threshold
    checks.confidence = tradeDecision.confidence >= 70;
  } catch (error) {
    logger.error('Error during execution validation', { error: error.message });
    checks.apiConnection = false;
  }

  const approved = Object.values(checks).every(v => v === true);
  const failedChecks = Object.keys(checks).filter(k => !checks[k]);

  return {
    approved: approved,
    checks: checks,
    failedChecks: failedChecks
  };
}

/**
 * Save trade to database
 *
 * @param {Object} tradeData - Trade data to save
 * @returns {Promise<Object>} Saved trade record
 * @private
 */
async function saveTrade(tradeData) {
  try {
    const trade = await dbQueries.insertTrade(tradeData);
    return trade;
  } catch (error) {
    logger.error('Failed to save trade to database', {
      error: error.message,
      tradeData
    });
    throw error;
  }
}

/**
 * Calculate stop distance percentage
 *
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @returns {number} Stop distance as percentage
 * @private
 */
function calculateStopDistancePercent(entryPrice, stopLoss) {
  const distance = Math.abs(entryPrice - stopLoss);
  return (distance / entryPrice) * 100;
}

/**
 * Rollback orders on execution failure
 *
 * Cancels any stop loss or take profit orders that were placed
 * before the error occurred.
 *
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} stopOrder - Stop loss order (may be null)
 * @param {Object} tpOrder - Take profit order (may be null)
 * @private
 */
async function rollbackOrders(coinbaseClient, stopOrder, tpOrder) {
  const ordersToCancel = [];

  if (stopOrder && stopOrder.orderId) {
    ordersToCancel.push(stopOrder.orderId);
  }

  if (tpOrder && tpOrder.orderId) {
    ordersToCancel.push(tpOrder.orderId);
  }

  if (ordersToCancel.length > 0) {
    logger.warn('Rolling back placed orders', {
      orderCount: ordersToCancel.length,
      orderIds: ordersToCancel
    });

    try {
      await cancelOrders(coinbaseClient, ordersToCancel);
      logger.info('Rollback completed - orders cancelled');
    } catch (rollbackError) {
      logger.error('Rollback failed - manual intervention required', {
        error: rollbackError.message,
        orderIds: ordersToCancel
      });
    }
  }
}

/**
 * Close a trade manually at market price
 *
 * @param {number} tradeId - Trade ID to close
 * @param {Object} coinbaseClient - Coinbase API client
 * @param {Object} db - Database connection
 * @returns {Promise<Object>} Closed trade details
 */
async function closeTrade(tradeId, coinbaseClient, db) {
  await initializeDependencies();

  try {
    logger.info('Manually closing trade', { tradeId });

    // Get trade from database
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    if (trade.status !== 'OPEN') {
      throw new Error(`Trade ${tradeId} is not open (status: ${trade.status})`);
    }

    // Cancel existing stop loss and take profit orders
    const ordersToCancel = [
      trade.coinbase_stop_order_id,
      trade.coinbase_tp_order_id
    ].filter(Boolean);

    if (ordersToCancel.length > 0) {
      logger.info('Cancelling open orders', { orderIds: ordersToCancel });
      await cancelOrders(coinbaseClient, ordersToCancel);
    }

    // Get current price
    const currentPrice = await coinbaseClient.getCurrentPrice('BTC-USD');

    // Close position at market
    const closeSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';
    const closeOrder = await placeMarketOrder(coinbaseClient, {
      productId: 'BTC-USD',
      side: closeSide,
      size: trade.position_size_btc
    });

    // Calculate P&L
    const pnl = calculatePnL(trade, closeOrder.fillPrice);

    // Update trade in database
    const updatedTrade = await dbQueries.updateTrade(tradeId, {
      exit_price: closeOrder.fillPrice,
      exit_time: closeOrder.timestamp,
      pnl_usd: pnl.usd,
      pnl_percent: pnl.percent,
      outcome: pnl.outcome,
      status: 'CLOSED'
    });

    logger.info('Trade closed successfully', {
      tradeId,
      exitPrice: closeOrder.fillPrice,
      pnl: pnl.usd,
      outcome: pnl.outcome
    });

    return {
      trade: updatedTrade,
      closeOrder: closeOrder,
      pnl: pnl
    };
  } catch (error) {
    logger.error('Failed to close trade', {
      error: error.message,
      tradeId
    });
    throw error;
  }
}

/**
 * Calculate P&L for a trade
 *
 * @param {Object} trade - Trade record
 * @param {number} exitPrice - Exit price
 * @returns {Object} P&L details
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

/**
 * Get trade by ID
 *
 * @param {number} tradeId - Trade ID
 * @returns {Promise<Object>} Trade record
 */
async function getTrade(tradeId) {
  await initializeDependencies();

  try {
    const trades = await dbQueries.getTrades({ limit: 1000 });
    const trade = trades.find(t => t.id === tradeId);

    if (!trade) {
      throw new Error(`Trade not found: ${tradeId}`);
    }

    return trade;
  } catch (error) {
    logger.error('Failed to get trade', {
      error: error.message,
      tradeId
    });
    throw error;
  }
}

/**
 * Get all open trades
 *
 * @returns {Promise<Array>} Array of open trades
 */
async function getOpenTrades() {
  await initializeDependencies();

  try {
    const trades = await dbQueries.getOpenTrades();
    return trades;
  } catch (error) {
    logger.error('Failed to get open trades', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  executeTrade,
  closeTrade,
  getTrade,
  getOpenTrades,
  calculatePnL
};
