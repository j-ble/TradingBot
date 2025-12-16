# LIVE TRADING CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Validation**: All upstream contracts validated, simulation survival 100%
**Dependencies**: All 6 contracts (4H, 1H, 5M, 1M, Trade Management, Daily Ops) + all 4 logical steps (Expectancy, Position Sizing, Equity Simulation, Trade Horizon)

---

## Purpose

This contract governs the DEPLOYMENT of the trading system.

The upstream contracts define WHAT to trade and HOW to manage.
The logical steps validate the MATH behind the edge.
This contract answers: WHEN is the system ready, and HOW does capital scale?

---

## Phase 0: PAPER VALIDATION (Pre-Live Gate)

**Method**: Manual tracking in spreadsheet/log

Before risking real capital, prove mechanical execution discipline.

### Requirements

```
ALL required before advancing to Phase 1:

1. Minimum 20 paper trades completed
2. Track all fields from Per-Trade Logging section
3. Execute as if real: wait for all confirmations, log exact entry/exit
4. No "would have taken" trades — only trades tracked in real-time
5. Win rate > 55%
6. No system execution failures
```

### Paper Trade Log Template

| # | Date | Dir | Entry | Stop | Target | Exit | R | Session | Notes |
|---|------|-----|-------|------|--------|------|---|---------|-------|
| 1 | | | | | | | | | |

### Advancement Criteria

```
IF paper_trades >= 20 AND win_rate > 55% AND no_execution_failures:
    → ADVANCE to Phase 1
ELSE:
    → Review all contracts
    → Identify pattern recognition failures
    → Repeat 10 more trades
    → Do NOT proceed until threshold met
```

---

## Pre-Live Checklist (Gate 0)

**All items MUST be complete before first live trade:**

```
□ All 6 contracts read and acknowledged
□ Phase 0 paper validation complete (20+ trades, >55% win rate)
□ Capital deployed: $500 minimum (Phase 1)
□ Exchange setup: API keys configured and tested
□ Stop orders: Verified functional on exchange
□ Risk parameters: 1% per trade configured in system
□ Daily limit: 3% loss pause configured
□ Monitoring: Dashboard operational
□ Emergency: Stop button accessible and tested
□ No-Trade Events calendar reviewed for next 7 days
```

**If ANY checkbox is empty → DO NOT TRADE**

---

## Capital Deployment Phases

### Phase 1: VALIDATION

```
Capital:    $500 - $1,000
Trades:     1-20
Risk:       1.0% fixed (non-negotiable)
Goal:       Prove mechanical execution with real capital

Exit Conditions:
  - 20 trades completed, OR
  - 3 consecutive losses (triggers Level 1 circuit breaker)

Advancement to Phase 2:
  - Win rate > 55%
  - No system execution failures
  - All trades logged correctly
  - Mechanical discipline maintained
```

### Phase 2: CONFIDENCE

```
Capital:    $1,000 - $3,000
Trades:     21-50
Risk:       1.0% fixed (no increase yet)
Goal:       Validate pattern recognition in live conditions

Exit Conditions:
  - 50 trades completed, OR
  - 6% account drawdown (triggers Level 2 circuit breaker)

Advancement to Phase 3:
  - Win rate > 60%
  - Expectancy > +0.5R
  - No Level 2 circuit breaker triggered
```

### Phase 3: SCALING

```
Capital:    $3,000 - $10,000
Trades:     51-100
Risk:       1.5% (first risk increase)
Goal:       Test edge at larger position sizes

Exit Conditions:
  - 100 trades completed, OR
  - 8% account drawdown (triggers Level 2 circuit breaker)

Advancement to Phase 4:
  - Win rate > 65%
  - Expectancy > +0.8R
  - No Level 2 circuit breaker triggered
```

### Phase 4: DEPLOYMENT

```
Capital:    $10,000+
Trades:     100+
Risk:       2.0% - 2.5% (Kelly-adjusted maximum)
Goal:       Full edge expression with validated system

Exit Conditions:
  - None (continuous operation)
  - Subject to circuit breakers

Maintenance:
  - Monthly expectancy review
  - Quarterly edge validation against simulation
  - Annual contract review
```

### Phase Summary Table

| Phase | Capital | Trades | Risk | Win Rate Req | Expectancy Req |
|-------|---------|--------|------|--------------|----------------|
| 0 | $0 (paper) | 20+ | 0% | > 55% | — |
| 1 | $500-1K | 1-20 | 1.0% | > 55% | — |
| 2 | $1K-3K | 21-50 | 1.0% | > 60% | > +0.5R |
| 3 | $3K-10K | 51-100 | 1.5% | > 65% | > +0.8R |
| 4 | $10K+ | 100+ | 2.0-2.5% | > 65% | > +0.8R |

---

## No-Trade Events (HARD PAUSE)

The following events create untested market conditions.
ALL positions must be FLAT before event. NO new entries until 4 hours post-release.

| Event | Frequency | Typical Time (UTC) |
|-------|-----------|-------------------|
| FOMC Rate Decision | 8x/year | 18:00 |
| FOMC Minutes | 8x/year | 18:00 |
| CPI (Consumer Price Index) | Monthly | 12:30 |
| NFP (Non-Farm Payrolls) | Monthly (1st Friday) | 12:30 |
| PPI (Producer Price Index) | Monthly | 12:30 |
| Fed Chair Speech | Variable | Variable |
| ECB Rate Decision | 8x/year | 12:15 |
| Bank of Japan Rate Decision | 8x/year | Variable |

### Event Rules

```
Rule 1: Position Open + Event Within 4 Hours
    → EXIT position regardless of P&L
    → Log as EXIT_EVENT in trade record

Rule 2: No-Trade Window
    → No new entries from 4 hours before to 4 hours after event
    → Even if all other conditions are met

Rule 3: Checking Events
    → Review economic calendar at start of each trading day
    → Part of Daily Operating Checklist Phase 1
```

**Rationale**: These events can cause 2-5% moves in minutes. Your edge was validated on normal market conditions. Volatility spikes are untested and could invalidate stop placement logic.

---

## Circuit Breakers

### Level 1 — PAUSE (24 hours)

```
Trigger Conditions (ANY):
  - 3 consecutive losses
  - Daily loss hits 3%
  - AI confidence drops below 60% on 3+ consecutive signals

Action:
  - Close all positions
  - Cancel all pending orders
  - No trading for 24 hours
  - Log pause reason
  - Review last 3 trades

Auto-Resume After:
  - 24 hours elapsed
  - Review completed and logged
```

### Level 2 — REVIEW (72 hours + manual reset)

```
Trigger Conditions (ANY):
  - Monthly win rate < 50%
  - 5 consecutive losses
  - Any single trade loss > 1.5%
  - System error during execution
  - Phase drawdown limit hit (6%/8% depending on phase)

Action:
  - Close all positions immediately
  - Cancel all pending orders
  - No trading for minimum 72 hours
  - Full trade-by-trade review required
  - Identify pattern or execution failure
  - Manual reset required (not automatic)

Resume Requires:
  - Written analysis of what went wrong
  - Confirmation system is functioning correctly
  - Manual acknowledgment to resume
```

### Level 3 — HALT (Indefinite + full audit)

```
Trigger Conditions (ANY):
  - Drawdown hits 10%
  - 3 months consecutive negative
  - Any unauthorized trade execution
  - API key compromise suspected
  - Pattern recognition fundamentally broken

Action:
  - Close all positions immediately
  - Revoke API trading permissions
  - Full system audit required
  - Do NOT resume until root cause identified and fixed

Resume Requires:
  - Complete audit documentation
  - Contract review (may require unlocking and revision)
  - Fresh Phase 0 paper validation
  - Gradual re-entry starting from Phase 1
```

### Circuit Breaker Summary

| Level | Duration | Trigger Examples | Reset Type |
|-------|----------|------------------|------------|
| 1 | 24 hours | 3 losses, 3% daily loss | Automatic |
| 2 | 72+ hours | 50% monthly WR, 5 losses | Manual |
| 3 | Indefinite | 10% DD, unauthorized trade | Full audit |

---

## Performance Tracking Requirements

### Per-Trade Logging (MANDATORY)

Every trade MUST record:

```
Core Fields:
  - Trade ID (sequential)
  - Timestamp entry (UTC)
  - Timestamp exit (UTC)
  - Direction (LONG/SHORT)
  - Entry price
  - Position size (USD)
  - Position size (BTC)

Stop/Target Fields:
  - Stop loss price
  - Stop loss source (5M_SWING / 4H_SWING)
  - Stop distance (%)
  - Target price
  - Target R multiple
  - Risk amount (USD)

Exit Fields:
  - Exit price
  - Exit type (WIN / LOSS / BREAKEVEN / STRUCTURE / WEEKEND / EVENT)
  - R result (actual)
  - P&L (USD)
  - Hold time (hours)

Context Fields:
  - Session (ASIA / LONDON / NY_MID / NY_CLOSE)
  - 4H bias at entry (BULLISH / BEARISH)
  - 4H sweep price
  - 5M reclaim confirmation time
  - 1M entry improvement (% vs 5M close)
  - Notes (anomalies, observations)
```

### Weekly Review (MANDATORY)

Every Sunday, calculate and log:

```
Rolling 20-Trade Metrics:
  - Win rate (target: 68%)
  - Average winner (R)
  - Average loser (R)
  - Expectancy (target: +0.94R)
  - Max drawdown (current phase)
  - Longest losing streak

Session Breakdown:
  - Trades per session
  - Win rate per session
  - Confirm NY_MID outperforming

System Health:
  - Any execution failures?
  - Any missed signals?
  - Any manual overrides? (should be 0)
```

### Monthly Review (MANDATORY)

First day of each month, calculate and log:

```
Monthly Performance:
  - Total trades
  - Win rate vs expected (68%)
  - Actual expectancy vs expected (+0.94R)
  - Monthly return (%)
  - Max drawdown (%)

Phase Evaluation:
  - Current phase
  - Phase advancement eligibility
  - Risk level appropriateness

Equity Curve Comparison:
  - Plot actual equity vs simulation median
  - Identify if tracking within expected range
  - Flag if outside 5th-95th percentile bounds

Contract Compliance:
  - Any contract violations?
  - Any prohibited actions taken?
  - Circuit breaker activations
```

---

## Prohibited Actions

| # | Prohibited Action | Why It's Banned |
|---|-------------------|-----------------|
| 1 | Trading without Phase 0 paper validation | Untested execution = unknown edge |
| 2 | Starting above Phase 1 capital | Overexposure before system proven live |
| 3 | Increasing risk before phase advancement | Premature scaling destroys accounts |
| 4 | Skipping daily operating checklist | Checklist prevents emotional/rushed trading |
| 5 | Manual override of AI decision | Introduces discretionary bias, invalidates edge |
| 6 | Continuing after circuit breaker trigger | Circuit breakers are protection, not suggestions |
| 7 | Trading during No-Trade Events | Untested volatility conditions |
| 8 | Removing stops to "give it room" | Violates swing-based stop contract |
| 9 | Adding to losing positions | Averaging down not in validated system |
| 10 | Revenge trading after loss | Psychological contamination destroys discipline |
| 11 | Skipping trade logging | Untracked trades cannot be analyzed |
| 12 | Phase jumping (skipping phases) | Each phase validates before next |

---

## Mental Model

### Live Trading is EXECUTION, not EXPERIMENTATION

```
By the time you go live:
  - The patterns are LOCKED (contracts)
  - The math is VALIDATED (logical steps)
  - The simulation shows SURVIVAL (100% probability)
  - Your only job is MECHANICAL EXECUTION

This is a DEPLOYMENT, not a DISCOVERY phase.
```

### The Robot Mindset

```
IF signal_valid AND all_contracts_satisfied:
    EXECUTE exactly as specified
    LOG everything
    WAIT for exit condition

IF something_unexpected:
    DO NOT take the trade
    LOG the anomaly
    REVIEW later in weekly analysis

NEVER "test a theory" with live capital.
NEVER "feel" like a trade is good/bad.
NEVER override the system.

Paper trading exists for experimentation.
Live trading is execution.
```

### Capital is Permission, Not Pressure

```
Phase 1 capital ($500) is not "play money."
Phase 4 capital ($10K+) is not "serious money."

ALL capital is real.
ALL trades are equal.
The system doesn't know your account size.

If you wouldn't take a trade at $10K, don't take it at $500.
If you wouldn't skip a trade at $500, don't skip it at $10K.

Mechanical execution is size-agnostic.
```

---

## Integration Stack

```
┌─────────────────────────────────────────────────┐
│  LOGICAL STEPS (VALIDATED)                      │
│  Expectancy: +0.94R | Position: 1% | Survival: 100% │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  4H BIAS CONTRACT (LOCKED)                      │
│  Permission: HIGH/LOW sweep + RSI confirmation  │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  1H SESSION CONTRACT (LOCKED)                   │
│  Filter: NY_MID optimal, NY_OPEN banned         │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  5M EXECUTION CONTRACT (LOCKED)                 │
│  Timing: Reclaim level within 1-2 hours         │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  1M ENTRY CONTRACT (LOCKED)                     │
│  Precision: 30-minute optimal entry window      │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  TRADE MANAGEMENT CONTRACT (LOCKED)             │
│  In-trade: Stops, targets, breakeven, exits     │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  DAILY OPERATING CHECKLIST (LOCKED)             │
│  Procedure: 8-phase daily execution protocol    │
└───────────────────────┬─────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│  ★ LIVE TRADING CONTRACT (THIS DOCUMENT)        │
│  Deployment: Phases, circuit breakers, tracking │
└─────────────────────────────────────────────────┘
```

---

## Contract Signature

```
LIVE TRADING LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: PHASED_MECHANICAL_EXECUTION

This contract is immutable.

Prerequisites:
  - 4H_BIAS_CONTRACT.md — LOCKED
  - 1H_SESSION_CONTRACT.md — LOCKED
  - 5M_EXECUTION_CONTRACT.md — LOCKED
  - 1M_ENTRY_CONTRACT.md — LOCKED
  - TRADE_MANAGEMENT_CONTRACT.md — LOCKED
  - DAILY_OPERATING_CHECKLIST.md — LOCKED
  - EXPECTANCY_CALCULATION.md — VALIDATED
  - POSITION_SIZING_MODEL.md — VALIDATED
  - EQUITY_CURVE_SIMULATION.md — VALIDATED
  - TRADE_HORIZON_DECISION.md — VALIDATED

This contract does not modify upstream documents.
It governs their deployment into live markets.
```

---

## One-Sentence Takeaway

**Live trading is phased deployment with circuit breakers — not a switch to flip, but a ladder to climb.**
