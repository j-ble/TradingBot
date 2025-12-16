#!/usr/bin/env python3
"""
1M DETAILED ANALYSIS
Deep dive into stop efficiency and MFE/MAE timing
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
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df

def aggregate_candles(df_1m: pd.DataFrame, period: str) -> pd.DataFrame:
    df = df_1m.set_index('timestamp')
    agg_dict = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }
    df_agg = df.resample(period).agg(agg_dict).dropna()
    return df_agg.reset_index()

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(span=period, adjust=False).mean()
    avg_loss = loss.ewm(span=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def detect_swings(df: pd.DataFrame, lookback: int = 3) -> Tuple[pd.DataFrame, pd.DataFrame]:
    swing_highs = []
    swing_lows = []

    for i in range(lookback, len(df) - lookback):
        is_swing_high = True
        for j in range(1, lookback + 1):
            if df.iloc[i]['high'] <= df.iloc[i-j]['high'] or df.iloc[i]['high'] <= df.iloc[i+j]['high']:
                is_swing_high = False
                break
        if is_swing_high:
            swing_highs.append({'timestamp': df.iloc[i]['timestamp'], 'price': df.iloc[i]['high'], 'index': i})

        is_swing_low = True
        for j in range(1, lookback + 1):
            if df.iloc[i]['low'] >= df.iloc[i-j]['low'] or df.iloc[i]['low'] >= df.iloc[i+j]['low']:
                is_swing_low = False
                break
        if is_swing_low:
            swing_lows.append({'timestamp': df.iloc[i]['timestamp'], 'price': df.iloc[i]['low'], 'index': i})

    return pd.DataFrame(swing_highs), pd.DataFrame(swing_lows)

def analyze_trade_sequence(df_1m: pd.DataFrame, entry_time: datetime, entry_price: float,
                           direction: Direction, stop_5m: float, stop_1m: float,
                           max_hours: int = 48) -> Dict:
    """
    Analyze the exact sequence of events for a trade:
    - When does price first hit 5M stop?
    - When does price first hit 1M stop?
    - When does price first hit target (2:1)?
    - Which happens first?
    """
    window_end = entry_time + timedelta(hours=max_hours)
    mask = (df_1m['timestamp'] > entry_time) & (df_1m['timestamp'] <= window_end)
    window = df_1m[mask].copy()

    if window.empty:
        return {'error': 'No data in window'}

    # Calculate targets (2:1 R:R)
    if direction == Direction.BULLISH:
        stop_5m_dist = entry_price - stop_5m
        stop_1m_dist = entry_price - stop_1m
        target_5m = entry_price + (stop_5m_dist * 2)
        target_1m = entry_price + (stop_1m_dist * 2)
    else:
        stop_5m_dist = stop_5m - entry_price
        stop_1m_dist = stop_1m - entry_price
        target_5m = entry_price - (stop_5m_dist * 2)
        target_1m = entry_price - (stop_1m_dist * 2)

    # Track events
    events = []

    for _, candle in window.iterrows():
        if direction == Direction.BULLISH:
            # Check stop hits (low touches stop)
            if candle['low'] <= stop_1m:
                events.append({'time': candle['timestamp'], 'event': 'STOP_1M', 'price': candle['low']})
            if candle['low'] <= stop_5m:
                events.append({'time': candle['timestamp'], 'event': 'STOP_5M', 'price': candle['low']})
            # Check target hits (high touches target)
            if candle['high'] >= target_1m:
                events.append({'time': candle['timestamp'], 'event': 'TARGET_1M', 'price': candle['high']})
            if candle['high'] >= target_5m:
                events.append({'time': candle['timestamp'], 'event': 'TARGET_5M', 'price': candle['high']})
        else:  # BEARISH
            # Check stop hits (high touches stop)
            if candle['high'] >= stop_1m:
                events.append({'time': candle['timestamp'], 'event': 'STOP_1M', 'price': candle['high']})
            if candle['high'] >= stop_5m:
                events.append({'time': candle['timestamp'], 'event': 'STOP_5M', 'price': candle['high']})
            # Check target hits (low touches target)
            if candle['low'] <= target_1m:
                events.append({'time': candle['timestamp'], 'event': 'TARGET_1M', 'price': candle['low']})
            if candle['low'] <= target_5m:
                events.append({'time': candle['timestamp'], 'event': 'TARGET_5M', 'price': candle['low']})

    # Get first occurrence of each event type
    first_events = {}
    for event in events:
        if event['event'] not in first_events:
            first_events[event['event']] = event

    # Determine outcome for each stop level
    def get_outcome(stop_event_key, target_event_key):
        stop_event = first_events.get(stop_event_key)
        target_event = first_events.get(target_event_key)

        if stop_event and target_event:
            if stop_event['time'] < target_event['time']:
                return 'LOSS', stop_event['time'], (stop_event['time'] - entry_time).total_seconds() / 60
            else:
                return 'WIN', target_event['time'], (target_event['time'] - entry_time).total_seconds() / 60
        elif stop_event:
            return 'LOSS', stop_event['time'], (stop_event['time'] - entry_time).total_seconds() / 60
        elif target_event:
            return 'WIN', target_event['time'], (target_event['time'] - entry_time).total_seconds() / 60
        else:
            return 'NEUTRAL', None, None

    outcome_5m, time_5m, mins_5m = get_outcome('STOP_5M', 'TARGET_5M')
    outcome_1m, time_1m, mins_1m = get_outcome('STOP_1M', 'TARGET_1M')

    # Calculate MFE/MAE
    if direction == Direction.BULLISH:
        mfe = (window['high'].max() - entry_price) / entry_price * 100
        mae = (entry_price - window['low'].min()) / entry_price * 100
    else:
        mfe = (entry_price - window['low'].min()) / entry_price * 100
        mae = (window['high'].max() - entry_price) / entry_price * 100

    return {
        'entry_price': entry_price,
        'stop_5m': stop_5m,
        'stop_1m': stop_1m,
        'stop_5m_dist_pct': abs(entry_price - stop_5m) / entry_price * 100,
        'stop_1m_dist_pct': abs(entry_price - stop_1m) / entry_price * 100,
        'target_5m': target_5m,
        'target_1m': target_1m,
        'outcome_5m': outcome_5m,
        'outcome_1m': outcome_1m,
        'time_to_resolution_5m': mins_5m,
        'time_to_resolution_1m': mins_1m,
        'mfe': mfe,
        'mae': mae,
        'first_events': first_events
    }

def run_detailed_analysis(filepath: str):
    """Run detailed trade-by-trade analysis"""
    print("=" * 80)
    print("1M DETAILED TRADE ANALYSIS")
    print("=" * 80)

    # Load data
    print("\nLoading data...")
    df_1m = load_1m_data(filepath)
    df_5m = aggregate_candles(df_1m, '5min')
    df_4h = aggregate_candles(df_1m, '4h')
    df_4h['rsi'] = calculate_rsi(df_4h)

    print(f"1M candles: {len(df_1m):,}")
    print(f"5M candles: {len(df_5m):,}")
    print(f"4H candles: {len(df_4h):,}")

    # Detect 4H signals with RSI
    swing_highs, swing_lows = detect_swings(df_4h, lookback=3)

    print(f"\n4H Swing Highs: {len(swing_highs)}")
    print(f"4H Swing Lows: {len(swing_lows)}")

    # Find signals
    signals = []
    for i in range(10, len(df_4h) - 1):
        candle = df_4h.iloc[i]
        next_candle = df_4h.iloc[i + 1]
        rsi = candle['rsi']

        # BULLISH: LOW sweep with RSI < 40
        if rsi < 40:
            recent_lows = swing_lows[
                (swing_lows['timestamp'] < candle['timestamp']) &
                (swing_lows['timestamp'] > candle['timestamp'] - timedelta(days=7))
            ]
            for _, swing in recent_lows.iterrows():
                if candle['low'] < swing['price'] and candle['close'] > swing['price']:
                    if next_candle['close'] > candle['close']:
                        signals.append({
                            'timestamp': candle['timestamp'],
                            'direction': Direction.BULLISH,
                            'sweep_price': swing['price'],
                            'rsi': rsi,
                            'close': candle['close'],
                            'next_close': next_candle['close']
                        })
                        break

        # BEARISH: HIGH sweep with RSI > 80
        if rsi > 80:
            recent_highs = swing_highs[
                (swing_highs['timestamp'] < candle['timestamp']) &
                (swing_highs['timestamp'] > candle['timestamp'] - timedelta(days=7))
            ]
            for _, swing in recent_highs.iterrows():
                if candle['high'] > swing['price'] and candle['close'] < swing['price']:
                    if next_candle['close'] < candle['close']:
                        signals.append({
                            'timestamp': candle['timestamp'],
                            'direction': Direction.BEARISH,
                            'sweep_price': swing['price'],
                            'rsi': rsi,
                            'close': candle['close'],
                            'next_close': next_candle['close']
                        })
                        break

    print(f"\n4H Signals Found: {len(signals)}")

    # Process each signal with full detail
    print("\n" + "=" * 80)
    print("TRADE-BY-TRADE ANALYSIS")
    print("=" * 80)

    results = []
    for i, sig in enumerate(signals, 1):
        print(f"\n{'─' * 80}")
        print(f"TRADE #{i}")
        print(f"{'─' * 80}")
        print(f"Signal Time: {sig['timestamp']}")
        print(f"Direction:   {sig['direction'].value}")
        print(f"RSI:         {sig['rsi']:.1f}")
        print(f"Sweep Price: ${sig['sweep_price']:,.2f}")

        # Skip NY_OPEN (14:00-17:00 UTC)
        hour = sig['timestamp'].hour
        if 14 <= hour < 17:
            print(f"[BLOCKED] NY_OPEN session - SKIPPED")
            continue

        # Find 5M reclaim
        signal_end = sig['timestamp'] + timedelta(hours=4)  # After confirmation candle
        window_end = signal_end + timedelta(hours=4)
        buffer_pct = 0.002

        mask = (df_5m['timestamp'] > signal_end) & (df_5m['timestamp'] <= window_end)
        window_5m = df_5m[mask]

        entry = None
        for _, candle in window_5m.iterrows():
            if sig['direction'] == Direction.BULLISH:
                reclaim_level = sig['sweep_price'] * (1 + buffer_pct)
                if candle['close'] > reclaim_level:
                    entry = {'timestamp': candle['timestamp'], 'price': candle['close']}
                    break
            else:
                reclaim_level = sig['sweep_price'] * (1 - buffer_pct)
                if candle['close'] < reclaim_level:
                    entry = {'timestamp': candle['timestamp'], 'price': candle['close']}
                    break

        if not entry:
            print(f"[SKIPPED] No 5M reclaim within 4 hours")
            continue

        # Check entry time session
        entry_hour = entry['timestamp'].hour
        if 14 <= entry_hour < 17:
            print(f"[BLOCKED] Entry during NY_OPEN - SKIPPED")
            continue

        print(f"Entry Time:  {entry['timestamp']}")
        print(f"Entry Price: ${entry['price']:,.2f}")
        latency = (entry['timestamp'] - signal_end).total_seconds() / 60
        print(f"Latency:     {latency:.0f} minutes")

        # Find stops
        # 5M stop - from 5M swing
        entry_idx_5m = df_5m[df_5m['timestamp'] <= entry['timestamp']].index[-1]
        lookback_5m = df_5m.iloc[max(0, entry_idx_5m-20):entry_idx_5m]
        swing_h_5m, swing_l_5m = detect_swings(lookback_5m.reset_index(drop=True), lookback=2)

        # 1M stop - from 1M swing
        entry_idx_1m = df_1m[df_1m['timestamp'] <= entry['timestamp']].index[-1]
        lookback_1m = df_1m.iloc[max(0, entry_idx_1m-60):entry_idx_1m]
        swing_h_1m, swing_l_1m = detect_swings(lookback_1m.reset_index(drop=True), lookback=2)

        if sig['direction'] == Direction.BULLISH:
            if swing_l_5m.empty:
                stop_5m = lookback_5m['low'].min() * 0.998
            else:
                stop_5m = swing_l_5m['price'].iloc[-1] * 0.998

            if swing_l_1m.empty:
                print(f"[SKIPPED] No 1M swing low found")
                continue
            valid_1m = swing_l_1m[swing_l_1m['price'] < entry['price']]
            if valid_1m.empty:
                print(f"[SKIPPED] No valid 1M swing below entry")
                continue
            stop_1m = valid_1m['price'].iloc[-1] * 0.999
        else:
            if swing_h_5m.empty:
                stop_5m = lookback_5m['high'].max() * 1.002
            else:
                stop_5m = swing_h_5m['price'].iloc[-1] * 1.002

            if swing_h_1m.empty:
                print(f"[SKIPPED] No 1M swing high found")
                continue
            valid_1m = swing_h_1m[swing_h_1m['price'] > entry['price']]
            if valid_1m.empty:
                print(f"[SKIPPED] No valid 1M swing above entry")
                continue
            stop_1m = valid_1m['price'].iloc[-1] * 1.001

        print(f"\n5M Stop:     ${stop_5m:,.2f} ({abs(entry['price'] - stop_5m) / entry['price'] * 100:.2f}%)")
        print(f"1M Stop:     ${stop_1m:,.2f} ({abs(entry['price'] - stop_1m) / entry['price'] * 100:.2f}%)")
        print(f"Stop Reduction: {(1 - abs(entry['price'] - stop_1m) / abs(entry['price'] - stop_5m)) * 100:.0f}%")

        # Analyze trade sequence
        analysis = analyze_trade_sequence(df_1m, entry['timestamp'], entry['price'],
                                          sig['direction'], stop_5m, stop_1m, max_hours=48)

        print(f"\nMFE:         {analysis['mfe']:.2f}%")
        print(f"MAE:         {analysis['mae']:.2f}%")
        print(f"MFE/MAE:     {analysis['mfe'] / analysis['mae'] if analysis['mae'] > 0 else 'inf':.2f}x")

        print(f"\n5M Outcome:  {analysis['outcome_5m']}")
        if analysis['time_to_resolution_5m']:
            print(f"  Time to resolution: {analysis['time_to_resolution_5m']:.0f} minutes")

        print(f"1M Outcome:  {analysis['outcome_1m']}")
        if analysis['time_to_resolution_1m']:
            print(f"  Time to resolution: {analysis['time_to_resolution_1m']:.0f} minutes")

        # Key insight
        if analysis['outcome_5m'] == 'WIN' and analysis['outcome_1m'] == 'LOSS':
            print(f"\n⚠️  1M STOP WAS TOO TIGHT - Lost a winning trade!")
        elif analysis['outcome_5m'] == 'LOSS' and analysis['outcome_1m'] == 'WIN':
            print(f"\n✓  1M STOP SAVED A LOSING TRADE")
        elif analysis['outcome_5m'] == 'WIN' and analysis['outcome_1m'] == 'WIN':
            print(f"\n✓  Both stops led to WIN - 1M is more efficient")
        elif analysis['outcome_5m'] == 'LOSS' and analysis['outcome_1m'] == 'LOSS':
            print(f"\n✗  Both stops led to LOSS - trade was wrong")

        results.append({
            'signal': sig,
            'entry': entry,
            'stop_5m': stop_5m,
            'stop_1m': stop_1m,
            'analysis': analysis
        })

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)

    if not results:
        print("No valid trades to analyze.")
        return

    wins_5m = len([r for r in results if r['analysis']['outcome_5m'] == 'WIN'])
    wins_1m = len([r for r in results if r['analysis']['outcome_1m'] == 'WIN'])
    losses_5m = len([r for r in results if r['analysis']['outcome_5m'] == 'LOSS'])
    losses_1m = len([r for r in results if r['analysis']['outcome_1m'] == 'LOSS'])

    print(f"\nTotal Trades: {len(results)}")
    print(f"\n5M Stop Results: {wins_5m}W / {losses_5m}L ({wins_5m/len(results)*100:.0f}% WR)")
    print(f"1M Stop Results: {wins_1m}W / {losses_1m}L ({wins_1m/len(results)*100:.0f}% WR)")

    saved_by_1m = len([r for r in results
                       if r['analysis']['outcome_5m'] == 'LOSS' and r['analysis']['outcome_1m'] == 'WIN'])
    lost_by_1m = len([r for r in results
                      if r['analysis']['outcome_5m'] == 'WIN' and r['analysis']['outcome_1m'] == 'LOSS'])

    print(f"\nTrades SAVED by 1M (would've lost with 5M): {saved_by_1m}")
    print(f"Trades LOST by 1M (would've won with 5M):   {lost_by_1m}")
    print(f"Net Impact: {saved_by_1m - lost_by_1m:+d} trades")

    avg_stop_5m = np.mean([abs(r['entry']['price'] - r['stop_5m']) / r['entry']['price'] * 100 for r in results])
    avg_stop_1m = np.mean([abs(r['entry']['price'] - r['stop_1m']) / r['entry']['price'] * 100 for r in results])
    reduction = (avg_stop_5m - avg_stop_1m) / avg_stop_5m * 100

    print(f"\nAvg 5M Stop: {avg_stop_5m:.2f}%")
    print(f"Avg 1M Stop: {avg_stop_1m:.2f}%")
    print(f"Stop Reduction: {reduction:.0f}%")

    # Final verdict
    print("\n" + "=" * 80)
    print("VERDICT")
    print("=" * 80)

    wr_delta = (wins_1m/len(results)*100) - (wins_5m/len(results)*100)
    net_impact = saved_by_1m - lost_by_1m

    pass_criteria = [
        ("Stop reduction > 15%", reduction > 15),
        ("Win rate degradation < 5%", wr_delta >= -5),
        ("Net trades saved >= 0", net_impact >= 0),
    ]

    all_pass = True
    for name, passed in pass_criteria:
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {name}")
        if not passed:
            all_pass = False

    print("\n" + "-" * 40)
    if all_pass:
        print("OVERALL: PASS")
        print("1M refinement adds value.")
    else:
        print("OVERALL: FAIL")
        print("1M refinement does NOT add sufficient value.")
        print("Continue using 5M stops.")

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "/Users/ble/TradingBot/historyBot/data/btc_usd_1m.csv"
    run_detailed_analysis(filepath)
