"""
1H Structure Alignment Checkpoint V2
====================================
REFINEMENTS:
- Simpler trend detection (EMA-based instead of swing-based)
- Extended lookback (24H instead of 12H)
- Deeper session analysis with time-of-day breakdown

Goal: Does 1H structure filter out bad days?
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

def load_1h_data(filepath):
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df

def load_4h_signals(filepath):
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def calculate_emas(df):
    """Calculate EMAs for trend detection"""
    df = df.copy()
    df['ema_8'] = df['close'].ewm(span=8, adjust=False).mean()
    df['ema_21'] = df['close'].ewm(span=21, adjust=False).mean()
    df['ema_50'] = df['close'].ewm(span=50, adjust=False).mean()
    return df

def assess_1h_trend(df_1h, signal_time):
    """
    Assess 1H trend using EMA alignment

    BULLISH: EMA8 > EMA21 > EMA50 AND price > EMA8
    BEARISH: EMA8 < EMA21 < EMA50 AND price < EMA8
    NEUTRAL: Mixed alignment

    Also returns trend strength (distance from EMAs)
    """
    mask = df_1h['timestamp'] <= signal_time
    if mask.sum() < 50:
        return 'NEUTRAL', {'reason': 'insufficient_data'}

    idx = df_1h[mask].index[-1]
    row = df_1h.iloc[idx]

    price = row['close']
    ema8 = row['ema_8']
    ema21 = row['ema_21']
    ema50 = row['ema_50']

    # Check alignment
    bullish_stack = ema8 > ema21 > ema50
    bearish_stack = ema8 < ema21 < ema50
    price_above_ema8 = price > ema8
    price_below_ema8 = price < ema8

    # Trend strength: % distance from EMA50
    trend_strength = (price - ema50) / ema50 * 100

    details = {
        'price': price,
        'ema8': ema8,
        'ema21': ema21,
        'ema50': ema50,
        'bullish_stack': bullish_stack,
        'bearish_stack': bearish_stack,
        'price_above_ema8': price_above_ema8,
        'trend_strength': trend_strength
    }

    if bullish_stack and price_above_ema8:
        return 'BULLISH', details
    elif bearish_stack and price_below_ema8:
        return 'BEARISH', details
    else:
        return 'NEUTRAL', details

def assess_momentum(df_1h, signal_time, lookback=6):
    """
    Assess short-term momentum (last 6 hours)

    Returns: 'UP', 'DOWN', or 'FLAT'
    """
    mask = df_1h['timestamp'] <= signal_time
    if mask.sum() < lookback + 1:
        return 'FLAT', {}

    idx = df_1h[mask].index[-1]
    start_idx = idx - lookback

    window = df_1h.iloc[start_idx:idx+1]

    start_price = window['close'].iloc[0]
    end_price = window['close'].iloc[-1]
    change_pct = (end_price - start_price) / start_price * 100

    # Count up/down candles
    up_candles = sum(1 for i in range(1, len(window)) if window['close'].iloc[i] > window['close'].iloc[i-1])
    down_candles = len(window) - 1 - up_candles

    details = {
        'change_pct': change_pct,
        'up_candles': up_candles,
        'down_candles': down_candles
    }

    if change_pct > 0.5 and up_candles >= down_candles:
        return 'UP', details
    elif change_pct < -0.5 and down_candles >= up_candles:
        return 'DOWN', details
    else:
        return 'FLAT', details

def get_session(timestamp):
    """Classify into trading session"""
    hour = timestamp.hour
    if 0 <= hour < 8:
        return 'ASIA'
    elif 8 <= hour < 14:
        return 'LONDON'
    elif 14 <= hour < 17:
        return 'NY_OPEN'
    elif 17 <= hour < 22:
        return 'NY_MID'
    else:
        return 'ASIA'

def check_alignment(signal_bias, structure_1h):
    """Check if 1H trend aligns with 4H bias"""
    if structure_1h == 'NEUTRAL':
        return 'NEUTRAL'
    if signal_bias == 'BULLISH' and structure_1h == 'BULLISH':
        return 'AGREE'
    elif signal_bias == 'BEARISH' and structure_1h == 'BEARISH':
        return 'AGREE'
    elif (signal_bias == 'BULLISH' and structure_1h == 'BEARISH') or \
         (signal_bias == 'BEARISH' and structure_1h == 'BULLISH'):
        return 'CONFLICT'
    return 'NEUTRAL'

def check_momentum_alignment(signal_bias, momentum):
    """Check if short-term momentum aligns with bias"""
    if momentum == 'FLAT':
        return 'NEUTRAL'
    if signal_bias == 'BULLISH' and momentum == 'UP':
        return 'AGREE'
    elif signal_bias == 'BEARISH' and momentum == 'DOWN':
        return 'AGREE'
    elif (signal_bias == 'BULLISH' and momentum == 'DOWN') or \
         (signal_bias == 'BEARISH' and momentum == 'UP'):
        return 'CONFLICT'
    return 'NEUTRAL'

def calculate_loss_streaks(results, condition_col=None, condition_val=None):
    if condition_col and condition_val:
        filtered = [r for r in results if r.get(condition_col) == condition_val]
    else:
        filtered = results

    if not filtered:
        return {'max_streak': 0, 'avg_streak': 0, 'total_losses': 0, 'total_signals': 0}

    streaks = []
    current_streak = 0
    for r in filtered:
        if r['outcome'] == 'WRONG':
            current_streak += 1
        else:
            if current_streak > 0:
                streaks.append(current_streak)
            current_streak = 0
    if current_streak > 0:
        streaks.append(current_streak)

    return {
        'max_streak': max(streaks) if streaks else 0,
        'avg_streak': np.mean(streaks) if streaks else 0,
        'total_losses': sum(1 for r in filtered if r['outcome'] == 'WRONG'),
        'total_signals': len(filtered)
    }

def run_backtest():
    print("=" * 90)
    print("1H STRUCTURE ALIGNMENT CHECKPOINT V2")
    print("=" * 90)
    print("\nRefinements: EMA-based trend, momentum analysis, deeper session breakdown\n")

    # Load data
    df_1h = load_1h_data('data/btc_usd_1h.csv')
    df_4h_signals = load_4h_signals('4H/4h_bias_v3_best_results.csv')

    # Calculate EMAs
    df_1h = calculate_emas(df_1h)

    min_1h = df_1h['timestamp'].min()
    max_1h = df_1h['timestamp'].max()
    print(f"1H data range: {min_1h.date()} to {max_1h.date()}")

    # Filter to overlap
    signals = df_4h_signals[
        (df_4h_signals['timestamp'] >= min_1h) &
        (df_4h_signals['timestamp'] <= max_1h)
    ].copy()

    print(f"4H signals in overlap: {len(signals)}\n")

    # Analyze each signal
    results = []
    for _, signal in signals.iterrows():
        trend, trend_details = assess_1h_trend(df_1h, signal['timestamp'])
        momentum, mom_details = assess_momentum(df_1h, signal['timestamp'])

        alignment = check_alignment(signal['bias'], trend)
        mom_alignment = check_momentum_alignment(signal['bias'], momentum)
        session = get_session(signal['timestamp'])

        results.append({
            'timestamp': signal['timestamp'],
            'bias': signal['bias'],
            'outcome': signal['outcome'],
            'mfe_pct': signal['mfe_pct'],
            'mae_pct': signal['mae_pct'],
            'regime': signal['regime'],
            'trend_1h': trend,
            'alignment': alignment,
            'momentum': momentum,
            'mom_alignment': mom_alignment,
            'session': session,
            'hour': signal['timestamp'].hour,
            **{f'trend_{k}': v for k, v in trend_details.items() if not isinstance(v, bool)},
            **{f'mom_{k}': v for k, v in mom_details.items()}
        })

    # =========================================================================
    # TEST 1: TREND ALIGNMENT
    # =========================================================================
    print("=" * 90)
    print("TEST 1: 1H TREND ALIGNMENT (EMA-based)")
    print("=" * 90)

    def calc_stats(subset):
        if not subset:
            return {'count': 0, 'win_rate': 0, 'avg_mfe': 0, 'avg_mae': 0, 'mfe_mae': 0}
        wins = sum(1 for r in subset if r['outcome'] == 'CORRECT')
        avg_mfe = np.mean([r['mfe_pct'] for r in subset])
        avg_mae = np.mean([r['mae_pct'] for r in subset])
        return {
            'count': len(subset),
            'win_rate': wins / len(subset) * 100,
            'avg_mfe': avg_mfe,
            'avg_mae': avg_mae,
            'mfe_mae': avg_mfe / avg_mae if avg_mae > 0 else 0
        }

    agree = [r for r in results if r['alignment'] == 'AGREE']
    conflict = [r for r in results if r['alignment'] == 'CONFLICT']
    neutral = [r for r in results if r['alignment'] == 'NEUTRAL']

    agree_stats = calc_stats(agree)
    conflict_stats = calc_stats(conflict)
    neutral_stats = calc_stats(neutral)

    print(f"\n{'Trend Alignment':<15} {'Count':<8} {'Win%':<8} {'MFE%':<8} {'MAE%':<8} {'MFE/MAE':<10}")
    print("-" * 65)
    print(f"{'AGREE':<15} {agree_stats['count']:<8} {agree_stats['win_rate']:<8.1f} {agree_stats['avg_mfe']:<8.2f} {agree_stats['avg_mae']:<8.2f} {agree_stats['mfe_mae']:<10.2f}")
    print(f"{'CONFLICT':<15} {conflict_stats['count']:<8} {conflict_stats['win_rate']:<8.1f} {conflict_stats['avg_mfe']:<8.2f} {conflict_stats['avg_mae']:<8.2f} {conflict_stats['mfe_mae']:<10.2f}")
    print(f"{'NEUTRAL':<15} {neutral_stats['count']:<8} {neutral_stats['win_rate']:<8.1f} {neutral_stats['avg_mfe']:<8.2f} {neutral_stats['avg_mae']:<8.2f} {neutral_stats['mfe_mae']:<10.2f}")

    trend_diff = agree_stats['win_rate'] - conflict_stats['win_rate'] if conflict_stats['count'] > 0 else 0
    trend_pass = trend_diff >= 10

    print(f"\nTrend Alignment Differential: {trend_diff:+.1f}%")
    print(f"TEST 1 RESULT: {'PASS' if trend_pass else 'FAIL'}")

    # =========================================================================
    # TEST 2: MOMENTUM ALIGNMENT
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 2: 6H MOMENTUM ALIGNMENT")
    print("=" * 90)

    mom_agree = [r for r in results if r['mom_alignment'] == 'AGREE']
    mom_conflict = [r for r in results if r['mom_alignment'] == 'CONFLICT']
    mom_neutral = [r for r in results if r['mom_alignment'] == 'NEUTRAL']

    mom_agree_stats = calc_stats(mom_agree)
    mom_conflict_stats = calc_stats(mom_conflict)
    mom_neutral_stats = calc_stats(mom_neutral)

    print(f"\n{'Momentum':<15} {'Count':<8} {'Win%':<8} {'MFE%':<8} {'MAE%':<8} {'MFE/MAE':<10}")
    print("-" * 65)
    print(f"{'AGREE':<15} {mom_agree_stats['count']:<8} {mom_agree_stats['win_rate']:<8.1f} {mom_agree_stats['avg_mfe']:<8.2f} {mom_agree_stats['avg_mae']:<8.2f} {mom_agree_stats['mfe_mae']:<10.2f}")
    print(f"{'CONFLICT':<15} {mom_conflict_stats['count']:<8} {mom_conflict_stats['win_rate']:<8.1f} {mom_conflict_stats['avg_mfe']:<8.2f} {mom_conflict_stats['avg_mae']:<8.2f} {mom_conflict_stats['mfe_mae']:<10.2f}")
    print(f"{'NEUTRAL':<15} {mom_neutral_stats['count']:<8} {mom_neutral_stats['win_rate']:<8.1f} {mom_neutral_stats['avg_mfe']:<8.2f} {mom_neutral_stats['avg_mae']:<8.2f} {mom_neutral_stats['mfe_mae']:<10.2f}")

    mom_diff = mom_agree_stats['win_rate'] - mom_conflict_stats['win_rate'] if mom_conflict_stats['count'] > 0 else 0
    mom_pass = mom_diff >= 10

    print(f"\nMomentum Differential: {mom_diff:+.1f}%")
    print(f"TEST 2 RESULT: {'PASS' if mom_pass else 'FAIL'}")

    # =========================================================================
    # TEST 3: SESSION ANALYSIS (DEEP DIVE)
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 3: SESSION QUALITY ANALYSIS")
    print("=" * 90)

    sessions = ['ASIA', 'LONDON', 'NY_OPEN', 'NY_MID']
    session_stats = {}

    print(f"\n{'Session':<12} {'Count':<8} {'Win%':<8} {'MFE%':<8} {'MAE%':<8} {'MFE/MAE':<10}")
    print("-" * 60)

    for session in sessions:
        subset = [r for r in results if r['session'] == session]
        stats = calc_stats(subset)
        session_stats[session] = stats
        print(f"{session:<12} {stats['count']:<8} {stats['win_rate']:<8.1f} {stats['avg_mfe']:<8.2f} {stats['avg_mae']:<8.2f} {stats['mfe_mae']:<10.2f}")

    # Hourly breakdown
    print("\n--- Hourly Breakdown ---")
    print(f"{'Hour(UTC)':<12} {'Count':<8} {'Win%':<8} {'Session':<12}")
    print("-" * 45)

    hourly_stats = {}
    for hour in range(24):
        subset = [r for r in results if r['hour'] == hour]
        if subset:
            wins = sum(1 for r in subset if r['outcome'] == 'CORRECT')
            hourly_stats[hour] = {
                'count': len(subset),
                'win_rate': wins / len(subset) * 100,
                'session': get_session(subset[0]['timestamp'])
            }
            print(f"{hour:02d}:00        {hourly_stats[hour]['count']:<8} {hourly_stats[hour]['win_rate']:<8.1f} {hourly_stats[hour]['session']:<12}")

    # Find best/worst sessions
    valid_sessions = {k: v for k, v in session_stats.items() if v['count'] >= 3}
    if valid_sessions:
        best = max(valid_sessions.items(), key=lambda x: x[1]['win_rate'])
        worst = min(valid_sessions.items(), key=lambda x: x[1]['win_rate'])
        spread = best[1]['win_rate'] - worst[1]['win_rate']

        print(f"\nBest: {best[0]} ({best[1]['win_rate']:.1f}%, n={best[1]['count']})")
        print(f"Worst: {worst[0]} ({worst[1]['win_rate']:.1f}%, n={worst[1]['count']})")
        print(f"Spread: {spread:.1f}%")

        session_pass = spread >= 15
    else:
        session_pass = False
        spread = 0

    print(f"TEST 3 RESULT: {'PASS' if session_pass else 'FAIL'}")

    # =========================================================================
    # TEST 4: COMBINED FILTER
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 4: COMBINED FILTER ANALYSIS")
    print("=" * 90)

    # Test combining filters
    filters = [
        ('No Filter (Baseline)', lambda r: True),
        ('AGREE trend only', lambda r: r['alignment'] == 'AGREE'),
        ('Not CONFLICT trend', lambda r: r['alignment'] != 'CONFLICT'),
        ('NY_MID only', lambda r: r['session'] == 'NY_MID'),
        ('Not NY_OPEN', lambda r: r['session'] != 'NY_OPEN'),
        ('NY_MID + Not CONFLICT', lambda r: r['session'] == 'NY_MID' and r['alignment'] != 'CONFLICT'),
        ('Not NY_OPEN + Not CONFLICT', lambda r: r['session'] != 'NY_OPEN' and r['alignment'] != 'CONFLICT'),
    ]

    print(f"\n{'Filter':<30} {'Signals':<10} {'Win%':<10} {'Loss Streak':<12}")
    print("-" * 65)

    for name, filter_fn in filters:
        subset = [r for r in results if filter_fn(r)]
        stats = calc_stats(subset)
        streaks = calculate_loss_streaks(subset)
        print(f"{name:<30} {stats['count']:<10} {stats['win_rate']:<10.1f} {streaks['max_streak']:<12}")

    # =========================================================================
    # TEST 5: FAILURE CONTAINMENT
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 5: FAILURE CONTAINMENT")
    print("=" * 90)

    overall = calculate_loss_streaks(results)
    no_ny_open = calculate_loss_streaks([r for r in results if r['session'] != 'NY_OPEN'])
    ny_mid_only = calculate_loss_streaks([r for r in results if r['session'] == 'NY_MID'])

    print(f"\n{'Filter':<25} {'Signals':<10} {'Losses':<10} {'Max Streak':<12}")
    print("-" * 60)
    print(f"{'No Filter':<25} {overall['total_signals']:<10} {overall['total_losses']:<10} {overall['max_streak']:<12}")
    print(f"{'Exclude NY_OPEN':<25} {no_ny_open['total_signals']:<10} {no_ny_open['total_losses']:<10} {no_ny_open['max_streak']:<12}")
    print(f"{'NY_MID only':<25} {ny_mid_only['total_signals']:<10} {ny_mid_only['total_losses']:<10} {ny_mid_only['max_streak']:<12}")

    containment_pass = no_ny_open['max_streak'] <= 3 or ny_mid_only['max_streak'] <= 2
    print(f"\nTEST 5 RESULT: {'PASS' if containment_pass else 'FAIL'}")

    # =========================================================================
    # FINAL VERDICT
    # =========================================================================
    print("\n" + "=" * 90)
    print("1H CHECKPOINT - FINAL VERDICT")
    print("=" * 90)

    tests = [
        ('Trend Alignment', trend_pass),
        ('Momentum Alignment', mom_pass),
        ('Session Quality', session_pass),
        ('Failure Containment', containment_pass)
    ]

    passed = sum(1 for _, p in tests if p)
    print(f"\n{'Test':<25} {'Result':<10}")
    print("-" * 35)
    for name, p in tests:
        print(f"{name:<25} {'PASS' if p else 'FAIL':<10}")

    print(f"\nTests Passed: {passed}/4")

    # Overall verdict
    if session_pass:
        print("\n" + "=" * 90)
        print("VERDICT: PARTIAL PASS - SESSION FILTER VALIDATED")
        print("=" * 90)
        print(f"""
KEY FINDINGS:

1. TREND ALIGNMENT: {'WORKS' if trend_pass else 'NO EDGE'}
   - Agree vs Conflict differential: {trend_diff:+.1f}%
   {'- 1H trend aligning with 4H bias improves outcomes' if trend_pass else '- 1H trend does not reliably predict 4H signal success'}

2. SESSION FILTER: STRONG SIGNAL
   - Best: {best[0]} ({best[1]['win_rate']:.1f}%)
   - Worst: {worst[0]} ({worst[1]['win_rate']:.1f}%)
   - Spread: {spread:.1f}%

RECOMMENDED 1H RULES:
""")
        if session_pass:
            print(f"  1. PREFER: {best[0]} session signals")
            print(f"  2. AVOID: {worst[0]} session signals")
        if trend_pass:
            print(f"  3. Require 1H trend alignment with 4H bias")
        if containment_pass:
            print(f"  4. Session filter reduces max loss streak")

        print(f"\n1H exists to say 'don't trade {worst[0]}'")

    else:
        print("\n" + "=" * 90)
        print("VERDICT: FAIL")
        print("=" * 90)
        print("\n1H structure does not add meaningful filtering.")
        print("The 4H bias alone may be sufficient.")

    # Export
    results_df = pd.DataFrame(results)
    results_df.to_csv('1H/1h_structure_v2_results.csv', index=False)
    print(f"\nResults exported to: 1H/1h_structure_v2_results.csv")

    return results

if __name__ == "__main__":
    run_backtest()
