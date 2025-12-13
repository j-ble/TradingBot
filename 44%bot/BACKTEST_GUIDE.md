# Backtesting Guide

## Quick Start

```bash
cd /Users/ble/TradingBot/paper_trading
source venv/bin/activate

# Backtest all available data
python backtest.py --all

# Backtest last 90 days
python backtest.py --days 90

# Backtest specific date range
python backtest.py --start "2024-01-01" --end "2024-12-31"

# Custom starting balance
python backtest.py --all --balance 1000
```

## What It Does

The backtest script:

1. **Loads historical candle data** from your PostgreSQL database
   - 4H candles: Pattern detection (liquidity sweeps)
   - 5M candles: Entry signals and position monitoring

2. **Simulates your trading strategy**:
   - ✅ 4H liquidity sweep detection
   - ✅ 5M confluence signals (simplified for backtest)
   - ✅ Swing-based stop loss (5M → 4H priority)
   - ✅ 1% fixed risk position sizing
   - ✅ 0.05% slippage + 0.60% fees
   - ✅ 2:1 minimum R/R ratio
   - ✅ Trailing stops at 80% to target

3. **Monitors each trade through history**:
   - Checks every 5M candle for SL/TP hits
   - Activates trailing stops when 80% to TP
   - Auto-closes after 72 hours if no exit

4. **Calculates performance**:
   - Win rate (target: 90%)
   - Total P&L
   - Best/worst trades
   - Average R/R ratio

## Output Example

```
============================================================
STARTING BACKTEST
============================================================
Loaded 221 4H candles, 1615 5M candles
Backtest period: 2023-12-31 to 2025-12-02
Starting balance: $100.00

4H HIGH sweep detected: $42,500 swept by $42,545 at 2024-01-15 -> BEARISH bias
Backtest trade EXECUTED: SHORT @ $42,521.26
  SL: $42,850.00 (5M_SWING)
  TP: $41,862.72 (R/R: 2.00:1)

Trade CLOSED (TAKE_PROFIT): WIN | P&L: $1.23 | Balance: $101.23

...

============================================================
BACKTEST COMPLETE
============================================================

[ACCOUNT]
  Starting Balance:  $100.00
  Final Balance:     $145.67
  Total P&L:         $45.67
  Total Return:      45.67%

[TRADES]
  Total Trades:      52
  Wins:              47 (90.38%)
  Losses:            5
  Breakevens:        0

[WIN RATE]
  Current:           90.38%
  Target:            90%
  Status:            ✅ TARGET ACHIEVED

[P&L STATS]
  Avg Win:           $1.15
  Avg Loss:          -$0.87
  Best Trade:        $2.34
  Worst Trade:       -$1.12
  Avg R/R Ratio:     2.15:1

============================================================
```

## How It Differs from Live Trading

| Feature | Backtest | Live Paper Trading |
|---------|----------|-------------------|
| Data Source | Historical candles from DB | Real-time price from Coinbase API |
| Pattern Detection | Simplified (price movement) | Full Node.js scanners (CHoCH→FVG→BOS) |
| Speed | Processes months in seconds | Real-time (hours/days per trade) |
| Purpose | Validate strategy quickly | Test execution & monitoring |

## Interpreting Results

### ✅ Good Results
- Win rate ≥ 90%
- Positive total P&L
- Average R/R ≥ 2.0:1
- Consistent wins across time periods

### ⚠️ Warning Signs
- Win rate < 80% → Strategy needs refinement
- Large losses → Stop loss logic issues
- Low R/R ratio → Take profit too conservative

### 🎯 Next Steps After Backtest

1. **If win rate ≥ 90%**:
   - Run live paper trading for 100+ trades
   - Confirm results match backtest
   - Start with micro capital ($100-500)

2. **If win rate < 90%**:
   - Analyze losing trades
   - Adjust stop loss buffers
   - Test different time periods
   - Refine pattern detection

## Advanced Options

### Export Results to CSV

Add to `backtest.py` after line 822:

```python
import csv

def export_results_to_csv(results, filename='backtest_results.csv'):
    """Export trade results to CSV"""
    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'entry_time', 'exit_time', 'direction', 'entry_price',
            'exit_price', 'stop_loss', 'take_profit', 'pnl_usd',
            'outcome', 'exit_reason', 'rr_ratio'
        ])
        writer.writeheader()

        for trade in results['trades']:
            writer.writerow({
                'entry_time': trade.entry_time,
                'exit_time': trade.exit_time,
                'direction': trade.direction,
                'entry_price': trade.entry_price,
                'exit_price': trade.exit_price,
                'stop_loss': trade.stop_loss,
                'take_profit': trade.take_profit,
                'pnl_usd': trade.pnl_usd,
                'outcome': trade.outcome,
                'exit_reason': trade.exit_reason,
                'rr_ratio': trade.risk_reward_ratio
            })

    print(f"\nResults exported to {filename}")

# Then call it:
await export_results_to_csv(results)
```

### Filter by Month

```bash
# Backtest January 2024
python backtest.py --start "2024-01-01" --end "2024-01-31"

# Compare different months
for month in {01..12}; do
    python backtest.py --start "2024-${month}-01" --end "2024-${month}-31"
done
```

## Troubleshooting

### "No trades executed"

Possible causes:
1. **No liquidity sweeps detected** - Historical data doesn't show sweeps
2. **No valid swing levels** - Swings outside 0.5%-3% range
3. **Date range too short** - Try `--all` or `--days 180`

Solutions:
- Check data: `psql -U trading_user -d trading_bot -c "SELECT COUNT(*) FROM candles_4h;"`
- Adjust sweep detection threshold in `backtest.py` line 87

### "Not enough data"

You need:
- Minimum 100 4H candles (~1.5 months)
- Minimum 500 5M candles

Fetch more data using your Node.js data collection scripts.

## Comparison: Backtest vs Live

Run both to validate:

```bash
# 1. Backtest last 3 months
python backtest.py --days 90

# 2. Run live paper trading
python main.py
# (Let it run for 2-4 weeks)

# 3. Compare results
psql -U trading_user -d trading_bot -c "SELECT * FROM v_paper_performance;"
```

If results match within ±5%, your strategy is validated! ✅

## Key Metrics to Track

1. **Win Rate** - Primary metric (target: 90%)
2. **Total Return %** - Should be positive
3. **Avg R/R Ratio** - Should be ≥ 2.0
4. **Max Consecutive Losses** - Risk management check
5. **Best/Worst Trade** - Outlier detection

## FAQ

**Q: Why is backtest faster than live trading?**
A: Backtest processes historical data at code speed (seconds). Live trading waits for real market movements (hours/days).

**Q: Can I backtest with more capital?**
A: Yes: `python backtest.py --all --balance 10000`

**Q: How accurate is the backtest?**
A: Very accurate for mechanics (stop loss, position sizing, P&L). Pattern detection is simplified vs. live Node.js scanners.

**Q: What if I want to test different stop loss buffers?**
A: Edit `config.py` or `.env` file:
```python
BUFFER_BELOW_LOW = Decimal('0.003')  # Change from 0.002 to 0.003
```

Then re-run backtest.

**Q: Can I see individual trade details?**
A: Yes, check the logs in `logs/paper_trading_*.log` or add CSV export (see Advanced Options).

---

## Next Steps

1. ✅ Run backtest: `python backtest.py --all`
2. ✅ Review results (target: 90% win rate)
3. ✅ If passed, run live paper trading: `python main.py`
4. ✅ After 100+ live trades with 90% win rate → Go live with micro capital
