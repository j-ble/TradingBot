"""
Backtesting Script for BTC-USD Trading Strategy
Processes historical candle data to validate trading rules before live trading.

Usage:
    python backtest.py --start "2024-01-01" --end "2024-12-31"
    python backtest.py --days 90  # Last 90 days
    python backtest.py --all      # All available data
"""

import asyncio
import argparse
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from database.connection import db
from config import config
from utils.logger import logger
from core.trade_simulator import TradeSimulator


@dataclass
class BacktestTrade:
    """Represents a completed backtest trade"""
    entry_time: datetime
    exit_time: datetime
    direction: str
    entry_price: Decimal
    exit_price: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    position_size_btc: Decimal
    position_size_usd: Decimal
    pnl_usd: Decimal
    outcome: str
    exit_reason: str
    stop_loss_source: str
    risk_reward_ratio: Decimal


class Backtester:
    """
    Backtesting engine that processes historical data to simulate trading.

    Strategy Rules:
    1. 4H liquidity sweep detection
    2. 5M confluence: CHoCH → FVG → BOS
    3. Swing-based stop loss (5M → 4H priority)
    4. 1% fixed risk per trade
    5. Minimum 2:1 R/R ratio
    """

    def __init__(self, starting_balance: Decimal = Decimal('100.00')):
        self.starting_balance = starting_balance
        self.current_balance = starting_balance
        self.trades: List[BacktestTrade] = []
        self.simulator = TradeSimulator()

        # State tracking
        self.open_position: Optional[Dict[str, Any]] = None
        self.max_positions = 1

    async def detect_liquidity_sweep_4h(
        self,
        candles_4h: List[Dict[str, Any]],
        current_index: int
    ) -> Optional[Dict[str, Any]]:
        """
        Detect 4H liquidity sweep at current candle.

        Swing pattern: 3-candle swing high/low
        Sweep: Price breaks swing level by ±0.1%

        Args:
            candles_4h: List of 4H candles
            current_index: Current candle index

        Returns:
            Sweep dict with bias or None
        """
        # Need at least 5 candles for swing detection
        if current_index < 5:
            return None

        # Look back 10 candles for swing levels
        lookback = min(10, current_index)
        sweep_threshold = Decimal('0.001')  # 0.1%

        current = candles_4h[current_index]
        current_high = Decimal(str(current['high']))
        current_low = Decimal(str(current['low']))

        # Check for swing high sweep (BEARISH bias)
        for i in range(current_index - 2, current_index - lookback, -1):
            if i < 2:
                break

            c = candles_4h[i]
            c_prev = candles_4h[i-1]
            c_prev2 = candles_4h[i-2]
            c_next = candles_4h[i+1] if i+1 < len(candles_4h) else None
            c_next2 = candles_4h[i+2] if i+2 < len(candles_4h) else None

            if not c_next or not c_next2:
                continue

            # 3-candle swing high pattern
            high = Decimal(str(c['high']))
            if (high > Decimal(str(c_prev2['high'])) and
                high > Decimal(str(c_next2['high']))):

                # Check if current candle sweeps this swing high
                sweep_level = high * (Decimal('1') + sweep_threshold)
                if current_high >= sweep_level:
                    logger.info(
                        f"4H HIGH sweep detected: ${high} swept by ${current_high} "
                        f"at {current['timestamp']} -> BEARISH bias"
                    )
                    return {
                        'sweep_type': 'HIGH',
                        'bias': 'BEARISH',
                        'price': high,
                        'timestamp': current['timestamp']
                    }

        # Check for swing low sweep (BULLISH bias)
        for i in range(current_index - 2, current_index - lookback, -1):
            if i < 2:
                break

            c = candles_4h[i]
            c_prev = candles_4h[i-1]
            c_prev2 = candles_4h[i-2]
            c_next = candles_4h[i+1] if i+1 < len(candles_4h) else None
            c_next2 = candles_4h[i+2] if i+2 < len(candles_4h) else None

            if not c_next or not c_next2:
                continue

            # 3-candle swing low pattern
            low = Decimal(str(c['low']))
            if (low < Decimal(str(c_prev2['low'])) and
                low < Decimal(str(c_next2['low']))):

                # Check if current candle sweeps this swing low
                sweep_level = low * (Decimal('1') - sweep_threshold)
                if current_low <= sweep_level:
                    logger.info(
                        f"4H LOW sweep detected: ${low} swept by ${current_low} "
                        f"at {current['timestamp']} -> BULLISH bias"
                    )
                    return {
                        'sweep_type': 'LOW',
                        'bias': 'BULLISH',
                        'price': low,
                        'timestamp': current['timestamp']
                    }

        return None

    async def detect_5m_confluence(
        self,
        candles_5m: List[Dict[str, Any]],
        start_index: int,
        end_index: int,
        bias: str
    ) -> Optional[Dict[str, Any]]:
        """
        Simplified 5M confluence detection for backtesting.

        In backtest mode, we look for:
        1. Price movement in bias direction
        2. Valid swing levels for stop loss

        In production, the Node.js scanner does full CHoCH→FVG→BOS detection.

        Args:
            candles_5m: 5M candle data
            start_index: Start of search window
            end_index: End of search window
            bias: 'BULLISH' or 'BEARISH'

        Returns:
            Confluence signal or None
        """
        # Simplified: Look for price movement confirming bias
        window = candles_5m[start_index:end_index+1]
        if not window:
            return None

        first_price = Decimal(str(window[0]['close']))
        last_price = Decimal(str(window[-1]['close']))

        # BULLISH: Price should be rising
        if bias == 'BULLISH' and last_price > first_price * Decimal('1.002'):  # 0.2% move
            return {
                'bias': bias,
                'bos_price': last_price,
                'timestamp': window[-1]['timestamp']
            }

        # BEARISH: Price should be falling
        if bias == 'BEARISH' and last_price < first_price * Decimal('0.998'):  # 0.2% move
            return {
                'bias': bias,
                'bos_price': last_price,
                'timestamp': window[-1]['timestamp']
            }

        return None

    async def find_swing_level(
        self,
        candles: List[Dict[str, Any]],
        current_index: int,
        swing_type: str
    ) -> Optional[Decimal]:
        """
        Find most recent swing high/low for stop loss.

        Args:
            candles: Candle data (5M or 4H)
            current_index: Current candle index
            swing_type: 'HIGH' or 'LOW'

        Returns:
            Swing price or None
        """
        lookback = min(20, current_index - 2)

        for i in range(current_index - 2, current_index - lookback, -1):
            if i < 2:
                break

            c = candles[i]
            c_prev2 = candles[i-2]
            c_next2 = candles[i+2] if i+2 < len(candles) else None

            if not c_next2:
                continue

            if swing_type == 'HIGH':
                high = Decimal(str(c['high']))
                if (high > Decimal(str(c_prev2['high'])) and
                    high > Decimal(str(c_next2['high']))):
                    return high

            elif swing_type == 'LOW':
                low = Decimal(str(c['low']))
                if (low < Decimal(str(c_prev2['low'])) and
                    low < Decimal(str(c_next2['low']))):
                    return low

        return None

    async def execute_backtest_trade(
        self,
        entry_time: datetime,
        bias: str,
        entry_price: Decimal,
        candles_5m: List[Dict[str, Any]],
        candles_4h: List[Dict[str, Any]],
        current_5m_index: int,
        current_4h_index: int
    ) -> Optional[Dict[str, Any]]:
        """
        Execute a backtest trade with proper stop loss calculation.

        Args:
            entry_time: Trade entry timestamp
            bias: 'BULLISH' or 'BEARISH'
            entry_price: Entry price
            candles_5m: 5M candle data
            candles_4h: 4H candle data
            current_5m_index: Current 5M index
            current_4h_index: Current 4H index

        Returns:
            Trade dict if valid, None if rejected
        """
        direction = 'LONG' if bias == 'BULLISH' else 'SHORT'
        swing_type = 'LOW' if direction == 'LONG' else 'HIGH'

        # Try 5M swing first
        swing_5m = await self.find_swing_level(candles_5m, current_5m_index, swing_type)

        stop_result = None
        if swing_5m:
            stop_price = await self.simulator.calculate_stop_with_buffer(swing_5m, direction)
            validation = self.simulator.is_valid_stop(entry_price, stop_price)

            if validation['valid'] and self.simulator.is_stop_on_correct_side(
                entry_price, stop_price, direction
            ):
                min_tp = self.simulator.calculate_minimum_take_profit(
                    entry_price, stop_price, direction
                )
                stop_result = {
                    'price': stop_price,
                    'source': '5M_SWING',
                    'swing_price': swing_5m,
                    'min_tp': min_tp
                }

        # Fallback to 4H swing
        if not stop_result:
            swing_4h = await self.find_swing_level(candles_4h, current_4h_index, swing_type)

            if swing_4h:
                stop_price = await self.simulator.calculate_stop_with_buffer(swing_4h, direction)
                validation = self.simulator.is_valid_stop(entry_price, stop_price)

                if validation['valid'] and self.simulator.is_stop_on_correct_side(
                    entry_price, stop_price, direction
                ):
                    min_tp = self.simulator.calculate_minimum_take_profit(
                        entry_price, stop_price, direction
                    )
                    stop_result = {
                        'price': stop_price,
                        'source': '4H_SWING',
                        'swing_price': swing_4h,
                        'min_tp': min_tp
                    }

        # Reject trade if no valid stop
        if not stop_result:
            logger.warning(
                f"Trade REJECTED: No valid swing-based stop at {entry_time}"
            )
            return None

        # Calculate position size (1% risk)
        position = self.simulator.calculate_position_size(
            self.current_balance,
            entry_price,
            stop_result['price']
        )

        # Apply slippage
        entry_price_slipped = self.simulator.apply_slippage(
            entry_price, direction, is_entry=True
        )

        # Calculate fees
        entry_fee = self.simulator.calculate_fee(position.usd)

        # Create trade record
        trade = {
            'entry_time': entry_time,
            'direction': direction,
            'entry_price': entry_price_slipped,
            'stop_loss': stop_result['price'],
            'take_profit': stop_result['min_tp'],
            'position_size_btc': position.btc,
            'position_size_usd': position.usd,
            'risk_amount': position.risk_amount,
            'stop_loss_source': stop_result['source'],
            'entry_fee': entry_fee,
            'stop_distance': abs(entry_price_slipped - stop_result['price']),
            'target_distance': abs(stop_result['min_tp'] - entry_price_slipped)
        }

        # Calculate R/R
        trade['rr_ratio'] = trade['target_distance'] / trade['stop_distance']

        logger.info(
            f"Backtest trade EXECUTED: {direction} @ ${entry_price_slipped:.2f}\n"
            f"  SL: ${stop_result['price']:.2f} ({stop_result['source']})\n"
            f"  TP: ${stop_result['min_tp']:.2f} (R/R: {trade['rr_ratio']:.2f}:1)"
        )

        return trade

    async def monitor_backtest_trade(
        self,
        trade: Dict[str, Any],
        candles_5m: List[Dict[str, Any]],
        start_index: int
    ) -> BacktestTrade:
        """
        Monitor an open trade through historical candles until exit.

        Args:
            trade: Trade dict from execute_backtest_trade
            candles_5m: 5M candle data
            start_index: Index to start monitoring from

        Returns:
            Completed BacktestTrade
        """
        direction = trade['direction']
        entry_price = trade['entry_price']
        stop_loss = trade['stop_loss']
        take_profit = trade['take_profit']

        max_duration_candles = (72 * 60) // 5  # 72 hours in 5M candles
        trailing_activated = False
        trailing_stop = None

        # Process each subsequent candle
        for i in range(start_index + 1, min(start_index + max_duration_candles, len(candles_5m))):
            candle = candles_5m[i]
            high = Decimal(str(candle['high']))
            low = Decimal(str(candle['low']))
            close = Decimal(str(candle['close']))

            # Check trailing stop activation (80% to TP)
            if not trailing_activated:
                progress = abs(close - entry_price) / abs(take_profit - entry_price)
                if progress >= Decimal('0.80'):
                    trailing_stop = entry_price
                    trailing_activated = True
                    logger.debug(f"Trailing stop activated @ ${entry_price:.2f}")

            # Check stop loss (or trailing stop)
            effective_stop = trailing_stop if trailing_activated else stop_loss

            if direction == 'LONG':
                # Stop hit
                if low <= effective_stop:
                    exit_reason = 'TRAILING_STOP' if trailing_activated else 'STOP_LOSS'
                    return await self._close_backtest_trade(
                        trade, candle['timestamp'], effective_stop, exit_reason
                    )

                # Take profit hit
                if high >= take_profit:
                    return await self._close_backtest_trade(
                        trade, candle['timestamp'], take_profit, 'TAKE_PROFIT'
                    )

            else:  # SHORT
                # Stop hit
                if high >= effective_stop:
                    exit_reason = 'TRAILING_STOP' if trailing_activated else 'STOP_LOSS'
                    return await self._close_backtest_trade(
                        trade, candle['timestamp'], effective_stop, exit_reason
                    )

                # Take profit hit
                if low <= take_profit:
                    return await self._close_backtest_trade(
                        trade, candle['timestamp'], take_profit, 'TAKE_PROFIT'
                    )

        # Time limit reached
        final_candle = candles_5m[min(start_index + max_duration_candles - 1, len(candles_5m) - 1)]
        final_price = Decimal(str(final_candle['close']))
        return await self._close_backtest_trade(
            trade, final_candle['timestamp'], final_price, 'TIME_LIMIT'
        )

    async def _close_backtest_trade(
        self,
        trade: Dict[str, Any],
        exit_time: datetime,
        exit_price: Decimal,
        exit_reason: str
    ) -> BacktestTrade:
        """Close a backtest trade and calculate P&L."""
        direction = trade['direction']

        # Apply exit slippage
        exit_price_slipped = self.simulator.apply_slippage(
            exit_price, direction, is_entry=False
        )

        # Calculate exit fee
        exit_fee = self.simulator.calculate_fee(trade['position_size_usd'])

        # Calculate P&L
        if direction == 'LONG':
            price_diff = exit_price_slipped - trade['entry_price']
        else:  # SHORT
            price_diff = trade['entry_price'] - exit_price_slipped

        gross_pnl = price_diff * trade['position_size_btc']
        net_pnl = gross_pnl - trade['entry_fee'] - exit_fee

        # Determine outcome
        if net_pnl > Decimal('0.01'):
            outcome = 'WIN'
        elif net_pnl < Decimal('-0.01'):
            outcome = 'LOSS'
        else:
            outcome = 'BREAKEVEN'

        # Update balance
        self.current_balance += net_pnl

        # Create completed trade
        completed = BacktestTrade(
            entry_time=trade['entry_time'],
            exit_time=exit_time,
            direction=direction,
            entry_price=trade['entry_price'],
            exit_price=exit_price_slipped,
            stop_loss=trade['stop_loss'],
            take_profit=trade['take_profit'],
            position_size_btc=trade['position_size_btc'],
            position_size_usd=trade['position_size_usd'],
            pnl_usd=net_pnl,
            outcome=outcome,
            exit_reason=exit_reason,
            stop_loss_source=trade['stop_loss_source'],
            risk_reward_ratio=trade['rr_ratio']
        )

        logger.info(
            f"Trade CLOSED ({exit_reason}): {outcome} | "
            f"P&L: ${net_pnl:.2f} | Balance: ${self.current_balance:.2f}"
        )

        return completed

    async def run_backtest(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Main backtest execution loop.

        Args:
            start_date: Start date for backtest (default: earliest data)
            end_date: End date for backtest (default: latest data)

        Returns:
            Backtest results dictionary
        """
        logger.info("=" * 60)
        logger.info("STARTING BACKTEST")
        logger.info("=" * 60)

        # Load historical data
        query_4h = "SELECT * FROM candles_4h ORDER BY timestamp ASC"
        query_5m = "SELECT * FROM candles_5m ORDER BY timestamp ASC"

        candles_4h = await db.fetch_all(query_4h)
        candles_5m = await db.fetch_all(query_5m)

        logger.info(f"Loaded {len(candles_4h)} 4H candles, {len(candles_5m)} 5M candles")

        # Filter by date range (convert timestamps to naive for comparison)
        if start_date:
            candles_4h = [c for c in candles_4h if c['timestamp'].replace(tzinfo=None) >= start_date]
            candles_5m = [c for c in candles_5m if c['timestamp'].replace(tzinfo=None) >= start_date]

        if end_date:
            candles_4h = [c for c in candles_4h if c['timestamp'].replace(tzinfo=None) <= end_date]
            candles_5m = [c for c in candles_5m if c['timestamp'].replace(tzinfo=None) <= end_date]

        logger.info(
            f"Backtest period: {candles_4h[0]['timestamp']} to {candles_4h[-1]['timestamp']}"
        )
        logger.info(f"Starting balance: ${self.starting_balance:.2f}\n")

        # Process 4H candles for liquidity sweeps
        current_5m_index = 0

        for i4h in range(len(candles_4h)):
            candle_4h = candles_4h[i4h]
            candle_4h_time = candle_4h['timestamp']

            # Check for liquidity sweep
            sweep = await self.detect_liquidity_sweep_4h(candles_4h, i4h)

            if not sweep:
                continue

            # Skip if we have an open position
            if self.open_position:
                continue

            # Find corresponding 5M candles (next 4 hours)
            while (current_5m_index < len(candles_5m) and
                   candles_5m[current_5m_index]['timestamp'] < candle_4h_time):
                current_5m_index += 1

            # Look for 5M confluence in next 48 candles (4 hours)
            confluence_window_end = min(current_5m_index + 48, len(candles_5m) - 1)

            confluence = await self.detect_5m_confluence(
                candles_5m,
                current_5m_index,
                confluence_window_end,
                sweep['bias']
            )

            if not confluence:
                continue

            # Find the 5M candle where confluence completed
            entry_index = current_5m_index
            for j in range(current_5m_index, confluence_window_end + 1):
                if candles_5m[j]['timestamp'] == confluence['timestamp']:
                    entry_index = j
                    break

            entry_candle = candles_5m[entry_index]
            entry_price = Decimal(str(entry_candle['close']))

            # Execute trade
            trade = await self.execute_backtest_trade(
                entry_time=entry_candle['timestamp'],
                bias=sweep['bias'],
                entry_price=entry_price,
                candles_5m=candles_5m,
                candles_4h=candles_4h,
                current_5m_index=entry_index,
                current_4h_index=i4h
            )

            if not trade:
                continue  # Trade rejected (no valid stop)

            # Monitor trade to completion
            completed_trade = await self.monitor_backtest_trade(
                trade, candles_5m, entry_index
            )

            self.trades.append(completed_trade)

            # Update 5M index to after trade exit
            while (current_5m_index < len(candles_5m) and
                   candles_5m[current_5m_index]['timestamp'] <= completed_trade.exit_time):
                current_5m_index += 1

        # Calculate results
        results = self._calculate_results()

        logger.info("\n" + "=" * 60)
        logger.info("BACKTEST COMPLETE")
        logger.info("=" * 60)
        self._print_results(results)

        return results

    def _calculate_results(self) -> Dict[str, Any]:
        """Calculate backtest performance metrics."""
        if not self.trades:
            return {
                'total_trades': 0,
                'wins': 0,
                'losses': 0,
                'breakevens': 0,
                'win_rate': 0.0,
                'total_pnl': Decimal('0'),
                'total_return_pct': 0.0,
                'avg_win': Decimal('0'),
                'avg_loss': Decimal('0'),
                'best_trade': Decimal('0'),
                'worst_trade': Decimal('0'),
                'avg_rr_ratio': 0.0,
                'final_balance': self.current_balance
            }

        wins = [t for t in self.trades if t.outcome == 'WIN']
        losses = [t for t in self.trades if t.outcome == 'LOSS']
        breakevens = [t for t in self.trades if t.outcome == 'BREAKEVEN']

        total_pnl = sum(t.pnl_usd for t in self.trades)
        win_rate = (len(wins) / len(self.trades)) * 100 if self.trades else 0

        return {
            'total_trades': len(self.trades),
            'wins': len(wins),
            'losses': len(losses),
            'breakevens': len(breakevens),
            'win_rate': win_rate,
            'total_pnl': total_pnl,
            'total_return_pct': float((total_pnl / self.starting_balance) * 100),
            'avg_win': sum(t.pnl_usd for t in wins) / len(wins) if wins else Decimal('0'),
            'avg_loss': sum(t.pnl_usd for t in losses) / len(losses) if losses else Decimal('0'),
            'best_trade': max(t.pnl_usd for t in self.trades) if self.trades else Decimal('0'),
            'worst_trade': min(t.pnl_usd for t in self.trades) if self.trades else Decimal('0'),
            'avg_rr_ratio': sum(t.risk_reward_ratio for t in self.trades) / len(self.trades),
            'final_balance': self.current_balance,
            'trades': self.trades
        }

    def _print_results(self, results: Dict[str, Any]) -> None:
        """Print backtest results to console."""
        print(f"\n[ACCOUNT]")
        print(f"  Starting Balance:  ${self.starting_balance:,.2f}")
        print(f"  Final Balance:     ${results['final_balance']:,.2f}")
        print(f"  Total P&L:         ${results['total_pnl']:,.2f}")
        print(f"  Total Return:      {results['total_return_pct']:.2f}%")

        print(f"\n[TRADES]")
        print(f"  Total Trades:      {results['total_trades']}")
        print(f"  Wins:              {results['wins']} ({results['win_rate']:.2f}%)")
        print(f"  Losses:            {results['losses']}")
        print(f"  Breakevens:        {results['breakevens']}")

        print(f"\n[WIN RATE]")
        print(f"  Current:           {results['win_rate']:.2f}%")
        print(f"  Target:            90%")
        if results['win_rate'] >= 90:
            print(f"  Status:            ✅ TARGET ACHIEVED")
        else:
            print(f"  Status:            ❌ Below target ({90 - results['win_rate']:.2f}%)")

        print(f"\n[P&L STATS]")
        print(f"  Avg Win:           ${results['avg_win']:,.2f}")
        print(f"  Avg Loss:          ${results['avg_loss']:,.2f}")
        print(f"  Best Trade:        ${results['best_trade']:,.2f}")
        print(f"  Worst Trade:       ${results['worst_trade']:,.2f}")
        print(f"  Avg R/R Ratio:     {results['avg_rr_ratio']:.2f}:1")

        print("\n" + "=" * 60)


async def main():
    """Main entry point for backtesting."""
    parser = argparse.ArgumentParser(description='Backtest BTC-USD trading strategy')
    parser.add_argument('--start', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--days', type=int, help='Last N days to backtest')
    parser.add_argument('--all', action='store_true', help='Use all available data')
    parser.add_argument('--balance', type=float, default=100.0, help='Starting balance (default: $100)')

    args = parser.parse_args()

    # Parse date arguments
    start_date = None
    end_date = None

    if args.days:
        end_date = datetime.utcnow().replace(tzinfo=None)
        start_date = end_date - timedelta(days=args.days)
    elif args.start:
        start_date = datetime.strptime(args.start, '%Y-%m-%d')

    if args.end:
        end_date = datetime.strptime(args.end, '%Y-%m-%d')

    # Connect to database
    await db.connect()

    try:
        # Run backtest
        backtester = Backtester(starting_balance=Decimal(str(args.balance)))
        results = await backtester.run_backtest(start_date, end_date)

        # Optionally export results
        # await export_results_to_csv(results)

    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
