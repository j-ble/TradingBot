-- ============================================================================
-- BTC Trading Bot Database Schema
-- PostgreSQL 16
-- ============================================================================
-- Description: Complete database schema for autonomous BTC futures trading bot
-- Tables: 7 (candles_4h, candles_5m, swing_levels, liquidity_sweeps,
--            confluence_state, trades, system_config)
-- ============================================================================

-- Drop existing tables (for clean migrations)
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS confluence_state CASCADE;
DROP TABLE IF EXISTS liquidity_sweeps CASCADE;
DROP TABLE IF EXISTS swing_levels CASCADE;
DROP TABLE IF EXISTS candles_5m CASCADE;
DROP TABLE IF EXISTS candles_4h CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;

-- ============================================================================
-- Table 1: candles_4h
-- Description: 4-hour candlestick data for BTC-PERP
-- Retention: Last 200 candles (~33 days)
-- ============================================================================

CREATE TABLE candles_4h (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL UNIQUE,
    open DECIMAL(12,2) NOT NULL CHECK (open > 0),
    high DECIMAL(12,2) NOT NULL CHECK (high > 0),
    low DECIMAL(12,2) NOT NULL CHECK (low > 0),
    close DECIMAL(12,2) NOT NULL CHECK (close > 0),
    volume DECIMAL(18,8) NOT NULL CHECK (volume >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure OHLC relationships are valid
    CONSTRAINT valid_ohlc_4h CHECK (
        high >= open AND
        high >= close AND
        high >= low AND
        low <= open AND
        low <= close
    )
);

-- Indexes for 4H candles
CREATE INDEX idx_candles_4h_timestamp ON candles_4h(timestamp DESC);
CREATE INDEX idx_candles_4h_created_at ON candles_4h(created_at DESC);

COMMENT ON TABLE candles_4h IS '4-hour candlestick data for swing detection and liquidity sweep scanning';
COMMENT ON COLUMN candles_4h.timestamp IS 'Candle open time (UTC)';
COMMENT ON COLUMN candles_4h.volume IS 'BTC trading volume for this candle';

-- ============================================================================
-- Table 2: candles_5m
-- Description: 5-minute candlestick data for BTC-PERP
-- Retention: Last 1000 candles (~3.5 days), pruned after 7 days
-- ============================================================================

CREATE TABLE candles_5m (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL UNIQUE,
    open DECIMAL(12,2) NOT NULL CHECK (open > 0),
    high DECIMAL(12,2) NOT NULL CHECK (high > 0),
    low DECIMAL(12,2) NOT NULL CHECK (low > 0),
    close DECIMAL(12,2) NOT NULL CHECK (close > 0),
    volume DECIMAL(18,8) NOT NULL CHECK (volume >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure OHLC relationships are valid
    CONSTRAINT valid_ohlc_5m CHECK (
        high >= open AND
        high >= close AND
        high >= low AND
        low <= open AND
        low <= close
    )
);

-- Indexes for 5M candles
CREATE INDEX idx_candles_5m_timestamp ON candles_5m(timestamp DESC);
CREATE INDEX idx_candles_5m_created_at ON candles_5m(created_at DESC);

COMMENT ON TABLE candles_5m IS '5-minute candlestick data for confluence detection (CHoCH, FVG, BOS)';
COMMENT ON COLUMN candles_5m.timestamp IS 'Candle open time (UTC)';

-- ============================================================================
-- Table 3: swing_levels
-- Description: Tracks swing highs and lows on both 4H and 5M timeframes
-- Detection: 3-candle pattern (middle candle forms swing)
-- ============================================================================

CREATE TABLE swing_levels (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    timeframe VARCHAR(10) NOT NULL CHECK (timeframe IN ('4H', '5M')),
    swing_type VARCHAR(10) NOT NULL CHECK (swing_type IN ('HIGH', 'LOW')),
    price DECIMAL(12,2) NOT NULL CHECK (price > 0),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for swing levels
CREATE INDEX idx_swing_levels_timeframe_type ON swing_levels(timeframe, swing_type);
CREATE INDEX idx_swing_levels_active ON swing_levels(active) WHERE active = true;
CREATE INDEX idx_swing_levels_timestamp ON swing_levels(timestamp DESC);

COMMENT ON TABLE swing_levels IS 'Swing high/low levels for stop loss calculation';
COMMENT ON COLUMN swing_levels.timeframe IS 'Timeframe where swing was detected (4H or 5M)';
COMMENT ON COLUMN swing_levels.swing_type IS 'HIGH or LOW swing point';
COMMENT ON COLUMN swing_levels.active IS 'True if this is the most recent swing of this type';

-- ============================================================================
-- Table 4: liquidity_sweeps
-- Description: 4H liquidity sweep events (high/low sweeps)
-- Purpose: Set market bias for 5M confluence detection
-- ============================================================================

CREATE TABLE liquidity_sweeps (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    sweep_type VARCHAR(10) NOT NULL CHECK (sweep_type IN ('HIGH', 'LOW')),
    price DECIMAL(12,2) NOT NULL CHECK (price > 0),
    bias VARCHAR(10) NOT NULL CHECK (bias IN ('BULLISH', 'BEARISH')),
    swing_level DECIMAL(12,2) NOT NULL,
    swing_level_id INTEGER REFERENCES swing_levels(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for liquidity sweeps
CREATE INDEX idx_liquidity_sweeps_active ON liquidity_sweeps(active) WHERE active = true;
CREATE INDEX idx_liquidity_sweeps_timestamp ON liquidity_sweeps(timestamp DESC);
CREATE INDEX idx_liquidity_sweeps_bias ON liquidity_sweeps(bias);

COMMENT ON TABLE liquidity_sweeps IS '4H swing high/low sweep events that set trading bias';
COMMENT ON COLUMN liquidity_sweeps.sweep_type IS 'HIGH sweep or LOW sweep';
COMMENT ON COLUMN liquidity_sweeps.bias IS 'BULLISH (after LOW sweep) or BEARISH (after HIGH sweep)';
COMMENT ON COLUMN liquidity_sweeps.active IS 'True until confluence completes or expires';

-- ============================================================================
-- Table 5: confluence_state
-- Description: 5M confluence state machine (CHoCH → FVG → BOS)
-- States: WAITING_CHOCH, WAITING_FVG, WAITING_BOS, COMPLETE, EXPIRED
-- ============================================================================

CREATE TABLE confluence_state (
    id SERIAL PRIMARY KEY,
    sweep_id INTEGER NOT NULL REFERENCES liquidity_sweeps(id),
    current_state VARCHAR(20) NOT NULL DEFAULT 'WAITING_CHOCH'
        CHECK (current_state IN ('WAITING_CHOCH', 'WAITING_FVG', 'WAITING_BOS', 'COMPLETE', 'EXPIRED')),

    -- CHoCH (Change of Character)
    choch_detected BOOLEAN DEFAULT false,
    choch_time TIMESTAMPTZ,
    choch_price DECIMAL(12,2),

    -- FVG (Fair Value Gap)
    fvg_detected BOOLEAN DEFAULT false,
    fvg_zone_low DECIMAL(12,2),
    fvg_zone_high DECIMAL(12,2),
    fvg_fill_price DECIMAL(12,2),
    fvg_fill_time TIMESTAMPTZ,

    -- BOS (Break of Structure)
    bos_detected BOOLEAN DEFAULT false,
    bos_time TIMESTAMPTZ,
    bos_price DECIMAL(12,2),

    -- Metadata
    sequence_valid BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ
);

-- Indexes for confluence state
CREATE INDEX idx_confluence_state_sweep ON confluence_state(sweep_id);
CREATE INDEX idx_confluence_state_current ON confluence_state(current_state);
CREATE INDEX idx_confluence_incomplete ON confluence_state(current_state)
    WHERE current_state NOT IN ('COMPLETE', 'EXPIRED');

COMMENT ON TABLE confluence_state IS '5M confluence detection state machine for trade signal generation';
COMMENT ON COLUMN confluence_state.current_state IS 'Current stage in confluence sequence';
COMMENT ON COLUMN confluence_state.sequence_valid IS 'False if order violated (CHoCH must come before FVG before BOS)';

-- ============================================================================
-- Table 6: trades
-- Description: Complete trade lifecycle with execution details
-- Includes: Entry, stop loss (swing-based), take profit, P&L tracking
-- ============================================================================

CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    confluence_id INTEGER REFERENCES confluence_state(id),

    -- Trade parameters
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_price DECIMAL(12,2) NOT NULL CHECK (entry_price > 0),
    entry_time TIMESTAMPTZ NOT NULL,
    position_size_btc DECIMAL(18,8) NOT NULL CHECK (position_size_btc > 0),
    position_size_usd DECIMAL(12,2) NOT NULL CHECK (position_size_usd > 0),

    -- Stop Loss (swing-based)
    stop_loss DECIMAL(12,2) NOT NULL CHECK (stop_loss > 0),
    stop_loss_source VARCHAR(20) CHECK (stop_loss_source IN ('5M_SWING', '4H_SWING')),
    stop_loss_swing_price DECIMAL(12,2),
    stop_loss_distance_percent DECIMAL(5,2),

    -- Take Profit
    take_profit DECIMAL(12,2) NOT NULL CHECK (take_profit > 0),
    risk_reward_ratio DECIMAL(5,2) NOT NULL CHECK (risk_reward_ratio >= 2.0),

    -- Exit details
    exit_price DECIMAL(12,2),
    exit_time TIMESTAMPTZ,
    exit_reason VARCHAR(50) CHECK (exit_reason IN ('TAKE_PROFIT', 'STOP_LOSS', 'TIME_BASED', 'MANUAL', 'EMERGENCY')),

    -- P&L
    pnl_btc DECIMAL(18,8),
    pnl_usd DECIMAL(12,2),
    pnl_percent DECIMAL(5,2),
    outcome VARCHAR(20) CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN')),

    -- Coinbase order IDs
    coinbase_entry_order_id VARCHAR(100),
    coinbase_stop_order_id VARCHAR(100),
    coinbase_tp_order_id VARCHAR(100),

    -- AI decision metadata
    ai_confidence INTEGER CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT,

    -- Position management
    trailing_stop_activated BOOLEAN DEFAULT false,
    trailing_stop_price DECIMAL(12,2),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'FAILED')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trades
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX idx_trades_outcome ON trades(outcome);
CREATE INDEX idx_trades_direction ON trades(direction);
CREATE INDEX idx_trades_open ON trades(status) WHERE status = 'OPEN';

COMMENT ON TABLE trades IS 'Complete trade history with swing-based stop loss and execution details';
COMMENT ON COLUMN trades.stop_loss_source IS 'Which swing level was used for stop (5M preferred, 4H fallback)';
COMMENT ON COLUMN trades.risk_reward_ratio IS 'Minimum 2:1 enforced by validation';
COMMENT ON COLUMN trades.trailing_stop_activated IS 'True when price reaches 80% to TP and stop moved to breakeven';

-- ============================================================================
-- Table 7: system_config
-- Description: Bot configuration and emergency controls
-- Single row table for runtime configuration
-- ============================================================================

CREATE TABLE system_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row only

    -- Emergency controls
    emergency_stop BOOLEAN DEFAULT false,
    trading_enabled BOOLEAN DEFAULT true,

    -- Account status
    account_balance DECIMAL(12,2) DEFAULT 100.00,
    last_balance_update TIMESTAMPTZ,

    -- Risk limits
    max_positions INTEGER DEFAULT 1,
    daily_loss_limit_percent DECIMAL(5,2) DEFAULT 3.00,
    consecutive_loss_limit INTEGER DEFAULT 3,

    -- Trading statistics
    total_trades INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    current_win_rate DECIMAL(5,2) DEFAULT 0.00,
    consecutive_wins INTEGER DEFAULT 0,
    consecutive_losses INTEGER DEFAULT 0,

    -- Daily tracking
    daily_pnl DECIMAL(12,2) DEFAULT 0.00,
    daily_loss_percent DECIMAL(5,2) DEFAULT 0.00,
    last_daily_reset TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration row
INSERT INTO system_config (id) VALUES (1);

COMMENT ON TABLE system_config IS 'System-wide configuration and emergency controls (single row)';
COMMENT ON COLUMN system_config.emergency_stop IS 'When true, all trading stops and positions close';
COMMENT ON COLUMN system_config.current_win_rate IS 'Rolling win rate (target: 90%)';

-- ============================================================================
-- Database Functions and Triggers
-- ============================================================================

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at on all relevant tables
CREATE TRIGGER update_swing_levels_updated_at BEFORE UPDATE ON swing_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidity_sweeps_updated_at BEFORE UPDATE ON liquidity_sweeps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_confluence_state_updated_at BEFORE UPDATE ON confluence_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Database Views for Common Queries
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

-- ============================================================================
-- Schema Creation Complete
-- ============================================================================

-- Display summary
\echo '======================================================================='
\echo 'BTC Trading Bot Schema Created Successfully'
\echo '======================================================================='
\echo 'Tables Created: 7'
\echo '  1. candles_4h         - 4-hour candlestick data'
\echo '  2. candles_5m         - 5-minute candlestick data'
\echo '  3. swing_levels       - Swing high/low tracking'
\echo '  4. liquidity_sweeps   - 4H sweep detection'
\echo '  5. confluence_state   - 5M confluence state machine'
\echo '  6. trades             - Trade execution and history'
\echo '  7. system_config      - Bot configuration'
\echo ''
\echo 'Views Created: 4'
\echo '  - v_active_setup      - Current trading setup'
\echo '  - v_open_positions    - Live open positions'
\echo '  - v_recent_swings     - Active swing levels'
\echo '  - v_performance_metrics - Trading statistics'
\echo ''
\echo 'Indexes: Optimized for time-series queries'
\echo 'Triggers: Auto-update timestamps'
\echo 'Constraints: Data integrity enforced'
\echo '======================================================================='
\echo 'Next Steps:'
\echo '  1. Create database connection layer (connection.js)'
\echo '  2. Create query functions (queries.js)'
\echo '  3. Test database operations'
\echo '======================================================================='
