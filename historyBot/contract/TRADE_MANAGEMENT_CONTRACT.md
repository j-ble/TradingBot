# TRADE MANAGEMENT CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Dependencies**: 4H Bias, 1H Session, 5M Execution, Position Sizing

---

## Why This is Locked First

Every result downstream depends on how trades are exited, not how they're entered.

If trade management is not frozen:
- Equity curve simulations are meaningless
- Expectancy will drift
- Checklist rules become subjective
- You'll "improve" performance by accident (curve fitting)

**Professionals treat exits as contract law, not preferences.**

---

## 1. Initial Stop Placement (IMMUTABLE)

### Rule

```
STOP SOURCE: 5M structure ONLY
STOP LOCATION: Beyond 5M reclaim invalidation level

STOP = 5M swing level that invalidates reclaim
```

### Prohibited Stop Methods

| Method | Status | Reason |
|--------|--------|--------|
| 1M-based stops | BANNED | Too tight, noise stop-outs |
| Volatility-based tightening | BANNED | Discretionary, not structural |
| Discretionary adjustments | BANNED | Curve fitting |
| ATR-based stops | BANNED | Not structure-based |
| Percentage-based stops | BANNED | Ignores market structure |

### Why 5M Structure

```
Proven survivability
    ↓
Prevents noise stop-outs
    ↓
Preserves 4H edge expression
```

**This rule is frozen. No exceptions.**

---

## 2. Profit Target Framework (ASYMMETRIC)

### You Are NOT a Fixed-R Scalper

Your edge lives in asymmetry. Fixed scalp targets destroy it.

### Target Derivation

```
TARGET SOURCE: 4H opposing liquidity / structure
MINIMUM ACCEPTABLE R:R: 2.0R

IF structure_target < 2R:
    → SKIP TRADE (do not force entry)
```

### Why Minimum 2R

| Expectancy Assumption | Requirement |
|-----------------------|-------------|
| Your win rate | ~68-71% |
| Your expected winners | ≥2R average |
| System breakeven | Requires asymmetric wins |

**Lower targets mathematically break the system.**

### Target Setting Rules

```
1. Identify 4H opposing structure (liquidity pool, swing level)
2. Calculate R:R from entry to target
3. IF R:R < 2.0 → NO TRADE
4. IF R:R ≥ 2.0 → SET TARGET at structure level
```

---

## 3. Trade Progression Rules (THE HEART)

### Phase 1 — Protection (After Entry)

```
IF price reaches +0.8R (≈80% to target):
    → Move stop to BREAKEVEN (entry price)
```

### Why +0.8R (Not 1R)

| Reason | Impact |
|--------|--------|
| Avoids premature BE stop-outs | Price often tests entry zone |
| Aligns with MFE-first data | Your data shows 73% MFE first |
| Preserves convexity | Lets winners develop |

### Phase 2 — Hold (No Micromanagement)

```
IF trade is active AND valid:
    → DO NOTHING
    → NO partials
    → NO trailing stops
    → NO "locking in profit"
```

**You are not paid to "manage". You are paid to let time work.**

### What "Active and Valid" Means

```
Trade is VALID if:
- Stop has not been hit
- Target has not been hit
- 4H structure has not invalidated
- 72-hour max not reached

Trade is INVALID if:
- 4H opposite sweep + confirmation fires
- Structure that created signal breaks
```

---

## 4. Exit Conditions (ONLY THESE THREE)

A trade exits ONLY if one of the following occurs:

### Exit A — Target Hit

```
TRIGGER: Price reaches predefined structure target
ACTION: Full exit (100% of position)
RESULT: Winner logged
```

### Exit B — Stop Hit

```
TRIGGER: Price reaches stop loss level
ACTION: Full exit (100% of position)
RESULT: Loss logged
RULE: NO re-entry on same signal
```

### Exit C — Structure Failure (Rare)

```
TRIGGER: 4H invalidation (opposite sweep + confirmation)
ACTION: Manual exit allowed
RESULT: Logged as "Structure Exit"
```

### Time-Based Exits Are FORBIDDEN

```
❌ "Session is ending"
❌ "It's been 12 hours"
❌ "I want to sleep"
❌ "Weekend is coming" (special rules apply)
```

---

## 5. Overnight & Weekend Rules

### Overnight Rule

```
STOPS MUST BE:
- Live on exchange (not mental)
- At original 5M structure level
- Not widened
- Not tightened

NO:
- Mental stops
- "I'll check in the morning"
- Widening for "breathing room"
```

### Weekend Rule

```
FRIDAY CLOSE CHECK (22:00 UTC):

IF position NOT in profit:
    → CLOSE TRADE (full exit)
    → Reason: Remove tail risk

IF position IS in profit:
    → CAN HOLD through weekend
    → Stop MUST be at breakeven or better
```

### Why Weekend Rules

| Scenario | Action | Rationale |
|----------|--------|-----------|
| In profit | Hold | Reward > Risk |
| Not in profit | Close | Tail risk not compensated |
| At breakeven | Close | No edge to hold |

**Removes tail risk. Keeps only statistically favorable exposure.**

---

## 6. Explicitly PROHIBITED Actions

Write these down. Memorize them. Breaking any = no longer trading the tested system.

### The Banned List

| # | Prohibited Action | Why It's Banned |
|---|------------------|-----------------|
| 1 | Tightening stops because "it feels extended" | Discretionary, destroys edge |
| 2 | Taking partial profits | Truncates winners, curve fitting |
| 3 | Moving targets closer | Reduces R:R, destroys expectancy |
| 4 | Closing because "session ended" | Time-based exit not validated |
| 5 | Re-entering after stop-out | Revenge trading, not in system |
| 6 | Widening stops | Increases risk beyond 1% |
| 7 | Adding to position | Changes risk profile |
| 8 | Moving stop further from entry | Already at structure level |
| 9 | Using trailing stops | Not validated in your data |
| 10 | Taking "easy money" early | You don't know what's easy |

### If You Break These

```
You are no longer trading the tested system.
Your results are no longer comparable to validation.
Your expectancy is unknown.
```

---

## 7. Trade Management State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    TRADE MANAGEMENT STATES                   │
└─────────────────────────────────────────────────────────────┘

ENTRY
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  STATE: ACTIVE                                               │
│                                                              │
│  Stop: 5M structure level                                    │
│  Target: 4H structure level (≥2R)                            │
│  Action: NONE (hold)                                         │
│                                                              │
│  Transitions:                                                │
│    • Price reaches +0.8R → PROTECTED                         │
│    • Stop hit → EXIT_LOSS                                    │
│    • Target hit → EXIT_WIN                                   │
│    • 4H invalidates → EXIT_STRUCTURE                         │
│    • Friday close + not in profit → EXIT_WEEKEND             │
└─────────────────────────────────────────────────────────────┘
  │
  ▼ (+0.8R reached)
┌─────────────────────────────────────────────────────────────┐
│  STATE: PROTECTED                                            │
│                                                              │
│  Stop: BREAKEVEN (entry price)                               │
│  Target: Unchanged                                           │
│  Action: NONE (hold)                                         │
│                                                              │
│  Transitions:                                                │
│    • Stop hit → EXIT_BREAKEVEN                               │
│    • Target hit → EXIT_WIN                                   │
│    • 4H invalidates → EXIT_STRUCTURE                         │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  STATE: CLOSED                                               │
│                                                              │
│  Outcomes:                                                   │
│    EXIT_WIN - Target hit                                     │
│    EXIT_LOSS - Stop hit before protection                    │
│    EXIT_BREAKEVEN - Stop hit after protection                │
│    EXIT_STRUCTURE - 4H invalidation                          │
│    EXIT_WEEKEND - Friday close rule                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Management Decision Tree

```
DURING ACTIVE TRADE:

Is stop hit?
├── YES → EXIT (full loss)
└── NO ↓

Is target hit?
├── YES → EXIT (full win)
└── NO ↓

Has 4H structure invalidated?
├── YES → EXIT (structure failure)
└── NO ↓

Is it Friday close AND not in profit?
├── YES → EXIT (weekend rule)
└── NO ↓

Has price reached +0.8R?
├── YES (and not already protected) → MOVE STOP TO BREAKEVEN
└── NO ↓

OTHERWISE → DO NOTHING (HOLD)
```

---

## 9. Contract Summary

```
┌─────────────────────────────────────────────────────────────┐
│              FINAL TRADE MANAGEMENT CONTRACT                 │
└─────────────────────────────────────────────────────────────┘

ENTRY:
  4H bias + 1H session + 5M reclaim (+ optional 1M limit)

STOP:
  Fixed at 5M structure (NEVER 1M, NEVER volatility-based)

TARGET:
  4H structure, ≥2R ONLY (skip if <2R)

MANAGEMENT:
  +0.8R → stop to breakeven
  Otherwise → NO ACTION

EXIT:
  Target, stop, or 4H invalidation ONLY

HORIZON:
  Swing holds (8-48h typical)

WEEKEND:
  Only hold winners (stop at BE or better)

PROHIBITED:
  Partials, trailing, early exits, re-entries, tightening
```

---

## 10. Why This Works (One Sentence)

**Your system's edge lives in time + asymmetry, not activity — these rules protect both.**

---

## Contract Signature

```
TRADE MANAGEMENT LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: 5M_STOP_2R_TARGET_0.8R_BE

This contract is IMMUTABLE.
Upstream layers (4H, 1H, 5M, 1M) feed this.
This is the FINAL layer before execution.
No layer modifies these rules.
```

---

## Integration Stack (Complete)

```
┌─────────────────────────────────────────────────────────────┐
│  4H BIAS (LOCKED)                                            │
│  Permission layer                                            │
│  ~5-6 signals/month                                          │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  1H SESSION (LOCKED)                                         │
│  Session filter                                              │
│  NY_MID = 90% win rate                                       │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5M EXECUTION (LOCKED)                                       │
│  Entry timing                                                │
│  Reclaim Level, 1-2hr window                                 │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  1M ENTRY (LOCKED)                                           │
│  Precision layer (optional)                                  │
│  Limit orders for efficiency                                 │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  TRADE MANAGEMENT (LOCKED) ← YOU ARE HERE                    │
│  Stop: 5M structure                                          │
│  Target: 4H structure ≥2R                                    │
│  Protection: +0.8R → BE                                      │
│  Exit: Target/Stop/Structure only                            │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  EXECUTION & MONITORING                                      │
│  Place orders                                                │
│  Monitor state machine                                       │
│  Log results                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-Trade Checklist (Management Ready)

Before entering any trade, confirm management parameters:

```
□ Stop level identified (5M swing structure)
□ Stop distance calculated (% from entry)
□ Target level identified (4H opposing structure)
□ R:R calculated (must be ≥2.0)
□ Position size set (1% risk / stop distance)
□ Protection level calculated (+0.8R price)
□ Weekend rule noted (if Friday)
□ Exchange stop order ready to place
□ Exchange target order ready to place
```

---

## Post-Entry Protocol

Immediately after entry:

```
1. Place stop loss order at 5M structure level
2. Place take profit order at 4H target level
3. Calculate +0.8R price level (for BE trigger)
4. Set alert at +0.8R level
5. DO NOTHING ELSE
```

---

## One-Sentence Takeaway

**Every exit is defined before entry; during the trade, you are a monk — no adjustments, no opinions, just state transitions.**
