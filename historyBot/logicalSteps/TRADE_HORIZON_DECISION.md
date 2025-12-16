# Trade Horizon Decision

**Status**: DECISION DOCUMENT
**Created**: 2025-12-15
**Dependencies**: All Locked Contracts, Expectancy, Position Sizing

---

## Why This Comes Last

You cannot decide trade horizon without knowing:

| Required Knowledge | Your Answer |
|-------------------|-------------|
| Signal frequency | ~5-6/month from 4H |
| Optimal entry window | 1-2 hours post 5M reclaim |
| Session performance | NY_MID 90%, NY_OPEN 50% |
| Expectancy | +0.94R per trade |
| Position sizing | 1% fixed risk |

Only now can you ask: **"What kind of trader am I with this system?"**

---

## The Two Options

### Option A: Pure Day Trading

```
Entry: During session (NY_MID preferred)
Exit: Before session ends (22:00 UTC)
Hold time: 2-5 hours max
Overnight: Never
```

### Option B: Day-to-Swing Hybrid

```
Entry: During session (NY_MID preferred)
Exit: When 4H move exhausts OR target hit
Hold time: Hours to days
Overnight: Yes, when in profit
```

---

## What Your Data Actually Shows

### The 4H Bias is NOT an Intraday Signal

Your 4H contract measures accuracy over the **full bias period**, not intraday:

```
4H candle = 4 hours of price action
Confirmation candle = +4 hours
Full bias expression = 8-48 hours typically
```

**Implication**: The 71% accuracy assumes you hold for the move. Exiting early is untested.

### MFE/MAE Suggests Holding

| Period | MFE/MAE | What It Means |
|--------|---------|---------------|
| Training | 1.48x | Price moved 48% more in your favor than against |
| Stress Test | 2.04x | Price moved 104% more in your favor than against |

**Implication**: The edge expresses over TIME. Cutting early may cut profits more than losses.

### Session Data Shows Entry Timing, Not Exit

Your 1H contract optimizes **when to enter**, not how long to hold:

```
NY_MID 90% win rate = Best time to ENTER
Not = "Exit before NY_MID ends"
```

---

## Day Trading Analysis

### What You Would Do

```
1. 4H bias fires (e.g., BULLISH at 12:00 UTC)
2. Wait for allowed session
3. 5M reclaim at 18:00 UTC (NY_MID)
4. 1M limit entry at 18:15 UTC
5. EXIT by 22:00 UTC (session close)
6. Flat overnight
```

### Pros

| Benefit | Impact |
|---------|--------|
| No overnight risk | Sleep without checking phone |
| No weekend gap risk | BTC can gap on Sunday open |
| Cleaner P&L | Daily mark-to-market |
| Lower variance | Smaller swings in equity |
| Easier psychology | Fresh start each day |

### Cons

| Cost | Impact |
|------|--------|
| Truncated winners | Exit at +1R when move goes to +3R |
| Reduced expectancy | Full 4H edge doesn't express |
| Untested methodology | 71% accuracy measured on swing holds |
| More friction | Daily entries/exits = more slippage |
| Lower R:R | Time-capped trades = smaller targets |

### Day Trading Expectancy Estimate

If exiting early captures only 60% of the average move:

```
Original: Win = 1.8R average
Day trade: Win = 1.08R average (60% of 1.8R)

New Expectancy = (0.68 × 1.08R) - (0.32 × 0.9R)
               = 0.73R - 0.29R
               = +0.44R per trade (vs +0.94R swing)
```

**Result**: Day trading potentially cuts expectancy by 53%.

---

## Swing Hybrid Analysis

### What You Would Do

```
1. 4H bias fires (e.g., BULLISH at 12:00 UTC)
2. Wait for allowed session
3. 5M reclaim at 18:00 UTC (NY_MID)
4. 1M limit entry at 18:15 UTC
5. HOLD until:
   - Target hit (2R minimum)
   - Stop hit
   - 4H bias invalidated
   - 72-hour max duration (per system rules)
6. Manage overnight with stop in place
```

### Pros

| Benefit | Impact |
|---------|--------|
| Full edge expression | 71% accuracy as tested |
| Higher R:R | Let winners run to 2R+ |
| Original expectancy | +0.94R preserved |
| Matches validation | Trading what you tested |
| Fewer trades | 5/month is enough |

### Cons

| Cost | Impact |
|------|--------|
| Overnight risk | Price can gap against you |
| Weekend exposure | BTC trades 24/7 |
| Higher variance | Larger swings in equity |
| Psychological stress | Watching positions overnight |
| Funding costs | If using perpetuals |

### Overnight Risk Quantified

For BTC, typical overnight moves (00:00-08:00 UTC):

| Scenario | Probability | Impact |
|----------|-------------|--------|
| <1% move | ~70% | Within stop tolerance |
| 1-2% move | ~25% | May hit stop |
| 2%+ move | ~5% | Stop likely hit |

**Mitigation**: Stop is always at swing level. Overnight gap through stop is rare but possible.

---

## The Critical Insight

### Your System Was Validated on Swing Holds

```
4H Bias Contract:
- "71% of the time, price moves in the direction of my bias"
- This is measured over the FULL 4H move, not partial

5M Execution Contract:
- MFE/MAE 1.92x
- This is maximum excursion, which requires HOLDING

1M Entry Contract:
- R:R of 18.9:1 on winning trades
- Impossible to achieve with 4-hour exits
```

**Conclusion**: The validated edge requires swing holding. Day trading is a different system.

---

## Hybrid Approach: Best of Both

### The Optimal Framework

```
ENTRY = Intraday (precision from 5M/1M)
MANAGEMENT = Swing (let 4H edge express)
EXIT = Based on structure, not time
```

### Rules

```
1. Enter ONLY during valid sessions (not NY_OPEN)
2. Set stop at 5M swing level (always)
3. Set initial target at 2R minimum
4. If +80% to target → move stop to breakeven
5. If in profit at session close → HOLD overnight
6. If at loss at session close → evaluate:
   - Stop still valid? → Hold
   - Structure broken? → Exit
7. Maximum hold: 72 hours (per system rules)
```

### When to Exit Early (Before Target)

```
EXIT if any of:
- 4H structure invalidates bias
- New 4H signal fires in opposite direction
- 72-hour maximum reached
- Stop hit (obviously)

DO NOT EXIT just because:
- Session ended
- You're nervous
- Profit exists but target not hit
```

---

## Decision Matrix

| Factor | Day Trade | Swing Hybrid | Winner |
|--------|-----------|--------------|--------|
| Matches validated edge | No | Yes | **Hybrid** |
| Expectancy preserved | ~50% | 100% | **Hybrid** |
| Overnight stress | None | Some | Day Trade |
| Win rate impact | Unknown | Tested | **Hybrid** |
| R:R potential | Capped | Uncapped | **Hybrid** |
| Psychological ease | Higher | Lower | Day Trade |
| Compounding speed | Slower | Faster | **Hybrid** |

**Score**: Hybrid 5, Day Trade 2

---

## Recommendation

### Primary: Day-to-Swing Hybrid

```
RECOMMENDED APPROACH:

1. Enter during optimal session (intraday precision)
2. Hold for full 4H move expression (swing duration)
3. Manage with structure-based exits (not time-based)
4. Accept overnight positions when in profit
5. Maximum hold: 72 hours
```

### Why This Works

```
You get:
- Intraday entry precision (1M optimization)
- Session timing advantage (1H filter)
- Full edge expression (4H bias)
- Original expectancy (+0.94R)
- Tested methodology (no deviation from validation)
```

### Optional: Day Trade Exceptions

If you absolutely cannot hold overnight:

```
EXCEPTION RULE:
- If unrealized P&L < +0.5R at session close → EXIT
- Accept reduced expectancy on these trades
- Track separately to measure impact
```

This creates a "weak hybrid" that sacrifices some edge for sleep.

---

## Position Management for Overnight Holds

### Pre-Sleep Checklist

```
□ Stop is at 5M swing level (not mental)
□ Stop is active on exchange (not just charted)
□ Position size is exactly 1% risk
□ Take profit order placed at target
□ No second position open
□ Notifications enabled for stop/target fill
```

### Wake-Up Protocol

```
1. Check if position still open
2. If stopped out → Log and move on
3. If target hit → Log and celebrate
4. If still open:
   - Reassess 4H bias validity
   - Check if overnight created new swing level
   - Adjust stop if structure improved
```

---

## Weekend Handling

BTC trades 24/7 but weekends have:
- Lower liquidity
- Potential for gaps on Sunday open
- Higher manipulation risk

### Weekend Rule

```
IF position open Friday 22:00 UTC:
  IF unrealized > +1R → HOLD through weekend
  IF unrealized < +1R → EXIT before weekend
  IF unrealized < 0 → HOLD (stop protects)

Rationale: Only hold winners through weekend risk
```

---

## Trade Duration Statistics (Expected)

Based on your system parameters:

| Outcome | Expected Duration |
|---------|------------------|
| Winner (target hit) | 8-24 hours |
| Winner (trailing stop) | 24-48 hours |
| Loser (stop hit) | 1-6 hours |
| Breakeven (moved stop) | 12-24 hours |

**Average hold time**: ~12-20 hours

This is swing trading with intraday precision, not day trading.

---

## Summary

```
┌─────────────────────────────────────┐
│  YOUR SYSTEM IS:                    │
│                                     │
│  DAY-TO-SWING HYBRID                │
│                                     │
│  • Enter like a day trader          │
│    (session timing, 1M precision)   │
│                                     │
│  • Hold like a swing trader         │
│    (let 4H bias express fully)      │
│                                     │
│  • Exit on structure                │
│    (not on time or emotion)         │
│                                     │
└─────────────────────────────────────┘
```

---

## One-Sentence Summary

**You enter with intraday precision during optimal sessions, but you hold for the swing move because that's what your 71% edge was validated on — exiting early trades a tested system for an untested one.**
