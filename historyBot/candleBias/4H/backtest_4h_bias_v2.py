"""
4H Bias Validation Backtest V2 - With Recommended Filters
==========================================================
Testing if the following filters improve accuracy to pass metrics:

1. RSI Filter: Only take bullish sweeps when RSI < 30, bearish when RSI > 70
2. Confirmation Filter: Require follow-up candle to confirm direction
3. Regime Filter: Skip trending regimes OR flip bias during trends
4. Significance Filter: Require sweeps of more significant swing levels

Pass Criteria:
- Bias accuracy >= 55%
- No regime where accuracy < 45%
- MFE/MAE ratio > 1.0
- No death spirals (5+ consecutive failures)
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

EVALUATION_WINDOW = 8
SWING_LOOKBACK = 20
SWEEP_THRESHOLD = 0.001
RSI_PERIOD = 14
MIN_SWING_AGE = 3

# Filter configurations to test
FILTER_CONFIGS = {
    'baseline': {
        'rsi_filter': False,
        'confirmation': False,
        'regime_filter': None,
        'significance_lookback': 20
    },
    'rsi_only': {
        'rsi_filter': True,
        'rsi_bull_threshold': 30,
        'rsi_bear_threshold': 70,
        'confirmation': False,
        'regime_filter': None,
        'significance_lookback': 20
    },
    'confirmation_only': {
        'rsi_filter': False,
        'confirmation': True,
        'regime_filter': None,
        'significance_lookback': 20
    },
    'regime_skip': {
        'rsi_filter': False,
        'confirmation': False,
        'regime_filter': 'skip',  # Skip trending regimes
        'significance_lookback': 20
    },
    'regime_flip': {
        'rsi_filter': False,
        'confirmation': False,
        'regime_filter': 'flip',  # Flip bias during trends
        'significance_lookback': 20
    },
    'significance_40': {
        'rsi_filter': False,
        'confirmation': False,
        'regime_filter': None,
        'significance_lookback': 40  # Larger swing lookback
    },
    'rsi_plus_confirm': {
        'rsi_filter': True,
        'rsi_bull_threshold': 30,
        'rsi_bear_threshold': 70,
        'confirmation': True,
        'regime_filter': None,
        'significance_lookback': 20
    },
    'all_filters': {
        'rsi_filter': True,
        'rsi_bull_threshold': 35,
        'rsi_bear_threshold': 65,
        'confirmation': True,
        'regime_filter': 'skip',
        'significance_lookback': 30
    },
    'optimized': {
        'rsi_filter': True,
        'rsi_bull_threshold': 40,
        'rsi_bear_threshold': 60,
        'confirmation': True,
        'regime_filter': 'skip',
        'significance_lookback': 25
    }
}

# =============================================================================
# DATA LOADING & BASIC CALCULATIONS
# =============================================================================

def load_data(filepath):
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    df['rsi'] = calculate_rsi(df['close'], RSI_PERIOD)
    return df

def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def detect_swings(df, lookback=20):
    """Detect swing highs and lows using 3-candle pattern."""
    df['swing_high'] = False
    df['swing_low'] = False
    df['swing_high_price'] = np.nan
    df['swing_low_price'] = np.nan

    for i in range(1, len(df) - 1):
        if df['high'].iloc[i] > df['high'].iloc[i-1] and df['high'].iloc[i] > df['high'].iloc[i+1]:
            df.loc[df.index[i], 'swing_high'] = True
            df.loc[df.index[i], 'swing_high_price'] = df['high'].iloc[i]

        if df['low'].iloc[i] < df['low'].iloc[i-1] and df['low'].iloc[i] < df['low'].iloc[i+1]:
            df.loc[df.index[i], 'swing_low'] = True
            df.loc[df.index[i], 'swing_low_price'] = df['low'].iloc[i]

    return df

def detect_regimes(df, window=50):
    """Segment data into market regimes."""
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

    df['sma_20'] = df['close'].rolling(window=20).mean()
    df['sma_50'] = df['close'].rolling(window=50).mean()

    df['regime'] = 'RANGING'

    for i in range(window, len(df)):
        if df['atr_pct'].iloc[i] > high_vol_threshold:
            df.loc[df.index[i], 'regime'] = 'HIGH_VOL'
        elif df['sma_20'].iloc[i] > df['sma_50'].iloc[i] * 1.01:
            if df['close'].iloc[i] > df['sma_20'].iloc[i]:
                df.loc[df.index[i], 'regime'] = 'TRENDING_UP'
        elif df['sma_20'].iloc[i] < df['sma_50'].iloc[i] * 0.99:
            if df['close'].iloc[i] < df['sma_20'].iloc[i]:
                df.loc[df.index[i], 'regime'] = 'TRENDING_DOWN'

    return df

# =============================================================================
# FILTERED SWEEP DETECTION
# =============================================================================

def detect_sweeps_filtered(df, config):
    """Detect liquidity sweeps with configurable filters."""
    sweeps = []
    lookback = config['significance_lookback']
    active_swing_highs = []
    active_swing_lows = []

    for i in range(lookback, len(df) - EVALUATION_WINDOW):
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

        active_swing_highs = [(idx, price) for idx, price in active_swing_highs if i - idx <= lookback]
        active_swing_lows = [(idx, price) for idx, price in active_swing_lows if i - idx <= lookback]

        # Check for HIGH sweep (bearish bias)
        for swing_idx, swing_price in active_swing_highs:
            if current_high > swing_price and current_close < swing_price:
                # Apply RSI filter
                if config['rsi_filter']:
                    if current_rsi < config['rsi_bear_threshold']:
                        continue  # Skip if RSI not extreme enough for bearish

                # Apply confirmation filter
                confirmed = True
                if config['confirmation'] and i + 1 < len(df):
                    next_close = df['close'].iloc[i + 1]
                    confirmed = next_close < current_close  # Next candle continues down

                if not confirmed:
                    continue

                # Determine bias based on regime filter
                bias = 'BEARISH'
                if config['regime_filter'] == 'skip':
                    if current_regime == 'TRENDING_UP':
                        continue  # Skip bearish signals in uptrend
                elif config['regime_filter'] == 'flip':
                    if current_regime == 'TRENDING_UP':
                        bias = 'BULLISH'  # Flip to follow trend

                sweeps.append({
                    'candle_idx': i,
                    'timestamp': df['timestamp'].iloc[i],
                    'sweep_type': 'HIGH',
                    'bias': bias,
                    'swing_price': swing_price,
                    'close_price': current_close,
                    'rsi': current_rsi,
                    'regime': current_regime
                })
                active_swing_highs = [(idx, p) for idx, p in active_swing_highs if idx != swing_idx]
                break

        # Check for LOW sweep (bullish bias)
        for swing_idx, swing_price in active_swing_lows:
            if current_low < swing_price and current_close > swing_price:
                # Apply RSI filter
                if config['rsi_filter']:
                    if current_rsi > config['rsi_bull_threshold']:
                        continue  # Skip if RSI not extreme enough for bullish

                # Apply confirmation filter
                confirmed = True
                if config['confirmation'] and i + 1 < len(df):
                    next_close = df['close'].iloc[i + 1]
                    confirmed = next_close > current_close  # Next candle continues up

                if not confirmed:
                    continue

                # Determine bias based on regime filter
                bias = 'BULLISH'
                if config['regime_filter'] == 'skip':
                    if current_regime == 'TRENDING_DOWN':
                        continue  # Skip bullish signals in downtrend
                elif config['regime_filter'] == 'flip':
                    if current_regime == 'TRENDING_DOWN':
                        bias = 'BEARISH'  # Flip to follow trend

                sweeps.append({
                    'candle_idx': i,
                    'timestamp': df['timestamp'].iloc[i],
                    'sweep_type': 'LOW',
                    'bias': bias,
                    'swing_price': swing_price,
                    'close_price': current_close,
                    'rsi': current_rsi,
                    'regime': current_regime
                })
                active_swing_lows = [(idx, p) for idx, p in active_swing_lows if idx != swing_idx]
                break

    return sweeps

# =============================================================================
# EVALUATION
# =============================================================================

def evaluate_sweeps(df, sweeps):
    """Evaluate bias outcomes."""
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
            net_move = (exit_price - entry_price) / entry_price * 100
            outcome = 'CORRECT' if exit_price > entry_price else 'WRONG'
        else:
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

def detect_death_spirals(results, threshold=5):
    """Detect clustered failures."""
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
                spirals.append({'length': current_streak, 'start_idx': streak_start})
            current_streak = 0

    if current_streak >= threshold:
        spirals.append({'length': current_streak, 'start_idx': streak_start})

    return spirals

def calculate_metrics(results):
    """Calculate all pass/fail metrics."""
    if len(results) == 0:
        return None

    total = len(results)
    correct = sum(1 for r in results if r['outcome'] == 'CORRECT')
    accuracy = correct / total * 100

    avg_mfe = np.mean([r['mfe_pct'] for r in results])
    avg_mae = np.mean([r['mae_pct'] for r in results])
    mfe_mae_ratio = avg_mfe / avg_mae if avg_mae > 0 else 0

    # Regime accuracy
    regime_results = defaultdict(list)
    for r in results:
        regime_results[r['regime']].append(r)

    regime_accuracy = {}
    for regime, data in regime_results.items():
        if len(data) > 0:
            regime_accuracy[regime] = sum(1 for r in data if r['outcome'] == 'CORRECT') / len(data) * 100

    min_regime_acc = min(regime_accuracy.values()) if regime_accuracy else 0

    spirals = detect_death_spirals(results)

    return {
        'total_signals': total,
        'accuracy': accuracy,
        'mfe_mae_ratio': mfe_mae_ratio,
        'avg_mfe': avg_mfe,
        'avg_mae': avg_mae,
        'min_regime_accuracy': min_regime_acc,
        'regime_breakdown': regime_accuracy,
        'death_spirals': len(spirals),
        'spiral_details': spirals
    }

def check_pass_fail(metrics):
    """Check if metrics pass all criteria."""
    if metrics is None:
        return False, ['No signals generated']

    failures = []
    passes = []

    # Accuracy >= 55%
    if metrics['accuracy'] >= 55:
        passes.append(f"Accuracy: {metrics['accuracy']:.1f}% >= 55%")
    else:
        failures.append(f"Accuracy: {metrics['accuracy']:.1f}% < 55%")

    # MFE/MAE > 1.0
    if metrics['mfe_mae_ratio'] > 1.0:
        passes.append(f"MFE/MAE: {metrics['mfe_mae_ratio']:.2f}x > 1.0")
    else:
        failures.append(f"MFE/MAE: {metrics['mfe_mae_ratio']:.2f}x <= 1.0")

    # All regimes >= 45%
    if metrics['min_regime_accuracy'] >= 45:
        passes.append(f"Min regime: {metrics['min_regime_accuracy']:.1f}% >= 45%")
    else:
        failures.append(f"Min regime: {metrics['min_regime_accuracy']:.1f}% < 45%")

    # No death spirals
    if metrics['death_spirals'] == 0:
        passes.append("No death spirals")
    else:
        failures.append(f"{metrics['death_spirals']} death spiral(s)")

    passed = len(failures) == 0
    return passed, passes, failures

# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_filter_tests(filepath):
    """Test all filter configurations."""

    print("=" * 80)
    print("4H BIAS VALIDATION V2 - TESTING FILTER CONFIGURATIONS")
    print("=" * 80)

    df = load_data(filepath)
    print(f"\nLoaded {len(df)} candles")

    df = detect_swings(df)
    df = detect_regimes(df)

    results_summary = []

    for config_name, config in FILTER_CONFIGS.items():
        print(f"\n{'─' * 80}")
        print(f"Testing: {config_name.upper()}")
        print(f"{'─' * 80}")

        sweeps = detect_sweeps_filtered(df, config)
        results = evaluate_sweeps(df, sweeps)
        metrics = calculate_metrics(results)

        if metrics is None:
            print("  No signals generated with this configuration")
            continue

        passed, passes, failures = check_pass_fail(metrics)

        print(f"  Signals: {metrics['total_signals']}")
        print(f"  Accuracy: {metrics['accuracy']:.1f}%")
        print(f"  MFE/MAE: {metrics['mfe_mae_ratio']:.2f}x")
        print(f"  Min Regime: {metrics['min_regime_accuracy']:.1f}%")
        print(f"  Death Spirals: {metrics['death_spirals']}")
        print(f"  VERDICT: {'*** PASS ***' if passed else 'FAIL'}")

        results_summary.append({
            'config': config_name,
            'signals': metrics['total_signals'],
            'accuracy': metrics['accuracy'],
            'mfe_mae': metrics['mfe_mae_ratio'],
            'min_regime': metrics['min_regime_accuracy'],
            'spirals': metrics['death_spirals'],
            'passed': passed,
            'passes': passes,
            'failures': failures,
            'metrics': metrics
        })

    # ==========================================================================
    # SUMMARY TABLE
    # ==========================================================================

    print("\n" + "=" * 80)
    print("SUMMARY - ALL CONFIGURATIONS")
    print("=" * 80)
    print(f"\n{'Config':<20} {'Signals':<10} {'Acc%':<8} {'MFE/MAE':<10} {'MinReg%':<10} {'Spirals':<10} {'Result':<10}")
    print("-" * 80)

    passing_configs = []
    for r in results_summary:
        status = "PASS" if r['passed'] else "FAIL"
        print(f"{r['config']:<20} {r['signals']:<10} {r['accuracy']:<8.1f} {r['mfe_mae']:<10.2f} {r['min_regime']:<10.1f} {r['spirals']:<10} {status:<10}")
        if r['passed']:
            passing_configs.append(r)

    # ==========================================================================
    # BEST CONFIGURATION
    # ==========================================================================

    print("\n" + "=" * 80)

    if passing_configs:
        print("PASSING CONFIGURATIONS FOUND!")
        print("=" * 80)

        # Sort by accuracy, then by signal count
        passing_configs.sort(key=lambda x: (-x['accuracy'], -x['signals']))
        best = passing_configs[0]

        print(f"\nBEST CONFIG: {best['config'].upper()}")
        print(f"  Signals: {best['signals']}")
        print(f"  Accuracy: {best['accuracy']:.1f}%")
        print(f"  MFE/MAE: {best['mfe_mae']:.2f}x")
        print(f"  Min Regime Accuracy: {best['min_regime']:.1f}%")
        print(f"  Death Spirals: {best['spirals']}")

        print("\n  Regime Breakdown:")
        for regime, acc in best['metrics']['regime_breakdown'].items():
            print(f"    {regime}: {acc:.1f}%")

        print("\n  PASSES:")
        for p in best['passes']:
            print(f"    [+] {p}")

        print("\n" + "-" * 80)
        print("RECOMMENDATION: Proceed to 1H structure validation with this configuration")
        print("-" * 80)

        return best

    else:
        print("NO PASSING CONFIGURATIONS FOUND")
        print("=" * 80)

        # Find best performing even if not passing
        results_summary.sort(key=lambda x: -x['accuracy'])
        best = results_summary[0]

        print(f"\nBest (non-passing): {best['config'].upper()}")
        print(f"  Accuracy: {best['accuracy']:.1f}%")
        print(f"  Failures: {best['failures']}")

        print("\n" + "-" * 80)
        print("RECOMMENDATION: Need alternative approach - current filters insufficient")
        print("-" * 80)

        return None

# =============================================================================
# RUN
# =============================================================================

if __name__ == "__main__":
    best_config = run_filter_tests('data/btc_usd_4h.csv')
