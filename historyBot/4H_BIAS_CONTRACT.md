# 4H BIAS CONTRACT — LOCKED

**Status**: INVIOLABLE
**Lock Date**: 2025-12-15
**Validation**: 4+ years of data (2021-2025), symmetric under stress

---

## Final 4H Rules

### BULLISH BIAS
```
Conditions (ALL required):
1. 4H LOW sweep detected (price wicks below swing low, closes above)
2. RSI < 40 at sweep candle
3. Confirmation: Next 4H candle closes HIGHER than sweep candle
```

### BEARISH BIAS
```
Conditions (ALL required):
1. 4H HIGH sweep detected (price wicks above swing high, closes below)
2. RSI > 80 at sweep candle
3. Confirmation: Next 4H candle closes LOWER than sweep candle
```

---

## Validated Performance

| Dataset | Period | Signals | Accuracy | MFE/MAE | Death Spirals |
|---------|--------|---------|----------|---------|---------------|
| Training | 2023-2025 | 125 | 71.2% | 1.48x | 0 |
| Stress Test | 2021-2023 | 147 | 67.3% | 2.04x | 0 |

### Regime Stability (No Collapse)

| Regime | 2023-2025 | 2021-2023 |
|--------|-----------|-----------|
| BEARISH | 76.7% | 70.8% |
| BULLISH | 66.7% | 54.3% |
| RANGING | 68.1% | 77.4% |
| HIGH_VOL | 78.6% | 62.5% |

All regimes >= 45% across both periods.

---

## Mental Model (How to Think About 4H)

### 4H is PERMISSION, not OPPORTUNITY

The 4H layer does NOT tell you to trade.
It tells you WHETHER you're allowed to look for a trade.

```
4H BULLISH bias active?
  → You have PERMISSION to look for longs on lower timeframes
  → You do NOT have a trade yet

4H BEARISH bias active?
  → You have PERMISSION to look for shorts on lower timeframes
  → You do NOT have a trade yet

No 4H bias?
  → No permission
  → Do not look for trades
```

### Low Signal Count is a FEATURE

~5-6 signals per month is correct behavior.

This means:
- The filter is working
- Random noise is rejected
- Only high-conviction setups pass

If signal count increases, something is wrong.

### Accuracy is DIRECTIONAL, not ENTRY-BASED

71% accuracy does NOT mean:
- "71% of my trades will win"
- "I can enter immediately on 4H signal"

It DOES mean:
- "71% of the time, price moves in the direction of my bias"
- "Lower timeframe entries have a tailwind"

The 4H tells you WHICH WAY the wind blows.
Lower timeframes tell you WHEN to sail.

---

## Prohibited Actions

The following are BANNED:

1. **Tweaking thresholds** — RSI 40/80 are final
2. **Adding conditions** — No "also check X"
3. **Regime-specific logic** — No "unless in trending market"
4. **Signal boosting** — No loosening filters to get more trades
5. **Curve fitting** — No adjustments based on recent performance
6. **Exception handling** — No "but in this case..."

If edge degrades in live trading, the answer is NOT to fix 4H.
The answer is to examine lower timeframe execution.

---

## Contract Signature

```
4H BIAS LOGIC: LOCKED
Version: 1.0.0 (Final)
Checksum: RSI_ASYM_CONFIRM

This contract is immutable.
Downstream layers (1H, 5M, 1M) must adapt to this.
This layer does not adapt to them.
```

---

## What Comes Next

The 4H layer is complete. Further work proceeds DOWNSTREAM:

1. **1H Structure** — CHoCH, FVG, BOS validation
2. **5M Execution** — Entry timing, stop placement
3. **1M Optimization** — Precision entries (optional)

Each layer takes the 4H bias as INPUT.
No layer modifies the 4H bias as OUTPUT.
