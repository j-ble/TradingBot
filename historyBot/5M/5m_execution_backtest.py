"""
5M Execution Reliability Backtest
=================================
Goal: "Can I enter consistently after 4H bias is correct?"

NOT optimizing RR or win rate.
Testing: Timing confirmation, reducing premature entries.

4H Bias Rules (LOCKED per contract):
- BULLISH: 4H LOW sweep (wick below swing low, close above) + RSI < 40 + next candle closes higher
- BEARISH: 4H HIGH sweep (wick above swing high, close below) + RSI > 80 + next candle closes lower

5M Confirmation Methods to Test:
1. Break & Retest - Price breaks level, retests, continues
2. Momentum Shift - RSI crosses threshold in bias direction
3. Reclaim of Level - Price reclaims key level after sweep
4. RSI Recovery - RSI recovers from extreme in bias direction
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
    latency_minutes: int  # Time from 4H bias to 5M entry
    mfe: float  # Max Favorable Excursion (%)
    mae: float  # Max Adverse Excursion (%)
    outcome: str  # 'WIN', 'LOSS', 'BREAKEVEN'
    hold_time_minutes: int

def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def aggregate_to_4h(df_5m: pd.DataFrame) -> pd.DataFrame:
    """Aggregate 5M candles to 4H candles"""
    df = df_5m.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)

    # Resample to 4H
    df_4h = df.resample('4h').agg({
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }).dropna()

    # Calculate RSI on 4H
    df_4h['rsi'] = calculate_rsi(df_4h['close'], 14)

    return df_4h.reset_index()

def detect_swing_levels(df: pd.DataFrame, lookback: int = 5) -> pd.DataFrame:
    """Detect swing highs and lows using 3-candle pattern"""
    df = df.copy()
    df['swing_high'] = np.nan
    df['swing_low'] = np.nan

    for i in range(2, len(df) - 2):
        # Swing high: higher high than neighbors
        if df.iloc[i]['high'] > df.iloc[i-1]['high'] and \
           df.iloc[i]['high'] > df.iloc[i-2]['high'] and \
           df.iloc[i]['high'] > df.iloc[i+1]['high'] and \
           df.iloc[i]['high'] > df.iloc[i+2]['high']:
            df.loc[df.index[i], 'swing_high'] = df.iloc[i]['high']

        # Swing low: lower low than neighbors
        if df.iloc[i]['low'] < df.iloc[i-1]['low'] and \
           df.iloc[i]['low'] < df.iloc[i-2]['low'] and \
           df.iloc[i]['low'] < df.iloc[i+1]['low'] and \
           df.iloc[i]['low'] < df.iloc[i+2]['low']:
            df.loc[df.index[i], 'swing_low'] = df.iloc[i]['low']

    return df

def get_recent_swing(df: pd.DataFrame, idx: int, swing_type: str, lookback: int = 20) -> Optional[float]:
    """Get most recent swing high or low before index"""
    col = 'swing_high' if swing_type == 'high' else 'swing_low'
    start_idx = max(0, idx - lookback)
    swings = df.iloc[start_idx:idx][col].dropna()
    if len(swings) > 0:
        return swings.iloc[-1]
    return None

def detect_4h_bias_signals(df_4h: pd.DataFrame) -> List[BiasSignal]:
    """
    Detect 4H bias signals per LOCKED contract:
    - BULLISH: LOW sweep + RSI < 40 + next candle closes higher
    - BEARISH: HIGH sweep + RSI > 80 + next candle closes lower
    """
    df = detect_swing_levels(df_4h)
    signals = []

    for i in range(20, len(df) - 1):  # Need history and confirmation candle
        candle = df.iloc[i]
        next_candle = df.iloc[i + 1]
        rsi = candle['rsi']

        if pd.isna(rsi):
            continue

        # Check for LOW sweep (BULLISH bias)
        recent_swing_low = get_recent_swing(df, i, 'low', lookback=20)
        if recent_swing_low is not None:
            # Wick below swing low, close above
            if candle['low'] < recent_swing_low and candle['close'] > recent_swing_low:
                # RSI < 40
                if rsi < 40:
                    # Confirmation: next candle closes higher
                    if next_candle['close'] > candle['close']:
                        signals.append(BiasSignal(
                            timestamp=next_candle['timestamp'],  # Signal confirmed after next candle
                            bias=Bias.BULLISH,
                            sweep_price=candle['low'],
                            rsi_at_sweep=rsi,
                            swing_level=recent_swing_low
                        ))

        # Check for HIGH sweep (BEARISH bias)
        recent_swing_high = get_recent_swing(df, i, 'high', lookback=20)
        if recent_swing_high is not None:
            # Wick above swing high, close below
            if candle['high'] > recent_swing_high and candle['close'] < recent_swing_high:
                # RSI > 80
                if rsi > 80:
                    # Confirmation: next candle closes lower
                    if next_candle['close'] < candle['close']:
                        signals.append(BiasSignal(
                            timestamp=next_candle['timestamp'],
                            bias=Bias.BEARISH,
                            sweep_price=candle['high'],
                            rsi_at_sweep=rsi,
                            swing_level=recent_swing_high
                        ))

    return signals

def find_5m_confirmations(df_5m: pd.DataFrame, bias_signal: BiasSignal,
                          max_wait_hours: int = 12) -> List[Tuple[ConfirmationType, int, float]]:
    """
    Find 5M confirmations after 4H bias signal.
    Returns list of (confirmation_type, candle_index, entry_price)
    """
    confirmations = []

    # Get 5M data window after bias signal
    start_time = bias_signal.timestamp
    end_time = start_time + timedelta(hours=max_wait_hours)

    mask = (df_5m['timestamp'] >= start_time) & (df_5m['timestamp'] <= end_time)
    window = df_5m[mask].copy()

    if len(window) < 20:
        return confirmations

    window['rsi'] = calculate_rsi(window['close'], 14)
    window = window.reset_index(drop=True)

    # Track which confirmations we've found
    found = set()

    for i in range(14, len(window) - 1):
        candle = window.iloc[i]
        prev_candle = window.iloc[i - 1]
        rsi = candle['rsi']
        prev_rsi = prev_candle['rsi'] if not pd.isna(prev_candle['rsi']) else 50

        if pd.isna(rsi):
            continue

        # Get recent 5M swing levels
        recent_high = window.iloc[max(0, i-10):i]['high'].max()
        recent_low = window.iloc[max(0, i-10):i]['low'].min()

        if bias_signal.bias == Bias.BULLISH:
            # 1. Break & Retest: Price breaks above recent high, pulls back, holds
            if 'BREAK_RETEST' not in found:
                if candle['high'] > recent_high:  # Break
                    # Look for retest in next candles
                    for j in range(i + 1, min(i + 6, len(window))):
                        retest = window.iloc[j]
                        if retest['low'] <= recent_high * 1.001 and retest['close'] > recent_high:
                            confirmations.append((ConfirmationType.BREAK_RETEST, j, retest['close']))
                            found.add('BREAK_RETEST')
                            break

            # 2. Momentum Shift: RSI crosses above 50 from below
            if 'MOMENTUM_SHIFT' not in found:
                if prev_rsi < 50 and rsi >= 50:
                    confirmations.append((ConfirmationType.MOMENTUM_SHIFT, i, candle['close']))
                    found.add('MOMENTUM_SHIFT')

            # 3. Reclaim Level: Price closes above the swept swing level
            if 'RECLAIM_LEVEL' not in found:
                if candle['close'] > bias_signal.swing_level * 1.002:  # 0.2% buffer
                    confirmations.append((ConfirmationType.RECLAIM_LEVEL, i, candle['close']))
                    found.add('RECLAIM_LEVEL')

            # 4. RSI Recovery: RSI rises from <30 to >40
            if 'RSI_RECOVERY' not in found:
                # Look for RSI that was below 30 recently
                recent_rsis = window.iloc[max(0, i-10):i]['rsi']
                if len(recent_rsis.dropna()) > 0 and recent_rsis.min() < 30:
                    if rsi > 40:
                        confirmations.append((ConfirmationType.RSI_RECOVERY, i, candle['close']))
                        found.add('RSI_RECOVERY')

        elif bias_signal.bias == Bias.BEARISH:
            # 1. Break & Retest: Price breaks below recent low, pulls back, holds
            if 'BREAK_RETEST' not in found:
                if candle['low'] < recent_low:  # Break
                    # Look for retest in next candles
                    for j in range(i + 1, min(i + 6, len(window))):
                        retest = window.iloc[j]
                        if retest['high'] >= recent_low * 0.999 and retest['close'] < recent_low:
                            confirmations.append((ConfirmationType.BREAK_RETEST, j, retest['close']))
                            found.add('BREAK_RETEST')
                            break

            # 2. Momentum Shift: RSI crosses below 50 from above
            if 'MOMENTUM_SHIFT' not in found:
                if prev_rsi > 50 and rsi <= 50:
                    confirmations.append((ConfirmationType.MOMENTUM_SHIFT, i, candle['close']))
                    found.add('MOMENTUM_SHIFT')

            # 3. Reclaim Level: Price closes below the swept swing level
            if 'RECLAIM_LEVEL' not in found:
                if candle['close'] < bias_signal.swing_level * 0.998:  # 0.2% buffer
                    confirmations.append((ConfirmationType.RECLAIM_LEVEL, i, candle['close']))
                    found.add('RECLAIM_LEVEL')

            # 4. RSI Recovery: RSI drops from >70 to <60
            if 'RSI_RECOVERY' not in found:
                recent_rsis = window.iloc[max(0, i-10):i]['rsi']
                if len(recent_rsis.dropna()) > 0 and recent_rsis.max() > 70:
                    if rsi < 60:
                        confirmations.append((ConfirmationType.RSI_RECOVERY, i, candle['close']))
                        found.add('RSI_RECOVERY')

        # Early exit if we found all types
        if len(found) == 4:
            break

    return confirmations

def calculate_mfe_mae(df_5m: pd.DataFrame, entry_time: datetime, entry_price: float,
                      bias: Bias, hold_hours: int = 24) -> Tuple[float, float, str, int]:
    """
    Calculate MFE and MAE for an entry.
    Returns (mfe%, mae%, outcome, hold_time_minutes)
    """
    end_time = entry_time + timedelta(hours=hold_hours)
    mask = (df_5m['timestamp'] > entry_time) & (df_5m['timestamp'] <= end_time)
    future = df_5m[mask]

    if len(future) < 5:
        return 0, 0, 'INVALID', 0

    if bias == Bias.BULLISH:
        # For longs: MFE = max high, MAE = min low
        max_price = future['high'].max()
        min_price = future['low'].min()
        mfe = ((max_price - entry_price) / entry_price) * 100
        mae = ((entry_price - min_price) / entry_price) * 100
    else:
        # For shorts: MFE = min low (price drop), MAE = max high (price rise)
        max_price = future['high'].max()
        min_price = future['low'].min()
        mfe = ((entry_price - min_price) / entry_price) * 100
        mae = ((max_price - entry_price) / entry_price) * 100

    # Determine outcome (simple: if MFE > MAE = WIN)
    if mfe > mae * 1.5:
        outcome = 'WIN'
    elif mae > mfe * 1.5:
        outcome = 'LOSS'
    else:
        outcome = 'BREAKEVEN'

    hold_time = len(future) * 5  # 5 minutes per candle

    return max(0, mfe), max(0, mae), outcome, hold_time

def run_backtest(csv_path: str) -> dict:
    """Run full 5M execution reliability backtest"""

    print("="*70)
    print("5M EXECUTION RELIABILITY BACKTEST")
    print("="*70)
    print("\nGoal: Can I enter consistently after 4H bias is correct?")
    print("Testing: Timing, not optimization\n")

    # Load 5M data
    print("Loading 5M data...")
    df_5m = pd.read_csv(csv_path)
    df_5m['timestamp'] = pd.to_datetime(df_5m['timestamp'])
    print(f"  Loaded {len(df_5m):,} 5M candles")
    print(f"  Range: {df_5m['timestamp'].min()} to {df_5m['timestamp'].max()}")

    # Aggregate to 4H
    print("\nAggregating to 4H...")
    df_4h = aggregate_to_4h(df_5m)
    print(f"  Created {len(df_4h):,} 4H candles")

    # Detect 4H bias signals
    print("\nDetecting 4H bias signals (per LOCKED contract)...")
    bias_signals = detect_4h_bias_signals(df_4h)
    print(f"  Found {len(bias_signals)} valid 4H bias signals")

    bullish_count = sum(1 for s in bias_signals if s.bias == Bias.BULLISH)
    bearish_count = sum(1 for s in bias_signals if s.bias == Bias.BEARISH)
    print(f"    BULLISH: {bullish_count}")
    print(f"    BEARISH: {bearish_count}")

    # Track entries by confirmation type
    entries_by_type = {ct: [] for ct in ConfirmationType}
    all_entries = []

    print("\nFinding 5M confirmations for each bias signal...")

    for signal in bias_signals:
        confirmations = find_5m_confirmations(df_5m, signal, max_wait_hours=12)

        for conf_type, candle_idx, entry_price in confirmations:
            # Get entry timestamp
            start_time = signal.timestamp
            end_time = start_time + timedelta(hours=12)
            mask = (df_5m['timestamp'] >= start_time) & (df_5m['timestamp'] <= end_time)
            window = df_5m[mask].reset_index(drop=True)

            if candle_idx >= len(window):
                continue

            entry_time = window.iloc[candle_idx]['timestamp']

            # Calculate latency
            latency_minutes = int((entry_time - signal.timestamp).total_seconds() / 60)

            # Calculate MFE/MAE
            mfe, mae, outcome, hold_time = calculate_mfe_mae(
                df_5m, entry_time, entry_price, signal.bias, hold_hours=24
            )

            if outcome == 'INVALID':
                continue

            entry = Entry(
                timestamp=entry_time,
                bias=signal.bias,
                confirmation_type=conf_type,
                entry_price=entry_price,
                bias_signal_time=signal.timestamp,
                latency_minutes=latency_minutes,
                mfe=mfe,
                mae=mae,
                outcome=outcome,
                hold_time_minutes=hold_time
            )

            entries_by_type[conf_type].append(entry)
            all_entries.append(entry)

    # Analyze results
    print("\n" + "="*70)
    print("RESULTS BY CONFIRMATION TYPE")
    print("="*70)

    results = {}

    for conf_type in ConfirmationType:
        entries = entries_by_type[conf_type]
        if len(entries) == 0:
            print(f"\n{conf_type.value}: NO ENTRIES")
            continue

        mfes = [e.mfe for e in entries]
        maes = [e.mae for e in entries]
        latencies = [e.latency_minutes for e in entries]
        wins = sum(1 for e in entries if e.outcome == 'WIN')
        losses = sum(1 for e in entries if e.outcome == 'LOSS')

        avg_mfe = np.mean(mfes)
        avg_mae = np.mean(maes)
        mfe_mae_ratio = avg_mfe / avg_mae if avg_mae > 0 else float('inf')
        avg_latency = np.mean(latencies)

        # False confirmation rate: entries where MAE > MFE significantly
        false_confirms = sum(1 for e in entries if e.mae > e.mfe * 1.2)
        false_rate = false_confirms / len(entries) * 100

        results[conf_type.value] = {
            'count': len(entries),
            'avg_mfe': avg_mfe,
            'avg_mae': avg_mae,
            'mfe_mae_ratio': mfe_mae_ratio,
            'avg_latency_min': avg_latency,
            'win_rate': wins / len(entries) * 100,
            'false_confirm_rate': false_rate,
            'wins': wins,
            'losses': losses
        }

        print(f"\n{conf_type.value}")
        print("-" * 40)
        print(f"  Entries:           {len(entries)}")
        print(f"  Avg MFE:           {avg_mfe:.2f}%")
        print(f"  Avg MAE:           {avg_mae:.2f}%")
        print(f"  MFE/MAE Ratio:     {mfe_mae_ratio:.2f}x")
        print(f"  Avg Latency:       {avg_latency:.0f} min ({avg_latency/60:.1f} hrs)")
        print(f"  Win Rate:          {wins}/{len(entries)} ({wins/len(entries)*100:.1f}%)")
        print(f"  False Confirms:    {false_confirms} ({false_rate:.1f}%)")

    # Overall summary
    print("\n" + "="*70)
    print("OVERALL SUMMARY")
    print("="*70)

    if len(all_entries) > 0:
        total_mfe = np.mean([e.mfe for e in all_entries])
        total_mae = np.mean([e.mae for e in all_entries])
        total_ratio = total_mfe / total_mae if total_mae > 0 else 0
        total_wins = sum(1 for e in all_entries if e.outcome == 'WIN')
        total_losses = sum(1 for e in all_entries if e.outcome == 'LOSS')

        print(f"\nTotal Entries:       {len(all_entries)}")
        print(f"4H Signals:          {len(bias_signals)}")
        print(f"Entries per Signal:  {len(all_entries)/len(bias_signals):.1f}")
        print(f"\nAggregate MFE:       {total_mfe:.2f}%")
        print(f"Aggregate MAE:       {total_mae:.2f}%")
        print(f"Overall MFE/MAE:     {total_ratio:.2f}x")
        print(f"\nWins/Losses:         {total_wins}/{total_losses}")

    # Entry latency analysis
    print("\n" + "="*70)
    print("ENTRY LATENCY ANALYSIS")
    print("="*70)

    latency_buckets = {
        '0-30 min': [],
        '30-60 min': [],
        '1-2 hrs': [],
        '2-4 hrs': [],
        '4-8 hrs': [],
        '8-12 hrs': []
    }

    for entry in all_entries:
        lat = entry.latency_minutes
        if lat <= 30:
            latency_buckets['0-30 min'].append(entry)
        elif lat <= 60:
            latency_buckets['30-60 min'].append(entry)
        elif lat <= 120:
            latency_buckets['1-2 hrs'].append(entry)
        elif lat <= 240:
            latency_buckets['2-4 hrs'].append(entry)
        elif lat <= 480:
            latency_buckets['4-8 hrs'].append(entry)
        else:
            latency_buckets['8-12 hrs'].append(entry)

    print("\nMFE/MAE by Entry Latency:")
    print("-" * 50)

    latency_results = {}
    for bucket, entries in latency_buckets.items():
        if len(entries) > 0:
            avg_mfe = np.mean([e.mfe for e in entries])
            avg_mae = np.mean([e.mae for e in entries])
            ratio = avg_mfe / avg_mae if avg_mae > 0 else 0
            latency_results[bucket] = {'count': len(entries), 'mfe': avg_mfe, 'mae': avg_mae, 'ratio': ratio}
            print(f"  {bucket:12} | n={len(entries):3} | MFE={avg_mfe:5.2f}% | MAE={avg_mae:5.2f}% | Ratio={ratio:.2f}x")

    # PASS/FAIL Verdict
    print("\n" + "="*70)
    print("PASS / FAIL VERDICT")
    print("="*70)

    # Find best confirmation method
    best_method = None
    best_ratio = 0
    for method, data in results.items():
        if data['mfe_mae_ratio'] > best_ratio and data['count'] >= 5:
            best_ratio = data['mfe_mae_ratio']
            best_method = method

    # Criteria for PASS:
    # 1. MFE >> MAE (ratio > 1.5x)
    # 2. False confirmation rate < 40%
    # 3. At least one method with good latency profile

    pass_criteria = []

    if best_ratio >= 1.5:
        pass_criteria.append(f"MFE/MAE ratio {best_ratio:.2f}x >= 1.5x")
    else:
        pass_criteria.append(f"FAIL: MFE/MAE ratio {best_ratio:.2f}x < 1.5x")

    if best_method and results[best_method]['false_confirm_rate'] < 40:
        pass_criteria.append(f"False confirm rate {results[best_method]['false_confirm_rate']:.1f}% < 40%")
    else:
        pass_criteria.append("FAIL: False confirmation rate too high")

    # Check if early entries (< 2hr) have decent ratio
    early_entries = latency_buckets['0-30 min'] + latency_buckets['30-60 min'] + latency_buckets['1-2 hrs']
    if len(early_entries) > 0:
        early_mfe = np.mean([e.mfe for e in early_entries])
        early_mae = np.mean([e.mae for e in early_entries])
        early_ratio = early_mfe / early_mae if early_mae > 0 else 0
        if early_ratio >= 1.3:
            pass_criteria.append(f"Early entries (<2hr) ratio {early_ratio:.2f}x >= 1.3x")
        else:
            pass_criteria.append(f"CAUTION: Early entries ratio {early_ratio:.2f}x")

    print("\nCriteria Check:")
    for criterion in pass_criteria:
        status = "PASS" if not criterion.startswith("FAIL") and not criterion.startswith("CAUTION") else criterion.split(":")[0]
        print(f"  [{status}] {criterion}")

    overall_pass = best_ratio >= 1.5 and (not best_method or results[best_method]['false_confirm_rate'] < 40)

    print("\n" + "="*70)
    if overall_pass:
        print("VERDICT: PASS")
        print("="*70)
        print(f"\nBest Confirmation Method: {best_method}")
        print("5M execution CAN provide reliable entries after 4H bias.")
    else:
        print("VERDICT: NEEDS REFINEMENT")
        print("="*70)
        print("\n5M confirmations show signal but need tuning.")

    # Recommendation
    print("\n" + "="*70)
    print("RECOMMENDATIONS")
    print("="*70)

    if best_method:
        print(f"\n1. PRIMARY: Use '{best_method}' for entries")
        print(f"   - MFE/MAE: {results[best_method]['mfe_mae_ratio']:.2f}x")
        print(f"   - Avg Latency: {results[best_method]['avg_latency_min']:.0f} min")

    # Find optimal latency window
    best_latency_bucket = None
    best_latency_ratio = 0
    for bucket, data in latency_results.items():
        if data['count'] >= 3 and data['ratio'] > best_latency_ratio:
            best_latency_ratio = data['ratio']
            best_latency_bucket = bucket

    if best_latency_bucket:
        print(f"\n2. OPTIMAL TIMING: Enter within {best_latency_bucket}")
        print(f"   - MFE/MAE: {best_latency_ratio:.2f}x at this window")

    print("\n3. MENTAL MODEL:")
    print("   5M answers 'now or not yet'")
    print("   - Wait for confirmation type to trigger")
    print("   - If no confirmation in optimal window, skip the trade")

    return {
        'bias_signals': len(bias_signals),
        'total_entries': len(all_entries),
        'results_by_type': results,
        'latency_results': latency_results,
        'best_method': best_method,
        'best_ratio': best_ratio,
        'verdict': 'PASS' if overall_pass else 'NEEDS_REFINEMENT'
    }


if __name__ == "__main__":
    results = run_backtest("/Users/ble/TradingBot/historyBot/data/btc_usd_5m.csv")
