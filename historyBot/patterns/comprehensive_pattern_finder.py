#!/usr/bin/env python3
"""
Comprehensive Pattern Finder
Goal: Find ANY patterns with high win rates, then assess what R/R is achievable
"""

import pandas as pd
import numpy as np
from collections import defaultdict

# Load data
df = pd.read_csv('data/btc_usdc_5m.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

print(f"Data: {len(df)} candles from {df['timestamp'].min().date()} to {df['timestamp'].max().date()}")
print()

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_atr(df, period=14):
    high = df['high']
    low = df['low']
    close = df['close'].shift(1)
    tr = pd.concat([high - low, abs(high - close), abs(low - close)], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def calculate_rsi(df, period=14):
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def simulate_trade(df, entry_idx, direction, stop_pct, target_pct, max_candles=288):
    if entry_idx >= len(df) - 1:
        return None

    entry_price = df['close'].iloc[entry_idx]

    if direction == 'LONG':
        stop_price = entry_price * (1 - stop_pct)
        target_price = entry_price * (1 + target_pct)
    else:
        stop_price = entry_price * (1 + stop_pct)
        target_price = entry_price * (1 - target_pct)

    for i in range(entry_idx + 1, min(entry_idx + max_candles + 1, len(df))):
        high = df['high'].iloc[i]
        low = df['low'].iloc[i]

        if direction == 'LONG':
            if low <= stop_price:
                return 'LOSS'
            if high >= target_price:
                return 'WIN'
        else:
            if high >= stop_price:
                return 'LOSS'
            if low <= target_price:
                return 'WIN'

    return None

def test_pattern(df, signals, direction, stop_pct, target_pct, min_trades=3):
    wins = 0
    losses = 0
    last_exit = 0

    for idx in signals:
        if idx <= last_exit + 5:  # Minimum gap between trades
            continue
        result = simulate_trade(df, idx, direction, stop_pct, target_pct)
        if result == 'WIN':
            wins += 1
            last_exit = idx
        elif result == 'LOSS':
            losses += 1
            last_exit = idx

    total = wins + losses
    if total < min_trades:
        return None

    return {
        'wins': wins,
        'losses': losses,
        'total': total,
        'win_rate': (wins / total) * 100,
        'rr': target_pct / stop_pct
    }

# ============================================================
# CALCULATE ALL INDICATORS
# ============================================================

print("Calculating indicators...")

df['atr'] = calculate_atr(df, 14)
df['rsi'] = calculate_rsi(df, 14)
df['rsi_7'] = calculate_rsi(df, 7)
df['rsi_3'] = calculate_rsi(df, 3)
df['ema_9'] = calculate_ema(df['close'], 9)
df['ema_21'] = calculate_ema(df['close'], 21)
df['sma_50'] = df['close'].rolling(50).mean()

# Bollinger Bands
df['bb_mid'] = df['close'].rolling(20).mean()
df['bb_std'] = df['close'].rolling(20).std()
df['bb_upper'] = df['bb_mid'] + 2 * df['bb_std']
df['bb_lower'] = df['bb_mid'] - 2 * df['bb_std']

# Volume
df['vol_sma'] = df['volume'].rolling(20).mean()
df['vol_ratio'] = df['volume'] / df['vol_sma']

# Candle properties
df['body'] = abs(df['close'] - df['open'])
df['range'] = df['high'] - df['low']
df['upper_wick'] = df['high'] - df[['open', 'close']].max(axis=1)
df['lower_wick'] = df[['open', 'close']].min(axis=1) - df['low']
df['bullish'] = df['close'] > df['open']
df['bearish'] = df['close'] < df['open']

# Price changes
df['pct_1'] = df['close'].pct_change() * 100
df['pct_3'] = df['close'].pct_change(3) * 100
df['pct_12'] = df['close'].pct_change(12) * 100
df['pct_48'] = df['close'].pct_change(48) * 100

# Highs/Lows
df['high_20'] = df['high'].rolling(20).max()
df['low_20'] = df['low'].rolling(20).min()
df['high_50'] = df['high'].rolling(50).max()
df['low_50'] = df['low'].rolling(50).min()

# Consecutive candles
df['consec_red'] = 0
df['consec_green'] = 0
for i in range(1, len(df)):
    if df['bearish'].iloc[i]:
        df.loc[df.index[i], 'consec_red'] = df['consec_red'].iloc[i-1] + 1
    if df['bullish'].iloc[i]:
        df.loc[df.index[i], 'consec_green'] = df['consec_green'].iloc[i-1] + 1

# Session
df['hour'] = df['timestamp'].dt.hour

print("Done.\n")

# ============================================================
# PATTERN DEFINITIONS - Many combinations
# ============================================================

patterns = []

# RSI extremes
for rsi_thresh in [10, 12, 15, 18, 20, 22, 25]:
    patterns.append((f'RSI < {rsi_thresh} + Bullish',
                     df[(df['rsi'] < rsi_thresh) & (df['bullish'])].index.tolist(), 'LONG'))

for rsi_thresh in [80, 82, 85, 88, 90]:
    patterns.append((f'RSI > {rsi_thresh} + Bearish',
                     df[(df['rsi'] > rsi_thresh) & (df['bearish'])].index.tolist(), 'SHORT'))

# RSI + Volume
for rsi in [15, 20, 25, 30]:
    for vol in [2, 2.5, 3, 4]:
        patterns.append((f'RSI<{rsi} + Vol>{vol}x + Bullish',
                        df[(df['rsi'] < rsi) & (df['vol_ratio'] > vol) & (df['bullish'])].index.tolist(), 'LONG'))

for rsi in [70, 75, 80, 85]:
    for vol in [2, 2.5, 3, 4]:
        patterns.append((f'RSI>{rsi} + Vol>{vol}x + Bearish',
                        df[(df['rsi'] > rsi) & (df['vol_ratio'] > vol) & (df['bearish'])].index.tolist(), 'SHORT'))

# BB extremes
patterns.append(('BB Lower Touch + Bullish',
                 df[(df['low'] < df['bb_lower']) & (df['close'] > df['bb_lower']) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('BB Upper Touch + Bearish',
                 df[(df['high'] > df['bb_upper']) & (df['close'] < df['bb_upper']) & (df['bearish'])].index.tolist(), 'SHORT'))

# Consecutive candles
for n in [5, 6, 7, 8, 9, 10]:
    patterns.append((f'{n}+ Red Then Green',
                    df[(df['consec_red'].shift(1) >= n) & (df['bullish'])].index.tolist(), 'LONG'))
    patterns.append((f'{n}+ Green Then Red',
                    df[(df['consec_green'].shift(1) >= n) & (df['bearish'])].index.tolist(), 'SHORT'))

# Price drops
for drop in [0.5, 0.8, 1.0, 1.2, 1.5, 2.0]:
    patterns.append((f'1-Candle Drop >{drop}% Then Bullish',
                    df[(df['pct_1'].shift(1) < -drop) & (df['bullish'])].index.tolist(), 'LONG'))
    patterns.append((f'1-Candle Pump >{drop}% Then Bearish',
                    df[(df['pct_1'].shift(1) > drop) & (df['bearish'])].index.tolist(), 'SHORT'))

# Multi-hour drops
for drop in [1.5, 2, 2.5, 3, 4]:
    patterns.append((f'1H Drop >{drop}% Then Bullish',
                    df[(df['pct_12'] < -drop) & (df['bullish'])].index.tolist(), 'LONG'))
    patterns.append((f'4H Drop >{drop}% Then Bullish',
                    df[(df['pct_48'] < -drop) & (df['bullish'])].index.tolist(), 'LONG'))

# Hammer patterns
patterns.append(('Strong Hammer (wick > 2x body)',
                df[(df['lower_wick'] > df['body'] * 2) & (df['upper_wick'] < df['body'] * 0.3) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('Shooting Star (wick > 2x body)',
                df[(df['upper_wick'] > df['body'] * 2) & (df['lower_wick'] < df['body'] * 0.3) & (df['bearish'])].index.tolist(), 'SHORT'))

# Low sweep + recovery
patterns.append(('20-Bar Low Sweep + Bullish',
                df[(df['low'] < df['low_20'].shift(1)) & (df['close'] > df['low_20'].shift(1)) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('20-Bar High Sweep + Bearish',
                df[(df['high'] > df['high_20'].shift(1)) & (df['close'] < df['high_20'].shift(1)) & (df['bearish'])].index.tolist(), 'SHORT'))

# Extreme multi-confluence
patterns.append(('RSI<20 + BB<Lower + Vol>2x + Bullish',
                df[(df['rsi'] < 20) & (df['low'] < df['bb_lower']) & (df['vol_ratio'] > 2) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('RSI<15 + BB<Lower + Vol>3x + Hammer',
                df[(df['rsi'] < 15) & (df['low'] < df['bb_lower']) & (df['vol_ratio'] > 3) & (df['lower_wick'] > df['body'])].index.tolist(), 'LONG'))
patterns.append(('RSI<25 + 5+Red + Bullish',
                df[(df['rsi'] < 25) & (df['consec_red'].shift(1) >= 5) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('RSI<20 + Drop>1% + Bullish',
                df[(df['rsi'] < 20) & (df['pct_1'].shift(1) < -1) & (df['bullish'])].index.tolist(), 'LONG'))

# Session-based
patterns.append(('Asian (00-08 UTC) RSI<25 Bullish',
                df[(df['hour'] >= 0) & (df['hour'] < 8) & (df['rsi'] < 25) & (df['bullish'])].index.tolist(), 'LONG'))
patterns.append(('NY (13-21 UTC) RSI<25 + Vol>2x Bullish',
                df[(df['hour'] >= 13) & (df['hour'] < 21) & (df['rsi'] < 25) & (df['vol_ratio'] > 2) & (df['bullish'])].index.tolist(), 'LONG'))

print("=" * 90)
print("COMPREHENSIVE PATTERN ANALYSIS")
print("=" * 90)
print()

# ============================================================
# TEST ALL PATTERNS AT VARIOUS R/R RATIOS
# ============================================================

all_results = []
stop_losses = [0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.01]
rr_ratios = [1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]

print("Testing all pattern/stop/RR combinations...")
print()

for name, signals, direction in patterns:
    if len(signals) < 3:
        continue

    for stop in stop_losses:
        for rr in rr_ratios:
            target = stop * rr
            result = test_pattern(df, signals, direction, stop, target)
            if result and result['total'] >= 3:
                all_results.append({
                    'name': name,
                    'direction': direction,
                    'stop': stop,
                    'target': target,
                    'rr': rr,
                    **result
                })

# Sort by win rate
all_results.sort(key=lambda x: (x['win_rate'], x['rr']), reverse=True)

# ============================================================
# REPORT: Best patterns at 5:1 RR
# ============================================================

print("=" * 90)
print("BEST PATTERNS AT 5:1 R/R RATIO")
print("=" * 90)
print()

five_rr = [r for r in all_results if r['rr'] == 5]
five_rr.sort(key=lambda x: x['win_rate'], reverse=True)

print(f"{'Pattern':<50} {'WR%':<8} {'Trades':<8} {'Stop%':<8}")
print("-" * 90)
for r in five_rr[:20]:
    print(f"{r['name'][:48]:<50} {r['win_rate']:.1f}%    {r['total']:<8} {r['stop']*100:.2f}%")

print()

# ============================================================
# REPORT: Highest Win Rate Patterns (any RR)
# ============================================================

print("=" * 90)
print("HIGHEST WIN RATE PATTERNS (ANY R/R)")
print("=" * 90)
print()

# Only show patterns with 5+ trades
high_wr = [r for r in all_results if r['total'] >= 5]
high_wr.sort(key=lambda x: x['win_rate'], reverse=True)

print(f"{'Pattern':<45} {'WR%':<7} {'Trades':<7} {'R/R':<6} {'Stop%':<7}")
print("-" * 90)
for r in high_wr[:30]:
    print(f"{r['name'][:43]:<45} {r['win_rate']:.1f}%   {r['total']:<7} 1:{r['rr']:<4} {r['stop']*100:.2f}%")

print()

# ============================================================
# REPORT: Patterns with 80%+ Win Rate
# ============================================================

print("=" * 90)
print("PATTERNS WITH 80%+ WIN RATE (min 5 trades)")
print("=" * 90)
print()

eighty_plus = [r for r in all_results if r['win_rate'] >= 80 and r['total'] >= 5]
eighty_plus.sort(key=lambda x: (x['win_rate'], x['rr']), reverse=True)

if eighty_plus:
    for r in eighty_plus:
        print(f"Pattern: {r['name']}")
        print(f"  Win Rate: {r['win_rate']:.1f}% ({r['wins']}W / {r['losses']}L)")
        print(f"  R/R: 1:{r['rr']} | Stop: {r['stop']*100:.2f}% | Target: {r['target']*100:.2f}%")
        print()
else:
    print("No patterns found with 80%+ win rate and 5+ trades.\n")

# ============================================================
# REPORT: Expectancy Analysis
# ============================================================

print("=" * 90)
print("TOP PATTERNS BY EXPECTED VALUE (Win Rate × R/R)")
print("=" * 90)
print()

# Calculate expectancy: (WR * RR) - (1 - WR)
for r in all_results:
    wr = r['win_rate'] / 100
    r['expectancy'] = (wr * r['rr']) - (1 - wr)

by_expectancy = [r for r in all_results if r['total'] >= 5]
by_expectancy.sort(key=lambda x: x['expectancy'], reverse=True)

print(f"{'Pattern':<45} {'WR%':<7} {'R/R':<6} {'EV':<7} {'Trades':<7}")
print("-" * 90)
for r in by_expectancy[:20]:
    print(f"{r['name'][:43]:<45} {r['win_rate']:.1f}%   1:{r['rr']:<4} {r['expectancy']:.2f}    {r['total']}")

print()

# ============================================================
# SPECIAL ANALYSIS: What win rate is achievable at 5:1?
# ============================================================

print("=" * 90)
print("REALITY CHECK: WIN RATES AT DIFFERENT R/R RATIOS")
print("=" * 90)
print()

for rr in [2, 3, 4, 5, 6, 8, 10]:
    rr_patterns = [r for r in all_results if r['rr'] == rr and r['total'] >= 5]
    if rr_patterns:
        best = max(rr_patterns, key=lambda x: x['win_rate'])
        avg_wr = np.mean([r['win_rate'] for r in rr_patterns])
        print(f"R/R 1:{rr}")
        print(f"  Best Win Rate: {best['win_rate']:.1f}% ({best['name'][:40]})")
        print(f"  Average Win Rate: {avg_wr:.1f}%")
        print()

# ============================================================
# SPECIAL: Find patterns that might achieve 90% at lower RR
# ============================================================

print("=" * 90)
print("SEARCHING FOR 90%+ WIN RATE AT ANY R/R (min 5 trades)")
print("=" * 90)
print()

ninety_plus = [r for r in all_results if r['win_rate'] >= 90 and r['total'] >= 5]
ninety_plus.sort(key=lambda x: x['rr'], reverse=True)

if ninety_plus:
    for r in ninety_plus:
        print(f"Pattern: {r['name']}")
        print(f"  Win Rate: {r['win_rate']:.1f}% ({r['wins']}W / {r['losses']}L)")
        print(f"  R/R: 1:{r['rr']} | Stop: {r['stop']*100:.2f}% | Target: {r['target']*100:.2f}%")
        print(f"  Expectancy: {r['expectancy']:.2f}R per trade")
        print()
else:
    print("No patterns found with 90%+ win rate and 5+ trades.")
    print()
    # Show the closest
    closest = sorted([r for r in all_results if r['total'] >= 5],
                     key=lambda x: x['win_rate'], reverse=True)[:5]
    print("Closest patterns to 90%:")
    for r in closest:
        print(f"  {r['name'][:50]}: {r['win_rate']:.1f}% at 1:{r['rr']} ({r['total']} trades)")

print()
print("=" * 90)
print("ANALYSIS COMPLETE")
print("=" * 90)
