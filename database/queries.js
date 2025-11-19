/**
 * Database Query Functions
 * Reusable queries for all database operations
 */

import { query, transaction } from './connection.js';
import { createLogger } from '../lib/utils/logger.js';

const logger = createLogger('queries');

// ============================================================================
// Candles (4H and 5M)
// ============================================================================

/**
 * Insert 4H candle (duplicate timestamps ignored)
 */
export async function insert4HCandle(candle) {
  const text = `
    INSERT INTO candles_4h (timestamp, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (timestamp) DO NOTHING
    RETURNING *
  `;
  const values = [candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume];

  try {
    const result = await query(text, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert 4H candle', { error: error.message, candle });
    throw error;
  }
}

/**
 * Insert 5M candle (duplicate timestamps ignored)
 */
export async function insert5MCandle(candle) {
  const text = `
    INSERT INTO candles_5m (timestamp, open, high, low, close, volume)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (timestamp) DO NOTHING
    RETURNING *
  `;
  const values = [candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume];

  try {
    const result = await query(text, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert 5M candle', { error: error.message, candle });
    throw error;
  }
}

/**
 * Get recent 4H candles
 */
export async function get4HCandles(limit = 200) {
  const text = `
    SELECT * FROM candles_4h
    ORDER BY timestamp DESC
    LIMIT $1
  `;

  try {
    const result = await query(text, [limit]);
    return result.rows.reverse(); // Return in chronological order
  } catch (error) {
    logger.error('Failed to get 4H candles', { error: error.message });
    throw error;
  }
}

/**
 * Get recent 5M candles
 */
export async function get5MCandles(limit = 500) {
  const text = `
    SELECT * FROM candles_5m
    ORDER BY timestamp DESC
    LIMIT $1
  `;

  try {
    const result = await query(text, [limit]);
    return result.rows.reverse(); // Return in chronological order
  } catch (error) {
    logger.error('Failed to get 5M candles', { error: error.message });
    throw error;
  }
}

/**
 * Delete old 5M candles (retention policy: 7 days)
 */
export async function prune5MCandles() {
  const text = `
    DELETE FROM candles_5m
    WHERE timestamp < NOW() - INTERVAL '7 days'
    RETURNING COUNT(*) as deleted_count
  `;

  try {
    const result = await query(text);
    logger.info(`Pruned ${result.rowCount} old 5M candles`);
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to prune 5M candles', { error: error.message });
    throw error;
  }
}

// ============================================================================
// Swing Levels
// ============================================================================

/**
 * Insert new swing level
 */
export async function insertSwingLevel(swing) {
  const text = `
    INSERT INTO swing_levels (timestamp, timeframe, swing_type, price, active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [swing.timestamp, swing.timeframe, swing.swing_type, swing.price, swing.active];

  try {
    const result = await query(text, values);
    logger.info('Swing level inserted', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert swing level', { error: error.message, swing });
    throw error;
  }
}

/**
 * Get most recent active swing
 */
export async function getRecentSwing(timeframe, swingType) {
  const text = `
    SELECT * FROM swing_levels
    WHERE timeframe = $1 AND swing_type = $2 AND active = true
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  try {
    const result = await query(text, [timeframe, swingType]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get recent swing', { error: error.message, timeframe, swingType });
    throw error;
  }
}

/**
 * Deactivate previous swings of same type/timeframe
 */
export async function deactivatePreviousSwings(timeframe, swingType) {
  const text = `
    UPDATE swing_levels
    SET active = false
    WHERE timeframe = $1 AND swing_type = $2 AND active = true
    RETURNING *
  `;

  try {
    const result = await query(text, [timeframe, swingType]);
    if (result.rowCount > 0) {
      logger.info(`Deactivated ${result.rowCount} previous ${timeframe} ${swingType} swings`);
    }
    return result.rows;
  } catch (error) {
    logger.error('Failed to deactivate swings', { error: error.message });
    throw error;
  }
}

// ============================================================================
// Liquidity Sweeps
// ============================================================================

/**
 * Insert liquidity sweep
 */
export async function insertLiquiditySweep(sweep) {
  const text = `
    INSERT INTO liquidity_sweeps (timestamp, sweep_type, price, bias, swing_level, swing_level_id, active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    sweep.timestamp,
    sweep.sweep_type,
    sweep.price,
    sweep.bias,
    sweep.swing_level,
    sweep.swing_level_id,
    sweep.active
  ];

  try {
    const result = await query(text, values);
    logger.info('Liquidity sweep inserted', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert liquidity sweep', { error: error.message, sweep });
    throw error;
  }
}

/**
 * Get active liquidity sweep
 */
export async function getActiveSweep() {
  const text = `
    SELECT * FROM liquidity_sweeps
    WHERE active = true
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get active sweep', { error: error.message });
    throw error;
  }
}

/**
 * Deactivate sweep
 */
export async function deactivateSweep(sweepId) {
  const text = `
    UPDATE liquidity_sweeps
    SET active = false
    WHERE id = $1
    RETURNING *
  `;

  try {
    const result = await query(text, [sweepId]);
    logger.info(`Deactivated sweep ${sweepId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to deactivate sweep', { error: error.message, sweepId });
    throw error;
  }
}

// ============================================================================
// Confluence State
// ============================================================================

/**
 * Create new confluence state for a sweep
 */
export async function createConfluenceState(sweepId) {
  const text = `
    INSERT INTO confluence_state (sweep_id, current_state)
    VALUES ($1, 'WAITING_CHOCH')
    RETURNING *
  `;

  try {
    const result = await query(text, [sweepId]);
    logger.info('Confluence state created', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create confluence state', { error: error.message, sweepId });
    throw error;
  }
}

/**
 * Update confluence state
 */
export async function updateConfluenceState(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Build dynamic UPDATE query
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  // Always update updated_at
  fields.push(`updated_at = NOW()`);

  const text = `
    UPDATE confluence_state
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  values.push(id);

  try {
    const result = await query(text, values);
    logger.info('Confluence state updated', { id, updates });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update confluence state', { error: error.message, id, updates });
    throw error;
  }
}

/**
 * Get active confluence state
 */
export async function getActiveConfluence() {
  const text = `
    SELECT cs.*, ls.bias
    FROM confluence_state cs
    JOIN liquidity_sweeps ls ON ls.id = cs.sweep_id
    WHERE cs.current_state NOT IN ('COMPLETE', 'EXPIRED')
    ORDER BY cs.created_at DESC
    LIMIT 1
  `;

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get active confluence', { error: error.message });
    throw error;
  }
}

// ============================================================================
// Trades
// ============================================================================

/**
 * Insert new trade
 */
export async function insertTrade(trade) {
  const text = `
    INSERT INTO trades (
      confluence_id, direction, entry_price, entry_time, position_size_btc, position_size_usd,
      stop_loss, stop_loss_source, stop_loss_swing_price, stop_loss_distance_percent,
      take_profit, risk_reward_ratio,
      coinbase_entry_order_id, coinbase_stop_order_id, coinbase_tp_order_id,
      ai_confidence, ai_reasoning, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
    )
    RETURNING *
  `;

  const values = [
    trade.confluence_id, trade.direction, trade.entry_price, trade.entry_time,
    trade.position_size_btc, trade.position_size_usd,
    trade.stop_loss, trade.stop_loss_source, trade.stop_loss_swing_price,
    trade.stop_loss_distance_percent, trade.take_profit, trade.risk_reward_ratio,
    trade.coinbase_entry_order_id, trade.coinbase_stop_order_id, trade.coinbase_tp_order_id,
    trade.ai_confidence, trade.ai_reasoning, trade.status || 'OPEN'
  ];

  try {
    const result = await query(text, values);
    logger.info('Trade inserted', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to insert trade', { error: error.message, trade });
    throw error;
  }
}

/**
 * Update trade
 */
export async function updateTrade(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  const text = `
    UPDATE trades
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  values.push(id);

  try {
    const result = await query(text, values);
    logger.info('Trade updated', { id, updates });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update trade', { error: error.message, id, updates });
    throw error;
  }
}

/**
 * Get open trades
 */
export async function getOpenTrades() {
  const text = `
    SELECT * FROM trades
    WHERE status = 'OPEN'
    ORDER BY entry_time DESC
  `;

  try {
    const result = await query(text);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get open trades', { error: error.message });
    throw error;
  }
}

/**
 * Get all trades (with optional filters)
 */
export async function getTrades(filters = {}) {
  let text = 'SELECT * FROM trades WHERE 1=1';
  const values = [];
  let paramIndex = 1;

  if (filters.status) {
    text += ` AND status = $${paramIndex}`;
    values.push(filters.status);
    paramIndex++;
  }

  if (filters.direction) {
    text += ` AND direction = $${paramIndex}`;
    values.push(filters.direction);
    paramIndex++;
  }

  if (filters.outcome) {
    text += ` AND outcome = $${paramIndex}`;
    values.push(filters.outcome);
    paramIndex++;
  }

  text += ' ORDER BY entry_time DESC';

  if (filters.limit) {
    text += ` LIMIT $${paramIndex}`;
    values.push(filters.limit);
  }

  try {
    const result = await query(text, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get trades', { error: error.message, filters });
    throw error;
  }
}

// ============================================================================
// System Config
// ============================================================================

/**
 * Get system configuration
 */
export async function getSystemConfig() {
  const text = 'SELECT * FROM system_config WHERE id = 1';

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get system config', { error: error.message });
    throw error;
  }
}

/**
 * Update system configuration
 */
export async function updateSystemConfig(updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  const text = `
    UPDATE system_config
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = 1
    RETURNING *
  `;

  try {
    const result = await query(text, values);
    logger.info('System config updated', updates);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update system config', { error: error.message, updates });
    throw error;
  }
}

/**
 * Set emergency stop
 */
export async function setEmergencyStop(enabled) {
  return updateSystemConfig({ emergency_stop: enabled });
}

/**
 * Get trading metrics
 */
export async function getTradingMetrics() {
  const text = `
    SELECT
      total_trades,
      total_wins,
      total_losses,
      current_win_rate,
      consecutive_wins,
      consecutive_losses,
      daily_pnl,
      daily_loss_percent,
      account_balance
    FROM system_config
    WHERE id = 1
  `;

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get trading metrics', { error: error.message });
    throw error;
  }
}

// ============================================================================
// Views
// ============================================================================

/**
 * Get active trading setup view
 */
export async function getActiveSetupView() {
  const text = 'SELECT * FROM v_active_setup';

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get active setup view', { error: error.message });
    throw error;
  }
}

/**
 * Get open positions view
 */
export async function getOpenPositionsView() {
  const text = 'SELECT * FROM v_open_positions';

  try {
    const result = await query(text);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get open positions view', { error: error.message });
    throw error;
  }
}

/**
 * Get recent swings view
 */
export async function getRecentSwingsView() {
  const text = 'SELECT * FROM v_recent_swings';

  try {
    const result = await query(text);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get recent swings view', { error: error.message });
    throw error;
  }
}

/**
 * Get performance metrics view
 */
export async function getPerformanceMetricsView() {
  const text = 'SELECT * FROM v_performance_metrics';

  try {
    const result = await query(text);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get performance metrics view', { error: error.message });
    throw error;
  }
}

// Export all functions
export default {
  // Candles
  insert4HCandle,
  insert5MCandle,
  get4HCandles,
  get5MCandles,
  prune5MCandles,

  // Swing Levels
  insertSwingLevel,
  getRecentSwing,
  deactivatePreviousSwings,

  // Liquidity Sweeps
  insertLiquiditySweep,
  getActiveSweep,
  deactivateSweep,

  // Confluence State
  createConfluenceState,
  updateConfluenceState,
  getActiveConfluence,

  // Trades
  insertTrade,
  updateTrade,
  getOpenTrades,
  getTrades,

  // System Config
  getSystemConfig,
  updateSystemConfig,
  setEmergencyStop,
  getTradingMetrics,

  // Views
  getActiveSetupView,
  getOpenPositionsView,
  getRecentSwingsView,
  getPerformanceMetricsView
};
