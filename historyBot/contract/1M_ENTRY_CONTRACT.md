# 1M ENTRY CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Validation**: 7 signals, 2 months of data (Oct-Dec 2025)

---

## Final 1M Rule

### FUNCTION: ENTRY TIMING ONLY

```
1M does NOT modify 4H bias.
1M does NOT modify 5M stop.
1M does NOT add confirmation.
1M ONLY optimizes entry price.
```

### ENTRY OPTIMIZATION

```
After valid 5M reclaim:
  1. Look for 1M retracement (30 min window)
  2. BULLISH → Limit order at recent 1M swing low
  3. BEARISH → Limit order at recent 1M swing high
  4. If not filled by window close → Market order
  5. Stop remains at 5M swing level (ALWAYS)
```

---

## Validated Performance

| Metric | Market Entry | Limit Entry | Change |
|--------|-------------|-------------|--------|
| Win Rate | 29% | 57% | +28% |
| Avg R:R | 7.2:1 | 18.9:1 | +163% |
| Trades Saved | — | 2 | — |
| Trades Lost | — | 0 | — |

### Entry Improvement Statistics

| Metric | Value |
|--------|-------|
| Avg Improvement | 0.35% |
| Min Improvement | 0.16% |
| Max Improvement | 0.74% |
| Fill Rate | 100% (7/7) |

---

## What 1M is NOT

The following are EXPLICITLY EXCLUDED from 1M logic:

```
1. Stop placement (BANNED - proven to hurt win rate)
2. Bias modification (4H only)
3. Additional confirmation (5M reclaim is sufficient)
4. Entry rejection (5M signal is the decision)
5. Pattern recognition (no CHoCH/FVG/BOS on 1M)
```

### Why Stop Tightening is Banned

```
Test Result:
- 1M stops: -14.3% win rate degradation
- 1M stops: Lost 1 winning trade
- 1M stops: Saved 0 losing trades

The 4H edge requires room for price to consolidate.
Tight 1M stops get stopped out on normal volatility.
```

---

## Mental Model

### 1M is PRECISION, not DECISION

```
5M reclaim signal fires?
  → You have PERMISSION to enter
  → Wait for 1M retracement (up to 30 min)
  → If retracement happens → Limit order
  → If no retracement → Market order
  → Stop ALWAYS at 5M swing

1M does NOT tell you whether to trade.
1M tells you the optimal price to execute a trade.
```

### The Complete Stack

```
┌─────────────────────────────────────┐
│  4H BIAS (LOCKED)                   │
│  Permission layer                   │
│  WHAT direction                     │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  1H SESSION (LOCKED)                │
│  Time filter                        │
│  WHEN allowed                       │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  5M EXECUTION (LOCKED)              │
│  Reclaim confirmation               │
│  WHETHER to enter + WHERE to stop   │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  1M ENTRY (LOCKED)                  │
│  Entry timing                       │
│  OPTIMAL price within window        │
└─────────────────────────────────────┘
```

---

## Execution Flow

### Step-by-Step

```
1. 4H signal fires (sweep + RSI + confirmation)
   → BULLISH or BEARISH bias set

2. 1H session check
   → If NY_OPEN (14:00-17:00 UTC) → WAIT
   → Otherwise → PROCEED

3. 5M reclaim detected
   → Entry is valid
   → Calculate 5M swing stop

4. 1M entry window opens (30 min)
   → Look for retracement to recent 1M swing
   → BULLISH: 1M swing low for limit order
   → BEARISH: 1M swing high for limit order

5. Entry executed
   → Limit if filled within window
   → Market if not filled by 30 min

6. Stop set at 5M swing level
   → NOT at 1M swing
   → NEVER tighten below 5M
```

---

## Permanent Locks

### INVIOLABLE RULES

```
1. Stops NEVER move below 5M structure
2. 1M is NEVER allowed to veto a trade
```

### 1M CAN ONLY:

```
✓ Improve entry price
✓ Reduce slippage
✓ Improve R:R
```

### 1M CANNOT:

```
✗ Tighten stops
✗ Reject valid 5M signals
✗ Add confirmation requirements
✗ Modify bias
✗ Override any upstream layer
```

---

## Prohibited Actions

The following are BANNED:

1. **Using 1M for stop placement** — Proven to hurt win rate
2. **Extending window beyond 30 min** — Reduces fill reliability
3. **Rejecting 5M signal if no 1M fill** — Market order is fallback
4. **Adding 1M confirmation requirements** — Complexity without benefit
5. **Optimizing limit offset** — Simple swing level is sufficient

If entry timing feels "suboptimal," the answer is NOT to add 1M complexity.
The answer is to trust the system.

---

## Contract Signature

```
1M ENTRY LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: LIMIT_TIMING_ONLY

This contract is immutable.
Upstream layers (4H, 1H, 5M) feed this.
This layer does not modify them.
```

---

## One-Sentence Summary

**The 1M chart doesn't make you right more often — it makes you right more efficiently, which is how returns scale without increasing risk.**

---

## Integration Summary

| Layer | Function | Locked Rule |
|-------|----------|-------------|
| 4H | Permission | RSI sweep + confirmation |
| 1H | Time gate | Block NY_OPEN |
| 5M | Signal + Stop | Reclaim + swing stop |
| 1M | Entry timing | Limit order at retracement |

---

## Risk Note

The 1M optimization is an efficiency improvement, not an edge source.

If you skip the 1M limit order and use market entry:
- You lose ~28% win rate improvement
- You lose ~163% R:R improvement
- But you still have a valid system

The 4H bias is the edge.
The 5M reclaim is the confirmation.
The 1M entry is the polish.

**Do not confuse optimization for edge.**
