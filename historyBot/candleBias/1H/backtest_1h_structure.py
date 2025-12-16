"""
1H Structure Alignment Checkpoint
=================================
Goal: Does 1H structure filter out bad days and keep me aligned with 4H bias?

NOT trying to:
- Increase trade frequency
- Improve entries
- Optimize RR

ARE trying to:
- Prevent trading on structurally bad days

Tests:
1. Bias agreement rate (agree/neutral/conflict)
2. Session quality filter (London/NY/Asia)
3. Failure containment (loss clustering)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Constants
SWING_LOOKBACK = 5  # 1H swing detection window
STRUCTURE_LOOKBACK = 12  # 12 hours to assess structure

def load_1h_data(filepath):
    """Load and prepare 1H data"""
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df

def load_4h_signals(filepath):
    """Load 4H bias signals from backtest results"""
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def detect_1h_swings(df):
    """Detect swing highs and lows on 1H"""
    df = df.copy()
    df['swing_high'] = False
    df['swing_low'] = False
    df['swing_high_price'] = np.nan
    df['swing_low_price'] = np.nan

    for i in range(2, len(df) - 2):
        # 5-candle swing pattern for more significant swings
        if (df['high'].iloc[i] > df['high'].iloc[i-1] and
            df['high'].iloc[i] > df['high'].iloc[i-2] and
            df['high'].iloc[i] > df['high'].iloc[i+1] and
            df['high'].iloc[i] > df['high'].iloc[i+2]):
            df.loc[df.index[i], 'swing_high'] = True
            df.loc[df.index[i], 'swing_high_price'] = df['high'].iloc[i]

        if (df['low'].iloc[i] < df['low'].iloc[i-1] and
            df['low'].iloc[i] < df['low'].iloc[i-2] and
            df['low'].iloc[i] < df['low'].iloc[i+1] and
            df['low'].iloc[i] < df['low'].iloc[i+2]):
            df.loc[df.index[i], 'swing_low'] = True
            df.loc[df.index[i], 'swing_low_price'] = df['low'].iloc[i]

    return df

def assess_1h_structure(df_1h, signal_time, lookback_hours=12):
    """
    Assess 1H structure at the time of a 4H signal

    Returns: 'BULLISH', 'BEARISH', or 'NEUTRAL'

    BULLISH structure: Higher highs AND higher lows
    BEARISH structure: Lower highs AND lower lows
    NEUTRAL: Mixed or unclear
    """
    # Find the 1H candle closest to signal time
    mask = df_1h['timestamp'] <= signal_time
    if mask.sum() < lookback_hours:
        return 'NEUTRAL', {}

    # Get the lookback window
    end_idx = df_1h[mask].index[-1]
    start_idx = max(0, end_idx - lookback_hours)
    window = df_1h.iloc[start_idx:end_idx+1]

    # Find swing highs and lows in the window
    swing_highs = window[window['swing_high']]['swing_high_price'].dropna().values
    swing_lows = window[window['swing_low']]['swing_low_price'].dropna().values

    if len(swing_highs) < 2 or len(swing_lows) < 2:
        return 'NEUTRAL', {'swing_highs': len(swing_highs), 'swing_lows': len(swing_lows)}

    # Check for higher highs / lower highs
    hh_count = sum(1 for i in range(1, len(swing_highs)) if swing_highs[i] > swing_highs[i-1])
    lh_count = sum(1 for i in range(1, len(swing_highs)) if swing_highs[i] < swing_highs[i-1])

    # Check for higher lows / lower lows
    hl_count = sum(1 for i in range(1, len(swing_lows)) if swing_lows[i] > swing_lows[i-1])
    ll_count = sum(1 for i in range(1, len(swing_lows)) if swing_lows[i] < swing_lows[i-1])

    total_comparisons = len(swing_highs) - 1 + len(swing_lows) - 1

    bullish_score = hh_count + hl_count
    bearish_score = lh_count + ll_count

    details = {
        'swing_highs': len(swing_highs),
        'swing_lows': len(swing_lows),
        'hh': hh_count, 'lh': lh_count,
        'hl': hl_count, 'll': ll_count,
        'bullish_score': bullish_score,
        'bearish_score': bearish_score
    }

    # Require >60% agreement for clear structure
    threshold = total_comparisons * 0.6

    if bullish_score >= threshold:
        return 'BULLISH', details
    elif bearish_score >= threshold:
        return 'BEARISH', details
    else:
        return 'NEUTRAL', details

def get_session(timestamp):
    """
    Classify timestamp into trading session (UTC)

    Asia: 00:00-08:00 UTC
    London: 08:00-14:00 UTC
    NY Open: 14:00-17:00 UTC
    NY Mid: 17:00-22:00 UTC
    Asia Late: 22:00-00:00 UTC (counted as Asia)
    """
    hour = timestamp.hour

    if 0 <= hour < 8:
        return 'ASIA'
    elif 8 <= hour < 14:
        return 'LONDON'
    elif 14 <= hour < 17:
        return 'NY_OPEN'
    elif 17 <= hour < 22:
        return 'NY_MID'
    else:  # 22-24
        return 'ASIA'

def check_alignment(signal_bias, structure):
    """
    Check if 1H structure aligns with 4H bias

    Returns: 'AGREE', 'CONFLICT', or 'NEUTRAL'
    """
    if structure == 'NEUTRAL':
        return 'NEUTRAL'

    if signal_bias == 'BULLISH' and structure == 'BULLISH':
        return 'AGREE'
    elif signal_bias == 'BEARISH' and structure == 'BEARISH':
        return 'AGREE'
    elif signal_bias == 'BULLISH' and structure == 'BEARISH':
        return 'CONFLICT'
    elif signal_bias == 'BEARISH' and structure == 'BULLISH':
        return 'CONFLICT'
    else:
        return 'NEUTRAL'

def calculate_loss_streaks(results, condition_col=None, condition_val=None):
    """Calculate maximum and average loss streaks"""
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
    print("1H STRUCTURE ALIGNMENT CHECKPOINT")
    print("=" * 90)
    print("\nGoal: Does 1H structure filter out bad days?")
    print("NOT optimizing: entries, frequency, RR")
    print("ARE testing: alignment filter effectiveness\n")

    # Load data
    print("Loading data...")
    df_1h = load_1h_data('data/btc_usd_1h.csv')
    df_4h_signals = load_4h_signals('4H/4h_bias_v3_best_results.csv')

    # Detect swings on 1H
    print("Detecting 1H swings...")
    df_1h = detect_1h_swings(df_1h)

    # Get date range overlap
    min_1h = df_1h['timestamp'].min()
    max_1h = df_1h['timestamp'].max()
    print(f"\n1H data range: {min_1h.date()} to {max_1h.date()}")

    # Filter 4H signals to overlap period
    signals = df_4h_signals[
        (df_4h_signals['timestamp'] >= min_1h) &
        (df_4h_signals['timestamp'] <= max_1h)
    ].copy()

    print(f"4H signals in overlap period: {len(signals)}")

    if len(signals) < 10:
        print("\nINSUFFICIENT DATA: Need at least 10 signals for analysis")
        return None

    # Analyze each signal
    print("\nAnalyzing structure alignment...")
    results = []

    for _, signal in signals.iterrows():
        structure, details = assess_1h_structure(df_1h, signal['timestamp'])
        alignment = check_alignment(signal['bias'], structure)
        session = get_session(signal['timestamp'])

        results.append({
            'timestamp': signal['timestamp'],
            'bias': signal['bias'],
            'outcome': signal['outcome'],
            'mfe_pct': signal['mfe_pct'],
            'mae_pct': signal['mae_pct'],
            'regime': signal['regime'],
            'structure_1h': structure,
            'alignment': alignment,
            'session': session,
            **details
        })

    # =========================================================================
    # TEST 1: BIAS AGREEMENT RATE
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 1: BIAS AGREEMENT RATE")
    print("=" * 90)

    agree = [r for r in results if r['alignment'] == 'AGREE']
    conflict = [r for r in results if r['alignment'] == 'CONFLICT']
    neutral = [r for r in results if r['alignment'] == 'NEUTRAL']

    def calc_stats(subset):
        if not subset:
            return {'count': 0, 'win_rate': 0, 'avg_mfe': 0, 'avg_mae': 0}
        wins = sum(1 for r in subset if r['outcome'] == 'CORRECT')
        return {
            'count': len(subset),
            'win_rate': wins / len(subset) * 100,
            'avg_mfe': np.mean([r['mfe_pct'] for r in subset]),
            'avg_mae': np.mean([r['mae_pct'] for r in subset])
        }

    agree_stats = calc_stats(agree)
    conflict_stats = calc_stats(conflict)
    neutral_stats = calc_stats(neutral)

    print(f"\n{'Alignment':<15} {'Count':<10} {'Win Rate':<12} {'Avg MFE%':<12} {'Avg MAE%':<12}")
    print("-" * 60)
    print(f"{'AGREE':<15} {agree_stats['count']:<10} {agree_stats['win_rate']:<12.1f} {agree_stats['avg_mfe']:<12.2f} {agree_stats['avg_mae']:<12.2f}")
    print(f"{'CONFLICT':<15} {conflict_stats['count']:<10} {conflict_stats['win_rate']:<12.1f} {conflict_stats['avg_mfe']:<12.2f} {conflict_stats['avg_mae']:<12.2f}")
    print(f"{'NEUTRAL':<15} {neutral_stats['count']:<10} {neutral_stats['win_rate']:<12.1f} {neutral_stats['avg_mfe']:<12.2f} {neutral_stats['avg_mae']:<12.2f}")

    # Agreement test: PASS if conflict significantly underperforms
    agreement_diff = agree_stats['win_rate'] - conflict_stats['win_rate'] if conflict_stats['count'] > 0 else 0
    agreement_pass = agreement_diff >= 10  # 10% difference threshold

    print(f"\nAgreement Differential: {agreement_diff:+.1f}%")
    print(f"TEST 1 RESULT: {'PASS' if agreement_pass else 'FAIL'} (need AGREE > CONFLICT by 10%+)")

    # =========================================================================
    # TEST 2: SESSION QUALITY FILTER
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 2: SESSION QUALITY FILTER")
    print("=" * 90)

    sessions = ['ASIA', 'LONDON', 'NY_OPEN', 'NY_MID']
    session_stats = {}

    print(f"\n{'Session':<12} {'Count':<10} {'Win Rate':<12} {'Avg MFE%':<12} {'Avg MAE%':<12} {'MFE/MAE':<10}")
    print("-" * 70)

    for session in sessions:
        subset = [r for r in results if r['session'] == session]
        stats = calc_stats(subset)
        mfe_mae = stats['avg_mfe'] / stats['avg_mae'] if stats['avg_mae'] > 0 else 0
        session_stats[session] = {**stats, 'mfe_mae': mfe_mae}
        print(f"{session:<12} {stats['count']:<10} {stats['win_rate']:<12.1f} {stats['avg_mfe']:<12.2f} {stats['avg_mae']:<12.2f} {mfe_mae:<10.2f}")

    # Find best and worst sessions
    valid_sessions = {k: v for k, v in session_stats.items() if v['count'] >= 3}
    if valid_sessions:
        best_session = max(valid_sessions.items(), key=lambda x: x[1]['win_rate'])
        worst_session = min(valid_sessions.items(), key=lambda x: x[1]['win_rate'])
        session_spread = best_session[1]['win_rate'] - worst_session[1]['win_rate']

        print(f"\nBest Session: {best_session[0]} ({best_session[1]['win_rate']:.1f}%)")
        print(f"Worst Session: {worst_session[0]} ({worst_session[1]['win_rate']:.1f}%)")
        print(f"Session Spread: {session_spread:.1f}%")

        # Session test: PASS if there's meaningful differentiation (>15% spread)
        session_pass = session_spread >= 15
    else:
        session_pass = False
        session_spread = 0

    print(f"TEST 2 RESULT: {'PASS' if session_pass else 'FAIL'} (need 15%+ spread between sessions)")

    # =========================================================================
    # TEST 3: FAILURE CONTAINMENT (Loss Clustering)
    # =========================================================================
    print("\n" + "=" * 90)
    print("TEST 3: FAILURE CONTAINMENT")
    print("=" * 90)

    # Overall loss streaks
    overall_streaks = calculate_loss_streaks(results)

    # Loss streaks by alignment
    agree_streaks = calculate_loss_streaks(results, 'alignment', 'AGREE')
    conflict_streaks = calculate_loss_streaks(results, 'alignment', 'CONFLICT')
    neutral_streaks = calculate_loss_streaks(results, 'alignment', 'NEUTRAL')

    print(f"\n{'Category':<20} {'Signals':<10} {'Losses':<10} {'Max Streak':<12} {'Avg Streak':<12}")
    print("-" * 65)
    print(f"{'OVERALL':<20} {overall_streaks['total_signals']:<10} {overall_streaks['total_losses']:<10} {overall_streaks['max_streak']:<12} {overall_streaks['avg_streak']:<12.2f}")
    print(f"{'AGREE only':<20} {agree_streaks['total_signals']:<10} {agree_streaks['total_losses']:<10} {agree_streaks['max_streak']:<12} {agree_streaks['avg_streak']:<12.2f}")
    print(f"{'CONFLICT only':<20} {conflict_streaks['total_signals']:<10} {conflict_streaks['total_losses']:<10} {conflict_streaks['max_streak']:<12} {conflict_streaks['avg_streak']:<12.2f}")
    print(f"{'NEUTRAL only':<20} {neutral_streaks['total_signals']:<10} {neutral_streaks['total_losses']:<10} {neutral_streaks['max_streak']:<12} {neutral_streaks['avg_streak']:<12.2f}")

    # Failure containment test: PASS if filtering to AGREE reduces max streak
    containment_improvement = overall_streaks['max_streak'] - agree_streaks['max_streak']
    containment_pass = containment_improvement > 0 and agree_streaks['max_streak'] <= 3

    print(f"\nFiltering to AGREE reduces max streak by: {containment_improvement}")
    print(f"AGREE max streak: {agree_streaks['max_streak']} (target: <= 3)")
    print(f"TEST 3 RESULT: {'PASS' if containment_pass else 'FAIL'}")

    # =========================================================================
    # FINAL VERDICT
    # =========================================================================
    print("\n" + "=" * 90)
    print("1H STRUCTURE CHECKPOINT - FINAL VERDICT")
    print("=" * 90)

    tests_passed = sum([agreement_pass, session_pass, containment_pass])

    print(f"\nTest 1 (Agreement Rate):    {'PASS' if agreement_pass else 'FAIL'}")
    print(f"Test 2 (Session Quality):   {'PASS' if session_pass else 'FAIL'}")
    print(f"Test 3 (Loss Containment):  {'PASS' if containment_pass else 'FAIL'}")

    print(f"\nTests Passed: {tests_passed}/3")

    overall_pass = tests_passed >= 2  # Need 2/3 tests to pass

    if overall_pass:
        print("\n" + "=" * 90)
        print("VERDICT: PASS")
        print("=" * 90)
        print("\n1H structure alignment DOES filter out bad days.")
        print("\nRECOMMENDED RULES:")
        if agreement_pass:
            print(f"  - Only trade when 1H structure AGREES with 4H bias")
            print(f"  - Avoid trading on CONFLICT (1H opposes 4H)")
        if session_pass:
            print(f"  - Best session: {best_session[0]} ({best_session[1]['win_rate']:.1f}%)")
            print(f"  - Avoid: {worst_session[0]} ({worst_session[1]['win_rate']:.1f}%)")
        if containment_pass:
            print(f"  - Using AGREE filter limits max loss streak to {agree_streaks['max_streak']}")
    else:
        print("\n" + "=" * 90)
        print("VERDICT: FAIL")
        print("=" * 90)
        print("\n1H structure does NOT meaningfully filter bad days.")
        print("The 4H bias alone is sufficient for directional permission.")
        print("Consider skipping 1H checkpoint or testing alternative metrics.")

    # Export results
    results_df = pd.DataFrame(results)
    results_df.to_csv('1H/1h_structure_results.csv', index=False)
    print(f"\nDetailed results exported to: 1H/1h_structure_results.csv")

    return {
        'agreement_pass': agreement_pass,
        'session_pass': session_pass,
        'containment_pass': containment_pass,
        'overall_pass': overall_pass,
        'agreement_diff': agreement_diff,
        'session_spread': session_spread,
        'agree_stats': agree_stats,
        'conflict_stats': conflict_stats,
        'session_stats': session_stats,
        'results': results
    }

if __name__ == "__main__":
    run_backtest()
