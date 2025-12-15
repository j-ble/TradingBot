"""
4H Bias Stress Test - Symmetry Validation Under Bearish Conditions
===================================================================
Purpose: Confirm the FROZEN RSI_ASYM_CONFIRM logic doesn't collapse when market polarity flips.

Data: 2021-2023 (includes Nov 2021 ATH and 2022 bear market crash)

FROZEN LOGIC (DO NOT MODIFY):
- BULLISH: LOW sweep + RSI < 40 + confirmation (next candle closes higher)
- BEARISH: HIGH sweep + RSI > 80 + confirmation (next candle closes lower)

Pass Criteria (same as training):
- Accuracy >= 55%
- MFE/MAE >= 1.0
- No death spirals (5+ consecutive failures)
- Regime accuracy >= 45% (especially in BEARISH regime)

This is validation, NOT optimization.
"""

import pandas as pd
import numpy as np
from collections import defaultdict
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# FROZEN CONFIGURATION (DO NOT CHANGE)
# =============================================================================

EVALUATION_WINDOW = 8
SWING_LOOKBACK = 20
RSI_PERIOD = 14
MIN_SWING_AGE = 3

# FROZEN RSI_ASYM_CONFIRM thresholds
RSI_BULL_THRESHOLD = 40  # BULLISH only when RSI < 40
RSI_BEAR_THRESHOLD = 80  # BEARISH only when RSI > 80
CONFIRMATION_REQUIRED = True

# =============================================================================
# DATA LOADING
# =============================================================================

def load_data(filepath):
    """Load and prepare data."""
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    df['rsi'] = calculate_rsi(df['close'], RSI_PERIOD)

    # Calculate 200-period SMA for bearish regime detection
    df['sma_200'] = df['close'].rolling(window=200).mean()

    print(f"Loaded {len(df)} candles")
    print(f"Period: {df['timestamp'].iloc[0].strftime('%Y-%m-%d')} to {df['timestamp'].iloc[-1].strftime('%Y-%m-%d')}")
    print(f"Price range: ${df['low'].min():,.0f} - ${df['high'].max():,.0f}")

    return df

def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

# =============================================================================
# OBJECTIVE BEARISH REGIME DETECTION
# =============================================================================

def detect_market_regimes(df):
    """
    Objective regime classification:

    BEARISH: Price below 200-SMA AND recent lower-high/lower-low structure
    BULLISH: Price above 200-SMA AND recent higher-high/higher-low structure
    RANGING: Everything else
    HIGH_VOL: ATR > 1.5x average (overlays other regimes)
    """
    # ATR for volatility
    df['tr'] = np.maximum(
        df['high'] - df['low'],
        np.maximum(
            abs(df['high'] - df['close'].shift(1)),
            abs(df['low'] - df['close'].shift(1))
        )
    )
    df['atr'] = df['tr'].rolling(window=14).mean()
    df['atr_pct'] = df['atr'] / df['close'] * 100
    avg_atr = df['atr_pct'].mean()
    high_vol_threshold = avg_atr * 1.5

    # Recent highs/lows for structure
    df['recent_high'] = df['high'].rolling(window=20).max()
    df['recent_low'] = df['low'].rolling(window=20).min()
    df['prev_high'] = df['recent_high'].shift(20)
    df['prev_low'] = df['recent_low'].shift(20)

    df['regime'] = 'RANGING'
    df['regime_detail'] = ''

    for i in range(200, len(df)):
        price = df['close'].iloc[i]
        sma_200 = df['sma_200'].iloc[i]

        if pd.isna(sma_200):
            continue

        below_sma = price < sma_200
        above_sma = price > sma_200

        # Structure analysis
        recent_high = df['recent_high'].iloc[i]
        recent_low = df['recent_low'].iloc[i]
        prev_high = df['prev_high'].iloc[i]
        prev_low = df['prev_low'].iloc[i]

        lower_highs = recent_high < prev_high if not pd.isna(prev_high) else False
        lower_lows = recent_low < prev_low if not pd.isna(prev_low) else False
        higher_highs = recent_high > prev_high if not pd.isna(prev_high) else False
        higher_lows = recent_low > prev_low if not pd.isna(prev_low) else False

        # Classify regime
        if df['atr_pct'].iloc[i] > high_vol_threshold:
            df.loc[df.index[i], 'regime'] = 'HIGH_VOL'
            df.loc[df.index[i], 'regime_detail'] = 'high_volatility'
        elif below_sma and (lower_highs or lower_lows):
            df.loc[df.index[i], 'regime'] = 'BEARISH'
            df.loc[df.index[i], 'regime_detail'] = 'below_200sma_lh_ll'
        elif above_sma and (higher_highs or higher_lows):
            df.loc[df.index[i], 'regime'] = 'BULLISH'
            df.loc[df.index[i], 'regime_detail'] = 'above_200sma_hh_hl'
        else:
            df.loc[df.index[i], 'regime'] = 'RANGING'

    # Summary
    regime_counts = df['regime'].value_counts()
    print(f"\nRegime Distribution (Objective):")
    for regime, count in regime_counts.items():
        pct = count / len(df) * 100
        print(f"  {regime}: {count} candles ({pct:.1f}%)")

    return df

# =============================================================================
# SWING DETECTION (FROZEN)
# =============================================================================

def detect_swings(df):
    """3-candle swing detection - FROZEN LOGIC."""
    df['swing_high'] = False
    df['swing_low'] = False

    for i in range(1, len(df) - 1):
        if df['high'].iloc[i] > df['high'].iloc[i-1] and df['high'].iloc[i] > df['high'].iloc[i+1]:
            df.loc[df.index[i], 'swing_high'] = True
        if df['low'].iloc[i] < df['low'].iloc[i-1] and df['low'].iloc[i] < df['low'].iloc[i+1]:
            df.loc[df.index[i], 'swing_low'] = True

    return df

# =============================================================================
# FROZEN SWEEP DETECTION (RSI_ASYM_CONFIRM)
# =============================================================================

def detect_sweeps_frozen(df):
    """
    FROZEN RSI_ASYM_CONFIRM LOGIC - DO NOT MODIFY

    BULLISH: LOW sweep + RSI < 40 + confirmation
    BEARISH: HIGH sweep + RSI > 80 + confirmation
    """
    sweeps = []
    active_swing_highs = []
    active_swing_lows = []

    for i in range(SWING_LOOKBACK, len(df) - EVALUATION_WINDOW):
        current_high = df['high'].iloc[i]
        current_low = df['low'].iloc[i]
        current_close = df['close'].iloc[i]
        current_rsi = df['rsi'].iloc[i]
        current_regime = df['regime'].iloc[i]

        # Track swings
        check_idx = i - MIN_SWING_AGE
        if check_idx >= 0 and df['swing_high'].iloc[check_idx]:
            active_swing_highs.append((check_idx, df['high'].iloc[check_idx]))
        if check_idx >= 0 and df['swing_low'].iloc[check_idx]:
            active_swing_lows.append((check_idx, df['low'].iloc[check_idx]))

        active_swing_highs = [(idx, price) for idx, price in active_swing_highs if i - idx <= SWING_LOOKBACK]
        active_swing_lows = [(idx, price) for idx, price in active_swing_lows if i - idx <= SWING_LOOKBACK]

        # HIGH sweep → BEARISH (FROZEN: RSI > 80 + confirmation)
        for swing_idx, swing_price in active_swing_highs:
            if current_high > swing_price and current_close < swing_price:
                # FROZEN RSI filter
                if current_rsi < RSI_BEAR_THRESHOLD:
                    continue

                # FROZEN confirmation filter
                if CONFIRMATION_REQUIRED and i + 1 < len(df):
                    next_close = df['close'].iloc[i + 1]
                    if next_close >= current_close:
                        continue

                sweeps.append({
                    'candle_idx': i,
                    'timestamp': df['timestamp'].iloc[i],
                    'sweep_type': 'HIGH',
                    'bias': 'BEARISH',
                    'swing_price': swing_price,
                    'close_price': current_close,
                    'rsi': current_rsi,
                    'regime': current_regime
                })
                active_swing_highs = [(idx, p) for idx, p in active_swing_highs if idx != swing_idx]
                break

        # LOW sweep → BULLISH (FROZEN: RSI < 40 + confirmation)
        for swing_idx, swing_price in active_swing_lows:
            if current_low < swing_price and current_close > swing_price:
                # FROZEN RSI filter
                if current_rsi > RSI_BULL_THRESHOLD:
                    continue

                # FROZEN confirmation filter
                if CONFIRMATION_REQUIRED and i + 1 < len(df):
                    next_close = df['close'].iloc[i + 1]
                    if next_close <= current_close:
                        continue

                sweeps.append({
                    'candle_idx': i,
                    'timestamp': df['timestamp'].iloc[i],
                    'sweep_type': 'LOW',
                    'bias': 'BULLISH',
                    'swing_price': swing_price,
                    'close_price': current_close,
                    'rsi': current_rsi,
                    'regime': current_regime
                })
                active_swing_lows = [(idx, p) for idx, p in active_swing_lows if idx != swing_idx]
                break

    print(f"\nTotal sweeps detected: {len(sweeps)}")
    return sweeps

# =============================================================================
# EVALUATION (FROZEN)
# =============================================================================

def evaluate_sweeps(df, sweeps):
    """Evaluate outcomes - FROZEN LOGIC."""
    results = []

    for sweep in sweeps:
        idx = sweep['candle_idx']
        entry_price = df['close'].iloc[idx]

        end_idx = min(idx + EVALUATION_WINDOW + 1, len(df))
        future_candles = df.iloc[idx+1:end_idx]

        if len(future_candles) < 4:
            continue

        future_highs = future_candles['high'].values
        future_lows = future_candles['low'].values
        exit_price = future_candles['close'].iloc[-1]

        if sweep['bias'] == 'BULLISH':
            mfe = (max(future_highs) - entry_price) / entry_price * 100
            mae = (entry_price - min(future_lows)) / entry_price * 100
            outcome = 'CORRECT' if exit_price > entry_price else 'WRONG'
        else:  # BEARISH
            mfe = (entry_price - min(future_lows)) / entry_price * 100
            mae = (max(future_highs) - entry_price) / entry_price * 100
            outcome = 'CORRECT' if exit_price < entry_price else 'WRONG'

        results.append({
            **sweep,
            'entry_price': entry_price,
            'exit_price': exit_price,
            'mfe_pct': round(mfe, 3),
            'mae_pct': round(mae, 3),
            'outcome': outcome
        })

    return results

def detect_death_spirals(results, threshold=5):
    spirals = []
    streak = 0
    streak_start = None

    for i, r in enumerate(results):
        if r['outcome'] == 'WRONG':
            if streak == 0:
                streak_start = i
            streak += 1
        else:
            if streak >= threshold:
                spirals.append({
                    'length': streak,
                    'start_date': results[streak_start]['timestamp'],
                    'end_date': results[i-1]['timestamp']
                })
            streak = 0

    if streak >= threshold:
        spirals.append({
            'length': streak,
            'start_date': results[streak_start]['timestamp'],
            'end_date': results[-1]['timestamp']
        })

    return spirals

# =============================================================================
# STRESS TEST REPORT
# =============================================================================

def run_stress_test(filepath):
    """Run stress test with FROZEN logic on bear market data."""

    print("=" * 80)
    print("4H BIAS STRESS TEST - SYMMETRY VALIDATION")
    print("=" * 80)
    print("\nFROZEN LOGIC: RSI_ASYM_CONFIRM")
    print(f"  BULLISH: LOW sweep + RSI < {RSI_BULL_THRESHOLD} + confirmation")
    print(f"  BEARISH: HIGH sweep + RSI > {RSI_BEAR_THRESHOLD} + confirmation")
    print("\nNO OPTIMIZATION ALLOWED - VALIDATION ONLY")
    print("=" * 80)

    # Load data
    df = load_data(filepath)

    # Detect regimes objectively
    df = detect_market_regimes(df)

    # Detect swings
    df = detect_swings(df)

    # Apply FROZEN sweep detection
    sweeps = detect_sweeps_frozen(df)

    if len(sweeps) == 0:
        print("\n*** NO SIGNALS GENERATED ***")
        print("The frozen logic produced zero signals in this period.")
        return None

    # Evaluate outcomes
    results = evaluate_sweeps(df, sweeps)

    # ==========================================================================
    # OVERALL METRICS
    # ==========================================================================

    print("\n" + "=" * 80)
    print("1. OVERALL METRICS (FULL PERIOD)")
    print("=" * 80)

    total = len(results)
    correct = sum(1 for r in results if r['outcome'] == 'CORRECT')
    accuracy = correct / total * 100

    avg_mfe = np.mean([r['mfe_pct'] for r in results])
    avg_mae = np.mean([r['mae_pct'] for r in results])
    mfe_mae = avg_mfe / avg_mae if avg_mae > 0 else 0

    spirals = detect_death_spirals(results)

    print(f"\n  Total signals: {total}")
    print(f"  Accuracy: {accuracy:.1f}%")
    print(f"  MFE/MAE: {mfe_mae:.2f}x")
    print(f"  Avg MFE: {avg_mfe:.2f}%")
    print(f"  Avg MAE: {avg_mae:.2f}%")
    print(f"  Death spirals: {len(spirals)}")

    # Bias breakdown
    bullish = [r for r in results if r['bias'] == 'BULLISH']
    bearish = [r for r in results if r['bias'] == 'BEARISH']

    print(f"\n  BULLISH signals: {len(bullish)}")
    if bullish:
        bull_acc = sum(1 for r in bullish if r['outcome'] == 'CORRECT') / len(bullish) * 100
        print(f"    Accuracy: {bull_acc:.1f}%")

    print(f"  BEARISH signals: {len(bearish)}")
    if bearish:
        bear_acc = sum(1 for r in bearish if r['outcome'] == 'CORRECT') / len(bearish) * 100
        print(f"    Accuracy: {bear_acc:.1f}%")

    # ==========================================================================
    # BEARISH REGIME ISOLATION (KEY TEST)
    # ==========================================================================

    print("\n" + "=" * 80)
    print("2. BEARISH REGIME ISOLATION (KEY STRESS TEST)")
    print("=" * 80)

    bearish_regime_results = [r for r in results if r['regime'] == 'BEARISH']

    print(f"\n  Signals in BEARISH regime: {len(bearish_regime_results)}")

    if bearish_regime_results:
        bear_total = len(bearish_regime_results)
        bear_correct = sum(1 for r in bearish_regime_results if r['outcome'] == 'CORRECT')
        bear_accuracy = bear_correct / bear_total * 100

        bear_mfe = np.mean([r['mfe_pct'] for r in bearish_regime_results])
        bear_mae = np.mean([r['mae_pct'] for r in bearish_regime_results])
        bear_mfe_mae = bear_mfe / bear_mae if bear_mae > 0 else 0

        bear_spirals = detect_death_spirals(bearish_regime_results)

        print(f"  Accuracy: {bear_accuracy:.1f}%")
        print(f"  MFE/MAE: {bear_mfe_mae:.2f}x")
        print(f"  Death spirals: {len(bear_spirals)}")

        # Bias breakdown within bearish regime
        bear_bullish = [r for r in bearish_regime_results if r['bias'] == 'BULLISH']
        bear_bearish = [r for r in bearish_regime_results if r['bias'] == 'BEARISH']

        print(f"\n  Within BEARISH regime:")
        print(f"    BULLISH signals: {len(bear_bullish)}")
        if bear_bullish:
            bb_acc = sum(1 for r in bear_bullish if r['outcome'] == 'CORRECT') / len(bear_bullish) * 100
            print(f"      Accuracy: {bb_acc:.1f}%")

        print(f"    BEARISH signals: {len(bear_bearish)}")
        if bear_bearish:
            be_acc = sum(1 for r in bear_bearish if r['outcome'] == 'CORRECT') / len(bear_bearish) * 100
            print(f"      Accuracy: {be_acc:.1f}%")
    else:
        bear_accuracy = 0
        bear_mfe_mae = 0
        bear_spirals = []
        print("  No signals generated in bearish regime")

    # ==========================================================================
    # ALL REGIME BREAKDOWN
    # ==========================================================================

    print("\n" + "=" * 80)
    print("3. ALL REGIME BREAKDOWN")
    print("=" * 80)

    regime_metrics = {}

    for regime in ['BULLISH', 'BEARISH', 'RANGING', 'HIGH_VOL']:
        regime_results = [r for r in results if r['regime'] == regime]

        if regime_results:
            r_correct = sum(1 for r in regime_results if r['outcome'] == 'CORRECT')
            r_accuracy = r_correct / len(regime_results) * 100
            r_mfe = np.mean([r['mfe_pct'] for r in regime_results])
            r_mae = np.mean([r['mae_pct'] for r in regime_results])
            r_mfe_mae = r_mfe / r_mae if r_mae > 0 else 0
            r_spirals = detect_death_spirals(regime_results)

            regime_metrics[regime] = {
                'signals': len(regime_results),
                'accuracy': r_accuracy,
                'mfe_mae': r_mfe_mae,
                'spirals': len(r_spirals)
            }

            print(f"\n  {regime}:")
            print(f"    Signals: {len(regime_results)}")
            print(f"    Accuracy: {r_accuracy:.1f}%")
            print(f"    MFE/MAE: {r_mfe_mae:.2f}x")
            print(f"    Death spirals: {len(r_spirals)}")

    # ==========================================================================
    # TEMPORAL ANALYSIS (Bear market months)
    # ==========================================================================

    print("\n" + "=" * 80)
    print("4. TEMPORAL ANALYSIS (BEAR MARKET MONTHS)")
    print("=" * 80)

    # Known bear market period: Nov 2021 - Nov 2022
    bear_months = []
    for r in results:
        ts = r['timestamp']
        if ts.year == 2022 or (ts.year == 2021 and ts.month >= 11):
            bear_months.append(r)

    print(f"\n  Bear market period (Nov 2021 - Dec 2022): {len(bear_months)} signals")

    if bear_months:
        bm_correct = sum(1 for r in bear_months if r['outcome'] == 'CORRECT')
        bm_accuracy = bm_correct / len(bear_months) * 100
        bm_spirals = detect_death_spirals(bear_months)

        print(f"  Accuracy: {bm_accuracy:.1f}%")
        print(f"  Death spirals: {len(bm_spirals)}")

        # Monthly breakdown
        print(f"\n  Monthly breakdown:")
        monthly = defaultdict(list)
        for r in bear_months:
            month_key = r['timestamp'].strftime('%Y-%m')
            monthly[month_key].append(r)

        for month in sorted(monthly.keys()):
            m_results = monthly[month]
            m_correct = sum(1 for r in m_results if r['outcome'] == 'CORRECT')
            m_acc = m_correct / len(m_results) * 100 if m_results else 0
            print(f"    {month}: {len(m_results)} signals, {m_acc:.0f}% accuracy")

    # ==========================================================================
    # DEATH SPIRAL ANALYSIS
    # ==========================================================================

    print("\n" + "=" * 80)
    print("5. DEATH SPIRAL ANALYSIS")
    print("=" * 80)

    if spirals:
        print(f"\n  *** {len(spirals)} death spiral(s) detected ***")
        for i, s in enumerate(spirals):
            print(f"\n    Spiral {i+1}:")
            print(f"      Length: {s['length']} consecutive failures")
            print(f"      Period: {s['start_date']} to {s['end_date']}")
    else:
        print("\n  No death spirals detected (good)")

    # ==========================================================================
    # SYMMETRY VERDICT
    # ==========================================================================

    print("\n" + "=" * 80)
    print("SYMMETRY VERDICT")
    print("=" * 80)

    passes = []
    failures = []
    observations = []

    # Check 1: Overall accuracy >= 55%
    if accuracy >= 55:
        passes.append(f"Overall accuracy: {accuracy:.1f}% >= 55%")
    else:
        failures.append(f"Overall accuracy: {accuracy:.1f}% < 55%")

    # Check 2: MFE/MAE >= 1.0
    if mfe_mae >= 1.0:
        passes.append(f"MFE/MAE: {mfe_mae:.2f}x >= 1.0")
    else:
        failures.append(f"MFE/MAE: {mfe_mae:.2f}x < 1.0")

    # Check 3: No death spirals
    if len(spirals) == 0:
        passes.append("No death spirals")
    else:
        failures.append(f"{len(spirals)} death spiral(s) detected")

    # Check 4: Bearish regime accuracy >= 45%
    if bearish_regime_results:
        if bear_accuracy >= 45:
            passes.append(f"Bearish regime accuracy: {bear_accuracy:.1f}% >= 45%")
        else:
            failures.append(f"Bearish regime accuracy: {bear_accuracy:.1f}% < 45%")
    else:
        observations.append("No signals in isolated bearish regime (may indicate high selectivity)")

    # Check 5: All regimes >= 45%
    min_regime_acc = min([m['accuracy'] for m in regime_metrics.values()]) if regime_metrics else 0
    if min_regime_acc >= 45:
        passes.append(f"All regimes >= 45% (min: {min_regime_acc:.1f}%)")
    else:
        failures.append(f"Some regime < 45% (min: {min_regime_acc:.1f}%)")

    # Observations (not failures, just notes)
    if bearish and len(bearish) < 10:
        observations.append(f"Low BEARISH signal count ({len(bearish)}) - expected due to RSI > 80 requirement")

    if len(results) < 50:
        observations.append(f"Low total signal count ({len(results)}) - system is highly selective")

    print("\nPASSES:")
    for p in passes:
        print(f"  [+] {p}")

    print("\nFAILURES:")
    if failures:
        for f in failures:
            print(f"  [-] {f}")
    else:
        print("  None")

    if observations:
        print("\nOBSERVATIONS (not failures):")
        for o in observations:
            print(f"  [i] {o}")

    # Final verdict
    print("\n" + "-" * 80)

    if len(failures) == 0:
        print("VERDICT: *** SYMMETRIC - STRESS TEST PASSED ***")
        print("The frozen 4H logic maintains edge under bearish market conditions.")
        print("System does not collapse when market polarity flips.")
    elif len(failures) == 1 and len(spirals) > 0:
        print("VERDICT: *** MARGINAL - MINOR REGIME SENSITIVITY ***")
        print("Logic shows some clustering of failures but maintains overall edge.")
        print("Document asymmetry; consider future conditional logic.")
    else:
        print("VERDICT: *** ASYMMETRIC - REGIME SENSITIVITY DETECTED ***")
        print("Logic degrades significantly in bearish conditions.")
        print("This is information, not a reason to re-optimize now.")
        print("Document findings for future conditional logic planning.")

    print("-" * 80)

    # Export results
    results_df = pd.DataFrame(results)
    results_df.to_csv('data/4h_stress_test_results.csv', index=False)
    print(f"\nResults exported to: data/4h_stress_test_results.csv")

    return {
        'overall_accuracy': accuracy,
        'mfe_mae': mfe_mae,
        'spirals': len(spirals),
        'bearish_accuracy': bear_accuracy if bearish_regime_results else None,
        'regime_metrics': regime_metrics,
        'passed': len(failures) == 0
    }

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    results = run_stress_test('data/btc_usd_4h_2021_2023.csv')
