"""
4H Bias Validation Backtest
============================
Purpose: Answer ONE question - "Does my 4H bias logic put me on the right side of the market often enough?"

NOT testing: Stop losses, take profits, entries, R:R tuning
ONLY testing: Directional edge from liquidity sweeps

Pass Criteria:
- Bias accuracy >= 55%
- No regime where accuracy < 45%
- Liquidity sweeps improve outcomes
- No death spirals (clustered failures)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# CONFIGURATION
# =============================================================================

EVALUATION_WINDOW = 8  # Candles to evaluate after bias (4-12 range, 8 = 32 hours)
SWING_LOOKBACK = 20    # Candles to look back for swing detection
SWEEP_THRESHOLD = 0.001  # 0.1% threshold for sweep detection
RSI_PERIOD = 14
RSI_OVERSOLD = 20
RSI_OVERBOUGHT = 80
MIN_SWING_AGE = 3      # Minimum candles since swing formed before it can be swept

# =============================================================================
# DATA LOADING
# =============================================================================

def load_data(filepath):
    """Load and prepare 4H candle data."""
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)

    # Calculate RSI
    df['rsi'] = calculate_rsi(df['close'], RSI_PERIOD)

    print(f"Loaded {len(df)} candles from {df['timestamp'].iloc[0]} to {df['timestamp'].iloc[-1]}")
    print(f"Price range: ${df['low'].min():,.0f} - ${df['high'].max():,.0f}")

    return df

def calculate_rsi(prices, period=14):
    """Calculate RSI."""
    delta = prices.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# =============================================================================
# SWING DETECTION (3-Candle Pattern)
# =============================================================================

def detect_swings(df):
    """
    Detect swing highs and lows using 3-candle pattern.
    Swing High: candle[i].high > candle[i-1].high AND candle[i].high > candle[i+1].high
    Swing Low:  candle[i].low < candle[i-1].low AND candle[i].low < candle[i+1].low
    """
    df['swing_high'] = False
    df['swing_low'] = False
    df['swing_high_price'] = np.nan
    df['swing_low_price'] = np.nan

    for i in range(1, len(df) - 1):
        # Swing High
        if df['high'].iloc[i] > df['high'].iloc[i-1] and df['high'].iloc[i] > df['high'].iloc[i+1]:
            df.loc[df.index[i], 'swing_high'] = True
            df.loc[df.index[i], 'swing_high_price'] = df['high'].iloc[i]

        # Swing Low
        if df['low'].iloc[i] < df['low'].iloc[i-1] and df['low'].iloc[i] < df['low'].iloc[i+1]:
            df.loc[df.index[i], 'swing_low'] = True
            df.loc[df.index[i], 'swing_low_price'] = df['low'].iloc[i]

    swing_highs = df['swing_high'].sum()
    swing_lows = df['swing_low'].sum()
    print(f"\nDetected {swing_highs} swing highs, {swing_lows} swing lows")

    return df

# =============================================================================
# LIQUIDITY SWEEP DETECTION
# =============================================================================

def detect_sweeps(df):
    """
    Detect when price sweeps previous swing highs/lows.
    HIGH swept → BEARISH bias (look for SHORT)
    LOW swept → BULLISH bias (look for LONG)
    """
    sweeps = []
    active_swing_highs = []  # List of (index, price)
    active_swing_lows = []   # List of (index, price)

    for i in range(SWING_LOOKBACK, len(df) - EVALUATION_WINDOW):
        current_high = df['high'].iloc[i]
        current_low = df['low'].iloc[i]
        current_close = df['close'].iloc[i]

        # Track new swings (must be at least MIN_SWING_AGE old to be valid)
        if i > 0:
            # Add swings that formed MIN_SWING_AGE candles ago
            check_idx = i - MIN_SWING_AGE
            if check_idx >= 0 and df['swing_high'].iloc[check_idx]:
                active_swing_highs.append((check_idx, df['high'].iloc[check_idx]))
            if check_idx >= 0 and df['swing_low'].iloc[check_idx]:
                active_swing_lows.append((check_idx, df['low'].iloc[check_idx]))

        # Only keep swings from last SWING_LOOKBACK candles
        active_swing_highs = [(idx, price) for idx, price in active_swing_highs
                             if i - idx <= SWING_LOOKBACK]
        active_swing_lows = [(idx, price) for idx, price in active_swing_lows
                            if i - idx <= SWING_LOOKBACK]

        # Check for HIGH sweep (bearish bias)
        for swing_idx, swing_price in active_swing_highs:
            sweep_threshold = swing_price * (1 + SWEEP_THRESHOLD)

            # Price must go above swing high (sweep it)
            if current_high > swing_price:
                # Check for rejection: close below the swing high
                if current_close < swing_price:
                    sweeps.append({
                        'candle_idx': i,
                        'timestamp': df['timestamp'].iloc[i],
                        'sweep_type': 'HIGH',
                        'bias': 'BEARISH',
                        'swing_price': swing_price,
                        'sweep_price': current_high,
                        'close_price': current_close,
                        'rsi': df['rsi'].iloc[i],
                        'rsi_extreme': df['rsi'].iloc[i] >= RSI_OVERBOUGHT
                    })
                    # Remove the swept swing
                    active_swing_highs = [(idx, p) for idx, p in active_swing_highs
                                         if idx != swing_idx]
                    break

        # Check for LOW sweep (bullish bias)
        for swing_idx, swing_price in active_swing_lows:
            sweep_threshold = swing_price * (1 - SWEEP_THRESHOLD)

            # Price must go below swing low (sweep it)
            if current_low < swing_price:
                # Check for rejection: close above the swing low
                if current_close > swing_price:
                    sweeps.append({
                        'candle_idx': i,
                        'timestamp': df['timestamp'].iloc[i],
                        'sweep_type': 'LOW',
                        'bias': 'BULLISH',
                        'swing_price': swing_price,
                        'sweep_price': current_low,
                        'close_price': current_close,
                        'rsi': df['rsi'].iloc[i],
                        'rsi_extreme': df['rsi'].iloc[i] <= RSI_OVERSOLD
                    })
                    # Remove the swept swing
                    active_swing_lows = [(idx, p) for idx, p in active_swing_lows
                                        if idx != swing_idx]
                    break

    print(f"Detected {len(sweeps)} liquidity sweeps")
    return sweeps

# =============================================================================
# BIAS OUTCOME EVALUATION
# =============================================================================

def evaluate_sweeps(df, sweeps):
    """
    For each sweep, evaluate if price moved in the direction of the bias.

    Measures:
    - Max Favorable Excursion (MFE): Best price in favor of bias
    - Max Adverse Excursion (MAE): Worst price against bias
    - Outcome: Correct/Wrong based on net movement
    """
    results = []

    for sweep in sweeps:
        idx = sweep['candle_idx']
        entry_price = df['close'].iloc[idx]

        # Get next EVALUATION_WINDOW candles
        end_idx = min(idx + EVALUATION_WINDOW + 1, len(df))
        future_candles = df.iloc[idx+1:end_idx]

        if len(future_candles) < 4:  # Need minimum candles
            continue

        future_highs = future_candles['high'].values
        future_lows = future_candles['low'].values
        exit_price = future_candles['close'].iloc[-1]

        if sweep['bias'] == 'BULLISH':
            mfe = (max(future_highs) - entry_price) / entry_price * 100
            mae = (entry_price - min(future_lows)) / entry_price * 100
            net_move = (exit_price - entry_price) / entry_price * 100
            outcome = 'CORRECT' if exit_price > entry_price else 'WRONG'
        else:  # BEARISH
            mfe = (entry_price - min(future_lows)) / entry_price * 100
            mae = (max(future_highs) - entry_price) / entry_price * 100
            net_move = (entry_price - exit_price) / entry_price * 100
            outcome = 'CORRECT' if exit_price < entry_price else 'WRONG'

        results.append({
            **sweep,
            'entry_price': entry_price,
            'exit_price': exit_price,
            'mfe_pct': round(mfe, 3),
            'mae_pct': round(mae, 3),
            'net_move_pct': round(net_move, 3),
            'outcome': outcome
        })

    return results

# =============================================================================
# REGIME DETECTION
# =============================================================================

def detect_regimes(df, window=50):
    """
    Segment data into market regimes:
    - TRENDING_UP: Price making higher highs and higher lows
    - TRENDING_DOWN: Price making lower highs and lower lows
    - RANGING: Price oscillating in a range
    - HIGH_VOL: ATR significantly above average
    """
    # Calculate ATR for volatility
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

    # Simple trend detection using moving averages
    df['sma_20'] = df['close'].rolling(window=20).mean()
    df['sma_50'] = df['close'].rolling(window=50).mean()

    regimes = []

    for i in range(window, len(df)):
        window_data = df.iloc[i-window:i]

        # Volatility check first
        if df['atr_pct'].iloc[i] > high_vol_threshold:
            regime = 'HIGH_VOL'
        # Trend detection
        elif df['sma_20'].iloc[i] > df['sma_50'].iloc[i] * 1.01:  # 1% above
            if df['close'].iloc[i] > df['sma_20'].iloc[i]:
                regime = 'TRENDING_UP'
            else:
                regime = 'RANGING'
        elif df['sma_20'].iloc[i] < df['sma_50'].iloc[i] * 0.99:  # 1% below
            if df['close'].iloc[i] < df['sma_20'].iloc[i]:
                regime = 'TRENDING_DOWN'
            else:
                regime = 'RANGING'
        else:
            regime = 'RANGING'

        regimes.append({
            'idx': i,
            'timestamp': df['timestamp'].iloc[i],
            'regime': regime
        })

    regime_df = pd.DataFrame(regimes)

    # Summary
    regime_counts = regime_df['regime'].value_counts()
    print(f"\nRegime Distribution:")
    for regime, count in regime_counts.items():
        pct = count / len(regime_df) * 100
        print(f"  {regime}: {count} candles ({pct:.1f}%)")

    return regime_df

# =============================================================================
# RSI EXTREME ANALYSIS
# =============================================================================

def analyze_rsi_extremes(df, results):
    """
    Analyze RSI extremes:
    - Do RSI extremes precede mean reversion?
    - Or do they persist during trends?
    """
    rsi_extremes = []

    for i in range(RSI_PERIOD + 1, len(df) - EVALUATION_WINDOW):
        rsi = df['rsi'].iloc[i]

        if rsi <= RSI_OVERSOLD or rsi >= RSI_OVERBOUGHT:
            entry_price = df['close'].iloc[i]
            future_candles = df.iloc[i+1:i+EVALUATION_WINDOW+1]

            if len(future_candles) < 4:
                continue

            exit_price = future_candles['close'].iloc[-1]

            if rsi <= RSI_OVERSOLD:
                extreme_type = 'OVERSOLD'
                mean_reversion = exit_price > entry_price  # Price went up (reverted)
            else:
                extreme_type = 'OVERBOUGHT'
                mean_reversion = exit_price < entry_price  # Price went down (reverted)

            move_pct = (exit_price - entry_price) / entry_price * 100

            rsi_extremes.append({
                'timestamp': df['timestamp'].iloc[i],
                'rsi': round(rsi, 1),
                'type': extreme_type,
                'entry_price': entry_price,
                'exit_price': exit_price,
                'move_pct': round(move_pct, 2),
                'mean_reversion': mean_reversion
            })

    return rsi_extremes

# =============================================================================
# DEATH SPIRAL DETECTION
# =============================================================================

def detect_death_spirals(results, threshold=5):
    """
    Detect clustered failures (death spirals).
    A death spiral = more than 'threshold' consecutive wrong calls.
    """
    spirals = []
    current_streak = 0
    streak_start = None

    for i, result in enumerate(results):
        if result['outcome'] == 'WRONG':
            if current_streak == 0:
                streak_start = i
            current_streak += 1
        else:
            if current_streak >= threshold:
                spirals.append({
                    'start_idx': streak_start,
                    'end_idx': i - 1,
                    'length': current_streak,
                    'start_date': results[streak_start]['timestamp'],
                    'end_date': results[i-1]['timestamp']
                })
            current_streak = 0

    # Check final streak
    if current_streak >= threshold:
        spirals.append({
            'start_idx': streak_start,
            'end_idx': len(results) - 1,
            'length': current_streak,
            'start_date': results[streak_start]['timestamp'],
            'end_date': results[-1]['timestamp']
        })

    return spirals

# =============================================================================
# MAIN ANALYSIS
# =============================================================================

def run_backtest(filepath):
    """Run the complete 4H bias validation backtest."""

    print("=" * 70)
    print("4H BIAS VALIDATION BACKTEST")
    print("Question: Does 4H bias logic put me on the right side of the market?")
    print("=" * 70)

    # Load data
    df = load_data(filepath)

    # Detect swings
    df = detect_swings(df)

    # Detect liquidity sweeps
    sweeps = detect_sweeps(df)

    if len(sweeps) == 0:
        print("\n*** NO SWEEPS DETECTED - Cannot evaluate bias logic ***")
        return

    # Evaluate outcomes
    results = evaluate_sweeps(df, sweeps)

    # Detect regimes
    regime_df = detect_regimes(df)

    # RSI extremes analysis
    rsi_extremes = analyze_rsi_extremes(df, results)

    # Death spiral detection
    spirals = detect_death_spirals(results)

    # ==========================================================================
    # REPORT: BIAS ACCURACY
    # ==========================================================================

    print("\n" + "=" * 70)
    print("1. BIAS ACCURACY")
    print("=" * 70)

    total = len(results)
    correct = sum(1 for r in results if r['outcome'] == 'CORRECT')
    wrong = total - correct
    accuracy = correct / total * 100 if total > 0 else 0

    print(f"\nTotal bias signals: {total}")
    print(f"Correct direction: {correct} ({accuracy:.1f}%)")
    print(f"Wrong direction:   {wrong} ({100-accuracy:.1f}%)")

    # By bias type
    bullish = [r for r in results if r['bias'] == 'BULLISH']
    bearish = [r for r in results if r['bias'] == 'BEARISH']

    bull_correct = sum(1 for r in bullish if r['outcome'] == 'CORRECT')
    bear_correct = sum(1 for r in bearish if r['outcome'] == 'CORRECT')

    print(f"\nBULLISH bias: {len(bullish)} signals, {bull_correct} correct ({bull_correct/len(bullish)*100:.1f}%)" if bullish else "")
    print(f"BEARISH bias: {len(bearish)} signals, {bear_correct} correct ({bear_correct/len(bearish)*100:.1f}%)" if bearish else "")

    # MFE/MAE analysis
    avg_mfe = np.mean([r['mfe_pct'] for r in results])
    avg_mae = np.mean([r['mae_pct'] for r in results])
    mfe_mae_ratio = avg_mfe / avg_mae if avg_mae > 0 else 0

    print(f"\nAvg MFE (favorable): {avg_mfe:.2f}%")
    print(f"Avg MAE (adverse):   {avg_mae:.2f}%")
    print(f"MFE/MAE ratio:       {mfe_mae_ratio:.2f}x")

    # ==========================================================================
    # REPORT: LIQUIDITY SWEEP VALIDITY
    # ==========================================================================

    print("\n" + "=" * 70)
    print("2. LIQUIDITY SWEEP VALIDITY")
    print("=" * 70)

    high_sweeps = [r for r in results if r['sweep_type'] == 'HIGH']
    low_sweeps = [r for r in results if r['sweep_type'] == 'LOW']

    high_reversal = sum(1 for r in high_sweeps if r['outcome'] == 'CORRECT')
    low_reversal = sum(1 for r in low_sweeps if r['outcome'] == 'CORRECT')

    print(f"\nHIGH sweeps (→ BEARISH): {len(high_sweeps)}")
    print(f"  → Reversal (correct): {high_reversal} ({high_reversal/len(high_sweeps)*100:.1f}%)" if high_sweeps else "")
    print(f"  → Continuation (wrong): {len(high_sweeps)-high_reversal}")

    print(f"\nLOW sweeps (→ BULLISH): {len(low_sweeps)}")
    print(f"  → Reversal (correct): {low_reversal} ({low_reversal/len(low_sweeps)*100:.1f}%)" if low_sweeps else "")
    print(f"  → Continuation (wrong): {len(low_sweeps)-low_reversal}")

    # ==========================================================================
    # REPORT: RSI EXTREME CONTEXT
    # ==========================================================================

    print("\n" + "=" * 70)
    print("3. RSI EXTREME CONTEXT (≤20 or ≥80)")
    print("=" * 70)

    oversold = [r for r in rsi_extremes if r['type'] == 'OVERSOLD']
    overbought = [r for r in rsi_extremes if r['type'] == 'OVERBOUGHT']

    oversold_reversion = sum(1 for r in oversold if r['mean_reversion'])
    overbought_reversion = sum(1 for r in overbought if r['mean_reversion'])

    print(f"\nRSI ≤ 20 (OVERSOLD): {len(oversold)} occurrences")
    print(f"  → Mean reversion: {oversold_reversion} ({oversold_reversion/len(oversold)*100:.1f}%)" if oversold else "")

    print(f"\nRSI ≥ 80 (OVERBOUGHT): {len(overbought)} occurrences")
    print(f"  → Mean reversion: {overbought_reversion} ({overbought_reversion/len(overbought)*100:.1f}%)" if overbought else "")

    # RSI alignment with sweeps
    sweeps_with_rsi = [r for r in results if r['rsi_extreme']]
    sweeps_rsi_correct = sum(1 for r in sweeps_with_rsi if r['outcome'] == 'CORRECT')

    print(f"\nSweeps with aligned RSI extreme: {len(sweeps_with_rsi)}")
    if sweeps_with_rsi:
        print(f"  → Correct: {sweeps_rsi_correct} ({sweeps_rsi_correct/len(sweeps_with_rsi)*100:.1f}%)")

    # ==========================================================================
    # REPORT: REGIME SEGMENTATION
    # ==========================================================================

    print("\n" + "=" * 70)
    print("4. REGIME SEGMENTATION")
    print("=" * 70)

    # Map results to regimes
    for result in results:
        idx = result['candle_idx']
        regime_match = regime_df[regime_df['idx'] == idx]
        if not regime_match.empty:
            result['regime'] = regime_match['regime'].iloc[0]
        else:
            result['regime'] = 'UNKNOWN'

    regime_results = defaultdict(list)
    for r in results:
        regime_results[r['regime']].append(r)

    regime_accuracy = {}
    for regime, regime_data in regime_results.items():
        if regime == 'UNKNOWN':
            continue
        correct = sum(1 for r in regime_data if r['outcome'] == 'CORRECT')
        accuracy = correct / len(regime_data) * 100 if regime_data else 0
        regime_accuracy[regime] = accuracy
        print(f"\n{regime}:")
        print(f"  Signals: {len(regime_data)}")
        print(f"  Correct: {correct} ({accuracy:.1f}%)")

    # ==========================================================================
    # REPORT: DEATH SPIRALS
    # ==========================================================================

    print("\n" + "=" * 70)
    print("5. DEATH SPIRAL DETECTION (5+ consecutive failures)")
    print("=" * 70)

    if spirals:
        print(f"\n*** WARNING: {len(spirals)} death spiral(s) detected ***")
        for i, spiral in enumerate(spirals):
            print(f"\n  Spiral {i+1}:")
            print(f"    Length: {spiral['length']} consecutive failures")
            print(f"    Period: {spiral['start_date']} to {spiral['end_date']}")
    else:
        print("\nNo death spirals detected (good)")

    # ==========================================================================
    # FINAL VERDICT
    # ==========================================================================

    print("\n" + "=" * 70)
    print("FINAL VERDICT")
    print("=" * 70)

    failures = []
    passes = []

    # Check 1: Overall accuracy >= 55%
    if accuracy >= 55:
        passes.append(f"Overall accuracy: {accuracy:.1f}% >= 55%")
    else:
        failures.append(f"Overall accuracy: {accuracy:.1f}% < 55% (REQUIRED)")

    # Check 2: No regime below 45%
    regime_fail = False
    for regime, acc in regime_accuracy.items():
        if acc < 45:
            failures.append(f"Regime '{regime}' accuracy: {acc:.1f}% < 45%")
            regime_fail = True
    if not regime_fail and regime_accuracy:
        min_regime = min(regime_accuracy.values())
        passes.append(f"All regimes >= 45% (min: {min_regime:.1f}%)")

    # Check 3: MFE/MAE > 1 (favorable > adverse)
    if mfe_mae_ratio > 1:
        passes.append(f"MFE/MAE ratio: {mfe_mae_ratio:.2f}x > 1.0")
    else:
        failures.append(f"MFE/MAE ratio: {mfe_mae_ratio:.2f}x <= 1.0")

    # Check 4: No death spirals
    if not spirals:
        passes.append("No death spirals detected")
    else:
        failures.append(f"{len(spirals)} death spiral(s) detected")

    print("\nPASSES:")
    for p in passes:
        print(f"  [+] {p}")

    print("\nFAILURES:")
    if failures:
        for f in failures:
            print(f"  [-] {f}")
    else:
        print("  None")

    # Final verdict
    print("\n" + "-" * 70)
    if len(failures) == 0:
        print("VERDICT: *** PASS *** - 4H bias logic shows directional edge")
        print("Next step: Lock 4H rules, proceed to 1H structure validation")
    elif accuracy >= 50 and len(failures) <= 1:
        print("VERDICT: *** MARGINAL *** - Edge exists but needs refinement")
        print("Recommendation: Review failing criteria before proceeding")
    else:
        print("VERDICT: *** FAIL *** - No reliable directional edge detected")
        print("Recommendation: Rework 4H bias logic before proceeding")
    print("-" * 70)

    # ==========================================================================
    # DETAILED SIGNAL LOG (First 20)
    # ==========================================================================

    print("\n" + "=" * 70)
    print("SAMPLE SIGNALS (First 20)")
    print("=" * 70)
    print(f"{'Date':<20} {'Bias':<8} {'Sweep':<5} {'RSI':<6} {'MFE%':<7} {'MAE%':<7} {'Net%':<7} {'Result':<8}")
    print("-" * 70)

    for r in results[:20]:
        date = r['timestamp'].strftime('%Y-%m-%d %H:%M')
        rsi_flag = '*' if r['rsi_extreme'] else ''
        print(f"{date:<20} {r['bias']:<8} {r['sweep_type']:<5} {r['rsi']:.0f}{rsi_flag:<5} {r['mfe_pct']:<7.2f} {r['mae_pct']:<7.2f} {r['net_move_pct']:<7.2f} {r['outcome']:<8}")

    # Export results
    results_df = pd.DataFrame(results)
    results_df.to_csv('data/4h_bias_backtest_results.csv', index=False)
    print(f"\nFull results exported to: data/4h_bias_backtest_results.csv")

    return results, regime_accuracy, spirals

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    results, regime_acc, spirals = run_backtest('data/btc_usd_4h.csv')
