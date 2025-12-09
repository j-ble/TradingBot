# Paper Trading System - Developer Handoff

## 📋 Project Overview

**Goal**: Build a Python-based paper trading system to validate the BTC-USD trading strategy before live trading. The system simulates trades based on pattern signals from the existing Node.js bot.

**Target Win Rate**: 90% over 100+ trades

---

## ✅ What's Been Completed (60% done)

### 1. Database Layer
- ✅ **Migration**: `/Users/ble/TradingBot/database/migrations/002_paper_trading.sql`
  - Tables: `paper_trades`, `paper_trading_config`
  - Views: `v_paper_performance`, `v_paper_open_positions`
  - **Already applied to database** - no need to re-run

### 2. Python Project Structure
- ✅ Virtual environment with Python 3.11 (NOT 3.14 - incompatible)
- ✅ All dependencies installed via `requirements.txt`
- ✅ Directory structure created:
  ```
  paper_trading/
  ├── venv/              ← Python 3.11 virtual env
  ├── .env               ← Config (copied from parent)
  ├── config.py          ← Configuration loader
  ├── database/
  │   └── models.py      ← Pydantic data models
  ├── utils/
  │   └── logger.py      ← Loguru logging setup
  └── [other dirs]       ← Empty, ready for implementation
  ```

### 3. Core Modules Implemented
- ✅ **config.py** - Loads all trading parameters from `.env`
  - 1% risk per trade
  - 2:1 min R/R ratio
  - 0.05% slippage, 0.60% fees
  - Stop loss constraints (0.2-0.3% buffer, 0.5-3% distance)

- ✅ **utils/logger.py** - Modern logging with loguru
  - Color-coded console output
  - File logging to `logs/paper_trading_*.log`

- ✅ **database/models.py** - Pydantic models with validation
  - `ConfluenceSignal`, `SwingLevel`, `StopLossResult`
  - `PositionSize`, `PaperTrade`, `PerformanceMetrics`
  - Validation enforces R/R ≥ 2:1, positive values

### 4. Testing
- ✅ **test_setup.py** - Validates all completed components
  - Run: `source venv/bin/activate && python test_setup.py`
  - All 4 tests passing: Config ✅ Logger ✅ Models ✅ Database ✅

---

## ⏳ What Needs to Be Implemented (40% remaining)

### Priority Order:

#### 1. **Database Layer** (NEXT - START HERE)
**Files**: `database/connection.py`, `database/queries.py`

**connection.py** - PostgreSQL connection pool:
```python
import asyncpg
from config import config

class DatabasePool:
    async def connect(self):
        self.pool = await asyncpg.create_pool(
            host=config.DB_HOST,
            port=config.DB_PORT,
            database=config.DB_NAME,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            min_size=2,
            max_size=10
        )

    async def fetch_one(self, query, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def fetch_all(self, query, *args):
        async with self.pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def execute(self, query, *args):
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)
```

**queries.py** - SQL queries:
- `get_complete_confluence_signals()` - Get signals where `current_state='COMPLETE'`
- `get_swing_levels(timeframe, swing_type)` - Get active swings for stop loss
- `insert_paper_trade(trade)` - Insert new simulated trade
- `get_open_positions()` - Get all open trades
- `update_paper_trade(trade_id, updates)` - Update trade fields
- `get_paper_config()` - Get session config

#### 2. **Market Data**
**File**: `market/price_feed.py`

- Fetch live BTC-USD price from Coinbase API
- Use REST endpoint: `GET /api/v3/brokerage/best_bid_ask?product_ids=BTC-USD`
- Optional: WebSocket for real-time updates
- Reference: `/Users/ble/TradingBot/lib/coinbase/client.js` for API auth

#### 3. **Trade Simulator**
**File**: `core/trade_simulator.py`

**Critical**: Must EXACTLY match Node.js logic at:
- `/Users/ble/TradingBot/lib/trading/stop_loss_calculator.js`
- `/Users/ble/TradingBot/lib/trading/position_sizer.js`

Key functions:
```python
async def calculate_stop_loss(entry_price, direction, bias):
    # Priority: 5M swing → 4H swing → reject
    # Apply buffer: 0.2% (LONG) or 0.3% (SHORT)
    # Validate: 0.5% ≤ distance ≤ 3.0%
    # Return: StopLossResult or None

def calculate_position_size(account_balance, entry_price, stop_loss):
    # Fixed 1% risk (non-negotiable)
    # Formula: risk_amount / stop_distance = position_btc
    # Return: PositionSize

async def execute_paper_trade(signal: ConfluenceSignal):
    # 1. Get current price
    # 2. Calculate stop loss (swing-based)
    # 3. Calculate position size (1% risk)
    # 4. Apply slippage (0.05% FIXED model)
    # 5. Apply fees (0.60% taker)
    # 6. Insert into paper_trades table
```

#### 4. **Position Manager**
**File**: `core/position_manager.py`

Real-time monitoring loop (runs every 1 second):
```python
async def monitor_positions(self):
    while self.running:
        current_price = await self.price_feed.get_current_price()

        for position in open_positions:
            # 1. Check stop loss hit
            # 2. Check take profit hit
            # 3. Check trailing stop activation (80% to TP)
            # 4. Check 72-hour time limit

        await asyncio.sleep(1)

async def activate_trailing_stop(position, current_price):
    # Move stop to breakeven (entry price)
    # Update: trailing_stop_activated=true, trailing_stop_price=entry_price

async def close_position(position, exit_price, reason):
    # Apply exit slippage
    # Calculate P&L (LONG: exit-entry, SHORT: entry-exit)
    # Subtract fees
    # Determine outcome (WIN/LOSS/BREAKEVEN)
    # Update paper_trades: exit_price, pnl_usd, outcome, status='CLOSED'
```

#### 5. **Signal Monitor**
**File**: `core/signal_monitor.py`

Poll for complete signals (every 5 seconds):
```python
async def poll_for_signals(self):
    while self.running:
        # Query: SELECT cs.*, ls.bias FROM confluence_state cs
        #        JOIN liquidity_sweeps ls ON cs.sweep_id = ls.id
        #        WHERE cs.current_state = 'COMPLETE'
        #        AND cs.id NOT IN (SELECT confluence_id FROM paper_trades)

        if signal_found:
            await self.trade_simulator.execute_paper_trade(signal)

        await asyncio.sleep(5)
```

#### 6. **Main Event Loop**
**File**: `main.py`

Orchestrate all components:
```python
async def main():
    system = PaperTradingSystem()

    # Initialize
    await system.db.connect()
    await system.price_feed.connect()

    # Run 3 concurrent tasks
    await asyncio.gather(
        system.signal_monitor.run(),     # Poll every 5s
        system.position_manager.run(),   # Monitor every 1s
        system.performance.run()         # Update every 60s
    )

if __name__ == "__main__":
    asyncio.run(main())
```

#### 7. **Analytics**
**File**: `analytics/performance.py`

Calculate metrics:
```python
async def calculate_metrics(self):
    # Query v_paper_performance view
    # Calculate: win_rate, avg_rr, total_pnl, max_drawdown
    # Track: consecutive wins/losses, best/worst trades
```

#### 8. **Unit Tests**
**Files**: `tests/test_*.py`

Test coverage needed:
- Position sizing (1% risk formula)
- Stop loss calculation (swing-based priority logic)
- Slippage simulation
- P&L calculation
- Trailing stop activation
- Pattern accuracy (Python reads same data as Node.js writes)

---

## 🔑 Critical Implementation Notes

### 1. **NEVER Duplicate Pattern Detection Logic**
The JavaScript scanners write ALL pattern data to the database:
- `confluence_state` table has: choch_price, fvg_zone_low/high, bos_price
- Python just READS this data
- No need to port JavaScript pattern detection code

### 2. **Stop Loss MUST Match Node.js Exactly**
Reference: `/Users/ble/TradingBot/lib/trading/stop_loss_calculator.js`

Constants:
```python
BUFFER_BELOW_LOW = Decimal('0.002')      # 0.2%
BUFFER_ABOVE_HIGH = Decimal('0.003')     # 0.3%
MIN_STOP_DISTANCE_PERCENT = Decimal('0.5')  # 0.5%
MAX_STOP_DISTANCE_PERCENT = Decimal('3.0')  # 3.0%
```

Priority Logic:
1. Try 5M swing first
2. Fallback to 4H swing
3. If neither valid → **reject trade** (return None)

### 3. **Position Sizing is Non-Negotiable**
Always exactly 1% of account balance:
```python
risk_amount = account_balance * Decimal('0.01')
position_btc = risk_amount / stop_distance
position_usd = position_btc * entry_price
```

### 4. **Slippage & Fees**
- **Slippage** (FIXED model, 0.05%):
  - LONG entry: `filled_price = market_price * 1.0005` (pay more)
  - SHORT entry: `filled_price = market_price * 0.9995` (receive less)
  - LONG exit: `exit_price = market_price * 0.9995` (sell lower)
  - SHORT exit: `exit_price = market_price * 1.0005` (buy higher)

- **Fees** (Coinbase Advanced Trade):
  - Taker: 0.60% (market orders)
  - Applied to position size: `fee_usd = position_size_usd * 0.006`

### 5. **Trailing Stop Logic**
- Activates at **80% progress to take profit**
- Moves stop to **breakeven** (entry price)
- Update: `trailing_stop_activated=true`, `trailing_stop_price=entry_price`

---

## 📁 Key Files & Locations

### Implementation Plan
- **Detailed plan**: `/Users/ble/.claude/plans/abundant-cooking-wall.md`
  - Complete architecture diagram
  - Pseudocode for all modules
  - Database schema details
  - Risk mitigation strategies

### Reference Files (Node.js - READ ONLY)
- **Stop loss**: `/Users/ble/TradingBot/lib/trading/stop_loss_calculator.js`
- **Position sizing**: `/Users/ble/TradingBot/lib/trading/position_sizer.js`
- **5M scanner**: `/Users/ble/TradingBot/lib/scanners/5m_scanner.js`
- **Database schema**: `/Users/ble/TradingBot/database/schema.sql`

### Environment Config
- **File**: `/Users/ble/TradingBot/paper_trading/.env`
- **Database**: trading_bot @ localhost:5432 (user: trading_user)
- **Coinbase API**: Keys already configured
- **Starting balance**: $100 (from ACCOUNT_BALANCE in .env)

---

## 🧪 How to Run & Test

### Activate Environment
```bash
cd /Users/ble/TradingBot/paper_trading
source venv/bin/activate
```

### Run Tests
```bash
# Validate setup (config, logger, models, database)
python test_setup.py

# Run unit tests (after implementing)
pytest tests/ -v
```

### Start Paper Trading System
```bash
# After all modules are implemented
python main.py
```

### Check Database
```bash
# View paper trading config
psql -U trading_user -d trading_bot -c "SELECT * FROM paper_trading_config;"

# View performance metrics
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"

# View open positions
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_open_positions;"

# View recent trades
psql -U trading_user -d trading_bot -c "SELECT id, direction, entry_price, stop_loss, take_profit, outcome, pnl_usd FROM paper_trades ORDER BY entry_time DESC LIMIT 10;"
```

---

## 📊 Success Criteria

When complete, the system should:
1. ✅ Detect every `confluence_state = 'COMPLETE'` signal
2. ✅ Calculate swing-based stop loss (5M → 4H priority)
3. ✅ Size positions at exactly 1% risk
4. ✅ Simulate entries with slippage and fees
5. ✅ Monitor positions in real-time (SL/TP/trailing stop)
6. ✅ Close positions correctly with P&L calculation
7. ✅ Track win rate and performance metrics
8. ✅ Run continuously without errors

**Primary Metric**: Win rate (target: 90% over 100+ trades)

---

## ⚠️ Common Pitfalls

1. **Python 3.14 incompatible** - Use Python 3.11 (venv already set up)
2. **Don't replicate pattern detection** - Read from database, don't port JS code
3. **Stop loss must be swing-based** - Never arbitrary percentages
4. **1% risk is non-negotiable** - Don't make it configurable
5. **Decimal precision matters** - Use `Decimal` for all money calculations
6. **Async/await everywhere** - Database and API calls are async
7. **Connection pooling** - Use asyncpg pool, not single connections

---

## 📞 Questions?

- **Implementation plan**: Read `/Users/ble/.claude/plans/abundant-cooking-wall.md` first
- **Node.js reference**: Check files in `/Users/ble/TradingBot/lib/` for exact logic
- **Database**: Schema at `/Users/ble/TradingBot/database/schema.sql`
- **Validation**: Run `python test_setup.py` before starting new code

---

## 🎯 Estimated Timeline

- **Database layer** (connection.py, queries.py): 2-3 hours
- **Price feed** (price_feed.py): 1-2 hours
- **Trade simulator** (trade_simulator.py): 4-5 hours (most critical)
- **Position manager** (position_manager.py): 3-4 hours
- **Signal monitor** (signal_monitor.py): 1-2 hours
- **Main event loop** (main.py): 1 hour
- **Analytics** (performance.py): 1-2 hours
- **Testing** (unit + integration): 2-3 hours

**Total**: ~15-22 hours of implementation + testing

---

## 📝 Next Immediate Steps

1. **Read the full plan**: `/Users/ble/.claude/plans/abundant-cooking-wall.md`
2. **Implement database layer**: Start with `database/connection.py`
3. **Test database queries**: Verify can read confluence_state, swing_levels
4. **Implement price feed**: Get live BTC-USD price from Coinbase
5. **Implement trade simulator**: This is the most critical component
6. **Test each component**: Write tests as you go

**Start here**: `database/connection.py` - Everything else depends on database access.

Good luck! 🚀
