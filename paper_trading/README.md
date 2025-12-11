# Paper Trading System - Live Testing Guide

Autonomous paper trading system for BTC-USD that validates trading strategies before live trading. Uses swing-based stop losses, 1% fixed risk, and real-time monitoring.

**Target**: 90% win rate over 100+ trades

---

## Table of Contents

- [Quick Start](#quick-start)
- [Starting the System](#1-start-the-paper-trading-system)
- [Monitoring Logs](#2-monitor-logs-in-real-time)
- [Checking Performance](#3-check-win-rate--performance)
- [System Workflow](#4-understanding-what-happens)
- [Monitoring Tips](#5-monitoring-tips)
- [Stopping the System](#6-stop-the-system)
- [Quick Reference](#quick-reference-commands)

---

## Quick Start

```bash
cd /Users/ble/TradingBot/paper_trading
source venv/bin/activate
python main.py
```

Press **Ctrl+C** to stop.

---

## 1. Start the Paper Trading System

```bash
cd /Users/ble/TradingBot/paper_trading
source venv/bin/activate
python main.py
```

### Expected Output

```
============================================================
PAPER TRADING SYSTEM - INITIALIZATION
============================================================
Connecting to database...
✅ Database connected
Connecting to Coinbase price feed...
✅ Price feed connected

[CONFIGURATION]
  Risk per trade:       1%
  Min R/R ratio:        2.0:1
  Slippage:             0.05%
  Trading fee:          0.60%
  Stop loss buffer:     0.2% (LONG), 0.3% (SHORT)
  Stop distance range:  0.5% - 3.0%

✅ System initialization complete
============================================================

============================================================
STARTING PAPER TRADING SYSTEM
============================================================
System is now running...
Press Ctrl+C to stop

Signal monitor started (polling every 5 seconds)
Position manager started
Performance analytics started (updating every 60 seconds)
```

The system is now **live** and will:
- Poll for confluence signals every 5 seconds
- Monitor open positions every 1 second
- Display performance metrics every 60 seconds

---

## 2. Monitor Logs in Real-Time

### Live Console Output (Recommended)

The main terminal shows color-coded logs:

#### When a Signal is Found

```
[INFO] Found 1 complete confluence signal(s)
[INFO] Processing signal #123: HIGH sweep -> BEARISH bias -> BOS @ $95234
[INFO] Executing paper trade for signal #123: SHORT (BEARISH)
[INFO] Current BTC-USD price: $95,234.00
[INFO] 5M swing stop VALID: stop=$95834, distance=0.63%, min_tp=$93934
[INFO] Account balance: $100.00
[INFO] Paper trade #1 EXECUTED: SHORT 0.00016573 BTC @ $95,281.65
  SL: $95,834.00 (5M_SWING)
  TP: $93,928.30 (R/R: 2.00:1)
  Risk: $1.00 (1%)
  Fee: $0.95
```

#### When Monitoring Positions

```
[DEBUG] Monitoring 1 open position(s) at price $95,100.00
[INFO] Position #1 CLOSED (TAKE_PROFIT):
  Exit: $93,881.35
  P&L: $1.28 (WIN)
  Exit Fee: $0.95
```

#### Every 60 Seconds (Performance Metrics)

```
============================================================
PAPER TRADING PERFORMANCE METRICS
============================================================

[ACCOUNT]
  Starting Balance: $100.00
  Current Balance:  $101.28
  Total P&L:        +$1.28
  Total Return:     +1.28%

[TRADES]
  Total Trades:     1
  Wins:             1 (100.0%)
  Losses:           0
  Breakevens:       0

[WIN RATE]
  Current:          100.0%
  Target:           90%
  Status:           ABOVE TARGET (+10.0%)

[P&L STATS]
  Avg Win:          $1.28
  Avg Loss:         $0.00
  Largest Win:      $1.28
  Largest Loss:     $0.00
  Avg R/R Ratio:    2.00:1

============================================================
```

### Log Files (Optional)

Logs are also saved to files:

```bash
tail -f logs/paper_trading_*.log
```

---

## 3. Check Win Rate & Performance

Open a **second terminal** while the system runs to query the database.

### A. View Current Performance Metrics

```bash
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"
```

**Output:**
```
 total_trades | wins | losses | breakevens | win_rate | total_pnl | avg_win | avg_loss | largest_win | largest_loss | avg_rr
--------------+------+--------+------------+----------+-----------+---------+----------+-------------+--------------+--------
            5 |    4 |      1 |          0 |    80.00 |      2.45 |    1.23 |    -0.47 |        1.85 |        -0.47 |   2.05
```

### B. View Open Positions

```bash
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_open_positions;"
```

**Output:**
```
 id | direction | entry_price | stop_loss | take_profit | position_size_btc | position_size_usd | unrealized_pnl | time_open | trailing_active
----+-----------+-------------+-----------+-------------+-------------------+-------------------+----------------+-----------+-----------------
  6 | LONG      |    94500.00 |  94250.00 |    95000.00 |        0.00042011 |            39.68 |           0.21 | 00:05:23  | f
```

### C. View Recent Trades

```bash
psql -U trading_user -d trading_bot -c "
  SELECT
    id,
    direction,
    entry_price,
    stop_loss,
    take_profit,
    outcome,
    pnl_usd,
    close_reason,
    entry_time
  FROM paper_trades
  ORDER BY entry_time DESC
  LIMIT 10;
"
```

**Output:**
```
 id | direction | entry_price | stop_loss | take_profit | outcome |  pnl_usd  | close_reason | entry_time
----+-----------+-------------+-----------+-------------+---------+-----------+--------------+------------
  5 | SHORT     |    95281.65 |  95834.00 |    93928.30 | WIN     |      1.28 | TAKE_PROFIT  | 2025-12-11 10:55:22
  4 | LONG      |    94234.12 |  93984.00 |    94734.12 | LOSS    |     -0.47 | STOP_LOSS    | 2025-12-11 10:42:15
  3 | SHORT     |    95100.00 |  95650.00 |    93950.00 | WIN     |      1.15 | TAKE_PROFIT  | 2025-12-11 10:30:08
```

### D. View Trade Details (Individual Trade)

```bash
psql -U trading_user -d trading_bot -c "SELECT * FROM paper_trades WHERE id = 5;"
```

This shows all fields including:
- `stop_loss_source` (5M_SWING or 4H_SWING)
- `stop_loss_swing_price` (the actual swing level)
- `risk_reward_ratio`
- `trailing_stop_activated`
- Entry/exit fees and slippage

---

## 4. Understanding What Happens

### System Workflow

#### 1. Signal Detection (every 5s)
- Checks for `confluence_state.current_state = 'COMPLETE'`
- Skips if already in a trade (max 1 position)

#### 2. Trade Execution (when signal found)
- Fetches current BTC-USD price
- Tries 5M swing for stop loss → fallback to 4H swing
- If no valid swing: **REJECTS TRADE** (you'll see warning log)
- Calculates 1% position size
- Applies 0.05% slippage and 0.60% fee
- Inserts into `paper_trades` table

#### 3. Position Monitoring (every 1s)
- Checks if stop loss hit → close as LOSS
- Checks if take profit hit → close as WIN
- Checks if 80% to TP → activate trailing stop (move to breakeven)
- Checks if 72 hours passed → auto-close

#### 4. Performance Reporting (every 60s)
- Displays metrics in console
- Updates are also queryable in database views

### Critical Trading Rules

**Stop Loss (Swing-Based)**:
- NEVER arbitrary percentages
- Priority: 5M swing → 4H swing → reject trade
- Buffer: 0.2% (LONG), 0.3% (SHORT) beyond swing level
- Distance: Must be 0.5%-3% from entry
- Must allow minimum 2:1 R/R ratio

**Position Sizing**:
- Fixed 1% of account balance per trade (non-negotiable)
- Formula: `position_size = (account_balance * 0.01) / stop_distance`

**Trailing Stop**:
- Activates at 80% progress to take profit
- Moves stop to breakeven (entry price)

**Time Limit**:
- Auto-close after 72 hours if neither SL nor TP hit

---

## 5. Monitoring Tips

### A. Keep Logs in One Terminal

```bash
# Terminal 1: Run the system
python main.py
```

### B. Monitor Database in Another Terminal

```bash
# Terminal 2: Watch metrics update every 5 seconds
watch -n 5 'psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"'
```

This refreshes the win rate view every 5 seconds.

### C. Check for Signals from Node.js Scanner

Make sure your Node.js scanners are running to generate signals:

```bash
# Check if Node.js bot is running
ps aux | grep node
```

The paper trading system **reads** signals written by the JavaScript scanners. If no signals appear, the Python system will just wait.

### What to Look For

#### ✅ Good Signs
- System starts without errors
- Logs show "Monitoring X open position(s)"
- Trades execute when signals appear
- Win rate tracked correctly in database
- Trailing stops activate when 80% to TP

#### ⚠️ Warning Signs
- "No valid swing-based stop loss found" → Trade rejected (this is CORRECT behavior - means no safe entry)
- Connection errors to database or Coinbase API
- No signals for long periods → Check if Node.js scanners are running

#### 🎯 Success Criteria
- **90% win rate over 100+ trades** (PRIMARY GOAL)
- System runs continuously without crashes
- All trades have swing-based stop losses (never arbitrary)
- Position sizing always exactly 1% risk

---

## 6. Stop the System

Press **Ctrl+C** in the terminal running `main.py`:

```
^C
Received signal SIGINT, initiating shutdown...

============================================================
SHUTTING DOWN PAPER TRADING SYSTEM
============================================================
Stopping monitors...
Cancelling 3 running task(s)...
All tasks cancelled
Disconnecting from services...
✅ Shutdown complete
============================================================
```

The system will gracefully:
- Stop all monitoring tasks
- Close database connections
- Disconnect from price feed

**Note:** Open positions remain in the database. When you restart, the system will resume monitoring them.

---

## Quick Reference Commands

```bash
# Start system
python main.py

# Check win rate
psql -U trading_user -d trading_bot -c "SELECT win_rate, total_trades, wins, losses FROM v_paper_performance;"

# View open positions
psql -U trading_user -d trading_bot -c "SELECT id, direction, entry_price, unrealized_pnl FROM v_paper_open_positions;"

# View recent trades
psql -U trading_user -d trading_bot -c "SELECT id, direction, outcome, pnl_usd, close_reason FROM paper_trades ORDER BY entry_time DESC LIMIT 10;"

# Check if Node.js scanners are running (to generate signals)
ps aux | grep node

# View log files
tail -f logs/paper_trading_*.log

# Watch metrics update in real-time
watch -n 5 'psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"'
```

---

## Project Structure

```
paper_trading/
├── venv/                    # Python 3.11 virtual environment
├── .env                     # Configuration (DB, API keys, risk params)
├── config.py                # Configuration loader
├── main.py                  # Main event loop
│
├── database/
│   ├── connection.py        # AsyncPG connection pool
│   ├── queries.py           # SQL query functions
│   └── models.py            # Pydantic data models
│
├── market/
│   └── price_feed.py        # Coinbase price feed (JWT auth)
│
├── core/
│   ├── trade_simulator.py   # Swing-based stop loss & position sizing
│   ├── position_manager.py  # Real-time position monitoring
│   └── signal_monitor.py    # Confluence signal polling
│
├── analytics/
│   └── performance.py       # Performance metrics calculation
│
├── utils/
│   └── logger.py            # Loguru logging setup
│
├── logs/                    # Log files
├── requirements.txt         # Python dependencies
├── test_setup.py           # Setup validation tests
└── README.md               # This file
```

---

## Troubleshooting

### System won't start

```bash
# Check virtual environment is activated
which python  # Should show /Users/ble/TradingBot/paper_trading/venv/bin/python

# Reinstall dependencies if needed
pip install -r requirements.txt
```

### No signals appearing

```bash
# Check if Node.js scanners are running
ps aux | grep node

# Check confluence_state table
psql -U trading_user -d trading_bot -c "SELECT id, current_state, updated_at FROM confluence_state ORDER BY updated_at DESC LIMIT 5;"
```

### Database connection errors

```bash
# Check PostgreSQL is running
psql -U trading_user -d trading_bot -c "SELECT version();"

# Verify credentials in .env file
cat .env | grep DB_
```

### Coinbase API errors

```bash
# Verify API credentials in .env
cat .env | grep COINBASE_

# Test manually
python -c "from market.price_feed import price_feed; import asyncio; asyncio.run(price_feed.connect())"
```

---

## Configuration

Edit `.env` to adjust settings:

```bash
# Risk Management (DO NOT CHANGE RISK_PERCENT - fixed at 1%)
RISK_PERCENT=0.01          # 1% risk per trade (non-negotiable)
MIN_RR_RATIO=2.0           # Minimum 2:1 risk/reward

# Slippage & Fees
SLIPPAGE_PERCENT=0.0005    # 0.05% (FIXED model)
FEE_PERCENT=0.006          # 0.60% Coinbase taker fee

# Stop Loss Configuration
BUFFER_BELOW_LOW=0.002     # 0.2% below swing low (LONG)
BUFFER_ABOVE_HIGH=0.003    # 0.3% above swing high (SHORT)
MIN_STOP_DISTANCE_PERCENT=0.5   # 0.5% minimum
MAX_STOP_DISTANCE_PERCENT=3.0   # 3.0% maximum

# Account
ACCOUNT_BALANCE=100        # Starting balance in USD
```

---

## System Architecture

```
┌─────────────────────────────────────────────────┐
│            Main Event Loop (main.py)             │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────┐│
│  │Signal Monitor│  │Position Mgr  │  │Analytics││
│  │  (5s poll)   │  │  (1s check)  │  │ (60s)  ││
│  └──────┬───────┘  └──────┬───────┘  └───┬────┘│
│         │                 │               │      │
│         ▼                 ▼               ▼      │
│  ┌──────────────────────────────────────────┐   │
│  │      Trade Simulator (Core Logic)        │   │
│  │  • Swing-based stop loss                 │   │
│  │  • 1% position sizing                    │   │
│  │  • Slippage + fees                       │   │
│  └───────────────┬──────────────────────────┘   │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────┐                  │
│  │     Database Layer        │                  │
│  │  • PostgreSQL (asyncpg)   │                  │
│  │  • Queries for all data   │                  │
│  └───────────────────────────┘                  │
└─────────────────────────────────────────────────┘
```

---

## Support

For detailed implementation docs:
- **Setup Guide**: `/Users/ble/TradingBot/paper_trading/HANDOFF.md`
- **Node.js Reference**: `/Users/ble/TradingBot/lib/trading/`
- **Database Schema**: `/Users/ble/TradingBot/database/schema.sql`

🚀 **Ready to start!** Run `python main.py` and watch the system paper trade automatically.
