# Paper Trading System - Complete Walkthrough

## 🔍 What You Asked For

You wanted to understand what's happening in your paper trading bot and confirm **NO REAL MONEY** is being used.

**Answer: YES, this is 100% SIMULATION. Zero real money at risk.**

---

## 📊 Database Tables - Where Everything Is Stored

### 1. `paper_trades` - The Core Trade Log

Every simulated trade is a row in this table:

```
Trade ID: 1
├── Entry Data
│   ├── direction: "LONG" or "SHORT"
│   ├── entry_price: $95,234.50 (with 0.05% slippage applied)
│   ├── entry_time: 2025-12-11 10:23:45
│   ├── position_size_btc: 0.00016573 BTC
│   ├── position_size_usd: $15.78
│   └── entry_fee_usd: $0.09 (0.60% simulated fee)
│
├── Risk Management
│   ├── stop_loss: $94,850.00
│   ├── stop_loss_source: "5M_SWING" (or "4H_SWING")
│   ├── stop_loss_swing_price: $94,900.00 (actual swing level)
│   ├── stop_loss_distance_percent: 0.63%
│   ├── take_profit: $96,000.00
│   └── risk_reward_ratio: 2.15:1 (always ≥ 2.0)
│
├── Exit Data (when closed)
│   ├── exit_price: $96,015.50 (with slippage)
│   ├── exit_time: 2025-12-11 11:45:22
│   ├── exit_reason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_STOP" | "TIME_LIMIT"
│   ├── pnl_usd: $1.23
│   └── outcome: "WIN" | "LOSS" | "BREAKEVEN"
│
└── Status
    ├── status: "OPEN" or "CLOSED"
    ├── trailing_stop_activated: true/false
    └── confluence_id: Links to the signal that triggered this trade
```

**Key Point**: This table ONLY stores simulated data. No actual orders exist on Coinbase.

---

### 2. `v_paper_performance` - Performance View

SQL View that calculates your stats in real-time:

```sql
SELECT
    win_rate_percent,    -- Your primary metric (target: 90%)
    total_trades,        -- Number of closed trades
    wins,                -- Count of winning trades
    losses,              -- Count of losing trades
    total_pnl_usd,       -- Total profit/loss
    avg_rr_wins,         -- Average R/R ratio on wins
    best_trade_usd,      -- Your best trade
    worst_trade_usd      -- Your worst trade
FROM v_paper_performance;
```

---

### 3. `v_paper_open_positions` - Live Monitoring

Shows currently open trades:

```sql
SELECT
    id,
    direction,
    entry_price,
    stop_loss,
    take_profit,
    hours_open,           -- How long position has been open
    trailing_stop_activated  -- Is breakeven stop active?
FROM v_paper_open_positions;
```

---

## 🔄 Complete Trade Flow (Step-by-Step)

### Phase 1: Signal Detection (Every 5 Seconds)

**File**: `core/signal_monitor.py`

```python
# 1. Check if we can take a new position
open_positions = await get_open_positions()
if len(open_positions) >= 1:
    # Max 1 position at a time - SKIP
    return

# 2. Query database for COMPLETE signals
signals = await get_complete_confluence_signals()
# SQL: SELECT * FROM confluence_state cs
#      JOIN liquidity_sweeps ls ON cs.sweep_id = ls.id
#      WHERE cs.current_state = 'COMPLETE'
#      AND cs.id NOT IN (SELECT confluence_id FROM paper_trades)

# This finds signals like:
# - 4H liquidity sweep detected (HIGH swept = BEARISH bias)
# - 5M confluence complete: CHoCH → FVG Fill → BOS
# - Not yet traded (not in paper_trades)

# 3. Execute trade for each signal found
for signal in signals:
    await trade_simulator.execute_paper_trade(signal)
```

---

### Phase 2: Trade Execution (When Signal Found)

**File**: `core/trade_simulator.py`

```python
async def execute_paper_trade(signal):
    # STEP 1: Get current BTC-USD price
    current_price = await price_feed.get_current_price()
    # API Call: GET https://api.coinbase.com/api/v3/brokerage/best_bid_ask
    # Result: $95,234.00 (mid price between bid/ask)
    # ⚠️ READ-ONLY - No orders placed

    # STEP 2: Calculate swing-based stop loss
    stop_result = await calculate_stop_loss(
        entry_price=current_price,
        direction='LONG',  # Based on signal bias
        bias='BULLISH'
    )

    # Priority logic:
    # 1. Try 5M swing LOW (for LONG)
    #    - Fetch most recent swing: SELECT * FROM swing_levels
    #                                WHERE timeframe='5M' AND swing_type='LOW'
    #    - Apply 0.2% buffer below swing
    #    - Check if distance is 0.5%-3% from entry
    #    - If valid → USE IT

    # 2. If 5M swing invalid, try 4H swing
    # 3. If both invalid → REJECT TRADE (return None)

    # Example result:
    # stop_result = {
    #     price: $94,850.00,
    #     source: '5M_SWING',
    #     swing_price: $94,900.00 (actual swing level),
    #     distance_percent: 0.63%
    # }

    # STEP 3: Calculate position size (1% risk)
    account_balance = Decimal('100.00')  # From database config
    risk_amount = account_balance * Decimal('0.01')  # $1.00

    stop_distance = abs(entry_price - stop_loss)
    position_btc = risk_amount / stop_distance
    # Example: $1.00 / (95234 - 94850) = 0.00000260 BTC

    position_usd = position_btc * entry_price
    # Example: 0.00000260 * 95234 = $0.25

    # STEP 4: Apply slippage (0.05% FIXED model)
    # LONG entry: pay MORE (worse fill)
    entry_price_slipped = current_price * 1.0005
    # $95,234.00 → $95,281.65

    # STEP 5: Calculate fees (0.60%)
    entry_fee = position_usd * 0.006
    # $0.25 * 0.006 = $0.0015

    # STEP 6: Calculate take profit (minimum 2:1 R/R)
    target_distance = stop_distance * 2.0
    take_profit = entry_price_slipped + target_distance
    # $95,281.65 + ($95,281.65 - $94,850.00) * 2 = $96,145.95

    # STEP 7: Insert into database (THE ONLY WRITE OPERATION)
    trade_id = await insert_paper_trade({
        'confluence_id': signal['id'],
        'direction': 'LONG',
        'entry_price': entry_price_slipped,
        'stop_loss': stop_result.price,
        'take_profit': take_profit,
        'position_size_btc': position_btc,
        'position_size_usd': position_usd,
        'risk_amount_usd': risk_amount,
        'stop_loss_source': stop_result.source,
        'entry_fee_usd': entry_fee
    })

    # SQL: INSERT INTO paper_trades (...) VALUES (...)
    # ✅ Trade stored in database ONLY
    # ❌ NO order sent to Coinbase
```

---

### Phase 3: Position Monitoring (Every 1 Second)

**File**: `core/position_manager.py`

```python
async def monitor_positions():
    while running:
        # Get current price (cached for 1 second to avoid API spam)
        current_price = await price_feed.get_current_price(use_cache=True)

        # Get all open positions from database
        open_positions = await get_open_positions()
        # SQL: SELECT * FROM paper_trades WHERE status = 'OPEN'

        for position in open_positions:
            # CHECK 1: Time limit (72 hours)
            if hours_open > 72:
                await close_position(reason='TIME_LIMIT')

            # CHECK 2: Stop loss hit?
            if direction == 'LONG' and current_price <= stop_loss:
                await close_position(reason='STOP_LOSS')

            # CHECK 3: Take profit hit?
            if direction == 'LONG' and current_price >= take_profit:
                await close_position(reason='TAKE_PROFIT')

            # CHECK 4: Trailing stop activation (80% to TP)
            progress = (current_price - entry_price) / (take_profit - entry_price)
            if progress >= 0.80 and not trailing_activated:
                # Move stop to breakeven
                await activate_trailing_stop(trade_id, entry_price)
                # SQL: UPDATE paper_trades
                #      SET trailing_stop_activated = true,
                #          trailing_stop_price = entry_price
                #      WHERE id = trade_id

        await asyncio.sleep(1)  # Check again in 1 second
```

---

### Phase 4: Closing a Position

**File**: `core/position_manager.py`

```python
async def close_position(trade_id, market_price, reason):
    # STEP 1: Apply exit slippage (0.05%)
    # LONG exit: sell LOWER (worse fill)
    exit_price_slipped = market_price * 0.9995
    # $96,000.00 → $95,952.00

    # STEP 2: Calculate exit fee
    exit_fee = position_usd * 0.006

    # STEP 3: Calculate P&L
    if direction == 'LONG':
        gross_pnl = (exit_price_slipped - entry_price) * position_btc
    else:  # SHORT
        gross_pnl = (entry_price - exit_price_slipped) * position_btc

    net_pnl = gross_pnl - exit_fee

    # STEP 4: Determine outcome
    if net_pnl > $0.01:
        outcome = 'WIN'
    elif net_pnl < -$0.01:
        outcome = 'LOSS'
    else:
        outcome = 'BREAKEVEN'

    # STEP 5: Update database
    await close_paper_trade(
        trade_id=trade_id,
        exit_price=exit_price_slipped,
        pnl_usd=net_pnl,
        outcome=outcome,
        close_reason=reason
    )
    # SQL: UPDATE paper_trades
    #      SET exit_price = $95,952.00,
    #          exit_time = NOW(),
    #          pnl_usd = $1.23,
    #          outcome = 'WIN',
    #          exit_reason = 'TAKE_PROFIT',
    #          status = 'CLOSED'
    #      WHERE id = trade_id

    # ✅ Trade closed in database
    # ❌ NO real position to close on Coinbase
```

---

## 🔒 Safety Guarantees

### 1. **No Order Execution**

Search the entire codebase for Coinbase order functions:
- ❌ No `create_order()` calls
- ❌ No `POST /api/v3/brokerage/orders` requests
- ✅ Only `GET /api/v3/brokerage/best_bid_ask` (read-only price fetch)

### 2. **Database-Only Operations**

All "trades" are just rows in PostgreSQL:
```bash
# To verify yourself:
psql -U trading_user -d trading_bot

# See all trades (they're just database entries)
SELECT * FROM paper_trades;

# Check your Coinbase account - you'll see ZERO positions
```

### 3. **Realistic Simulation**

The system models reality with:
- **Slippage**: 0.05% worse fill on entry and exit
- **Fees**: 0.60% taker fee (Coinbase Advanced Trade rate)
- **Swing-based stops**: Uses actual market structure, not arbitrary %
- **Position sizing**: Exactly 1% risk per trade

This ensures when you go live, results should be similar.

---

## 📈 Performance Tracking

The system calculates your win rate automatically:

```bash
# Query your stats anytime
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"

# Example output:
# wins | losses | total_trades | win_rate_percent | total_pnl_usd
# -----|--------|--------------|------------------|---------------
#   45 |      5 |           50 |            90.00 |       +$23.45
#
# 🎯 TARGET ACHIEVED: 90% win rate!
```

---

## 🚀 Running the System

```bash
# Terminal 1: Start the paper trading system
cd /Users/ble/TradingBot/paper_trading
source venv/bin/activate
python main.py

# Terminal 2: Watch your performance (updates every 5 seconds)
watch -n 5 'psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"'

# Terminal 3: Monitor open positions
watch -n 2 'psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_open_positions;"'
```

---

## ⚠️ Current Issue: API Authentication

The system tried to connect but got a 401 error from Coinbase. This is just an API key issue preventing price fetches.

**Two options to fix:**

### Option A: Use Valid API Keys
- The keys in your `.env` might be expired or invalid
- Create new read-only keys at https://cloud.coinbase.com/

### Option B: Use Mock Price Feed (for testing)
- We can modify `price_feed.py` to return simulated prices
- Perfect for testing the trading logic without real API

---

## 📊 What Happens Without Fixing API

**Nothing runs.** The system needs live BTC prices to:
1. Calculate entry prices
2. Monitor stop loss / take profit hits
3. Simulate realistic fills

**Workaround**: Use mock prices for now, fix API later before live trading.

---

## 🎯 Summary

✅ **Zero real money at risk** - Everything stored in PostgreSQL
✅ **Realistic simulation** - Slippage, fees, swing-based stops
✅ **Win rate tracking** - Target: 90% over 100+ trades
✅ **Safe testing** - Validate strategy before going live

❌ **Current blocker**: API auth (easily fixable)

---

## 📝 Next Steps

1. **Fix Coinbase API keys** OR use mock prices
2. **Run the system** for 100+ trades
3. **Analyze results** - If win rate ≥ 90%, go live
4. **Start with micro capital** - $100-500 real money
5. **Scale gradually** - Only after proven consistency

**Questions?** Let me know what you'd like to explore next!
