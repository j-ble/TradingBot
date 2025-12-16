# Position Sizing Model

**Status**: REFERENCE DOCUMENT
**Created**: 2025-12-15
**Dependencies**: Expectancy Calculation, All Locked Contracts

---

## Why Position Sizing Comes After Expectancy

Once you know:
- Win rate (68%)
- Average win (1.8R)
- Average loss (0.9R)
- Expectancy (+0.94R)
- Loss streak distribution (max 3-4 consecutive)

You can answer: **"How much should I risk per trade so I survive the worst case?"**

---

## Where Most Systems Fail

**Bad sizing is based on:**
- Confidence ("I feel good about this one")
- Recent wins ("I'm on a streak")
- Emotions ("I need to make back losses")

**Your sizing is based on:**
- Maximum observed drawdown
- Worst historical loss streak
- Improved R:R from 1M entries
- Mathematical survival probability

---

## Position Sizing Methods

### Method 1: Kelly Criterion

The Kelly formula calculates the optimal bet size to maximize long-term growth:

```
Kelly % = (bp - q) / b

Where:
  b = Win/Loss ratio (avg win ÷ avg loss)
  p = Win probability
  q = Loss probability (1 - p)
```

**Your Numbers (Moderate Scenario):**
```
b = 1.8R / 0.9R = 2.0
p = 0.68
q = 0.32

Kelly = (2.0 × 0.68 - 0.32) / 2.0
      = (1.36 - 0.32) / 2.0
      = 1.04 / 2.0
      = 0.52 = 52%
```

**Result**: Full Kelly suggests 52% of account per trade.

**Problem**: Full Kelly is too aggressive. One bad streak and you're done.

---

### Method 2: Fractional Kelly (Practical)

Professional traders use fractions of Kelly to reduce volatility:

| Fraction | % Per Trade | Pros | Cons |
|----------|-------------|------|------|
| Full Kelly | 52% | Maximum growth | Extreme volatility |
| Half Kelly | 26% | Strong growth | Still aggressive |
| Quarter Kelly | 13% | Balanced | Reasonable |
| Tenth Kelly | 5.2% | Conservative | Slower growth |
| **Twentieth Kelly** | **2.6%** | **Safe** | **Steady** |

**Recommendation**: Start with 1-2% (roughly 1/25 to 1/50 Kelly).

---

### Method 3: Fixed Fractional (Current Approach)

Your system uses **1% fixed risk per trade**.

```
Position Size = (Account Balance × Risk%) / Stop Distance

Example:
  Account: $10,000
  Risk: 1% = $100
  Stop Distance: 2%
  Position Size: $100 / 0.02 = $5,000 position
```

**Is 1% appropriate?**

| Metric | At 1% Risk | At 2% Risk |
|--------|-----------|-----------|
| Max loss streak (4 trades) | 4% drawdown | 8% drawdown |
| Monthly expectancy (5 trades) | +4.7% | +9.4% |
| Risk of ruin | Near zero | Very low |
| Recovery from 10% DD | ~11 trades | ~5 trades |

**Verdict**: 1% is conservative but appropriate for a new system.

---

### Method 4: Maximum Drawdown-Based

Size based on the worst-case scenario you can tolerate:

```
Risk Per Trade = Max Tolerable Drawdown / Expected Max Losing Streak

Example:
  Max tolerable DD: 10%
  Expected max streak: 4 losses
  Risk per trade: 10% / 4 = 2.5%
```

**Your Tolerance Matrix:**

| Max Tolerable DD | Max Streak | Risk Per Trade |
|-----------------|-----------|----------------|
| 5% | 4 | 1.25% |
| 10% | 4 | 2.5% |
| 15% | 4 | 3.75% |
| 20% | 4 | 5.0% |

---

## The 1M Entry Advantage

Your 1M optimization changes the math.

### What 1M Entry Improvement Does

From the 1M contract:
```
Entry improvement: 0.35% average (range: 0.16% - 0.74%)
```

**Effect on Position Sizing:**

If your stop distance is 1%:
```
Without 1M optimization:
  Entry: 100.00
  Stop: 99.00 (1% below)
  Risk distance: 1%

With 1M optimization (0.35% better entry):
  Entry: 99.65 (limit fill at retracement)
  Stop: 99.00 (same swing level)
  Risk distance: 0.65%

Effective risk reduction: 35%
```

### Two Strategic Options

**Option A: Lower Risk, Same Returns**
```
Original: 1% risk × 2R target = 2% potential gain
With 1M: 0.65% risk × 3.08R target = 2% potential gain

Same expected return, 35% less capital at risk.
```

**Option B: Same Risk, Higher Returns**
```
Original: 1% risk × 2R target = 2% potential gain
With 1M: 1% risk × 3.08R target = 3.08% potential gain

Same risk, 54% higher expected return.
```

### Recommendation

**Start with Option A** (lower effective risk):
- Proves the system works with real capital
- Builds confidence through survival
- Allows scaling up later

**Graduate to Option B** after 20+ trades with positive results.

---

## Risk of Ruin Calculation

Risk of ruin = probability of losing entire account before system edge manifests.

### Formula (Simplified)

```
Risk of Ruin ≈ ((1 - Edge) / (1 + Edge))^(Capital Units)

Where:
  Edge = Win% - Loss% = 0.68 - 0.32 = 0.36
  Capital Units = Account / Risk Per Trade = 100 (at 1% risk)
```

```
RoR = ((1 - 0.36) / (1 + 0.36))^100
    = (0.64 / 1.36)^100
    = (0.47)^100
    = Effectively 0%
```

**At 1% risk with your edge, risk of ruin is negligible.**

### Risk of Ruin by Position Size

| Risk Per Trade | Risk of Ruin |
|---------------|--------------|
| 1% | ~0% |
| 2% | ~0% |
| 5% | 0.1% |
| 10% | 2.3% |
| 20% | 15.7% |
| 50% (Full Kelly) | 48.2% |

---

## Optimal Position Sizing Recommendation

### For System Launch

```
RECOMMENDED: 1% Fixed Risk

Rationale:
- Kelly suggests you could risk 52% (way too high)
- 1/50 Kelly (1%) provides survival buffer
- Expectancy of +0.94R still compounds meaningfully
- Allows 100 "units" of survival
```

### Scaling Schedule

| Phase | Trades Completed | Risk Per Trade | Condition |
|-------|-----------------|----------------|-----------|
| 1 | 0-20 | 1.0% | System validation |
| 2 | 21-50 | 1.5% | If win rate > 60% |
| 3 | 51-100 | 2.0% | If win rate > 65% |
| 4 | 100+ | 2.5% | If expectancy > +0.8R |

**Never exceed 2.5%** regardless of performance.

---

## Position Sizing Formulas

### Standard Formula

```
Position Size ($) = (Account × Risk%) / Stop Distance%

Example:
  Account: $10,000
  Risk: 1%
  Stop: 1.5% from entry

  Position = ($10,000 × 0.01) / 0.015
           = $100 / 0.015
           = $6,667 position
```

### With 1M Entry Optimization

```
Effective Position Size = (Account × Risk%) / Effective Stop%

Where:
  Effective Stop = Original Stop - Entry Improvement

Example:
  Account: $10,000
  Risk: 1%
  Original Stop: 1.5%
  Entry Improvement: 0.35%
  Effective Stop: 1.15%

  Position = ($10,000 × 0.01) / 0.0115
           = $100 / 0.0115
           = $8,696 position
```

**Result**: 30% larger position for same dollar risk.

---

## Maximum Position Size Limits

Regardless of formula, enforce hard limits:

```
HARD LIMITS:
- Max position: 50% of account (leverage constraint)
- Max risk: 2.5% of account (survival constraint)
- Max leverage: 5x (per system rules)
```

### Position Size Cap Calculation

```
If Account = $10,000:
  Max position by % limit: $5,000 (50%)
  Max position by leverage: $50,000 (5x)

  Binding constraint: 50% limit = $5,000 max position
```

---

## Monthly Projections by Risk Level

Using expectancy of +0.94R and 5 trades/month:

| Risk % | Monthly Return | Annual Return | Max DD (4 losses) |
|--------|---------------|---------------|-------------------|
| 0.5% | +2.35% | +28% | 2% |
| 1.0% | +4.70% | +56% | 4% |
| 1.5% | +7.05% | +85% | 6% |
| 2.0% | +9.40% | +113% | 8% |
| 2.5% | +11.75% | +141% | 10% |

---

## Summary: The Position Sizing Stack

```
┌─────────────────────────────────────┐
│  EXPECTANCY: +0.94R per trade       │
│  (The edge exists)                  │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  KELLY CRITERION: 52%               │
│  (Theoretical maximum)              │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  FRACTIONAL KELLY: 1-2.5%           │
│  (Practical range)                  │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  RECOMMENDED: 1% (Starting)         │
│  Scale to 2.5% max over time        │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  1M OPTIMIZATION: +35% efficiency   │
│  Same risk = larger position        │
│  OR smaller risk = same position    │
└─────────────────────────────────────┘
```

---

## One-Sentence Summary

**Your 1% fixed risk is ~1/50 of Kelly, providing a massive survival buffer while still generating +4.7% monthly expected return — and your 1M entry optimization makes that 1% even more efficient.**
