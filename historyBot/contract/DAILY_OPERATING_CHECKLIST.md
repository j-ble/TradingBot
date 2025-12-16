# DAILY OPERATING CHECKLIST — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Type**: Pilot Checklist (boring, repeatable, professional)
**Dependencies**: All Locked Contracts

---

## Purpose

This is your pre-flight checklist. Pilots don't skip steps because they "feel confident." Neither do you.

```
Use this EVERY trading day.
No exceptions.
No shortcuts.
No "I already know this."
```

---

## Phase 0: Pre-Market Sanity Check

**Time Required**: 2 minutes
**When**: Before opening any charts

### Mental State Verification

```
┌─────────────────────────────────────────────────────────────┐
│  BEFORE CHARTS — ANSWER HONESTLY                            │
└─────────────────────────────────────────────────────────────┘

□ Am I rested and focused?
    → If tired, stressed, or distracted: STOP

□ No urge to "make money today"
    → If feeling pressure to perform: STOP

□ Acceptable to not trade at all today
    → If answer is "no": STOP
```

### Gate Decision

| All Boxes Checked | Action |
|-------------------|--------|
| YES | Proceed to Phase 1 |
| NO | Do not trade today |

**Discipline failure here invalidates everything downstream.**

---

## Phase 1: 4H Bias Check

**Frequency**: Once per new 4H candle close
**Question**: Do I have a valid 4H signal?

### Checklist

```
┌─────────────────────────────────────────────────────────────┐
│  4H BIAS VALIDATION                                          │
└─────────────────────────────────────────────────────────────┘

□ Liquidity sweep present
    → HIGH swept = BEARISH bias
    → LOW swept = BULLISH bias

□ RSI condition met
    → BULLISH: RSI < 40
    → BEARISH: RSI > 80

□ Confirmation candle closed
    → Must have full 4H close, not just wick

□ Rules match locked 4H contract logic
    → Reference: 4H_BIAS_CONTRACT.md

□ Bias timestamp recorded
    → Write down: [DATE] [TIME UTC] [DIRECTION]
```

### Gate Decision

| Valid 4H Signal | Action |
|-----------------|--------|
| YES | Proceed to Phase 2 |
| NO | **STOP. No trades today.** |

**This is PERMISSION TO LOOK, not permission to trade.**

---

## Phase 2: 1H Time Filter

**Question**: Am I allowed to act right now?

### Session Reference

| Session | UTC Time | Status |
|---------|----------|--------|
| ASIA | 00:00–08:00 | Allowed (not preferred) |
| LONDON | 08:00–14:00 | Allowed (not preferred) |
| NY_OPEN | 14:00–17:00 | **FORBIDDEN** |
| NY_MID | 17:00–22:00 | **PREFERRED (90% win rate)** |
| NY_CLOSE | 22:00–00:00 | Allowed (not preferred) |

### Checklist

```
┌─────────────────────────────────────────────────────────────┐
│  1H TIME FILTER                                              │
└─────────────────────────────────────────────────────────────┘

□ Current time ≠ NY_OPEN (14:00–17:00 UTC)
    → If in NY_OPEN: DO NOTHING, wait

□ Preferably NY_MID (17:00–22:00 UTC)
    → Best session for execution
```

### Gate Decision

| Current Session | Action |
|-----------------|--------|
| NY_OPEN | **WAIT. Do not trade.** |
| NY_MID | Proceed to Phase 3 (optimal) |
| Other | Proceed to Phase 3 (allowed, not forced) |

**1H controls RISK, not direction.**

---

## Phase 3: 5M Execution Check

**Question**: Has execution logic fired?
**This is the TRIGGER layer.**

### Checklist

```
┌─────────────────────────────────────────────────────────────┐
│  5M EXECUTION VALIDATION                                     │
└─────────────────────────────────────────────────────────────┘

□ 4H bias exists (confirmed in Phase 1)
    → Do not proceed without valid bias

□ Within 1–2 hours of 4H signal
    → Optimal window for execution
    → After 4 hours = EXPIRED

□ 5M Reclaim Level confirmed:
    → BULLISH: 5M close > swept level + 0.2%
    → BEARISH: 5M close < swept level − 0.2%

□ Structure is clean
    → No chop cluster (multiple wicks, indecision)
    → Clear directional intent
```

### Gate Decision

| Condition | Action |
|-----------|--------|
| No reclaim | **SKIP TRADE** |
| Reclaim after 4 hours | **SKIP TRADE** |
| Choppy structure | **SKIP TRADE** |
| Valid reclaim within window | Proceed to Phase 4 |

**No reclaim = No edge.**

---

## Phase 4: 1M Entry Optimization (OPTIONAL)

**Question**: Can I improve the fill without changing risk?
**Status**: Optional, controlled

### Prerequisites

```
□ 5M reclaim already valid (Phase 3 complete)
    → Never use 1M to CREATE a signal
    → 1M only OPTIMIZES an existing signal
```

### Optimization Window

```
┌─────────────────────────────────────────────────────────────┐
│  1M OPTIMIZATION PROTOCOL                                    │
└─────────────────────────────────────────────────────────────┘

□ Open 30-minute optimization window
    → Timer starts NOW

□ Identify recent 1M swing level
    → LONG: Recent 1M swing low
    → SHORT: Recent 1M swing high

□ Place LIMIT order only
    → At or near 1M swing level
    → No market orders during optimization

□ Stop remains 5M-based
    → NEVER use 1M for stop placement
    → Stop = 5M structure level

□ Set 30-minute deadline
```

### If Not Filled in 30 Minutes

```
□ Cancel limit order
□ Enter at MARKET price
□ Same stop (5M structure)
□ Same target (4H structure, ≥2R)
```

**CRITICAL: Never skip a valid trade to "wait for a perfect 1M."**

---

## Phase 5: Position Size Confirmation

**When**: Immediately before clicking Buy/Sell
**Question**: Is my sizing correct?

### Checklist

```
┌─────────────────────────────────────────────────────────────┐
│  POSITION SIZE VERIFICATION                                  │
└─────────────────────────────────────────────────────────────┘

□ Current risk tier verified
    → Default: 1% of account
    → After 3 wins: Can increase to 1.5%
    → After drawdown: Reduce per rules

□ Current drawdown < 5%
    → If drawdown ≥ 5%: Reduce risk tier
    → If drawdown ≥ 10%: Pause trading

□ One trade = One risk unit
    → No "double sizing" on "high conviction"
    → No splitting into multiple positions

□ No revenge sizing
    → After a loss, size stays the same or decreases
    → NEVER increase size to "make back" losses
```

### Calculation Verification

```
Position Size = (Account Balance × Risk%) / Stop Distance

Example:
  Account: $10,000
  Risk: 1% = $100
  Stop Distance: 2%
  Position Size = $100 / 0.02 = $5,000 notional
```

### Gate Decision

| Sizing Verified | Action |
|-----------------|--------|
| YES | Proceed to execute |
| UNSURE | Default to LOWER risk tier |

---

## Phase 6: Trade Management

**When**: After entry is filled
**Mindset**: Hands OFF

### Immediate Post-Entry Actions

```
┌─────────────────────────────────────────────────────────────┐
│  IMMEDIATELY AFTER ENTRY                                     │
└─────────────────────────────────────────────────────────────┘

□ Stop loss placed on exchange
    → Level: 5M structure swing
    → Type: Stop-market order
    → Status: LIVE (not mental)

□ Take profit placed on exchange
    → Level: 4H structure target
    → Minimum: ≥2R from entry
    → Type: Limit order

□ +0.8R alert set
    → Calculate: Entry + (Target - Entry) × 0.8
    → This is your breakeven trigger
```

### During Trade (THE HARD PART)

```
┌─────────────────────────────────────────────────────────────┐
│  WHILE TRADE IS ACTIVE                                       │
└─────────────────────────────────────────────────────────────┘

□ No partials
    → Do not take "some profit"
    → Full position stays until exit

□ No trailing stops
    → Not validated in your system
    → Destroys edge expression

□ No target adjustments
    → Target was set for a reason
    → Moving it closer = curve fitting

□ No stop tightening
    → "It feels extended" is not a signal
    → Stop stays at structure level
```

### Protection Rule

```
┌─────────────────────────────────────────────────────────────┐
│  PROTECTION TRIGGER                                          │
└─────────────────────────────────────────────────────────────┘

IF price reaches +0.8R:
    □ Move stop to BREAKEVEN (entry price)
    □ Log protection activation
    □ Continue holding for target

OTHERWISE:
    □ DO NOTHING
    □ Your edge needs TIME, not attention
```

---

## Phase 7: Overnight / End-of-Day Check

**When**: Before logging off for the day

### Daily Close Verification

```
┌─────────────────────────────────────────────────────────────┐
│  END OF DAY CHECKLIST                                        │
└─────────────────────────────────────────────────────────────┘

□ Stop is LIVE on exchange
    → Not a mental stop
    → Not an alert
    → Actual stop-market order placed

□ No stop widening occurred
    → Stop is at original 5M structure level
    → Or at breakeven if +0.8R was hit

□ No emotional interference
    → Did not adjust based on feelings
    → Did not "check one more time" excessively
```

### Friday-Specific Rules

```
┌─────────────────────────────────────────────────────────────┐
│  FRIDAY CLOSE (22:00 UTC)                                    │
└─────────────────────────────────────────────────────────────┘

IF position is NOT in profit:
    □ CLOSE the trade (full exit)
    □ Log as "Weekend Rule Exit"
    □ Accept the outcome

IF position IS in profit:
    □ May hold through weekend
    □ Stop MUST be at breakeven or better
    □ If stop not at BE: Move it there OR close

IF position is at exact breakeven:
    □ CLOSE the trade
    □ No edge to holding flat exposure
```

---

## Phase 8: Post-Trade Logging

**When**: After every trade exit
**Time Required**: 2-3 minutes
**Status**: MANDATORY

### Logging Checklist

```
┌─────────────────────────────────────────────────────────────┐
│  POST-TRADE LOG (REQUIRED)                                   │
└─────────────────────────────────────────────────────────────┘

□ Screenshot captured
    → Entry point visible
    → Exit point visible
    → Stop and target levels marked

□ Trade logged with:
    → Date/Time (UTC)
    → Session (ASIA/LONDON/NY_MID/NY_CLOSE)
    → Direction (LONG/SHORT)
    → Entry type (MARKET/LIMIT)
    → Entry price
    → Exit price
    → Stop level
    → Target level
    → R result (+2.1R, -1R, BE, etc.)
    → Rule violations (YES/NO)

□ If rule violation occurred:
    → Document which rule
    → Do not judge self
    → Note for weekly review
```

### What NOT To Do

```
□ No performance judgment TODAY
    → "I'm a bad trader" = not allowed
    → "I'm killing it" = not allowed
    → Just log the facts

□ No strategy changes TODAY
    → Losing trade ≠ broken system
    → Winning trade ≠ genius insight
    → Changes happen in weekly review ONLY
```

**Review happens WEEKLY, never intraday.**

---

## Forbidden Actions (READ DAILY)

```
┌─────────────────────────────────────────────────────────────┐
│                   ABSOLUTE FORBIDDEN ACTIONS                 │
│                                                              │
│              READ THIS EVERY DAY BEFORE TRADING              │
└─────────────────────────────────────────────────────────────┘

❌ Trading without 4H bias
   → No bias = no permission = no trade

❌ Trading during NY_OPEN (14:00-17:00 UTC)
   → 50% win rate session = coin flip
   → Wait for NY_MID

❌ Tightening stops with 1M noise
   → "It's extended" is not analysis
   → Stop stays at 5M structure

❌ Cutting winners early
   → "Lock in profit" = destroy edge
   → Let target or stop decide

❌ Adding indicators
   → Your system is complete
   → More indicators = more noise

❌ "One more trade" mentality
   → If signal is gone, day is done
   → Tomorrow exists

❌ Revenge trading after loss
   → Next trade must meet all criteria
   → Losses are not personal

❌ Increasing size after loss
   → Sizing rules don't change with emotions
   → If anything, size DOWN

❌ Moving stop further from entry
   → Increases risk beyond 1%
   → Breaks position sizing math

❌ Skipping the checklist
   → "I know the rules" = overconfidence
   → Pilots don't skip checklists
```

### If You Break Any Forbidden Action

```
1. Stop trading immediately
2. Log the violation
3. Do not trade for remainder of day
4. Review in weekly session
5. No self-punishment, just process
```

---

## Daily Reminder

Read this before every session:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   My job is not to trade often —                            │
│   it is to execute a small edge flawlessly.                 │
│                                                              │
│   • 5-6 trades per month is SUCCESS                         │
│   • No trade today is a VALID outcome                       │
│   • The checklist protects me from myself                   │
│   • Boredom is profitable                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Card

Print this. Keep it visible.

```
┌─────────────────────────────────────────────────────────────┐
│              DAILY CHECKLIST — QUICK REFERENCE               │
└─────────────────────────────────────────────────────────────┘

PHASE 0: SANITY          □ Rested? □ No pressure? □ OK with no trade?
PHASE 1: 4H BIAS         □ Sweep? □ RSI? □ Confirmation? □ Logged?
PHASE 2: 1H TIME         □ Not NY_OPEN? □ Prefer NY_MID?
PHASE 3: 5M TRIGGER      □ Reclaim? □ Within 2hrs? □ Clean structure?
PHASE 4: 1M OPTIMIZE     □ Optional □ 30min window □ Then market
PHASE 5: SIZE            □ 1% risk? □ <5% DD? □ No revenge?
PHASE 6: MANAGE          □ Stop live □ Target set □ +0.8R→BE □ Hands off
PHASE 7: EOD             □ Stop live □ Friday rule checked
PHASE 8: LOG             □ Screenshot □ Data logged □ No judgment

FORBIDDEN: No bias / NY_OPEN / Tight stops / Early exits / More indicators
```

---

## Checklist Completion Log

Use this to track daily checklist completion:

```
DATE        | CHECKLIST | TRADE | RESULT | NOTES
------------|-----------|-------|--------|------------------
2025-12-16  | ☑ Done    | No    | —      | No 4H signal
2025-12-17  | ☑ Done    | Yes   | +2.1R  | Clean execution
2025-12-18  | ☑ Done    | No    | —      | NY_OPEN only window
...
```

---

## Contract Signature

```
DAILY OPERATING CHECKLIST: LOCKED
Version: 1.0.0 (Final)
Checksum: 8_PHASES_FORBIDDEN_REMINDER

This checklist is MANDATORY.
Skip no phases.
Read forbidden actions DAILY.
Execute flawlessly, not frequently.
```

---

## One-Sentence Takeaway

**The checklist is the system — if you skip the checklist, you're not trading your system, you're gambling.**
