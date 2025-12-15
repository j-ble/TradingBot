# 1H SESSION CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Validation**: 63 signals, 1 year of data (2024-2025)

---

## Final 1H Rules

### FUNCTION: TIME FILTER ONLY

```
1H does NOT modify 4H bias.
1H does NOT confirm direction.
1H ONLY filters by time-of-day.
```

### BLOCK (Do Not Trade)
```
14:00–17:00 UTC (NY_OPEN)

Performance: 50% win rate (coin flip)
MFE/MAE: 0.77 (negative expectancy)
Reason: Maximum stop hunts, initial moves reverse
```

### PREFER (Best Signals)
```
17:00–22:00 UTC (NY_MID)

Performance: 90% win rate
MFE/MAE: 2.99
Reason: Direction established, follow-through reliable
```

### ALLOWED (Trade Normally)
```
00:00–08:00 UTC (ASIA)     → 70.6% win rate
08:00–14:00 UTC (LONDON)   → 66.7% win rate

Acceptable. Trade if 4H signal is valid.
```

---

## Validated Performance

| Session  | Hours (UTC) | Signals | Win Rate | MFE/MAE |
|----------|-------------|---------|----------|---------|
| NY_MID   | 17:00-22:00 | 20      | 90.0%    | 2.99    |
| ASIA     | 00:00-08:00 | 17      | 70.6%    | 1.21    |
| LONDON   | 08:00-14:00 | 18      | 66.7%    | 1.91    |
| NY_OPEN  | 14:00-17:00 | 8       | 50.0%    | 0.77    |

**Session Spread**: 40% (NY_MID vs NY_OPEN)

---

## What 1H is NOT

The following are EXPLICITLY EXCLUDED from 1H logic:

```
1. Structure alignment (HH/HL, LH/LL)
2. Trend confirmation (EMA stacks)
3. Bias modification
4. CHoCH detection
5. Any pattern recognition
```

**Why**: CONFLICT signals outperformed AGREE by +18.6%.
The 4H catches reversals. Requiring 1H alignment would filter out winning trades.

---

## Mental Model

### 1H is a GATE, not a FILTER

```
4H BULLISH bias active + NY_OPEN?
  → BLOCKED. Wait for better session.

4H BULLISH bias active + NY_MID?
  → PROCEED to 5M execution.

4H BULLISH bias active + ASIA/LONDON?
  → ALLOWED. Proceed with normal caution.
```

### The Stack

```
4H = WHAT direction (permission to look)
1H = WHEN to act (time gate)
5M = WHERE to enter (precision)
```

---

## Why This Works

```
1. Removes the worst hours (50% → filtered out)
2. Doesn't add complexity (single time check)
3. Reduces drawdown clustering (max streak: 1 in NY_MID)
4. Keeps reversals intact (doesn't require trend alignment)
```

This is how professionals improve expectancy without overfitting.

---

## Prohibited Actions

The following are BANNED:

1. **Adding structure checks** — No "also check 1H trend"
2. **Session-specific bias rules** — No "only longs in London"
3. **Relaxing NY_OPEN block** — No "but this one looks good"
4. **Tightening other sessions** — No "also block early Asia"
5. **Pattern overlays** — No CHoCH/FVG/BOS on 1H

If edge degrades in live trading, the answer is NOT to add 1H complexity.
The answer is to examine 5M execution.

---

## Contract Signature

```
1H SESSION LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: TIME_GATE_ONLY

This contract is immutable.
Downstream layers (5M, 1M) must adapt to this.
This layer does not adapt to them.
```

---

## What Comes Next

The 1H layer is complete. Further work proceeds DOWNSTREAM:

1. **5M Execution** — Entry timing, stop placement, confluence
2. **1M Optimization** — Precision entries (optional)

Each layer takes:
- 4H bias as directional INPUT
- 1H session gate as time INPUT

No layer modifies the 4H bias or 1H time rules as OUTPUT.

---

## One-Sentence Summary

**You used 1H the right way: not to confirm direction, but to avoid the most dangerous time window.**
