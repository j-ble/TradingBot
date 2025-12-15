"""
5M Execution Detailed Analysis
===============================
Deep dive into entry quality, false confirmation patterns, and MAE distribution
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Optional, Tuple
from enum import Enum

class Bias(Enum):
    NONE = 0
    BULLISH = 1
    BEARISH = -1

class ConfirmationType(Enum):
    BREAK_RETEST = "Break & Retest"
    MOMENTUM_SHIFT = "Momentum Shift"
    RECLAIM_LEVEL = "Reclaim Level"
    RSI_RECOVERY = "RSI Recovery"

@dataclass
class BiasSignal:
    timestamp: datetime
    bias: Bias
    sweep_price: float
    rsi_at_sweep: float
    swing_level: float

@dataclass
class Entry:
    timestamp: datetime
    bias: Bias
    confirmation_type: ConfirmationType
    entry_price: float
    bias_signal_time: datetime
    latency_minutes: int
    mfe: float
    mae: float
    outcome: str
    hold_time_minutes: int
    # New detailed metrics
    time_to_mfe: int  # Minutes to reach MFE
    time_to_mae: int  # Minutes to reach MAE
    mfe_first: bool  # Did MFE happen before MAE?
    drawdown_before_profit: float  # Max drawdown before first profit

def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def aggregate_to_4h(df_5m: pd.DataFrame) -> pd.DataFrame:
    df = df_5m.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)
    df_4h = df.resample('4h').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }).dropna()
    df_4h['rsi'] = calculate_rsi(df_4h['close'], 14)
    return df_4h.reset_index()

def detect_swing_levels(df: pd.DataFrame, lookback: int = 5) -> pd.DataFrame:
    df = df.copy()
    df['swing_high'] = np.nan
    df['swing_low'] = np.nan
    for i in range(2, len(df) - 2):
        if df.iloc[i]['high'] > df.iloc[i-1]['high'] and \
           df.iloc[i]['high'] > df.iloc[i-2]['high'] and \
           df.iloc[i]['high'] > df.iloc[i+1]['high'] and \
           df.iloc[i]['high'] > df.iloc[i+2]['high']:
            df.loc[df.index[i], 'swing_high'] = df.iloc[i]['high']
        if df.iloc[i]['low'] < df.iloc[i-1]['low'] and \
           df.iloc[i]['low'] < df.iloc[i-2]['low'] and \
           df.iloc[i]['low'] < df.iloc[i+1]['low'] and \
           df.iloc[i]['low'] < df.iloc[i+2]['low']:
            df.loc[df.index[i], 'swing_low'] = df.iloc[i]['low']
    return df

def get_recent_swing(df: pd.DataFrame, idx: int, swing_type: str, lookback: int = 20) -> Optional[float]:
    col = 'swing_high' if swing_type == 'high' else 'swing_low'
    start_idx = max(0, idx - lookback)
    swings = df.iloc[start_idx:idx][col].dropna()
    if len(swings) > 0:
        return swings.iloc[-1]
    return None

def detect_4h_bias_signals(df_4h: pd.DataFrame) -> List[BiasSignal]:
    df = detect_swing_levels(df_4h)
    signals = []
    for i in range(20, len(df) - 1):
        candle = df.iloc[i]
        next_candle = df.iloc[i + 1]
        rsi = candle['rsi']
        if pd.isna(rsi):
            continue
        recent_swing_low = get_recent_swing(df, i, 'low', lookback=20)
        if recent_swing_low is not None:
            if candle['low'] < recent_swing_low and candle['close'] > recent_swing_low:
                if rsi < 40:
                    if next_candle['close'] > candle['close']:
                        signals.append(BiasSignal(
                            timestamp=next_candle['timestamp'],
                            bias=Bias.BULLISH,
                            sweep_price=candle['low'],
                            rsi_at_sweep=rsi,
                            swing_level=recent_swing_low
                        ))
        recent_swing_high = get_recent_swing(df, i, 'high', lookback=20)
        if recent_swing_high is not None:
            if candle['high'] > recent_swing_high and candle['close'] < recent_swing_high:
                if rsi > 80:
                    if next_candle['close'] < candle['close']:
                        signals.append(BiasSignal(
                            timestamp=next_candle['timestamp'],
                            bias=Bias.BEARISH,
                            sweep_price=candle['high'],
                            rsi_at_sweep=rsi,
                            swing_level=recent_swing_high
                        ))
    return signals

def calculate_detailed_mfe_mae(df_5m: pd.DataFrame, entry_time: datetime, entry_price: float,
                                bias: Bias, hold_hours: int = 24) -> dict:
    """Calculate detailed MFE/MAE with timing information"""
    end_time = entry_time + timedelta(hours=hold_hours)
    mask = (df_5m['timestamp'] > entry_time) & (df_5m['timestamp'] <= end_time)
    future = df_5m[mask].reset_index(drop=True)

    if len(future) < 5:
        return None

    # Track running MFE and MAE
    running_mfe = 0
    running_mae = 0
    time_to_mfe = 0
    time_to_mae = 0
    mfe_first = None
    drawdown_before_profit = 0
    first_profit_time = None

    for i, row in future.iterrows():
        if bias == Bias.BULLISH:
            excursion_favorable = ((row['high'] - entry_price) / entry_price) * 100
            excursion_adverse = ((entry_price - row['low']) / entry_price) * 100
        else:
            excursion_favorable = ((entry_price - row['low']) / entry_price) * 100
            excursion_adverse = ((row['high'] - entry_price) / entry_price) * 100

        if excursion_favorable > running_mfe:
            running_mfe = excursion_favorable
            time_to_mfe = (i + 1) * 5  # Minutes
            if mfe_first is None and excursion_favorable > 0.1:
                mfe_first = True

        if excursion_adverse > running_mae:
            running_mae = excursion_adverse
            time_to_mae = (i + 1) * 5
            if mfe_first is None and excursion_adverse > 0.1:
                mfe_first = False

        # Track drawdown before first meaningful profit
        if first_profit_time is None:
            if excursion_favorable > 0.3:  # 0.3% profit threshold
                first_profit_time = (i + 1) * 5
            else:
                drawdown_before_profit = max(drawdown_before_profit, excursion_adverse)

    # Determine outcome
    if running_mfe > running_mae * 1.5:
        outcome = 'WIN'
    elif running_mae > running_mfe * 1.5:
        outcome = 'LOSS'
    else:
        outcome = 'BREAKEVEN'

    return {
        'mfe': max(0, running_mfe),
        'mae': max(0, running_mae),
        'time_to_mfe': time_to_mfe,
        'time_to_mae': time_to_mae,
        'mfe_first': mfe_first if mfe_first is not None else True,
        'drawdown_before_profit': drawdown_before_profit,
        'outcome': outcome,
        'hold_time': len(future) * 5
    }

def find_5m_confirmations_detailed(df_5m: pd.DataFrame, bias_signal: BiasSignal,
                                    max_wait_hours: int = 12) -> List[dict]:
    confirmations = []
    start_time = bias_signal.timestamp
    end_time = start_time + timedelta(hours=max_wait_hours)
    mask = (df_5m['timestamp'] >= start_time) & (df_5m['timestamp'] <= end_time)
    window = df_5m[mask].copy()

    if len(window) < 20:
        return confirmations

    window['rsi'] = calculate_rsi(window['close'], 14)
    window = window.reset_index(drop=True)
    found = set()

    for i in range(14, len(window) - 1):
        candle = window.iloc[i]
        prev_candle = window.iloc[i - 1]
        rsi = candle['rsi']
        prev_rsi = prev_candle['rsi'] if not pd.isna(prev_candle['rsi']) else 50

        if pd.isna(rsi):
            continue

        recent_high = window.iloc[max(0, i-10):i]['high'].max()
        recent_low = window.iloc[max(0, i-10):i]['low'].min()

        if bias_signal.bias == Bias.BULLISH:
            if 'BREAK_RETEST' not in found:
                if candle['high'] > recent_high:
                    for j in range(i + 1, min(i + 6, len(window))):
                        retest = window.iloc[j]
                        if retest['low'] <= recent_high * 1.001 and retest['close'] > recent_high:
                            confirmations.append({
                                'type': ConfirmationType.BREAK_RETEST,
                                'idx': j,
                                'price': retest['close'],
                                'timestamp': retest['timestamp'] if 'timestamp' in retest else window.iloc[j]['timestamp']
                            })
                            found.add('BREAK_RETEST')
                            break

            if 'MOMENTUM_SHIFT' not in found:
                if prev_rsi < 50 and rsi >= 50:
                    confirmations.append({
                        'type': ConfirmationType.MOMENTUM_SHIFT,
                        'idx': i,
                        'price': candle['close'],
                        'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                    })
                    found.add('MOMENTUM_SHIFT')

            if 'RECLAIM_LEVEL' not in found:
                if candle['close'] > bias_signal.swing_level * 1.002:
                    confirmations.append({
                        'type': ConfirmationType.RECLAIM_LEVEL,
                        'idx': i,
                        'price': candle['close'],
                        'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                    })
                    found.add('RECLAIM_LEVEL')

            if 'RSI_RECOVERY' not in found:
                recent_rsis = window.iloc[max(0, i-10):i]['rsi']
                if len(recent_rsis.dropna()) > 0 and recent_rsis.min() < 30:
                    if rsi > 40:
                        confirmations.append({
                            'type': ConfirmationType.RSI_RECOVERY,
                            'idx': i,
                            'price': candle['close'],
                            'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                        })
                        found.add('RSI_RECOVERY')

        elif bias_signal.bias == Bias.BEARISH:
            if 'BREAK_RETEST' not in found:
                if candle['low'] < recent_low:
                    for j in range(i + 1, min(i + 6, len(window))):
                        retest = window.iloc[j]
                        if retest['high'] >= recent_low * 0.999 and retest['close'] < recent_low:
                            confirmations.append({
                                'type': ConfirmationType.BREAK_RETEST,
                                'idx': j,
                                'price': retest['close'],
                                'timestamp': retest['timestamp'] if 'timestamp' in retest else window.iloc[j]['timestamp']
                            })
                            found.add('BREAK_RETEST')
                            break

            if 'MOMENTUM_SHIFT' not in found:
                if prev_rsi > 50 and rsi <= 50:
                    confirmations.append({
                        'type': ConfirmationType.MOMENTUM_SHIFT,
                        'idx': i,
                        'price': candle['close'],
                        'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                    })
                    found.add('MOMENTUM_SHIFT')

            if 'RECLAIM_LEVEL' not in found:
                if candle['close'] < bias_signal.swing_level * 0.998:
                    confirmations.append({
                        'type': ConfirmationType.RECLAIM_LEVEL,
                        'idx': i,
                        'price': candle['close'],
                        'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                    })
                    found.add('RECLAIM_LEVEL')

            if 'RSI_RECOVERY' not in found:
                recent_rsis = window.iloc[max(0, i-10):i]['rsi']
                if len(recent_rsis.dropna()) > 0 and recent_rsis.max() > 70:
                    if rsi < 60:
                        confirmations.append({
                            'type': ConfirmationType.RSI_RECOVERY,
                            'idx': i,
                            'price': candle['close'],
                            'timestamp': candle['timestamp'] if 'timestamp' in candle else window.iloc[i]['timestamp']
                        })
                        found.add('RSI_RECOVERY')

        if len(found) == 4:
            break

    return confirmations

def run_detailed_analysis(csv_path: str):
    print("="*70)
    print("5M EXECUTION - DETAILED ANALYSIS")
    print("="*70)

    # Load data
    df_5m = pd.read_csv(csv_path)
    df_5m['timestamp'] = pd.to_datetime(df_5m['timestamp'])

    df_4h = aggregate_to_4h(df_5m)
    bias_signals = detect_4h_bias_signals(df_4h)

    print(f"\n4H Bias Signals: {len(bias_signals)}")
    print(f"  BULLISH: {sum(1 for s in bias_signals if s.bias == Bias.BULLISH)}")
    print(f"  BEARISH: {sum(1 for s in bias_signals if s.bias == Bias.BEARISH)}")

    # Collect all entries with detailed metrics
    all_entries = []
    entries_by_type = {ct: [] for ct in ConfirmationType}

    for signal in bias_signals:
        confirmations = find_5m_confirmations_detailed(df_5m, signal, max_wait_hours=12)

        for conf in confirmations:
            entry_time = conf['timestamp']
            if isinstance(entry_time, str):
                entry_time = pd.to_datetime(entry_time)

            latency_minutes = int((entry_time - signal.timestamp).total_seconds() / 60)

            metrics = calculate_detailed_mfe_mae(
                df_5m, entry_time, conf['price'], signal.bias, hold_hours=24
            )

            if metrics is None:
                continue

            entry = {
                'timestamp': entry_time,
                'bias': signal.bias,
                'type': conf['type'],
                'entry_price': conf['price'],
                'latency_min': latency_minutes,
                **metrics
            }

            all_entries.append(entry)
            entries_by_type[conf['type']].append(entry)

    # Analysis 1: MAE Distribution (Critical for execution quality)
    print("\n" + "="*70)
    print("MAE DISTRIBUTION ANALYSIS")
    print("="*70)
    print("\nQuestion: How much heat do we take before profit?")

    mae_buckets = {
        '0-0.25%': 0,
        '0.25-0.5%': 0,
        '0.5-1%': 0,
        '1-2%': 0,
        '2%+': 0
    }

    for entry in all_entries:
        mae = entry['mae']
        if mae < 0.25:
            mae_buckets['0-0.25%'] += 1
        elif mae < 0.5:
            mae_buckets['0.25-0.5%'] += 1
        elif mae < 1:
            mae_buckets['0.5-1%'] += 1
        elif mae < 2:
            mae_buckets['1-2%'] += 1
        else:
            mae_buckets['2%+'] += 1

    total = len(all_entries)
    print("\nMAE Distribution (all entries):")
    for bucket, count in mae_buckets.items():
        pct = count / total * 100 if total > 0 else 0
        bar = '█' * int(pct / 2)
        print(f"  {bucket:10} | {count:3} | {pct:5.1f}% | {bar}")

    # Analysis 2: MFE First vs MAE First
    print("\n" + "="*70)
    print("EXCURSION SEQUENCE ANALYSIS")
    print("="*70)
    print("\nQuestion: Does price move in our favor BEFORE going against us?")

    mfe_first_count = sum(1 for e in all_entries if e['mfe_first'])
    mae_first_count = total - mfe_first_count

    print(f"\n  MFE First (favorable move first): {mfe_first_count} ({mfe_first_count/total*100:.1f}%)")
    print(f"  MAE First (adverse move first):   {mae_first_count} ({mae_first_count/total*100:.1f}%)")

    # MFE first by confirmation type
    print("\nBy Confirmation Type:")
    for ct in ConfirmationType:
        entries = entries_by_type[ct]
        if len(entries) > 0:
            mfe_first = sum(1 for e in entries if e['mfe_first'])
            print(f"  {ct.value:20} | MFE First: {mfe_first}/{len(entries)} ({mfe_first/len(entries)*100:.1f}%)")

    # Analysis 3: Drawdown Before Profit
    print("\n" + "="*70)
    print("DRAWDOWN BEFORE PROFIT")
    print("="*70)
    print("\nQuestion: How much pain before gain?")

    drawdowns = [e['drawdown_before_profit'] for e in all_entries]
    print(f"\n  Avg Drawdown Before Profit: {np.mean(drawdowns):.2f}%")
    print(f"  Max Drawdown Before Profit: {np.max(drawdowns):.2f}%")
    print(f"  Entries with <0.5% drawdown before profit: {sum(1 for d in drawdowns if d < 0.5)}/{total}")

    # Analysis 4: Time to MFE vs Time to MAE
    print("\n" + "="*70)
    print("TIMING ANALYSIS")
    print("="*70)
    print("\nQuestion: How quickly do we reach MFE vs MAE?")

    time_to_mfe = [e['time_to_mfe'] for e in all_entries if e['time_to_mfe'] > 0]
    time_to_mae = [e['time_to_mae'] for e in all_entries if e['time_to_mae'] > 0]

    print(f"\n  Avg Time to MFE: {np.mean(time_to_mfe):.0f} min ({np.mean(time_to_mfe)/60:.1f} hrs)")
    print(f"  Avg Time to MAE: {np.mean(time_to_mae):.0f} min ({np.mean(time_to_mae)/60:.1f} hrs)")

    # Analysis 5: False Confirmation Deep Dive
    print("\n" + "="*70)
    print("FALSE CONFIRMATION ANALYSIS")
    print("="*70)
    print("\nFalse confirmation: MAE > MFE * 1.2")

    false_confirms = [e for e in all_entries if e['mae'] > e['mfe'] * 1.2]
    clean_confirms = [e for e in all_entries if e['mfe'] > e['mae'] * 1.2]

    print(f"\n  False Confirmations: {len(false_confirms)}/{total} ({len(false_confirms)/total*100:.1f}%)")
    print(f"  Clean Confirmations: {len(clean_confirms)}/{total} ({len(clean_confirms)/total*100:.1f}%)")

    # Characteristics of false confirmations
    if len(false_confirms) > 0:
        print("\n  False Confirmation Characteristics:")
        avg_latency_false = np.mean([e['latency_min'] for e in false_confirms])
        avg_latency_clean = np.mean([e['latency_min'] for e in clean_confirms]) if clean_confirms else 0
        print(f"    Avg Latency (False): {avg_latency_false:.0f} min")
        print(f"    Avg Latency (Clean): {avg_latency_clean:.0f} min")

        # By type
        print("\n  False Confirms by Type:")
        for ct in ConfirmationType:
            false_of_type = [e for e in false_confirms if e['type'] == ct]
            total_of_type = len(entries_by_type[ct])
            if total_of_type > 0:
                print(f"    {ct.value:20}: {len(false_of_type)}/{total_of_type} ({len(false_of_type)/total_of_type*100:.1f}%)")

    # Analysis 6: Best Confirmation Method Deep Dive
    print("\n" + "="*70)
    print("CONFIRMATION METHOD COMPARISON")
    print("="*70)

    for ct in ConfirmationType:
        entries = entries_by_type[ct]
        if len(entries) == 0:
            continue

        mfes = [e['mfe'] for e in entries]
        maes = [e['mae'] for e in entries]
        latencies = [e['latency_min'] for e in entries]
        drawdowns = [e['drawdown_before_profit'] for e in entries]
        mfe_first_pct = sum(1 for e in entries if e['mfe_first']) / len(entries) * 100

        print(f"\n{ct.value}")
        print("-" * 40)
        print(f"  Count:               {len(entries)}")
        print(f"  Avg MFE:             {np.mean(mfes):.2f}%")
        print(f"  Avg MAE:             {np.mean(maes):.2f}%")
        print(f"  MFE/MAE Ratio:       {np.mean(mfes)/np.mean(maes):.2f}x")
        print(f"  Avg Latency:         {np.mean(latencies):.0f} min")
        print(f"  MFE First Rate:      {mfe_first_pct:.1f}%")
        print(f"  Avg Drawdown First:  {np.mean(drawdowns):.2f}%")

    # Final Verdict
    print("\n" + "="*70)
    print("EXECUTION QUALITY VERDICT")
    print("="*70)

    # Calculate composite score
    overall_mfe_mae = np.mean([e['mfe'] for e in all_entries]) / np.mean([e['mae'] for e in all_entries])
    overall_mfe_first = mfe_first_count / total * 100
    overall_clean_rate = len(clean_confirms) / total * 100
    low_mae_rate = sum(1 for e in all_entries if e['mae'] < 1) / total * 100

    print(f"\n  MFE/MAE Ratio:     {overall_mfe_mae:.2f}x {'✓' if overall_mfe_mae >= 1.5 else '✗'}")
    print(f"  MFE First Rate:    {overall_mfe_first:.1f}% {'✓' if overall_mfe_first >= 55 else '✗'}")
    print(f"  Clean Confirm Rate: {overall_clean_rate:.1f}% {'✓' if overall_clean_rate >= 50 else '✗'}")
    print(f"  Low MAE Rate (<1%): {low_mae_rate:.1f}% {'✓' if low_mae_rate >= 60 else '✗'}")

    checks_passed = sum([
        overall_mfe_mae >= 1.5,
        overall_mfe_first >= 55,
        overall_clean_rate >= 50,
        low_mae_rate >= 60
    ])

    print(f"\n  Checks Passed: {checks_passed}/4")

    if checks_passed >= 3:
        print("\n" + "="*70)
        print("VERDICT: PASS - Execution quality is reliable")
        print("="*70)
    else:
        print("\n" + "="*70)
        print("VERDICT: NEEDS WORK - Execution timing needs refinement")
        print("="*70)

    # Best method recommendation
    best_method = None
    best_score = 0
    for ct in ConfirmationType:
        entries = entries_by_type[ct]
        if len(entries) >= 5:
            ratio = np.mean([e['mfe'] for e in entries]) / np.mean([e['mae'] for e in entries])
            mfe_first = sum(1 for e in entries if e['mfe_first']) / len(entries)
            score = ratio * mfe_first
            if score > best_score:
                best_score = score
                best_method = ct

    if best_method:
        print(f"\n  RECOMMENDED: {best_method.value}")
        entries = entries_by_type[best_method]
        print(f"    - MFE/MAE: {np.mean([e['mfe'] for e in entries])/np.mean([e['mae'] for e in entries]):.2f}x")
        print(f"    - Avg Latency: {np.mean([e['latency_min'] for e in entries]):.0f} min")
        print(f"    - MFE First: {sum(1 for e in entries if e['mfe_first'])/len(entries)*100:.1f}%")


if __name__ == "__main__":
    run_detailed_analysis("/Users/ble/TradingBot/historyBot/data/btc_usd_5m.csv")
