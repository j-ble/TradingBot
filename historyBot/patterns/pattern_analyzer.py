#!/usr/bin/env python3
"""
BTC/USDC 5-Minute Pattern Analyzer
Finds patterns with 90%+ win rate at 5:1 Risk/Reward
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

# Load data
df = pd.read_csv('data/btc_usdc_5m.csv')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

print(f"Loaded {len(df)} candles from {df['timestamp'].min()} to {df['timestamp'].max()}")
print(f"Price range: ${df['low'].min():,.2f} - ${df['high'].max():,.2f}")
print()

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def calculate_atr(df, period=14):
    """Calculate Average True Range"""
    high = df['high']
    low = df['low']
    close = df['close'].shift(1)

    tr1 = high - low
    tr2 = abs(high - close)
    tr3 = abs(low - close)

    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def calculate_rsi(df, period=14):
    """Calculate RSI"""
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def calculate_ema(series, period):
    """Calculate EMA"""
    return series.ewm(span=period, adjust=False).mean()

def calculate_sma(series, period):
    """Calculate SMA"""
    return series.rolling(window=period).mean()

def calculate_bollinger_bands(df, period=20, std_dev=2):
    """Calculate Bollinger Bands"""
    sma = df['close'].rolling(window=period).mean()
    std = df['close'].rolling(window=period).std()
    upper = sma + (std * std_dev)
    lower = sma - (std * std_dev)
    return upper, sma, lower

def get_swing_high(df, idx, lookback=5):
    """Check if index is a swing high"""
    if idx < lookback or idx >= len(df) - lookback:
        return False
    high = df['high'].iloc[idx]
    for i in range(idx - lookback, idx + lookback + 1):
        if i != idx and df['high'].iloc[i] >= high:
            return False
    return True

def get_swing_low(df, idx, lookback=5):
    """Check if index is a swing low"""
    if idx < lookback or idx >= len(df) - lookback:
        return False
    low = df['low'].iloc[idx]
    for i in range(idx - lookback, idx + lookback + 1):
        if i != idx and df['low'].iloc[i] <= low:
            return False
    return True

def simulate_trade(df, entry_idx, direction, stop_pct, target_pct, max_candles=288):
    """
    Simulate a trade and return result
    direction: 'LONG' or 'SHORT'
    stop_pct: stop loss percentage from entry
    target_pct: take profit percentage from entry (should be 5x stop for 5:1 RR)
    max_candles: max duration (288 = 24 hours of 5min candles)
    """
    if entry_idx >= len(df) - 1:
        return None

    entry_price = df['close'].iloc[entry_idx]

    if direction == 'LONG':
        stop_price = entry_price * (1 - stop_pct)
        target_price = entry_price * (1 + target_pct)
    else:  # SHORT
        stop_price = entry_price * (1 + stop_pct)
        target_price = entry_price * (1 - target_pct)

    for i in range(entry_idx + 1, min(entry_idx + max_candles + 1, len(df))):
        high = df['high'].iloc[i]
        low = df['low'].iloc[i]

        if direction == 'LONG':
            # Check stop first (assumes worst case)
            if low <= stop_price:
                return {'result': 'LOSS', 'exit_idx': i, 'exit_price': stop_price}
            if high >= target_price:
                return {'result': 'WIN', 'exit_idx': i, 'exit_price': target_price}
        else:  # SHORT
            if high >= stop_price:
                return {'result': 'LOSS', 'exit_idx': i, 'exit_price': stop_price}
            if low <= target_price:
                return {'result': 'WIN', 'exit_idx': i, 'exit_price': target_price}

    # Timeout - close at market
    exit_price = df['close'].iloc[min(entry_idx + max_candles, len(df) - 1)]
    if direction == 'LONG':
        return {'result': 'WIN' if exit_price > entry_price else 'LOSS', 'exit_idx': i, 'exit_price': exit_price}
    else:
        return {'result': 'WIN' if exit_price < entry_price else 'LOSS', 'exit_idx': i, 'exit_price': exit_price}

def test_pattern(df, signals, direction, stop_pct, target_pct, min_trades=10):
    """Test a pattern and return statistics"""
    wins = 0
    losses = 0
    trades = []

    last_exit_idx = 0

    for idx in signals:
        if idx <= last_exit_idx:  # Skip if we're still in a trade
            continue

        result = simulate_trade(df, idx, direction, stop_pct, target_pct)
        if result:
            trades.append(result)
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
df['atr'] = calculate_atr(df, 14)
df['rsi'] = calculate_rsi(df, 14)
df['rsi_7'] = calculate_rsi(df, 7)
df['ema_9'] = calculate_ema(df['close'], 9)
df['ema_21'] = calculate_ema(df['close'], 21)
df['ema_50'] = calculate_ema(df['close'], 50)
df['sma_20'] = calculate_sma(df['close'], 20)
df['sma_50'] = calculate_sma(df['close'], 50)
df['sma_200'] = calculate_sma(df['close'], 200)
df['bb_upper'], df['bb_mid'], df['bb_lower'] = calculate_bollinger_bands(df)

# Volume indicators
df['volume_sma'] = df['volume'].rolling(window=20).mean()
df['volume_ratio'] = df['volume'] / df['volume_sma']

# Candle characteristics
df['body'] = abs(df['close'] - df['open'])
df['range'] = df['high'] - df['low']
df['upper_wick'] = df['high'] - df[['open', 'close']].max(axis=1)
df['lower_wick'] = df[['open', 'close']].min(axis=1) - df['low']
df['bullish'] = df['close'] > df['open']
df['bearish'] = df['close'] < df['open']

# Momentum
df['momentum'] = df['close'] - df['close'].shift(12)  # 1 hour momentum
df['price_change_pct'] = df['close'].pct_change() * 100

# Previous candle data
df['prev_close'] = df['close'].shift(1)
df['prev_high'] = df['high'].shift(1)
df['prev_low'] = df['low'].shift(1)
df['prev_open'] = df['open'].shift(1)
df['prev_bullish'] = df['bullish'].shift(1)
df['prev_bearish'] = df['bearish'].shift(1)
df['prev_body'] = df['body'].shift(1)
df['prev_range'] = df['range'].shift(1)

print("Indicators calculated.")
print()

# ============================================================
# PATTERN DEFINITIONS
# ============================================================

results = []

# Define stop loss and target for 5:1 RR
stop_losses = [0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.01]  # 0.2% to 1%

print("=" * 80)
print("TESTING PATTERNS FOR 90%+ WIN RATE WITH 5:1 R/R")
print("=" * 80)
print()

# ============================================================
# 1. RSI EXTREME REVERSALS
# ============================================================
print("Testing RSI Extreme Reversals...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5  # 5:1 RR

    # RSI Oversold Bounce (LONG)
    signals = df[(df['rsi'] < 20) & (df['rsi'].shift(1) < 20) & (df['close'] > df['open'])].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('RSI < 20 Reversal (LONG)', result))

    # RSI Extreme Oversold (LONG)
    signals = df[(df['rsi'] < 15) & (df['close'] > df['open'])].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('RSI < 15 Extreme (LONG)', result))

    # RSI Overbought Rejection (SHORT)
    signals = df[(df['rsi'] > 80) & (df['rsi'].shift(1) > 80) & (df['close'] < df['open'])].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('RSI > 80 Reversal (SHORT)', result))

    # RSI Extreme Overbought (SHORT)
    signals = df[(df['rsi'] > 85) & (df['close'] < df['open'])].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('RSI > 85 Extreme (SHORT)', result))

# ============================================================
# 2. BOLLINGER BAND PATTERNS
# ============================================================
print("Testing Bollinger Band Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # BB Lower Touch + Bullish (LONG)
    signals = df[(df['low'] < df['bb_lower']) & (df['close'] > df['open']) & (df['close'] > df['bb_lower'])].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('BB Lower Bounce (LONG)', result))

    # BB Upper Touch + Bearish (SHORT)
    signals = df[(df['high'] > df['bb_upper']) & (df['close'] < df['open']) & (df['close'] < df['bb_upper'])].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('BB Upper Rejection (SHORT)', result))

# ============================================================
# 3. VOLUME SPIKE PATTERNS
# ============================================================
print("Testing Volume Spike Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # High Volume Bullish Candle (LONG)
    signals = df[(df['volume_ratio'] > 3) & (df['bullish']) & (df['body'] > df['range'] * 0.6)].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Volume Spike Bullish (LONG)', result))

    # High Volume Bearish Candle (SHORT)
    signals = df[(df['volume_ratio'] > 3) & (df['bearish']) & (df['body'] > df['range'] * 0.6)].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Volume Spike Bearish (SHORT)', result))

# ============================================================
# 4. ENGULFING PATTERNS
# ============================================================
print("Testing Engulfing Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Bullish Engulfing
    signals = df[
        (df['prev_bearish'] == True) &
        (df['bullish'] == True) &
        (df['open'] <= df['prev_close']) &
        (df['close'] >= df['prev_open']) &
        (df['body'] > df['prev_body'] * 1.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Bullish Engulfing (LONG)', result))

    # Bearish Engulfing
    signals = df[
        (df['prev_bullish'] == True) &
        (df['bearish'] == True) &
        (df['open'] >= df['prev_close']) &
        (df['close'] <= df['prev_open']) &
        (df['body'] > df['prev_body'] * 1.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Bearish Engulfing (SHORT)', result))

# ============================================================
# 5. PIN BAR / HAMMER PATTERNS
# ============================================================
print("Testing Pin Bar Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Bullish Pin Bar (Hammer)
    signals = df[
        (df['lower_wick'] > df['body'] * 2) &
        (df['upper_wick'] < df['body'] * 0.5) &
        (df['range'] > df['atr'] * 0.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Bullish Pin Bar (LONG)', result))

    # Bearish Pin Bar (Shooting Star)
    signals = df[
        (df['upper_wick'] > df['body'] * 2) &
        (df['lower_wick'] < df['body'] * 0.5) &
        (df['range'] > df['atr'] * 0.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Bearish Pin Bar (SHORT)', result))

# ============================================================
# 6. EMA CROSSOVER PATTERNS
# ============================================================
print("Testing EMA Crossover Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # EMA 9 crosses above EMA 21 (LONG)
    signals = df[
        (df['ema_9'] > df['ema_21']) &
        (df['ema_9'].shift(1) <= df['ema_21'].shift(1)) &
        (df['close'] > df['ema_9'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('EMA 9/21 Bullish Cross (LONG)', result))

    # EMA 9 crosses below EMA 21 (SHORT)
    signals = df[
        (df['ema_9'] < df['ema_21']) &
        (df['ema_9'].shift(1) >= df['ema_21'].shift(1)) &
        (df['close'] < df['ema_9'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('EMA 9/21 Bearish Cross (SHORT)', result))

# ============================================================
# 7. MULTI-CONFLUENCE PATTERNS (Most Promising)
# ============================================================
print("Testing Multi-Confluence Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # RSI Oversold + BB Lower + Volume Spike + Bullish (LONG)
    signals = df[
        (df['rsi'] < 30) &
        (df['low'] < df['bb_lower']) &
        (df['volume_ratio'] > 2) &
        (df['bullish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Triple Confluence Oversold (LONG)', result))

    # RSI Overbought + BB Upper + Volume Spike + Bearish (SHORT)
    signals = df[
        (df['rsi'] > 70) &
        (df['high'] > df['bb_upper']) &
        (df['volume_ratio'] > 2) &
        (df['bearish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Triple Confluence Overbought (SHORT)', result))

    # Trend Following: Above SMA 200 + EMA 9 > EMA 21 + RSI < 40 pullback (LONG)
    signals = df[
        (df['close'] > df['sma_200']) &
        (df['ema_9'] > df['ema_21']) &
        (df['rsi'] < 40) &
        (df['rsi'] > 30) &
        (df['bullish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Trend Pullback (LONG)', result))

    # Trend Following: Below SMA 200 + EMA 9 < EMA 21 + RSI > 60 pullback (SHORT)
    signals = df[
        (df['close'] < df['sma_200']) &
        (df['ema_9'] < df['ema_21']) &
        (df['rsi'] > 60) &
        (df['rsi'] < 70) &
        (df['bearish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Trend Pullback (SHORT)', result))

# ============================================================
# 8. CONSECUTIVE CANDLE PATTERNS
# ============================================================
print("Testing Consecutive Candle Patterns...")

# Calculate consecutive candles
df['consec_red'] = 0
df['consec_green'] = 0

for i in range(1, len(df)):
    if df['bearish'].iloc[i]:
        df.loc[df.index[i], 'consec_red'] = df['consec_red'].iloc[i-1] + 1
    else:
        df.loc[df.index[i], 'consec_red'] = 0

    if df['bullish'].iloc[i]:
        df.loc[df.index[i], 'consec_green'] = df['consec_green'].iloc[i-1] + 1
    else:
        df.loc[df.index[i], 'consec_green'] = 0

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # 5+ consecutive red candles then green (LONG)
    signals = df[
        (df['consec_red'].shift(1) >= 5) &
        (df['bullish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('5+ Red Then Green (LONG)', result))

    # 5+ consecutive green candles then red (SHORT)
    signals = df[
        (df['consec_green'].shift(1) >= 5) &
        (df['bearish'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('5+ Green Then Red (SHORT)', result))

# ============================================================
# 9. SWING LEVEL PATTERNS
# ============================================================
print("Testing Swing Level Patterns...")

# Identify swing highs and lows
swing_highs = []
swing_lows = []

for i in range(10, len(df) - 10):
    if get_swing_high(df, i, lookback=5):
        swing_highs.append(i)
    if get_swing_low(df, i, lookback=5):
        swing_lows.append(i)

df['near_swing_low'] = False
df['near_swing_high'] = False

for sh in swing_highs:
    level = df['high'].iloc[sh]
    # Mark candles that are near this level
    for i in range(sh + 10, min(sh + 200, len(df))):
        if abs(df['close'].iloc[i] - level) / level < 0.003:  # Within 0.3%
            df.loc[df.index[i], 'near_swing_high'] = True

for sl in swing_lows:
    level = df['low'].iloc[sl]
    for i in range(sl + 10, min(sl + 200, len(df))):
        if abs(df['close'].iloc[i] - level) / level < 0.003:
            df.loc[df.index[i], 'near_swing_low'] = True

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Bounce from swing low (LONG)
    signals = df[
        (df['near_swing_low']) &
        (df['bullish']) &
        (df['lower_wick'] > df['body'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Swing Low Bounce (LONG)', result))

    # Rejection from swing high (SHORT)
    signals = df[
        (df['near_swing_high']) &
        (df['bearish']) &
        (df['upper_wick'] > df['body'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Swing High Rejection (SHORT)', result))

# ============================================================
# 10. EXTREME MOVES REVERSAL
# ============================================================
print("Testing Extreme Move Reversals...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Large drop followed by reversal (LONG)
    signals = df[
        (df['price_change_pct'].shift(1) < -0.5) &  # Previous candle dropped 0.5%+
        (df['bullish']) &
        (df['body'] > df['atr'] * 0.3)
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Large Drop Reversal (LONG)', result))

    # Large pump followed by reversal (SHORT)
    signals = df[
        (df['price_change_pct'].shift(1) > 0.5) &  # Previous candle pumped 0.5%+
        (df['bearish']) &
        (df['body'] > df['atr'] * 0.3)
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Large Pump Reversal (SHORT)', result))

# ============================================================
# 11. MORE AGGRESSIVE MULTI-CONFLUENCE
# ============================================================
print("Testing Aggressive Multi-Confluence Patterns...")

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # RSI < 25 + Below BB + Volume > 2.5x + Hammer pattern (LONG)
    signals = df[
        (df['rsi'] < 25) &
        (df['low'] < df['bb_lower']) &
        (df['volume_ratio'] > 2.5) &
        (df['lower_wick'] > df['body'] * 1.5) &
        (df['close'] > df['open'])
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Quad Confluence Hammer (LONG)', result))

    # RSI > 75 + Above BB + Volume > 2.5x + Shooting star pattern (SHORT)
    signals = df[
        (df['rsi'] > 75) &
        (df['high'] > df['bb_upper']) &
        (df['volume_ratio'] > 2.5) &
        (df['upper_wick'] > df['body'] * 1.5) &
        (df['close'] < df['open'])
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('Quad Confluence Shooting Star (SHORT)', result))

# ============================================================
# 12. LIQUIDITY SWEEP PATTERNS (Based on your trading system)
# ============================================================
print("Testing Liquidity Sweep Patterns...")

# Find recent highs and lows for sweep detection
df['high_20'] = df['high'].rolling(window=20).max()
df['low_20'] = df['low'].rolling(window=20).min()
df['high_50'] = df['high'].rolling(window=50).max()
df['low_50'] = df['low'].rolling(window=50).min()

for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Sweep of 20-period low then reversal (LONG)
    signals = df[
        (df['low'] < df['low_20'].shift(1)) &  # New low (sweep)
        (df['close'] > df['open']) &  # Bullish close
        (df['close'] > df['low_20'].shift(1)) &  # Close above old low (reclaim)
        (df['volume_ratio'] > 1.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('20-Period Low Sweep Reversal (LONG)', result))

    # Sweep of 20-period high then reversal (SHORT)
    signals = df[
        (df['high'] > df['high_20'].shift(1)) &  # New high (sweep)
        (df['close'] < df['open']) &  # Bearish close
        (df['close'] < df['high_20'].shift(1)) &  # Close below old high (rejection)
        (df['volume_ratio'] > 1.5)
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('20-Period High Sweep Rejection (SHORT)', result))

    # Sweep of 50-period low then reversal (LONG)
    signals = df[
        (df['low'] < df['low_50'].shift(1)) &
        (df['close'] > df['open']) &
        (df['close'] > df['low_50'].shift(1)) &
        (df['volume_ratio'] > 2)
    ].index.tolist()
    result = test_pattern(df, signals, 'LONG', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('50-Period Low Sweep Reversal (LONG)', result))

    # Sweep of 50-period high then reversal (SHORT)
    signals = df[
        (df['high'] > df['high_50'].shift(1)) &
        (df['close'] < df['open']) &
        (df['close'] < df['high_50'].shift(1)) &
        (df['volume_ratio'] > 2)
    ].index.tolist()
    result = test_pattern(df, signals, 'SHORT', stop_pct, target_pct)
    if result and result['win_rate'] >= 85:
        results.append(('50-Period High Sweep Rejection (SHORT)', result))

# ============================================================
# PRINT RESULTS
# ============================================================

print()
print("=" * 80)
print("PATTERNS WITH 85%+ WIN RATE AT 5:1 R/R")
print("=" * 80)
print()

# Sort by win rate
results.sort(key=lambda x: x[1]['win_rate'], reverse=True)

if results:
    for name, stats in results:
        print(f"Pattern: {name}")
        print(f"  Win Rate: {stats['win_rate']:.1f}%")
        print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
        print(f"  Stop: {stats['stop_pct']*100:.2f}%, Target: {stats['target_pct']*100:.2f}%")
        print(f"  R/R: 1:{stats['rr_ratio']:.1f}")
        print()
else:
    print("No patterns found with 85%+ win rate at 5:1 R/R with minimum 10 trades.")
    print()
    print("Searching for best available patterns...")
    print()

# ============================================================
# FIND BEST PATTERNS (even if below 90%)
# ============================================================

print("=" * 80)
print("TOP PERFORMING PATTERNS (ANY WIN RATE)")
print("=" * 80)
print()

all_results = []

# Re-run with lower threshold to show best patterns
for stop_pct in stop_losses:
    target_pct = stop_pct * 5

    # Test all patterns and collect results
    patterns_to_test = [
        ('RSI < 20 Reversal (LONG)', df[(df['rsi'] < 20) & (df['rsi'].shift(1) < 20) & (df['close'] > df['open'])].index.tolist(), 'LONG'),
        ('RSI < 15 Extreme (LONG)', df[(df['rsi'] < 15) & (df['close'] > df['open'])].index.tolist(), 'LONG'),
        ('RSI > 80 Reversal (SHORT)', df[(df['rsi'] > 80) & (df['rsi'].shift(1) > 80) & (df['close'] < df['open'])].index.tolist(), 'SHORT'),
        ('BB Lower Bounce (LONG)', df[(df['low'] < df['bb_lower']) & (df['close'] > df['open']) & (df['close'] > df['bb_lower'])].index.tolist(), 'LONG'),
        ('BB Upper Rejection (SHORT)', df[(df['high'] > df['bb_upper']) & (df['close'] < df['open']) & (df['close'] < df['bb_upper'])].index.tolist(), 'SHORT'),
        ('Volume Spike Bullish (LONG)', df[(df['volume_ratio'] > 3) & (df['bullish']) & (df['body'] > df['range'] * 0.6)].index.tolist(), 'LONG'),
        ('Volume Spike Bearish (SHORT)', df[(df['volume_ratio'] > 3) & (df['bearish']) & (df['body'] > df['range'] * 0.6)].index.tolist(), 'SHORT'),
        ('Triple Confluence Oversold (LONG)', df[(df['rsi'] < 30) & (df['low'] < df['bb_lower']) & (df['volume_ratio'] > 2) & (df['bullish'])].index.tolist(), 'LONG'),
        ('Triple Confluence Overbought (SHORT)', df[(df['rsi'] > 70) & (df['high'] > df['bb_upper']) & (df['volume_ratio'] > 2) & (df['bearish'])].index.tolist(), 'SHORT'),
        ('5+ Red Then Green (LONG)', df[(df['consec_red'].shift(1) >= 5) & (df['bullish'])].index.tolist(), 'LONG'),
        ('5+ Green Then Red (SHORT)', df[(df['consec_green'].shift(1) >= 5) & (df['bearish'])].index.tolist(), 'SHORT'),
        ('20-Period Low Sweep (LONG)', df[(df['low'] < df['low_20'].shift(1)) & (df['close'] > df['open']) & (df['close'] > df['low_20'].shift(1)) & (df['volume_ratio'] > 1.5)].index.tolist(), 'LONG'),
        ('20-Period High Sweep (SHORT)', df[(df['high'] > df['high_20'].shift(1)) & (df['close'] < df['open']) & (df['close'] < df['high_20'].shift(1)) & (df['volume_ratio'] > 1.5)].index.tolist(), 'SHORT'),
        ('Bullish Pin Bar (LONG)', df[(df['lower_wick'] > df['body'] * 2) & (df['upper_wick'] < df['body'] * 0.5) & (df['range'] > df['atr'] * 0.5)].index.tolist(), 'LONG'),
        ('Bearish Pin Bar (SHORT)', df[(df['upper_wick'] > df['body'] * 2) & (df['lower_wick'] < df['body'] * 0.5) & (df['range'] > df['atr'] * 0.5)].index.tolist(), 'SHORT'),
    ]

    for name, signals, direction in patterns_to_test:
        result = test_pattern(df, signals, direction, stop_pct, target_pct, min_trades=5)
        if result:
            all_results.append((name, result, stop_pct))

# Sort by win rate
all_results.sort(key=lambda x: x[1]['win_rate'], reverse=True)

# Print top 15
for i, (name, stats, stop) in enumerate(all_results[:15]):
    print(f"{i+1}. {name}")
    print(f"   Win Rate: {stats['win_rate']:.1f}% | Trades: {stats['total']} | Stop: {stop*100:.2f}%")
    print()

# ============================================================
# SEARCH FOR 90%+ WITH DIFFERENT R/R RATIOS
# ============================================================

print("=" * 80)
print("SEARCHING FOR 90%+ WIN RATE WITH VARIOUS R/R RATIOS")
print("=" * 80)
print()

high_wr_results = []

rr_ratios = [2, 3, 4, 5, 6, 7, 8, 10]

for stop_pct in [0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.01]:
    for rr in rr_ratios:
        target_pct = stop_pct * rr

        patterns_to_test = [
            ('RSI < 20 + Bullish', df[(df['rsi'] < 20) & (df['bullish'])].index.tolist(), 'LONG'),
            ('RSI < 25 + Bullish', df[(df['rsi'] < 25) & (df['bullish'])].index.tolist(), 'LONG'),
            ('RSI < 30 + Bullish Engulf', df[(df['rsi'] < 30) & (df['bullish']) & (df['body'] > df['prev_body'])].index.tolist(), 'LONG'),
            ('RSI > 80 + Bearish', df[(df['rsi'] > 80) & (df['bearish'])].index.tolist(), 'SHORT'),
            ('RSI > 75 + Bearish', df[(df['rsi'] > 75) & (df['bearish'])].index.tolist(), 'SHORT'),
            ('BB Lower + RSI < 30', df[(df['low'] < df['bb_lower']) & (df['rsi'] < 30) & (df['bullish'])].index.tolist(), 'LONG'),
            ('BB Upper + RSI > 70', df[(df['high'] > df['bb_upper']) & (df['rsi'] > 70) & (df['bearish'])].index.tolist(), 'SHORT'),
            ('Extreme Vol + RSI < 30', df[(df['volume_ratio'] > 3) & (df['rsi'] < 30) & (df['bullish'])].index.tolist(), 'LONG'),
            ('Extreme Vol + RSI > 70', df[(df['volume_ratio'] > 3) & (df['rsi'] > 70) & (df['bearish'])].index.tolist(), 'SHORT'),
            ('Low Sweep + Vol', df[(df['low'] < df['low_20'].shift(1)) & (df['close'] > df['low_20'].shift(1)) & (df['volume_ratio'] > 2) & (df['bullish'])].index.tolist(), 'LONG'),
            ('High Sweep + Vol', df[(df['high'] > df['high_20'].shift(1)) & (df['close'] < df['high_20'].shift(1)) & (df['volume_ratio'] > 2) & (df['bearish'])].index.tolist(), 'SHORT'),
        ]

        for name, signals, direction in patterns_to_test:
            result = test_pattern(df, signals, direction, stop_pct, target_pct, min_trades=5)
            if result and result['win_rate'] >= 90:
                high_wr_results.append((name, result, rr, stop_pct))

high_wr_results.sort(key=lambda x: (x[1]['win_rate'], x[2]), reverse=True)

if high_wr_results:
    print("FOUND PATTERNS WITH 90%+ WIN RATE:")
    print()
    for name, stats, rr, stop in high_wr_results[:20]:
        print(f"Pattern: {name}")
        print(f"  Win Rate: {stats['win_rate']:.1f}%")
        print(f"  Trades: {stats['total']} (W: {stats['wins']}, L: {stats['losses']})")
        print(f"  Stop: {stop*100:.2f}%, Target: {stop*rr*100:.2f}%")
        print(f"  R/R: 1:{rr}")
        print()
else:
    print("No patterns found with 90%+ win rate.")

print("=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
