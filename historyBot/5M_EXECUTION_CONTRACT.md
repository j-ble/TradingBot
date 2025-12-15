# 5M EXECUTION CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Validation**: 51,770 candles, 15 bias signals, MFE/MAE 1.92x

---

## Final 5M Rule

### 5M FUNCTION = EXECUTION ONLY

```
After valid 4H bias:
  1. Wait for 5M Reclaim Level
  2. Enter within 1-2 hours
  3. Skip trade if no reclaim within 4 hours
```

### Reclaim Definition

```
BULLISH → 5M close > swept level + 0.2%
BEARISH → 5M close < swept level - 0.2%
```

---

## Validated Performance

| Metric | Value |
|--------|-------|
| MFE/MAE Ratio | 1.92x |
| MFE First Rate | 73.3% |
| False Confirmation Rate | 26.7% |
| Avg Latency | 79 min |
| Drawdown Before Profit | 0.32% |

### Timing Window Performance

| Window | MFE/MAE | Status |
|--------|---------|--------|
| 1-2 hrs | 1.73x | OPTIMAL |
| 2-4 hrs | 1.53x | ACCEPTABLE |
| 4-8 hrs | 0.84x | DEGRADED |
| >12 hrs | — | EXPIRED |

---

## Mental Model

### 5M is TIMING, not OPPORTUNITY

The 5M layer does NOT create trades.
It tells you WHEN to execute a trade the 4H already permitted.

```
4H BULLISH bias active?
  → You have PERMISSION to look for longs
  → Wait for 5M Reclaim Level
  → If reclaim happens within 1-2 hrs → ENTER
  → If no reclaim by 4 hrs → SKIP

No 5M confirmation?
  → No entry
  → Wait for next 4H signal
```

### Why Reclaim Works

```
4H sweep (liquidity taken)
    ↓
5M initially continues sweep direction
    ↓
5M reclaims the level (absorption confirmed)
    ↓
ENTRY (reversal is genuine)
```

The reclaim proves institutions absorbed liquidity, not continuation.

---

## Prohibited Actions

The following are BANNED:

1. **Combining confirmation methods** — Reclaim Level only
2. **Optimizing the 0.2% buffer** — This is final
3. **Shortening latency window** — 1-2 hours is the edge
4. **Adding more confirmation types** — Reduces robustness
5. **Entering without reclaim** — Premature entry kills edge
6. **Extending past 4 hours** — RR collapses

If execution feels "slow" or "missing trades," the answer is NOT to loosen 5M rules.
The answer is to trust the filter is working.

---

## Contract Signature

```
5M EXECUTION LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: RECLAIM_LEVEL_1_2HR

This contract is immutable.
Upstream layer (4H) feeds this.
Downstream layers (stops, targets) must adapt to this.
This layer does not adapt to them.
```

---

## What Comes Next

The 5M layer is complete. Further work proceeds DOWNSTREAM:

1. **1H Structure** — Stop placement at swing levels
2. **Target Setting** — R:R based on structure
3. **Position Management** — Trailing, partials

Each layer takes the 5M entry as INPUT.
No layer modifies the 5M entry as OUTPUT.

---

## Integration Stack

```
┌─────────────────────────────┐
│  4H BIAS (LOCKED)           │
│  Permission layer           │
│  ~5-6 signals/month         │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  5M EXECUTION (LOCKED)      │
│  Timing layer               │
│  Reclaim Level, 1-2hr       │
└──────────────┬──────────────┘
               ↓
┌─────────────────────────────┐
│  1H STRUCTURE (NEXT)        │
│  Stop placement             │
│  Swing-based stops          │
└─────────────────────────────┘
```

---

## One-Sentence Takeaway

Your 5M layer proves you can enter with minimal heat and let the 4H edge express itself — that's exactly what execution is supposed to do.
