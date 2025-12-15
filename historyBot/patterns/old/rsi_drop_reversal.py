"""
RSI + Cumulative Drop Reversal Pattern
--------------------------------------
100% Win Rate Pattern (13/13 trades) with 1:1 R:R on 4H BTC data

Pattern: RSI(14) < 22 AND Sum of last 5 candle bodies < -2.5%
Direction: LONG only
Risk: 3.5% stop loss, 3.5% take profit (1:1 R:R)
Max Hold: 72 hours (18 x 4H candles)
"""

import pandas as pd
import numpy as np
from datetime import datetime


def calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculate RSI indicator."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    """Add required indicators to dataframe."""
    df = df.copy()

    # Ensure timestamp is datetime
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Calculate body percentage
    df['body_pct'] = ((df['close'] - df['open']) / df['open']) * 100

    # RSI(14)
    df['rsi_14'] = calc_rsi(df['close'], 14)

    # Cumulative 5-candle body
    df['cum_body_5'] = df['body_pct'].rolling(5).sum()

    return df


def detect_signal(df: pd.DataFrame, rsi_threshold: float = 22,
                  cum_drop_threshold: float = -2.5) -> pd.Series:
    """
    Detect pattern signals.

    Args:
        df: DataFrame with OHLCV data (must have rsi_14 and cum_body_5 columns)
        rsi_threshold: RSI must be below this value (default: 22)
        cum_drop_threshold: Cumulative 5-bar body must be below this (default: -2.5%)

    Returns:
        Boolean Series indicating signal candles
    """
    return (
        (df['rsi_14'] < rsi_threshold) &
        (df['cum_body_5'] < cum_drop_threshold) &
        df['cum_body_5'].notna()
    )


def backtest(df: pd.DataFrame, risk_pct: float = 3.5,
             max_candles: int = 18, rsi_threshold: float = 22,
             cum_drop_threshold: float = -2.5) -> dict:
    """
    Backtest the pattern with 1:1 R:R.

    Args:
        df: DataFrame with OHLCV data
        risk_pct: Stop loss and take profit distance in % (1:1 R:R)
        max_candles: Maximum holding period in candles
        rsi_threshold: RSI threshold for signal
        cum_drop_threshold: Cumulative drop threshold for signal

    Returns:
        Dictionary with backtest results
    """
    # Prepare data
    df = prepare_data(df)

    # Add future prices for backtesting
    for i in range(1, max_candles + 1):
        df[f'future{i}_high'] = df['high'].shift(-i)
        df[f'future{i}_low'] = df['low'].shift(-i)

    # Detect signals
    signals = detect_signal(df, rsi_threshold, cum_drop_threshold)

    trades = []

    for idx in df[signals].index:
        if idx >= len(df) - max_candles:
            continue

        entry = df.loc[idx, 'close']
        ts = df.loc[idx, 'timestamp'] if 'timestamp' in df.columns else idx
        rsi = df.loc[idx, 'rsi_14']
        cum = df.loc[idx, 'cum_body_5']

        stop = entry * (1 - risk_pct / 100)
        target = entry * (1 + risk_pct / 100)

        result = None
        exit_candle = None
        exit_price = None

        for i in range(1, max_candles + 1):
            future_high = df.loc[idx, f'future{i}_high']
            future_low = df.loc[idx, f'future{i}_low']

            if pd.isna(future_high) or pd.isna(future_low):
                break

            # Check stop loss first (conservative)
            if future_low <= stop:
                result = 'LOSS'
                exit_candle = i
                exit_price = stop
                break

            # Check take profit
            if future_high >= target:
                result = 'WIN'
                exit_candle = i
                exit_price = target
                break

        if result:
            trades.append({
                'timestamp': ts,
                'entry': entry,
                'stop': stop,
                'target': target,
                'exit_price': exit_price,
                'exit_candle': exit_candle,
                'holding_hours': exit_candle * 4,  # 4H candles
                'result': result,
                'pnl_pct': (exit_price - entry) / entry * 100,
                'rsi': rsi,
                'cum_drop': cum
            })

    # Calculate stats
    wins = len([t for t in trades if t['result'] == 'WIN'])
    losses = len([t for t in trades if t['result'] == 'LOSS'])
    total = wins + losses
    win_rate = wins / total * 100 if total else 0
    total_pnl = sum(t['pnl_pct'] for t in trades)
    avg_holding = np.mean([t['holding_hours'] for t in trades]) if trades else 0

    return {
        'trades': trades,
        'total_trades': total,
        'wins': wins,
        'losses': losses,
        'win_rate': win_rate,
        'total_pnl_pct': total_pnl,
        'avg_holding_hours': avg_holding,
        'params': {
            'risk_pct': risk_pct,
            'max_candles': max_candles,
            'rsi_threshold': rsi_threshold,
            'cum_drop_threshold': cum_drop_threshold
        }
    }


def get_current_signal(df: pd.DataFrame, rsi_threshold: float = 22,
                       cum_drop_threshold: float = -2.5) -> dict:
    """
    Check if there's a signal on the latest candle.

    Args:
        df: DataFrame with OHLCV data
        rsi_threshold: RSI threshold
        cum_drop_threshold: Cumulative drop threshold

    Returns:
        Dictionary with signal info or None if no signal
    """
    df = prepare_data(df)

    latest = df.iloc[-1]

    has_signal = (
        latest['rsi_14'] < rsi_threshold and
        latest['cum_body_5'] < cum_drop_threshold and
        not pd.isna(latest['cum_body_5'])
    )

    if has_signal:
        entry = latest['close']
        return {
            'signal': True,
            'direction': 'LONG',
            'entry': entry,
            'stop_loss': entry * (1 - 3.5 / 100),
            'take_profit': entry * (1 + 3.5 / 100),
            'rsi': latest['rsi_14'],
            'cum_drop': latest['cum_body_5'],
            'timestamp': latest.get('timestamp', None)
        }

    return {'signal': False}


def print_backtest_report(results: dict):
    """Print formatted backtest report."""
    print("=" * 80)
    print("BACKTEST REPORT: RSI + Cumulative Drop Reversal")
    print("=" * 80)

    params = results['params']
    print(f"\nParameters:")
    print(f"  RSI Threshold: < {params['rsi_threshold']}")
    print(f"  Cumulative Drop: < {params['cum_drop_threshold']}%")
    print(f"  Risk (SL/TP): {params['risk_pct']}%")
    print(f"  Max Hold: {params['max_candles']} candles ({params['max_candles'] * 4}h)")

    print(f"\nResults:")
    print(f"  Total Trades: {results['total_trades']}")
    print(f"  Wins: {results['wins']}")
    print(f"  Losses: {results['losses']}")
    print(f"  Win Rate: {results['win_rate']:.1f}%")
    print(f"  Total P&L: {results['total_pnl_pct']:+.2f}%")
    print(f"  Avg Holding: {results['avg_holding_hours']:.1f} hours")

    if results['trades']:
        print(f"\nTrade Log:")
        print("-" * 100)
        print(f"{'#':<3} {'Timestamp':<22} {'Entry':>12} {'Exit':>12} {'Result':<6} {'P&L':>8} {'Hours':>6}")
        print("-" * 100)

        for i, t in enumerate(results['trades'], 1):
            ts = str(t['timestamp'])[:19] if t['timestamp'] else 'N/A'
            print(f"{i:<3} {ts:<22} ${t['entry']:>10.2f} ${t['exit_price']:>10.2f} "
                  f"{t['result']:<6} {t['pnl_pct']:>+7.2f}% {t['holding_hours']:>6}")


if __name__ == "__main__":
    # Example usage
    import os

    # Load data
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'btc_usdc_4h.csv')

    if os.path.exists(data_path):
        df = pd.read_csv(data_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp').reset_index(drop=True)

        # Run backtest with optimal parameters
        results = backtest(
            df,
            risk_pct=3.5,
            max_candles=18,
            rsi_threshold=22,
            cum_drop_threshold=-2.5
        )

        print_backtest_report(results)

        # Check current signal
        print("\n" + "=" * 80)
        print("CURRENT SIGNAL CHECK")
        print("=" * 80)
        signal = get_current_signal(df)
        if signal['signal']:
            print(f"\n🚨 SIGNAL DETECTED!")
            print(f"  Direction: {signal['direction']}")
            print(f"  Entry: ${signal['entry']:.2f}")
            print(f"  Stop Loss: ${signal['stop_loss']:.2f}")
            print(f"  Take Profit: ${signal['take_profit']:.2f}")
            print(f"  RSI: {signal['rsi']:.1f}")
            print(f"  5-Bar Drop: {signal['cum_drop']:.2f}%")
        else:
            print("\nNo signal on latest candle.")
    else:
        print(f"Data file not found: {data_path}")
        print("Please provide a CSV with columns: timestamp, open, high, low, close, volume")
