#!/usr/bin/env python3
"""
1M EFFICIENCY ANALYSIS
Goal: Can we reduce risk without changing outcomes?

What we're testing:
1. Stop efficiency - Can 1M provide tighter stops vs 5M?
2. Entry precision - Market vs limit order improvement

What we're NOT doing:
- Changing bias (4H is locked)
- Adding confirmation logic
- Modifying strategy

PASS criteria:
- R:R improves
- Drawdown reduces
- Win rate stable (within 5%)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass
from enum import Enum

# ============================================================================
# DATA STRUCTURES
# ============================================================================

class Direction(Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"

class Session(Enum):
    ASIA = "ASIA"          # 00:00-08:00 UTC
    LONDON = "LONDON"      # 08:00-14:00 UTC
    NY_OPEN = "NY_OPEN"    # 14:00-17:00 UTC - BLOCKED
    NY_MID = "NY_MID"      # 17:00-22:00 UTC - PREFERRED

@dataclass
class Signal4H:
    timestamp: datetime
    direction: Direction
    sweep_price: float
    rsi: float
    confirmation_close: float

@dataclass
class Entry5M:
    timestamp: datetime
    entry_price: float
    reclaim_price: float
    latency_minutes: int

@dataclass
class Stop:
    price: float
    distance_pct: float
    swing_timestamp: datetime
    source: str  # "5M" or "1M"

@dataclass
class Trade:
    signal: Signal4H
    entry: Entry5M
    stop_5m: Stop
    stop_1m: Optional[Stop]
    mfe: float  # Maximum Favorable Excursion
    mae: float  # Maximum Adverse Excursion
    outcome_5m: str  # WIN/LOSS with 5M stop
    outcome_1m: str  # WIN/LOSS with 1M stop (if applicable)
    session: Session

# ============================================================================
# CANDLE AGGREGATION
# ============================================================================

def load_1m_data(filepath: str) -> pd.DataFrame:
    """Load 1M candle data"""
    df = pd.read_csv(filepath)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df

def aggregate_candles(df_1m: pd.DataFrame, period: str) -> pd.DataFrame:
    """Aggregate 1M candles to higher timeframe"""
    df = df_1m.set_index('timestamp')

    agg_dict = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
        'volume': 'sum'
    }

    df_agg = df.resample(period).agg(agg_dict).dropna()
    df_agg = df_agg.reset_index()
    return df_agg

def calculate_rsi(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Calculate RSI"""
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)

    avg_gain = gain.ewm(span=period, adjust=False).mean()
    avg_loss = loss.ewm(span=period, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# ============================================================================
# SWING DETECTION
# ============================================================================

def detect_swings(df: pd.DataFrame, lookback: int = 3) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Detect swing highs and lows using n-candle pattern
    Returns two dataframes: swing_highs and swing_lows
    """
    swing_highs = []
    swing_lows = []

    for i in range(lookback, len(df) - lookback):
        # Check for swing high
        is_swing_high = True
        for j in range(1, lookback + 1):
            if df.iloc[i]['high'] <= df.iloc[i-j]['high'] or df.iloc[i]['high'] <= df.iloc[i+j]['high']:
                is_swing_high = False
                break
        if is_swing_high:
            swing_highs.append({
                'timestamp': df.iloc[i]['timestamp'],
                'price': df.iloc[i]['high'],
                'index': i
            })

        # Check for swing low
        is_swing_low = True
        for j in range(1, lookback + 1):
            if df.iloc[i]['low'] >= df.iloc[i-j]['low'] or df.iloc[i]['low'] >= df.iloc[i+j]['low']:
                is_swing_low = False
                break
        if is_swing_low:
            swing_lows.append({
                'timestamp': df.iloc[i]['timestamp'],
                'price': df.iloc[i]['low'],
                'index': i
            })

    return pd.DataFrame(swing_highs), pd.DataFrame(swing_lows)

# ============================================================================
# 4H SIGNAL DETECTION (Per Locked Contract)
# ============================================================================

def detect_4h_signals(df_4h: pd.DataFrame) -> List[Signal4H]:
    """
    Detect 4H signals per locked contract:

    BULLISH:
    1. 4H LOW sweep (wick below swing low, close above)
    2. RSI < 40 at sweep candle
    3. Next candle closes HIGHER

    BEARISH:
    1. 4H HIGH sweep (wick above swing high, close below)
    2. RSI > 80 at sweep candle
    3. Next candle closes LOWER
    """
    signals = []
    df_4h['rsi'] = calculate_rsi(df_4h)

    # Get swings
    swing_highs, swing_lows = detect_swings(df_4h, lookback=3)

    if swing_highs.empty and swing_lows.empty:
        return signals

    for i in range(10, len(df_4h) - 1):  # Need room for lookback and confirmation
        candle = df_4h.iloc[i]
        next_candle = df_4h.iloc[i + 1]
        rsi = candle['rsi']

        # Check BULLISH: LOW sweep with RSI < 40
        if rsi < 40:
            # Find recent swing lows to check for sweep
            recent_swing_lows = swing_lows[
                (swing_lows['timestamp'] < candle['timestamp']) &
                (swing_lows['timestamp'] > candle['timestamp'] - timedelta(days=7))
            ]

            for _, swing in recent_swing_lows.iterrows():
                # Sweep: wick below, close above
                if candle['low'] < swing['price'] and candle['close'] > swing['price']:
                    # Confirmation: next candle closes higher
                    if next_candle['close'] > candle['close']:
                        signals.append(Signal4H(
                            timestamp=candle['timestamp'],
                            direction=Direction.BULLISH,
                            sweep_price=swing['price'],
                            rsi=rsi,
                            confirmation_close=next_candle['close']
                        ))
                        break  # One signal per candle

        # Check BEARISH: HIGH sweep with RSI > 80
        if rsi > 80:
            recent_swing_highs = swing_highs[
                (swing_highs['timestamp'] < candle['timestamp']) &
                (swing_highs['timestamp'] > candle['timestamp'] - timedelta(days=7))
            ]

            for _, swing in recent_swing_highs.iterrows():
                # Sweep: wick above, close below
                if candle['high'] > swing['price'] and candle['close'] < swing['price']:
                    # Confirmation: next candle closes lower
                    if next_candle['close'] < candle['close']:
                        signals.append(Signal4H(
                            timestamp=candle['timestamp'],
                            direction=Direction.BEARISH,
                            sweep_price=swing['price'],
                            rsi=rsi,
                            confirmation_close=next_candle['close']
                        ))
                        break

    return signals

# ============================================================================
# SESSION FILTER (Per 1H Contract)
# ============================================================================

def get_session(ts: datetime) -> Session:
    """Determine trading session from timestamp (UTC)"""
    hour = ts.hour
    if 0 <= hour < 8:
        return Session.ASIA
    elif 8 <= hour < 14:
        return Session.LONDON
    elif 14 <= hour < 17:
        return Session.NY_OPEN
    else:
        return Session.NY_MID

def is_blocked_session(ts: datetime) -> bool:
    """Check if timestamp is in NY_OPEN (blocked per 1H contract)"""
    return get_session(ts) == Session.NY_OPEN

# ============================================================================
# 5M EXECUTION (Per Locked Contract)
# ============================================================================

def find_5m_reclaim(df_5m: pd.DataFrame, signal: Signal4H, max_hours: int = 4) -> Optional[Entry5M]:
    """
    Find 5M reclaim per locked contract:
    - BULLISH: 5M close > swept level + 0.2%
    - BEARISH: 5M close < swept level - 0.2%
    - Must occur within max_hours (prefer 1-2 hours)
    """
    buffer_pct = 0.002  # 0.2%

    # Get 5M candles after 4H signal (after confirmation candle completes)
    signal_end = signal.timestamp + timedelta(hours=4)  # 4H candle + confirmation
    window_end = signal_end + timedelta(hours=max_hours)

    mask = (df_5m['timestamp'] > signal_end) & (df_5m['timestamp'] <= window_end)
    window = df_5m[mask]

    for _, candle in window.iterrows():
        if signal.direction == Direction.BULLISH:
            reclaim_level = signal.sweep_price * (1 + buffer_pct)
            if candle['close'] > reclaim_level:
                latency = int((candle['timestamp'] - signal_end).total_seconds() / 60)
                return Entry5M(
                    timestamp=candle['timestamp'],
                    entry_price=candle['close'],
                    reclaim_price=reclaim_level,
                    latency_minutes=latency
                )
        else:  # BEARISH
            reclaim_level = signal.sweep_price * (1 - buffer_pct)
            if candle['close'] < reclaim_level:
                latency = int((candle['timestamp'] - signal_end).total_seconds() / 60)
                return Entry5M(
                    timestamp=candle['timestamp'],
                    entry_price=candle['close'],
                    reclaim_price=reclaim_level,
                    latency_minutes=latency
                )

    return None

# ============================================================================
# STOP CALCULATION - THE CORE OF 1M EFFICIENCY TEST
# ============================================================================

def find_5m_stop(df_5m: pd.DataFrame, entry: Entry5M, direction: Direction,
                 lookback_candles: int = 20) -> Optional[Stop]:
    """Find stop based on 5M swing levels"""
    # Get candles before entry
    mask = df_5m['timestamp'] < entry.timestamp
    recent = df_5m[mask].tail(lookback_candles)

    if recent.empty:
        return None

    swing_highs, swing_lows = detect_swings(recent, lookback=2)

    if direction == Direction.BULLISH:
        # Stop below recent swing low
        if swing_lows.empty:
            swing_low = recent['low'].min()
        else:
            swing_low = swing_lows['price'].iloc[-1]

        stop_price = swing_low * 0.998  # 0.2% buffer below
        distance_pct = (entry.entry_price - stop_price) / entry.entry_price * 100

        return Stop(
            price=stop_price,
            distance_pct=distance_pct,
            swing_timestamp=recent.iloc[-1]['timestamp'],
            source="5M"
        )
    else:  # BEARISH
        if swing_highs.empty:
            swing_high = recent['high'].max()
        else:
            swing_high = swing_highs['price'].iloc[-1]

        stop_price = swing_high * 1.002  # 0.2% buffer above
        distance_pct = (stop_price - entry.entry_price) / entry.entry_price * 100

        return Stop(
            price=stop_price,
            distance_pct=distance_pct,
            swing_timestamp=recent.iloc[-1]['timestamp'],
            source="5M"
        )

def find_1m_refined_stop(df_1m: pd.DataFrame, entry: Entry5M, direction: Direction,
                          lookback_candles: int = 60) -> Optional[Stop]:
    """
    Find tighter stop using 1M swing levels

    This is the core efficiency test:
    - Can we find a closer swing on 1M that still protects the trade?
    """
    # Get 1M candles in a window around entry
    entry_idx = df_1m[df_1m['timestamp'] <= entry.timestamp].index[-1]
    start_idx = max(0, entry_idx - lookback_candles)
    recent = df_1m.iloc[start_idx:entry_idx]

    if recent.empty:
        return None

    swing_highs, swing_lows = detect_swings(recent, lookback=2)

    if direction == Direction.BULLISH:
        if swing_lows.empty:
            return None

        # Find the CLOSEST swing low that's still below entry
        valid_swings = swing_lows[swing_lows['price'] < entry.entry_price]
        if valid_swings.empty:
            return None

        # Take the most recent (closest in time, likely closest in price)
        best_swing = valid_swings.iloc[-1]
        stop_price = best_swing['price'] * 0.999  # 0.1% buffer (tighter than 5M)
        distance_pct = (entry.entry_price - stop_price) / entry.entry_price * 100

        # Validate: must be at least 0.1% away (avoid too tight)
        if distance_pct < 0.1:
            return None

        return Stop(
            price=stop_price,
            distance_pct=distance_pct,
            swing_timestamp=best_swing['timestamp'],
            source="1M"
        )
    else:  # BEARISH
        if swing_highs.empty:
            return None

        valid_swings = swing_highs[swing_highs['price'] > entry.entry_price]
        if valid_swings.empty:
            return None

        best_swing = valid_swings.iloc[-1]
        stop_price = best_swing['price'] * 1.001  # 0.1% buffer
        distance_pct = (stop_price - entry.entry_price) / entry.entry_price * 100

        if distance_pct < 0.1:
            return None

        return Stop(
            price=stop_price,
            distance_pct=distance_pct,
            swing_timestamp=best_swing['timestamp'],
            source="1M"
        )

# ============================================================================
# MFE/MAE CALCULATION
# ============================================================================

def calculate_mfe_mae(df_1m: pd.DataFrame, entry: Entry5M, direction: Direction,
                      max_hours: int = 24) -> Tuple[float, float]:
    """
    Calculate Maximum Favorable Excursion and Maximum Adverse Excursion
    over a fixed time window
    """
    window_end = entry.timestamp + timedelta(hours=max_hours)
    mask = (df_1m['timestamp'] > entry.timestamp) & (df_1m['timestamp'] <= window_end)
    window = df_1m[mask]

    if window.empty:
        return 0.0, 0.0

    if direction == Direction.BULLISH:
        max_price = window['high'].max()
        min_price = window['low'].min()
        mfe = (max_price - entry.entry_price) / entry.entry_price * 100
        mae = (entry.entry_price - min_price) / entry.entry_price * 100
    else:  # BEARISH
        max_price = window['high'].max()
        min_price = window['low'].min()
        mfe = (entry.entry_price - min_price) / entry.entry_price * 100
        mae = (max_price - entry.entry_price) / entry.entry_price * 100

    return mfe, mae

def determine_outcome(mfe: float, mae: float, stop_distance: float,
                      target_rr: float = 2.0) -> str:
    """
    Determine if trade would have won or lost
    - WIN: Price hits target (stop_distance * target_rr) before stop
    - LOSS: Price hits stop before target
    """
    target = stop_distance * target_rr

    # Check which happened first (simplified: use MFE/MAE)
    if mae >= stop_distance:
        return "LOSS"
    elif mfe >= target:
        return "WIN"
    else:
        return "NEUTRAL"  # Neither hit within window

# ============================================================================
# ENTRY PRECISION TEST
# ============================================================================

def test_limit_entry(df_1m: pd.DataFrame, entry: Entry5M, direction: Direction,
                     improvement_target: float = 0.1) -> Dict:
    """
    Test if a limit order could have gotten better entry

    Looks for retracement after entry signal within 15 minutes
    """
    window_end = entry.timestamp + timedelta(minutes=15)
    mask = (df_1m['timestamp'] > entry.timestamp) & (df_1m['timestamp'] <= window_end)
    window = df_1m[mask]

    if window.empty:
        return {'could_improve': False, 'improvement_pct': 0}

    if direction == Direction.BULLISH:
        # Look for lower price (better long entry)
        best_entry = window['low'].min()
        improvement = (entry.entry_price - best_entry) / entry.entry_price * 100
    else:
        # Look for higher price (better short entry)
        best_entry = window['high'].max()
        improvement = (best_entry - entry.entry_price) / entry.entry_price * 100

    return {
        'could_improve': improvement >= improvement_target,
        'improvement_pct': improvement,
        'best_price': best_entry
    }

# ============================================================================
# MAIN ANALYSIS
# ============================================================================

def run_analysis(filepath: str) -> Dict:
    """Run complete 1M efficiency analysis"""
    print("=" * 70)
    print("1M EFFICIENCY ANALYSIS")
    print("Goal: Can we reduce risk without changing outcomes?")
    print("=" * 70)

    # Load data
    print("\n[1] Loading 1M data...")
    df_1m = load_1m_data(filepath)
    print(f"    Loaded {len(df_1m):,} candles")
    print(f"    Range: {df_1m['timestamp'].min()} to {df_1m['timestamp'].max()}")

    # Aggregate to 5M and 4H
    print("\n[2] Aggregating candles...")
    df_5m = aggregate_candles(df_1m, '5T')
    df_4h = aggregate_candles(df_1m, '4H')
    print(f"    5M candles: {len(df_5m):,}")
    print(f"    4H candles: {len(df_4h):,}")

    # Detect 4H signals
    print("\n[3] Detecting 4H signals (per locked contract)...")
    signals = detect_4h_signals(df_4h)
    print(f"    Found {len(signals)} raw 4H signals")

    # Process each signal
    print("\n[4] Processing signals through execution layers...")
    trades = []
    blocked_by_session = 0
    no_reclaim = 0

    for signal in signals:
        # Session filter (1H contract)
        if is_blocked_session(signal.timestamp):
            blocked_by_session += 1
            continue

        # Find 5M reclaim
        entry = find_5m_reclaim(df_5m, signal)
        if entry is None:
            no_reclaim += 1
            continue

        # Check session at entry time
        if is_blocked_session(entry.timestamp):
            blocked_by_session += 1
            continue

        # Calculate stops
        stop_5m = find_5m_stop(df_5m, entry, signal.direction)
        stop_1m = find_1m_refined_stop(df_1m, entry, signal.direction)

        if stop_5m is None:
            continue

        # Calculate MFE/MAE
        mfe, mae = calculate_mfe_mae(df_1m, entry, signal.direction)

        # Determine outcomes
        outcome_5m = determine_outcome(mfe, mae, stop_5m.distance_pct)
        outcome_1m = determine_outcome(mfe, mae, stop_1m.distance_pct) if stop_1m else "N/A"

        trade = Trade(
            signal=signal,
            entry=entry,
            stop_5m=stop_5m,
            stop_1m=stop_1m,
            mfe=mfe,
            mae=mae,
            outcome_5m=outcome_5m,
            outcome_1m=outcome_1m,
            session=get_session(entry.timestamp)
        )
        trades.append(trade)

    print(f"    Blocked by session filter: {blocked_by_session}")
    print(f"    No 5M reclaim found: {no_reclaim}")
    print(f"    Valid trades for analysis: {len(trades)}")

    if not trades:
        print("\n[!] No valid trades found for analysis")
        return {}

    # ========================================================================
    # ANALYSIS RESULTS
    # ========================================================================

    print("\n" + "=" * 70)
    print("RESULTS")
    print("=" * 70)

    # 1. Stop Efficiency Analysis
    print("\n[A] STOP EFFICIENCY ANALYSIS")
    print("-" * 50)

    trades_with_1m_stop = [t for t in trades if t.stop_1m is not None]
    print(f"Trades with 1M refined stop: {len(trades_with_1m_stop)} / {len(trades)}")

    if trades_with_1m_stop:
        stop_reductions = []
        for t in trades_with_1m_stop:
            reduction = (t.stop_5m.distance_pct - t.stop_1m.distance_pct) / t.stop_5m.distance_pct * 100
            stop_reductions.append(reduction)

        avg_5m_stop = np.mean([t.stop_5m.distance_pct for t in trades_with_1m_stop])
        avg_1m_stop = np.mean([t.stop_1m.distance_pct for t in trades_with_1m_stop])
        avg_reduction = np.mean(stop_reductions)

        print(f"\nAverage 5M Stop Distance: {avg_5m_stop:.3f}%")
        print(f"Average 1M Stop Distance: {avg_1m_stop:.3f}%")
        print(f"Average Stop Reduction:   {avg_reduction:.1f}%")

        # Win rate comparison
        wins_5m = len([t for t in trades_with_1m_stop if t.outcome_5m == "WIN"])
        wins_1m = len([t for t in trades_with_1m_stop if t.outcome_1m == "WIN"])
        losses_5m = len([t for t in trades_with_1m_stop if t.outcome_5m == "LOSS"])
        losses_1m = len([t for t in trades_with_1m_stop if t.outcome_1m == "LOSS"])

        wr_5m = wins_5m / len(trades_with_1m_stop) * 100 if trades_with_1m_stop else 0
        wr_1m = wins_1m / len(trades_with_1m_stop) * 100 if trades_with_1m_stop else 0

        print(f"\nWin Rate (5M stop): {wr_5m:.1f}% ({wins_5m}W / {losses_5m}L)")
        print(f"Win Rate (1M stop): {wr_1m:.1f}% ({wins_1m}W / {losses_1m}L)")
        print(f"Win Rate Delta:     {wr_1m - wr_5m:+.1f}%")

        # Stopped out comparison (key metric)
        stopped_5m_only = len([t for t in trades_with_1m_stop
                              if t.outcome_5m == "LOSS" and t.outcome_1m == "WIN"])
        stopped_1m_only = len([t for t in trades_with_1m_stop
                              if t.outcome_5m == "WIN" and t.outcome_1m == "LOSS"])

        print(f"\nTrades saved by 1M stop (would've lost with 5M): {stopped_5m_only}")
        print(f"Trades lost by 1M stop (would've won with 5M):   {stopped_1m_only}")

    # 2. Entry Precision Analysis
    print("\n[B] ENTRY PRECISION ANALYSIS")
    print("-" * 50)

    entry_tests = []
    for t in trades:
        result = test_limit_entry(df_1m, t.entry, t.signal.direction)
        entry_tests.append(result)

    could_improve = len([r for r in entry_tests if r['could_improve']])
    avg_improvement = np.mean([r['improvement_pct'] for r in entry_tests])
    max_improvement = max([r['improvement_pct'] for r in entry_tests])

    print(f"Trades where limit order could improve entry: {could_improve} / {len(trades)}")
    print(f"Average potential improvement: {avg_improvement:.3f}%")
    print(f"Maximum improvement seen: {max_improvement:.3f}%")

    # 3. MFE/MAE Analysis
    print("\n[C] MFE/MAE ANALYSIS")
    print("-" * 50)

    avg_mfe = np.mean([t.mfe for t in trades])
    avg_mae = np.mean([t.mae for t in trades])
    mfe_mae_ratio = avg_mfe / avg_mae if avg_mae > 0 else float('inf')

    print(f"Average MFE: {avg_mfe:.3f}%")
    print(f"Average MAE: {avg_mae:.3f}%")
    print(f"MFE/MAE Ratio: {mfe_mae_ratio:.2f}x")

    # Compare with 1M stops
    if trades_with_1m_stop:
        # R:R improvement with tighter stops
        rr_5m_values = []
        rr_1m_values = []
        for t in trades_with_1m_stop:
            target_5m = t.stop_5m.distance_pct * 2  # 2:1 target
            target_1m = t.stop_1m.distance_pct * 2
            rr_5m_values.append(t.mfe / t.stop_5m.distance_pct if t.stop_5m.distance_pct > 0 else 0)
            rr_1m_values.append(t.mfe / t.stop_1m.distance_pct if t.stop_1m.distance_pct > 0 else 0)

        avg_rr_5m = np.mean(rr_5m_values)
        avg_rr_1m = np.mean(rr_1m_values)

        print(f"\nAverage R:R achieved (5M stop): {avg_rr_5m:.2f}:1")
        print(f"Average R:R achieved (1M stop): {avg_rr_1m:.2f}:1")
        print(f"R:R Improvement: {((avg_rr_1m / avg_rr_5m) - 1) * 100:+.1f}%")

    # 4. Session Breakdown
    print("\n[D] SESSION BREAKDOWN")
    print("-" * 50)

    for session in [Session.ASIA, Session.LONDON, Session.NY_MID]:
        session_trades = [t for t in trades if t.session == session]
        if session_trades:
            wins = len([t for t in session_trades if t.outcome_5m == "WIN"])
            total = len(session_trades)
            wr = wins / total * 100
            avg_mfe_session = np.mean([t.mfe for t in session_trades])
            print(f"{session.value:10s}: {total} trades, {wr:.0f}% WR, {avg_mfe_session:.2f}% avg MFE")

    # 5. Detailed Trade Log
    print("\n[E] TRADE LOG")
    print("-" * 50)
    print(f"{'#':>3} {'Date':12} {'Dir':7} {'Entry':>10} {'5M Stop':>8} {'1M Stop':>8} "
          f"{'Reduce':>7} {'MFE':>6} {'MAE':>6} {'Out(5M)':>8} {'Out(1M)':>8}")
    print("-" * 100)

    for i, t in enumerate(trades[:20], 1):  # Show first 20
        stop_1m_str = f"{t.stop_1m.distance_pct:.2f}%" if t.stop_1m else "N/A"
        reduction = f"{(t.stop_5m.distance_pct - t.stop_1m.distance_pct) / t.stop_5m.distance_pct * 100:.0f}%" if t.stop_1m else "N/A"

        print(f"{i:3d} {t.entry.timestamp.strftime('%Y-%m-%d'):12} "
              f"{t.signal.direction.value:7} {t.entry.entry_price:>10.2f} "
              f"{t.stop_5m.distance_pct:>7.2f}% {stop_1m_str:>8} {reduction:>7} "
              f"{t.mfe:>5.2f}% {t.mae:>5.2f}% {t.outcome_5m:>8} {t.outcome_1m:>8}")

    if len(trades) > 20:
        print(f"... and {len(trades) - 20} more trades")

    # ========================================================================
    # FINAL VERDICT
    # ========================================================================

    print("\n" + "=" * 70)
    print("1M EFFICIENCY VERDICT")
    print("=" * 70)

    # Criteria evaluation
    criteria = {}

    # 1. Stop reduction meaningful (>15%)?
    if trades_with_1m_stop:
        stop_reduction_pass = avg_reduction > 15
        criteria['stop_reduction'] = {
            'value': avg_reduction,
            'threshold': 15,
            'pass': stop_reduction_pass,
            'desc': f"Stop size reduction: {avg_reduction:.1f}% (need >15%)"
        }

        # 2. Win rate stable (within 5%)?
        wr_delta = wr_1m - wr_5m
        wr_stable = wr_delta >= -5
        criteria['win_rate_stable'] = {
            'value': wr_delta,
            'threshold': -5,
            'pass': wr_stable,
            'desc': f"Win rate change: {wr_delta:+.1f}% (need >= -5%)"
        }

        # 3. R:R improvement?
        rr_improvement = ((avg_rr_1m / avg_rr_5m) - 1) * 100 if avg_rr_5m > 0 else 0
        rr_improved = rr_improvement > 0
        criteria['rr_improved'] = {
            'value': rr_improvement,
            'threshold': 0,
            'pass': rr_improved,
            'desc': f"R:R improvement: {rr_improvement:+.1f}% (need >0%)"
        }

        # 4. Net trades saved positive?
        net_saved = stopped_5m_only - stopped_1m_only
        net_positive = net_saved >= 0
        criteria['net_trades_saved'] = {
            'value': net_saved,
            'threshold': 0,
            'pass': net_positive,
            'desc': f"Net trades saved by 1M: {net_saved:+d} (need >=0)"
        }

    print("\nCriteria Evaluation:")
    all_pass = True
    for key, c in criteria.items():
        status = "PASS" if c['pass'] else "FAIL"
        print(f"  [{status}] {c['desc']}")
        if not c['pass']:
            all_pass = False

    print("\n" + "-" * 50)
    if all_pass and trades_with_1m_stop:
        print("OVERALL: PASS")
        print("\n1M layer ADDS VALUE through efficiency improvement.")
        print("Recommend creating 1M_EXECUTION_CONTRACT.md")
    elif trades_with_1m_stop:
        print("OVERALL: FAIL")
        print("\n1M layer does NOT add sufficient value.")
        print("Continue using 5M stops. Do not add 1M complexity.")
    else:
        print("OVERALL: INSUFFICIENT DATA")
        print("\nNot enough trades with valid 1M stops to evaluate.")

    # Return results dict
    return {
        'trades': len(trades),
        'trades_with_1m': len(trades_with_1m_stop),
        'avg_5m_stop': avg_5m_stop if trades_with_1m_stop else 0,
        'avg_1m_stop': avg_1m_stop if trades_with_1m_stop else 0,
        'stop_reduction_pct': avg_reduction if trades_with_1m_stop else 0,
        'wr_5m': wr_5m if trades_with_1m_stop else 0,
        'wr_1m': wr_1m if trades_with_1m_stop else 0,
        'rr_5m': avg_rr_5m if trades_with_1m_stop else 0,
        'rr_1m': avg_rr_1m if trades_with_1m_stop else 0,
        'mfe_mae_ratio': mfe_mae_ratio,
        'verdict': 'PASS' if (all_pass and trades_with_1m_stop) else 'FAIL',
        'criteria': criteria,
        'trade_details': trades
    }

if __name__ == "__main__":
    import sys
    filepath = sys.argv[1] if len(sys.argv) > 1 else "/Users/ble/TradingBot/historyBot/data/btc_usd_1m.csv"
    results = run_analysis(filepath)
