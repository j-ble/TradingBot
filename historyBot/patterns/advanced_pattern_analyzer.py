#!/usr/bin/env python3
"""
Advanced BTC/USDC Pattern Analyzer
Searches for high win-rate patterns with various approaches:
1. Ultra-tight multi-confluence filters
2. Session-based analysis (Asian, London, NY)
3. Market structure (CHoCH, FVG, BOS simulation)
4. ATR-adaptive stops
5. Mean reversion extremes
6. Trailing stop simulation
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

# Load data
df = pd.read_csv('data/btc_usdc_5m.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

print(f"Loaded {len(df)} candles")
print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
print(f"Price range: ${df['low'].min():,.2f} - ${df['high'].max():,.2f}")
print()

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_atr(df, period=14):
    high = df['high']
    low = df['low']
    close = df['close'].shift(1)
    tr1 = high - low
    tr2 = abs(high - close)
    tr3 = abs(low - close)
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def calculate_rsi(df, period=14):
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def calculate_bollinger_bands(df, period=20, std_dev=2):
    sma = df['close'].rolling(window=period).mean()
    std = df['close'].rolling(window=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return upper, sma, lower

def simulate_trade_with_trailing(df, entry_idx, direction, stop_pct, target_pct,
                                  trailing_activation=0.5, max_candles=288):
    """
    Simulate trade with trailing stop that activates at X% of target
    """
    if entry_idx >= len(df) - 1:
        return None

    entry_price = df['close'].iloc[entry_idx]

    if direction == 'LONG':
        stop_price = entry_price * (1 - stop_pct)
        target_price = entry_price * (1 + target_pct)
        trailing_trigger = entry_price * (1 + target_pct * trailing_activation)
    else:
        stop_price = entry_price * (1 + stop_pct)
        target_price = entry_price * (1 - target_pct)
        trailing_trigger = entry_price * (1 - target_pct * trailing_activation)

    trailing_active = False
    highest_since_entry = entry_price if direction == 'LONG' else entry_price
    lowest_since_entry = entry_price if direction == 'SHORT' else entry_price

    for i in range(entry_idx + 1, min(entry_idx + max_candles + 1, len(df))):
        high = df['high'].iloc[i]
        low = df['low'].iloc[i]
        close = df['close'].iloc[i]

        if direction == 'LONG':
            highest_since_entry = max(highest_since_entry, high)

            # Check if trailing should activate
            if not trailing_active and high >= trailing_trigger:
                trailing_active = True
                stop_price = entry_price  # Move to breakeven

            # Update trailing stop if active
            if trailing_active:
                # Trail at 50% of profit
                new_stop = highest_since_entry * (1 - stop_pct * 0.5)
                stop_price = max(stop_price, new_stop)

            # Check stop
            if low <= stop_price:
                pnl = (stop_price - entry_price) / entry_price
                return {'result': 'WIN' if pnl > 0 else 'LOSS', 'pnl_pct': pnl * 100, 'exit_idx': i}
            # Check target
            if high >= target_price:
                return {'result': 'WIN', 'pnl_pct': target_pct * 100, 'exit_idx': i}

        else:  # SHORT
            lowest_since_entry = min(lowest_since_entry, low)

            if not trailing_active and low <= trailing_trigger:
                trailing_active = True
                stop_price = entry_price

            if trailing_active:
                new_stop = lowest_since_entry * (1 + stop_pct * 0.5)
                stop_price = min(stop_price, new_stop)

            if high >= stop_price:
                pnl = (entry_price - stop_price) / entry_price
                return {'result': 'WIN' if pnl > 0 else 'LOSS', 'pnl_pct': pnl * 100, 'exit_idx': i}
            if low <= target_price:
                return {'result': 'WIN', 'pnl_pct': target_pct * 100, 'exit_idx': i}

    # Timeout
    exit_price = df['close'].iloc[min(entry_idx + max_candles, len(df) - 1)]
    if direction == 'LONG':
        pnl = (exit_price - entry_price) / entry_price
    else:
        pnl = (entry_price - exit_price) / entry_price
    return {'result': 'WIN' if pnl > 0 else 'LOSS', 'pnl_pct': pnl * 100, 'exit_idx': i}

def simulate_trade_simple(df, entry_idx, direction, stop_pct, target_pct, max_candles=288):
    """Simple trade simulation without trailing"""
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
                return {'result': 'LOSS', 'exit_idx': i}
            if high >= target_price:
                return {'result': 'WIN', 'exit_idx': i}
        else:
            if high >= stop_price:
                return {'result': 'LOSS', 'exit_idx': i}
            if low <= target_price:
                return {'result': 'WIN', 'exit_idx': i}

    return None  # No clear outcome

def test_pattern_stats(df, signals, direction, stop_pct, target_pct, use_trailing=False, min_trades=5):
    """Test pattern and return detailed statistics"""
    wins = 0
    losses = 0
    last_exit_idx = 0

    for idx in signals:
        if idx <= last_exit_idx:
            continue

        if use_trailing:
            result = simulate_trade_with_trailing(df, idx, direction, stop_pct, target_pct)
        else:
            result = simulate_trade_simple(df, idx, direction, stop_pct, target_pct)

        if result:
            last_exit_idx = result['exit_idx']
            if result['result'] == 'WIN':
                wins += 1
            else:
                losses += 1

    total = wins + losses
    if total < min_trades:
        return None

    win_rate = (wins / total) * 100
    return {
        'wins': wins,
        'losses': losses,
        'total': total,
        'win_rate': win_rate,
        'stop_pct': stop_pct,
        'target_pct': target_pct,
        'rr_ratio': target_pct / stop_pct
    }

# ============================================================
# PRE-CALCULATE INDICATORS
# ============================================================

print("Calculating indicators...")

# Standard indicators
df['atr'] = calculate_atr(df, 14)
df['atr_pct'] = df['atr'] / df['close'] * 100  # ATR as percentage
df['rsi'] = calculate_rsi(df, 14)
df['rsi_7'] = calculate_rsi(df, 7)
df['rsi_3'] = calculate_rsi(df, 3)  # Ultra-short RSI
df['ema_9'] = calculate_ema(df['close'], 9)
df['ema_21'] = calculate_ema(df['close'], 21)
df['ema_50'] = calculate_ema(df['close'], 50)
df['sma_200'] = df['close'].rolling(window=200).mean()
df['bb_upper'], df['bb_mid'], df['bb_lower'] = calculate_bollinger_bands(df)

# Volatility
df['volatility'] = df['close'].pct_change().rolling(window=20).std() * 100

# Volume
df['volume_sma'] = df['volume'].rolling(window=20).mean()
df['volume_ratio'] = df['volume'] / df['volume_sma']

# Candle characteristics
df['body'] = abs(df['close'] - df['open'])
df['range'] = df['high'] - df['low']
df['upper_wick'] = df['high'] - df[['open', 'close']].max(axis=1)
df['lower_wick'] = df[['open', 'close']].min(axis=1) - df['low']
df['bullish'] = df['close'] > df['open']
df['bearish'] = df['close'] < df['open']
df['body_ratio'] = df['body'] / df['range'].replace(0, np.nan)  # Body as % of range

# Price change
df['pct_change'] = df['close'].pct_change() * 100
df['pct_change_3'] = df['close'].pct_change(3) * 100  # 15 min change
df['pct_change_12'] = df['close'].pct_change(12) * 100  # 1 hour change
df['pct_change_48'] = df['close'].pct_change(48) * 100  # 4 hour change

# Session (UTC times)
df['hour'] = df['timestamp'].dt.hour
df['is_asian'] = (df['hour'] >= 0) & (df['hour'] < 8)  # 00:00-08:00 UTC
df['is_london'] = (df['hour'] >= 8) & (df['hour'] < 13)  # 08:00-13:00 UTC
df['is_newyork'] = (df['hour'] >= 13) & (df['hour'] < 21)  # 13:00-21:00 UTC

# Swing detection (5 candle lookback)
df['swing_high'] = False
df['swing_low'] = False
for i in range(5, len(df) - 5):
    if all(df['high'].iloc[i] > df['high'].iloc[i-j] for j in range(1, 6)) and \
       all(df['high'].iloc[i] > df['high'].iloc[i+j] for j in range(1, 6)):
        df.loc[df.index[i], 'swing_high'] = True
    if all(df['low'].iloc[i] < df['low'].iloc[i-j] for j in range(1, 6)) and \
       all(df['low'].iloc[i] < df['low'].iloc[i+j] for j in range(1, 6)):
        df.loc[df.index[i], 'swing_low'] = True

# Recent swing levels
df['recent_swing_high'] = df['high'].where(df['swing_high']).ffill()
df['recent_swing_low'] = df['low'].where(df['swing_low']).ffill()

# Liquidity sweep detection
df['swept_high'] = (df['high'] > df['recent_swing_high'].shift(1)) & (df['close'] < df['recent_swing_high'].shift(1))
df['swept_low'] = (df['low'] < df['recent_swing_low'].shift(1)) & (df['close'] > df['recent_swing_low'].shift(1))

# Higher highs and lower lows
df['higher_high'] = df['high'] > df['high'].shift(1)
df['lower_low'] = df['low'] < df['low'].shift(1)
df['higher_close'] = df['close'] > df['close'].shift(1)
df['lower_close'] = df['close'] < df['close'].shift(1)

# Momentum
df['mom_12'] = df['close'] - df['close'].shift(12)
df['mom_positive'] = df['mom_12'] > 0
df['mom_negative'] = df['mom_12'] < 0

# Previous candle data
df['prev_bullish'] = df['bullish'].shift(1)
df['prev_bearish'] = df['bearish'].shift(1)
df['prev_volume_ratio'] = df['volume_ratio'].shift(1)

# Consecutive candles
df['consec_green'] = 0
df['consec_red'] = 0
for i in range(1, len(df)):
    if df['bullish'].iloc[i]:
        df.loc[df.index[i], 'consec_green'] = df['consec_green'].iloc[i-1] + 1
    else:
        df.loc[df.index[i], 'consec_green'] = 0
    if df['bearish'].iloc[i]:
        df.loc[df.index[i], 'consec_red'] = df['consec_red'].iloc[i-1] + 1
    else:
        df.loc[df.index[i], 'consec_red'] = 0

# Distance from EMAs
df['dist_ema9'] = (df['close'] - df['ema_9']) / df['ema_9'] * 100
df['dist_ema21'] = (df['close'] - df['ema_21']) / df['ema_21'] * 100

# Bollinger Band position
df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

# Range highs and lows
df['high_20'] = df['high'].rolling(window=20).max()
df['low_20'] = df['low'].rolling(window=20).min()
df['high_50'] = df['high'].rolling(window=50).max()
df['low_50'] = df['low'].rolling(window=50).min()

print("Indicators calculated.")
print()

# ============================================================
# PATTERN TESTING
# ============================================================

all_results = []

# Test parameters
stop_losses = [0.001, 0.0015, 0.002, 0.0025, 0.003, 0.004, 0.005, 0.006, 0.008, 0.01]
rr_ratios = [2, 3, 4, 5, 6, 7, 8, 10]

print("=" * 80)
print("TESTING ULTRA-SELECTIVE PATTERNS")
print("=" * 80)
print()

# ============================================================
# 1. EXTREME RSI + MULTI CONFLUENCE
# ============================================================
print("Testing Extreme RSI Multi-Confluence...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # RSI < 10 (extreme oversold) - very rare
        signals = df[
            (df['rsi'] < 10) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI < 10 Extreme', result, rr))

        # RSI < 15 + Volume Spike + Bullish
        signals = df[
            (df['rsi'] < 15) &
            (df['volume_ratio'] > 2.5) &
            (df['bullish']) &
            (df['body_ratio'] > 0.6)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI<15 + VolSpike + Strong Bullish', result, rr))

        # RSI < 20 + Below BB + Volume + Hammer pattern
        signals = df[
            (df['rsi'] < 20) &
            (df['low'] < df['bb_lower']) &
            (df['volume_ratio'] > 2) &
            (df['lower_wick'] > df['body']) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI<20 BB Hammer', result, rr))

        # RSI > 90 (extreme overbought) - SHORT
        signals = df[
            (df['rsi'] > 90) &
            (df['bearish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI > 90 Extreme', result, rr))

        # RSI > 85 + Volume Spike + Bearish
        signals = df[
            (df['rsi'] > 85) &
            (df['volume_ratio'] > 2.5) &
            (df['bearish']) &
            (df['body_ratio'] > 0.6)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI>85 + VolSpike + Strong Bearish', result, rr))

# ============================================================
# 2. LIQUIDITY SWEEP + CONFLUENCE
# ============================================================
print("Testing Liquidity Sweep Patterns...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # Low swept + RSI oversold + Volume + Bullish
        signals = df[
            (df['swept_low']) &
            (df['rsi'] < 35) &
            (df['volume_ratio'] > 1.5) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('Low Sweep + RSI<35 + Vol', result, rr))

        # High swept + RSI overbought + Volume + Bearish
        signals = df[
            (df['swept_high']) &
            (df['rsi'] > 65) &
            (df['volume_ratio'] > 1.5) &
            (df['bearish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('High Sweep + RSI>65 + Vol', result, rr))

# ============================================================
# 3. SESSION-BASED PATTERNS
# ============================================================
print("Testing Session-Based Patterns...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # Asian session reversal (low volatility)
        signals = df[
            (df['is_asian']) &
            (df['rsi'] < 25) &
            (df['bullish']) &
            (df['atr_pct'] < df['atr_pct'].quantile(0.3))  # Low volatility
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('Asian Session RSI<25 LowVol', result, rr))

        # NY session momentum
        signals = df[
            (df['is_newyork']) &
            (df['rsi'] < 30) &
            (df['volume_ratio'] > 2) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('NY Session RSI<30 HighVol', result, rr))

# ============================================================
# 4. CONSECUTIVE CANDLE EXTREMES
# ============================================================
print("Testing Consecutive Candle Extremes...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # 6+ consecutive red then green
        signals = df[
            (df['consec_red'].shift(1) >= 6) &
            (df['bullish']) &
            (df['body'] > df['body'].rolling(20).mean())
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('6+ Red Then Strong Green', result, rr))

        # 7+ consecutive red then green
        signals = df[
            (df['consec_red'].shift(1) >= 7) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('7+ Red Then Green', result, rr))

        # 8+ consecutive red then green
        signals = df[
            (df['consec_red'].shift(1) >= 8) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('8+ Red Then Green', result, rr))

        # 6+ consecutive green then red
        signals = df[
            (df['consec_green'].shift(1) >= 6) &
            (df['bearish']) &
            (df['body'] > df['body'].rolling(20).mean())
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('6+ Green Then Strong Red', result, rr))

# ============================================================
# 5. EXTREME PRICE MOVES
# ============================================================
print("Testing Extreme Price Moves...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # 4-hour drop > 3% then bullish
        signals = df[
            (df['pct_change_48'] < -3) &
            (df['bullish']) &
            (df['volume_ratio'] > 1.5)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('4H Drop >3% Reversal', result, rr))

        # 1-hour drop > 1.5% then bullish
        signals = df[
            (df['pct_change_12'] < -1.5) &
            (df['bullish']) &
            (df['lower_wick'] > df['body'] * 0.5)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('1H Drop >1.5% Reversal', result, rr))

        # Single candle drop > 0.8% then reversal
        signals = df[
            (df['pct_change'].shift(1) < -0.8) &
            (df['bullish']) &
            (df['body'] > df['atr'] * 0.3)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('Candle Drop >0.8% Reversal', result, rr))

# ============================================================
# 6. BOLLINGER BAND EXTREMES
# ============================================================
print("Testing Bollinger Band Extremes...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # Far below BB (position < -0.1) with bullish close
        signals = df[
            (df['bb_position'] < -0.1) &
            (df['bullish']) &
            (df['close'] > df['bb_lower'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('BB Extreme Low Bounce', result, rr))

        # Very far below BB (< -0.2)
        signals = df[
            (df['bb_position'] < -0.2) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('BB Ultra Low Bounce', result, rr))

# ============================================================
# 7. DISTANCE FROM EMA EXTREMES
# ============================================================
print("Testing EMA Distance Extremes...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # Very far below EMA 21 (mean reversion)
        signals = df[
            (df['dist_ema21'] < -2) &  # 2% below EMA21
            (df['bullish']) &
            (df['rsi'] < 40)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('EMA21 Distance <-2%', result, rr))

        # Very far above EMA 21
        signals = df[
            (df['dist_ema21'] > 2) &  # 2% above EMA21
            (df['bearish']) &
            (df['rsi'] > 60)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('EMA21 Distance >2%', result, rr))

# ============================================================
# 8. ULTRA-TIGHT MULTI-CONFLUENCE (5+ conditions)
# ============================================================
print("Testing Ultra-Tight Multi-Confluence...")

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # 5-factor confluence LONG
        signals = df[
            (df['rsi'] < 25) &                      # 1. Oversold
            (df['low'] < df['bb_lower']) &          # 2. Below BB
            (df['volume_ratio'] > 2) &              # 3. High volume
            (df['bullish']) &                       # 4. Bullish candle
            (df['lower_wick'] > df['body']) &       # 5. Long lower wick
            (df['close'] > df['bb_lower'])          # 6. Close reclaim
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('5-Factor Confluence LONG', result, rr))

        # 5-factor confluence SHORT
        signals = df[
            (df['rsi'] > 75) &
            (df['high'] > df['bb_upper']) &
            (df['volume_ratio'] > 2) &
            (df['bearish']) &
            (df['upper_wick'] > df['body']) &
            (df['close'] < df['bb_upper'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'SHORT', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('5-Factor Confluence SHORT', result, rr))

        # Super tight: RSI < 20 + BB < lower + Vol > 3x + Strong bullish
        signals = df[
            (df['rsi'] < 20) &
            (df['bb_position'] < 0) &
            (df['volume_ratio'] > 3) &
            (df['bullish']) &
            (df['body_ratio'] > 0.7)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('Super Tight Confluence LONG', result, rr))

# ============================================================
# 9. TEST WITH TRAILING STOPS
# ============================================================
print("Testing Patterns with Trailing Stops...")

for stop_pct in [0.003, 0.004, 0.005, 0.006, 0.008]:
    for rr in [5, 6, 7, 8, 10]:
        target_pct = stop_pct * rr

        # RSI < 25 + Volume with trailing
        signals = df[
            (df['rsi'] < 25) &
            (df['volume_ratio'] > 2) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct, use_trailing=True)
        if result and result['win_rate'] >= 80:
            all_results.append(('RSI<25 + Vol (Trailing)', result, rr))

        # Low sweep with trailing
        signals = df[
            (df['swept_low']) &
            (df['bullish']) &
            (df['volume_ratio'] > 1.5)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct, use_trailing=True)
        if result and result['win_rate'] >= 80:
            all_results.append(('Low Sweep (Trailing)', result, rr))

# ============================================================
# 10. VOLATILITY-FILTERED PATTERNS
# ============================================================
print("Testing Volatility-Filtered Patterns...")

# Calculate volatility percentiles
vol_low = df['atr_pct'].quantile(0.25)
vol_high = df['atr_pct'].quantile(0.75)

for stop_pct in stop_losses:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        # Low volatility + RSI extreme
        signals = df[
            (df['atr_pct'] < vol_low) &
            (df['rsi'] < 25) &
            (df['bullish'])
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('LowVol + RSI<25', result, rr))

        # High volatility + extreme drop reversal
        signals = df[
            (df['atr_pct'] > vol_high) &
            (df['pct_change'].shift(1) < -0.5) &
            (df['bullish']) &
            (df['volume_ratio'] > 2)
        ].index.tolist()
        result = test_pattern_stats(df, signals, 'LONG', stop_pct, target_pct)
        if result and result['win_rate'] >= 80:
            all_results.append(('HighVol Drop Reversal', result, rr))

# ============================================================
# PRINT RESULTS
# ============================================================

print()
print("=" * 80)
print("PATTERNS WITH 80%+ WIN RATE")
print("=" * 80)
print()

# Sort by win rate, then by RR ratio
all_results.sort(key=lambda x: (x[1]['win_rate'], x[2]), reverse=True)

if all_results:
    # Filter for 90%+ first
    ninety_plus = [r for r in all_results if r[1]['win_rate'] >= 90]
    if ninety_plus:
        print("*** PATTERNS WITH 90%+ WIN RATE ***")
        print()
        for name, stats, rr in ninety_plus:
            print(f"Pattern: {name}")
            print(f"  Win Rate: {stats['win_rate']:.1f}%")
            print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
            print(f"  Stop: {stats['stop_pct']*100:.3f}%, Target: {stats['target_pct']*100:.3f}%")
            print(f"  R/R: 1:{rr}")
            print()

    # 85-90%
    eighty_five_plus = [r for r in all_results if 85 <= r[1]['win_rate'] < 90]
    if eighty_five_plus:
        print("*** PATTERNS WITH 85-90% WIN RATE ***")
        print()
        for name, stats, rr in eighty_five_plus[:10]:
            print(f"Pattern: {name}")
            print(f"  Win Rate: {stats['win_rate']:.1f}%")
            print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
            print(f"  Stop: {stats['stop_pct']*100:.3f}%, Target: {stats['target_pct']*100:.3f}%")
            print(f"  R/R: 1:{rr}")
            print()

    # 80-85%
    eighty_plus = [r for r in all_results if 80 <= r[1]['win_rate'] < 85]
    if eighty_plus:
        print("*** PATTERNS WITH 80-85% WIN RATE ***")
        print()
        for name, stats, rr in eighty_plus[:15]:
            print(f"Pattern: {name}")
            print(f"  Win Rate: {stats['win_rate']:.1f}%")
            print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
            print(f"  Stop: {stats['stop_pct']*100:.3f}%, Target: {stats['target_pct']*100:.3f}%")
            print(f"  R/R: 1:{rr}")
            print()
else:
    print("No patterns found with 80%+ win rate.")

# ============================================================
# DETAILED ANALYSIS OF BEST PATTERNS AT 5:1 RR
# ============================================================

print()
print("=" * 80)
print("BEST PATTERNS AT EXACTLY 5:1 R/R (Target Win Rate)")
print("=" * 80)
print()

# Filter for 5:1 RR
five_rr_results = [r for r in all_results if r[2] == 5]
five_rr_results.sort(key=lambda x: x[1]['win_rate'], reverse=True)

if five_rr_results:
    print("Top patterns at 5:1 R/R:")
    print()
    for name, stats, rr in five_rr_results[:10]:
        print(f"Pattern: {name}")
        print(f"  Win Rate: {stats['win_rate']:.1f}%")
        print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
        print(f"  Stop: {stats['stop_pct']*100:.3f}%, Target: {stats['target_pct']*100:.3f}%")
        print()
else:
    print("No patterns with 80%+ win rate at 5:1 RR found.")

print()
print("=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
