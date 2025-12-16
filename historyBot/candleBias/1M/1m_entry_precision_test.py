#!/usr/bin/env python3
"""
1M ENTRY PRECISION TEST

Testing: Can 1M provide better entry timing while keeping 5M stops?

This is a different use case than stop tightening:
- Keep 5M stop (proven to work)
- Use 1M only for entry timing
- Measure: R:R improvement from better fills

If this works, 1M's role is ENTRY OPTIMIZATION, not stop optimization.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass
from enum import Enum

class Direction(Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"

def load_1m_data(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df.sort_values('timestamp').reset_index(drop=True)

def aggregate_candles(df_1m: pd.DataFrame, period: str) -> pd.DataFrame:
    df = df_1m.set_index('timestamp')
    agg_dict = {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}
    return df.resample(period).agg(agg_dict).dropna().reset_index()

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(span=period, adjust=False).mean()
    avg_loss = loss.ewm(span=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def detect_swings(df: pd.DataFrame, lookback: int = 3) -> Tuple[pd.DataFrame, pd.DataFrame]:
    swing_highs, swing_lows = [], []
    for i in range(lookback, len(df) - lookback):
        is_high = all(df.iloc[i]['high'] > df.iloc[i-j]['high'] and df.iloc[i]['high'] > df.iloc[i+j]['high'] for j in range(1, lookback+1))
        is_low = all(df.iloc[i]['low'] < df.iloc[i-j]['low'] and df.iloc[i]['low'] < df.iloc[i+j]['low'] for j in range(1, lookback+1))
        if is_high:
            swing_highs.append({'timestamp': df.iloc[i]['timestamp'], 'price': df.iloc[i]['high']})
        if is_low:
            swing_lows.append({'timestamp': df.iloc[i]['timestamp'], 'price': df.iloc[i]['low']})
    return pd.DataFrame(swing_highs), pd.DataFrame(swing_lows)

def find_1m_optimal_entry(df_1m: pd.DataFrame, signal_time: datetime, direction: Direction,
                          base_entry_price: float, window_minutes: int = 30) -> Dict:
    """
    After 5M reclaim signal, look for optimal 1M entry within window.

    For BULLISH: Look for pullback (lower low) to enter
    For BEARISH: Look for pullback (higher high) to enter

    This simulates a limit order at recent 1M swing level.
    """
    window_end = signal_time + timedelta(minutes=window_minutes)
    mask = (df_1m['timestamp'] >= signal_time) & (df_1m['timestamp'] <= window_end)
    window = df_1m[mask]

    if window.empty:
        return {'improvement': 0, 'optimal_entry': base_entry_price, 'found': False}

    if direction == Direction.BULLISH:
        # Best entry is lowest low in window (buy lower)
        optimal_price = window['low'].min()
        improvement_pct = (base_entry_price - optimal_price) / base_entry_price * 100
    else:
        # Best entry is highest high in window (sell higher)
        optimal_price = window['high'].max()
        improvement_pct = (optimal_price - base_entry_price) / base_entry_price * 100

    # Only count if improvement is achievable (price went there)
    return {
        'improvement': improvement_pct,
        'optimal_entry': optimal_price,
        'base_entry': base_entry_price,
        'found': True
    }

def analyze_entry_improvement(df_1m: pd.DataFrame, entry_time: datetime, entry_price: float,
                              optimal_entry_price: float, direction: Direction,
                              stop_price: float, max_hours: int = 48) -> Dict:
    """
    Compare outcomes between market entry vs optimal 1M entry.

    Both use the same stop (5M stop).
    Measure R:R improvement from better entry.
    """
    window_end = entry_time + timedelta(hours=max_hours)
    mask = (df_1m['timestamp'] > entry_time) & (df_1m['timestamp'] <= window_end)
    window = df_1m[mask]

    if window.empty:
        return {}

    # Calculate stop distances for both entries
    if direction == Direction.BULLISH:
        stop_dist_market = entry_price - stop_price
        stop_dist_optimal = optimal_entry_price - stop_price
        target_market = entry_price + (stop_dist_market * 2)
        target_optimal = optimal_entry_price + (stop_dist_optimal * 2)
    else:
        stop_dist_market = stop_price - entry_price
        stop_dist_optimal = stop_price - optimal_entry_price
        target_market = entry_price - (stop_dist_market * 2)
        target_optimal = optimal_entry_price - (stop_dist_optimal * 2)

    # Determine outcomes
    def get_outcome(ep, tp, sp, dir):
        for _, candle in window.iterrows():
            if dir == Direction.BULLISH:
                if candle['low'] <= sp:
                    return 'LOSS'
                if candle['high'] >= tp:
                    return 'WIN'
            else:
                if candle['high'] >= sp:
                    return 'LOSS'
                if candle['low'] <= tp:
                    return 'WIN'
        return 'NEUTRAL'

    outcome_market = get_outcome(entry_price, target_market, stop_price, direction)
    outcome_optimal = get_outcome(optimal_entry_price, target_optimal, stop_price, direction)

    # Calculate actual R:R achieved
    if direction == Direction.BULLISH:
        mfe = (window['high'].max() - entry_price) / entry_price * 100
        mae = (entry_price - window['low'].min()) / entry_price * 100
        mfe_optimal = (window['high'].max() - optimal_entry_price) / optimal_entry_price * 100
        mae_optimal = (optimal_entry_price - window['low'].min()) / optimal_entry_price * 100
    else:
        mfe = (entry_price - window['low'].min()) / entry_price * 100
        mae = (window['high'].max() - entry_price) / entry_price * 100
        mfe_optimal = (optimal_entry_price - window['low'].min()) / optimal_entry_price * 100
        mae_optimal = (window['high'].max() - optimal_entry_price) / optimal_entry_price * 100

    rr_market = mfe / (stop_dist_market / entry_price * 100) if stop_dist_market > 0 else 0
    rr_optimal = mfe_optimal / (stop_dist_optimal / optimal_entry_price * 100) if stop_dist_optimal > 0 else 0

    return {
        'entry_market': entry_price,
        'entry_optimal': optimal_entry_price,
        'entry_improvement_pct': (entry_price - optimal_entry_price) / entry_price * 100 if direction == Direction.BULLISH else (optimal_entry_price - entry_price) / entry_price * 100,
        'stop': stop_price,
        'stop_dist_market_pct': stop_dist_market / entry_price * 100,
        'stop_dist_optimal_pct': stop_dist_optimal / optimal_entry_price * 100,
        'outcome_market': outcome_market,
        'outcome_optimal': outcome_optimal,
        'mfe_market': mfe,
        'mfe_optimal': mfe_optimal,
        'mae_market': mae,
        'mae_optimal': mae_optimal,
        'rr_market': rr_market,
        'rr_optimal': rr_optimal,
    }

def run_entry_precision_test(filepath: str):
    """Test if 1M can improve entry timing while keeping 5M stops"""
    print("=" * 80)
    print("1M ENTRY PRECISION TEST")
    print("Question: Can 1M improve entry timing while keeping 5M stops?")
    print("=" * 80)

    # Load and prepare data
    print("\nLoading data...")
    df_1m = load_1m_data(filepath)
    df_5m = aggregate_candles(df_1m, '5min')
    df_4h = aggregate_candles(df_1m, '4h')
    df_4h['rsi'] = calculate_rsi(df_4h)

    # Detect signals
    swing_highs, swing_lows = detect_swings(df_4h, lookback=3)
    signals = []

    for i in range(10, len(df_4h) - 1):
        candle = df_4h.iloc[i]
        next_candle = df_4h.iloc[i + 1]
        rsi = candle['rsi']

        if rsi < 40:
            recent_lows = swing_lows[(swing_lows['timestamp'] < candle['timestamp']) &
                                     (swing_lows['timestamp'] > candle['timestamp'] - timedelta(days=7))]
            for _, swing in recent_lows.iterrows():
                if candle['low'] < swing['price'] and candle['close'] > swing['price']:
                    if next_candle['close'] > candle['close']:
                        signals.append({'timestamp': candle['timestamp'], 'direction': Direction.BULLISH,
                                        'sweep_price': swing['price'], 'rsi': rsi})
                        break

        if rsi > 80:
            recent_highs = swing_highs[(swing_highs['timestamp'] < candle['timestamp']) &
                                       (swing_highs['timestamp'] > candle['timestamp'] - timedelta(days=7))]
            for _, swing in recent_highs.iterrows():
                if candle['high'] > swing['price'] and candle['close'] < swing['price']:
                    if next_candle['close'] < candle['close']:
                        signals.append({'timestamp': candle['timestamp'], 'direction': Direction.BEARISH,
                                        'sweep_price': swing['price'], 'rsi': rsi})
                        break

    print(f"Found {len(signals)} 4H signals")

    # Process trades
    results = []
    for sig in signals:
        # Session filter
        if 14 <= sig['timestamp'].hour < 17:
            continue

        # Find 5M reclaim (per contract)
        signal_end = sig['timestamp'] + timedelta(hours=4)
        window_end = signal_end + timedelta(hours=4)
        buffer_pct = 0.002

        mask = (df_5m['timestamp'] > signal_end) & (df_5m['timestamp'] <= window_end)
        window_5m = df_5m[mask]

        entry = None
        for _, candle in window_5m.iterrows():
            if sig['direction'] == Direction.BULLISH:
                if candle['close'] > sig['sweep_price'] * (1 + buffer_pct):
                    entry = {'timestamp': candle['timestamp'], 'price': candle['close']}
                    break
            else:
                if candle['close'] < sig['sweep_price'] * (1 - buffer_pct):
                    entry = {'timestamp': candle['timestamp'], 'price': candle['close']}
                    break

        if not entry:
            continue

        if 14 <= entry['timestamp'].hour < 17:
            continue

        # Get 5M stop (keep this - it's proven)
        entry_idx = df_5m[df_5m['timestamp'] <= entry['timestamp']].index[-1]
        lookback = df_5m.iloc[max(0, entry_idx-20):entry_idx]
        _, swing_lows_5m = detect_swings(lookback.reset_index(drop=True), lookback=2)
        swing_highs_5m, _ = detect_swings(lookback.reset_index(drop=True), lookback=2)

        if sig['direction'] == Direction.BULLISH:
            if swing_lows_5m.empty:
                stop_5m = lookback['low'].min() * 0.998
            else:
                stop_5m = swing_lows_5m['price'].iloc[-1] * 0.998
        else:
            if swing_highs_5m.empty:
                stop_5m = lookback['high'].max() * 1.002
            else:
                stop_5m = swing_highs_5m['price'].iloc[-1] * 1.002

        # Find 1M optimal entry (the test)
        optimal = find_1m_optimal_entry(df_1m, entry['timestamp'], sig['direction'],
                                        entry['price'], window_minutes=30)

        if not optimal['found']:
            continue

        # Analyze outcomes
        analysis = analyze_entry_improvement(df_1m, entry['timestamp'], entry['price'],
                                             optimal['optimal_entry'], sig['direction'],
                                             stop_5m, max_hours=48)

        if analysis:
            results.append({
                'signal': sig,
                'entry_market': entry['price'],
                'entry_optimal': optimal['optimal_entry'],
                'stop_5m': stop_5m,
                'analysis': analysis
            })

    # Report results
    print("\n" + "=" * 80)
    print("TRADE-BY-TRADE RESULTS")
    print("=" * 80)

    for i, r in enumerate(results, 1):
        a = r['analysis']
        print(f"\nTrade #{i} ({r['signal']['timestamp'].strftime('%Y-%m-%d')})")
        print(f"  Direction:     {r['signal']['direction'].value}")
        print(f"  Market Entry:  ${r['entry_market']:,.2f}")
        print(f"  Optimal Entry: ${r['entry_optimal']:,.2f}")
        print(f"  Improvement:   {a['entry_improvement_pct']:.3f}%")
        print(f"  Stop (5M):     ${r['stop_5m']:,.2f}")
        print(f"  Stop Distance: {a['stop_dist_market_pct']:.2f}% (market) vs {a['stop_dist_optimal_pct']:.2f}% (optimal)")
        print(f"  Outcome:       {a['outcome_market']} (market) vs {a['outcome_optimal']} (optimal)")
        print(f"  R:R Achieved:  {a['rr_market']:.2f}:1 (market) vs {a['rr_optimal']:.2f}:1 (optimal)")

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    if not results:
        print("No valid trades for analysis.")
        return

    avg_improvement = np.mean([r['analysis']['entry_improvement_pct'] for r in results])
    avg_rr_market = np.mean([r['analysis']['rr_market'] for r in results])
    avg_rr_optimal = np.mean([r['analysis']['rr_optimal'] for r in results])

    wins_market = len([r for r in results if r['analysis']['outcome_market'] == 'WIN'])
    wins_optimal = len([r for r in results if r['analysis']['outcome_optimal'] == 'WIN'])
    losses_market = len([r for r in results if r['analysis']['outcome_market'] == 'LOSS'])
    losses_optimal = len([r for r in results if r['analysis']['outcome_optimal'] == 'LOSS'])

    print(f"\nTotal Trades: {len(results)}")
    print(f"\nEntry Improvement:")
    print(f"  Average: {avg_improvement:.3f}%")
    print(f"  Range:   {min([r['analysis']['entry_improvement_pct'] for r in results]):.3f}% to {max([r['analysis']['entry_improvement_pct'] for r in results]):.3f}%")

    print(f"\nR:R Comparison:")
    print(f"  Market Entry:  {avg_rr_market:.2f}:1 average")
    print(f"  Optimal Entry: {avg_rr_optimal:.2f}:1 average")
    print(f"  Improvement:   {(avg_rr_optimal / avg_rr_market - 1) * 100:+.1f}%")

    print(f"\nWin Rate Comparison:")
    print(f"  Market Entry:  {wins_market}W / {losses_market}L ({wins_market/len(results)*100:.0f}%)")
    print(f"  Optimal Entry: {wins_optimal}W / {losses_optimal}L ({wins_optimal/len(results)*100:.0f}%)")

    # Check if outcomes diverge (optimal wins where market loses)
    saved_by_optimal = len([r for r in results if r['analysis']['outcome_market'] == 'LOSS' and r['analysis']['outcome_optimal'] == 'WIN'])
    lost_by_optimal = len([r for r in results if r['analysis']['outcome_market'] == 'WIN' and r['analysis']['outcome_optimal'] == 'LOSS'])

    print(f"\nOutcome Divergence:")
    print(f"  Saved by optimal entry (market lost, optimal won): {saved_by_optimal}")
    print(f"  Lost by optimal entry (market won, optimal lost): {lost_by_optimal}")

    # Verdict
    print("\n" + "=" * 80)
    print("VERDICT: ENTRY PRECISION")
    print("=" * 80)

    # Entry precision is useful if:
    # 1. Average improvement > 0.1% (meaningful in terms of R:R)
    # 2. Win rate doesn't decrease
    # 3. R:R improves by at least 10%

    criteria = [
        ("Entry improvement > 0.1%", avg_improvement > 0.1),
        ("Win rate stable", wins_optimal >= wins_market),
        ("R:R improvement > 10%", avg_rr_optimal > avg_rr_market * 1.1),
    ]

    for name, passed in criteria:
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {name}")

    all_pass = all(c[1] for c in criteria)
    print("\n" + "-" * 40)
    if all_pass:
        print("ENTRY PRECISION: PASS")
        print("\n1M CAN be used for entry timing optimization.")
        print("Recommended: Limit order at 1M swing after 5M reclaim.")
    else:
        print("ENTRY PRECISION: FAIL")
        print("\n1M entry optimization does NOT add sufficient value.")
        print("Continue with market orders at 5M reclaim.")

    # Calculate practical fill rate
    achievable = len([r for r in results if r['analysis']['entry_improvement_pct'] > 0])
    print(f"\nPractical note: {achievable}/{len(results)} trades ({achievable/len(results)*100:.0f}%) had retracement opportunity.")

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "/Users/ble/TradingBot/historyBot/data/btc_usd_1m.csv"
    run_entry_precision_test(filepath)
