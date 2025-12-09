-- ============================================================================
-- Paper Trading System Database Migration
-- Description: Add tables and views for Python paper trading system
-- ============================================================================

-- Drop existing tables if they exist (for clean migrations)
DROP TABLE IF EXISTS paper_trades CASCADE;
DROP TABLE IF EXISTS paper_trading_config CASCADE;

-- ============================================================================
-- Table 1: paper_trades
-- Description: Simulated trades for paper trading (separate from live trades)
-- ============================================================================

CREATE TABLE paper_trades (
    id SERIAL PRIMARY KEY,
    confluence_id INTEGER REFERENCES confluence_state(id),

    -- Trade parameters
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    entry_price DECIMAL(12,2) NOT NULL CHECK (entry_price > 0),
    entry_time TIMESTAMPTZ NOT NULL,
    position_size_btc DECIMAL(18,8) NOT NULL CHECK (position_size_btc > 0),
    position_size_usd DECIMAL(12,2) NOT NULL CHECK (position_size_usd > 0),

    -- Stop Loss (swing-based, same logic as live trades)
    stop_loss DECIMAL(12,2) NOT NULL CHECK (stop_loss > 0),
    stop_loss_source VARCHAR(20) CHECK (stop_loss_source IN ('5M_SWING', '4H_SWING')),
    stop_loss_swing_price DECIMAL(12,2),
    stop_loss_distance_percent DECIMAL(5,2),

    -- Take Profit
    take_profit DECIMAL(12,2) NOT NULL CHECK (take_profit > 0),
    risk_reward_ratio DECIMAL(5,2) NOT NULL CHECK (risk_reward_ratio >= 2.0),

    -- Simulation details
    entry_slippage_percent DECIMAL(5,3) DEFAULT 0,
    exit_slippage_percent DECIMAL(5,3) DEFAULT 0,

    -- Exit details
    exit_price DECIMAL(12,2),
    exit_time TIMESTAMPTZ,
    exit_reason VARCHAR(50) CHECK (exit_reason IN ('TAKE_PROFIT', 'STOP_LOSS', 'TIME_BASED', 'MANUAL')),

    -- P&L
    pnl_btc DECIMAL(18,8),
    pnl_usd DECIMAL(12,2),
    pnl_percent DECIMAL(5,2),
    outcome VARCHAR(20) CHECK (outcome IN ('WIN', 'LOSS', 'BREAKEVEN')),

    -- Position management
    trailing_stop_activated BOOLEAN DEFAULT false,
    trailing_stop_price DECIMAL(12,2),
    trailing_stop_activated_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'CLOSED')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for paper_trades
CREATE INDEX idx_paper_trades_status ON paper_trades(status);
CREATE INDEX idx_paper_trades_entry_time ON paper_trades(entry_time DESC);
CREATE INDEX idx_paper_trades_outcome ON paper_trades(outcome);
CREATE INDEX idx_paper_trades_confluence ON paper_trades(confluence_id);
CREATE INDEX idx_paper_trades_open ON paper_trades(status) WHERE status = 'OPEN';

COMMENT ON TABLE paper_trades IS 'Paper trading simulated trades (separate from live trades table)';
COMMENT ON COLUMN paper_trades.stop_loss_source IS 'Which swing level was used for stop (5M preferred, 4H fallback)';
COMMENT ON COLUMN paper_trades.risk_reward_ratio IS 'Minimum 2:1 enforced by validation';
COMMENT ON COLUMN paper_trades.trailing_stop_activated IS 'True when price reaches 80% to TP and stop moved to breakeven';

-- ============================================================================
-- Table 2: paper_trading_config
-- Description: Paper trading session configuration (single row)
-- ============================================================================

CREATE TABLE paper_trading_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single row only

    -- Account simulation
    starting_balance DECIMAL(12,2) DEFAULT 10000.00,
    current_balance DECIMAL(12,2) DEFAULT 10000.00,

    -- Slippage model
    slippage_model VARCHAR(20) DEFAULT 'FIXED' CHECK (slippage_model IN ('FIXED', 'VOLUME_BASED', 'NONE')),
    fixed_slippage_percent DECIMAL(5,3) DEFAULT 0.05, -- 0.05% = 5 basis points

    -- Trading fees (Coinbase maker/taker)
    include_fees BOOLEAN DEFAULT true,
    maker_fee_percent DECIMAL(5,3) DEFAULT 0.40, -- 0.40%
    taker_fee_percent DECIMAL(5,3) DEFAULT 0.60, -- 0.60%

    -- System status
    trading_enabled BOOLEAN DEFAULT true,

    -- Statistics
    total_paper_trades INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    total_breakevens INTEGER DEFAULT 0,
    current_win_rate DECIMAL(5,2) DEFAULT 0.00,
    consecutive_wins INTEGER DEFAULT 0,
    consecutive_losses INTEGER DEFAULT 0,

    -- Daily tracking
    daily_pnl DECIMAL(12,2) DEFAULT 0.00,
    daily_loss_percent DECIMAL(5,2) DEFAULT 0.00,
    last_daily_reset TIMESTAMPTZ DEFAULT NOW(),

    -- Timestamps
    session_started_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration row
INSERT INTO paper_trading_config (id) VALUES (1);

COMMENT ON TABLE paper_trading_config IS 'Paper trading system configuration and statistics (single row)';
COMMENT ON COLUMN paper_trading_config.current_win_rate IS 'Rolling win rate (target: 90%)';
COMMENT ON COLUMN paper_trading_config.slippage_model IS 'FIXED (default 0.05%), VOLUME_BASED, or NONE';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Trigger for paper_trades
CREATE TRIGGER update_paper_trades_updated_at BEFORE UPDATE ON paper_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for paper_trading_config
CREATE TRIGGER update_paper_trading_config_updated_at BEFORE UPDATE ON paper_trading_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Database Views for Paper Trading
-- ============================================================================

-- View: Paper trading performance metrics
CREATE OR REPLACE VIEW v_paper_performance AS
SELECT
    COUNT(*) FILTER (WHERE outcome = 'WIN') as wins,
    COUNT(*) FILTER (WHERE outcome = 'LOSS') as losses,
    COUNT(*) FILTER (WHERE outcome = 'BREAKEVEN') as breakevens,
    COUNT(*) as total_trades,
    ROUND(
        (COUNT(*) FILTER (WHERE outcome = 'WIN')::DECIMAL /
         NULLIF(COUNT(*), 0) * 100), 2
    ) as win_rate_percent,
    AVG(risk_reward_ratio) FILTER (WHERE outcome = 'WIN') as avg_rr_wins,
    AVG(risk_reward_ratio) as avg_rr_all,
    SUM(pnl_usd) as total_pnl_usd,
    AVG(pnl_usd) as avg_pnl_per_trade,
    MAX(pnl_usd) as best_trade_usd,
    MIN(pnl_usd) as worst_trade_usd,
    AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/3600) FILTER (WHERE exit_time IS NOT NULL) as avg_trade_duration_hours
FROM paper_trades
WHERE status = 'CLOSED';

-- View: Open paper positions with live data
CREATE OR REPLACE VIEW v_paper_open_positions AS
SELECT
    id,
    direction,
    entry_price,
    entry_time,
    stop_loss,
    stop_loss_source,
    take_profit,
    position_size_btc,
    position_size_usd,
    risk_reward_ratio,
    trailing_stop_activated,
    trailing_stop_price,
    EXTRACT(EPOCH FROM (NOW() - entry_time))/3600 as hours_open
FROM paper_trades
WHERE status = 'OPEN'
ORDER BY entry_time DESC;

-- ============================================================================
-- Migration Complete
-- ============================================================================

\echo '======================================================================='
\echo 'Paper Trading Migration Applied Successfully'
\echo '======================================================================='
\echo 'New Tables Created: 2'
\echo '  1. paper_trades         - Simulated trades'
\echo '  2. paper_trading_config - Session configuration'
\echo ''
\echo 'New Views Created: 2'
\echo '  - v_paper_performance   - Aggregate performance metrics'
\echo '  - v_paper_open_positions - Currently open positions'
\echo ''
\echo 'Default Configuration:'
\echo '  - Starting balance: $10,000'
\echo '  - Slippage model: FIXED (0.05%)'
\echo '  - Trading fees: Enabled (0.60% taker)'
\echo '======================================================================='
\echo 'Next Steps:'
\echo '  1. Set up Python environment'
\echo '  2. Create paper_trading/ directory'
\echo '  3. Implement Python modules'
\echo '======================================================================='
