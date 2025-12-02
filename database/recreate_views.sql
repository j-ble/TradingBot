-- ============================================================================
-- Recreate Database Views as trading_user
-- ============================================================================

-- View: Active trading setup (current sweep + confluence state)
CREATE OR REPLACE VIEW v_active_setup AS
SELECT
    ls.id as sweep_id,
    ls.timestamp as sweep_time,
    ls.sweep_type,
    ls.bias,
    ls.price as sweep_price,
    cs.current_state,
    cs.choch_detected,
    cs.fvg_detected,
    cs.bos_detected,
    cs.created_at as confluence_start_time,
    EXTRACT(EPOCH FROM (NOW() - cs.created_at))/3600 as hours_elapsed
FROM liquidity_sweeps ls
LEFT JOIN confluence_state cs ON cs.sweep_id = ls.id
WHERE ls.active = true
ORDER BY ls.timestamp DESC
LIMIT 1;

-- View: Open positions with live P&L data
CREATE OR REPLACE VIEW v_open_positions AS
SELECT
    id,
    direction,
    entry_price,
    entry_time,
    stop_loss,
    stop_loss_source,
    take_profit,
    position_size_btc,
    risk_reward_ratio,
    ai_confidence,
    trailing_stop_activated,
    EXTRACT(EPOCH FROM (NOW() - entry_time))/3600 as hours_open
FROM trades
WHERE status = 'OPEN'
ORDER BY entry_time DESC;

-- View: Recent swing levels for stop loss calculation
CREATE OR REPLACE VIEW v_recent_swings AS
SELECT
    timeframe,
    swing_type,
    price,
    timestamp,
    active
FROM swing_levels
WHERE active = true
ORDER BY timeframe, swing_type, timestamp DESC;

-- View: Trading performance metrics
CREATE OR REPLACE VIEW v_performance_metrics AS
SELECT
    total_trades,
    total_wins,
    total_losses,
    current_win_rate,
    consecutive_wins,
    consecutive_losses,
    daily_pnl,
    daily_loss_percent,
    account_balance,
    emergency_stop,
    trading_enabled
FROM system_config
WHERE id = 1;

\echo 'Views recreated successfully as trading_user';
