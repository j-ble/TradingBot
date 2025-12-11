"""
Performance Analytics - Trading Metrics Calculation
Calculates and logs performance metrics every 60 seconds.
"""

import asyncio
from decimal import Decimal
from typing import Optional, Dict, Any

from utils.logger import logger
from database.queries import (
    get_performance_metrics,
    get_trade_history,
    get_paper_config
)


class PerformanceAnalytics:
    """
    Calculates and displays trading performance metrics.
    Updates every 60 seconds with win rate, P&L, and other stats.
    """

    def __init__(self):
        self.running = False
        self.update_interval = 60  # seconds
        self.target_win_rate = Decimal('90.0')  # 90% target

    async def calculate_metrics(self) -> None:
        """
        Main analytics loop - runs every 60 seconds.
        Fetches and logs performance metrics.
        """
        while self.running:
            try:
                # Get metrics from database view
                metrics = await get_performance_metrics()

                if metrics:
                    await self._display_metrics(metrics)
                else:
                    logger.info("No trades yet - waiting for first signal")

                # Wait before next update
                await asyncio.sleep(self.update_interval)

            except Exception as e:
                logger.error(f"Error in analytics loop: {e}", exc_info=True)
                await asyncio.sleep(self.update_interval)

    async def _display_metrics(self, metrics: Dict[str, Any]) -> None:
        """
        Display performance metrics in formatted output.

        Args:
            metrics: Performance metrics from v_paper_performance view
        """
        # Extract metrics
        total_trades = metrics.get('total_trades', 0)
        wins = metrics.get('wins', 0)
        losses = metrics.get('losses', 0)
        breakevens = metrics.get('breakevens', 0)
        win_rate = Decimal(str(metrics.get('win_rate', 0) or 0))
        total_pnl = Decimal(str(metrics.get('total_pnl', 0) or 0))
        avg_win = Decimal(str(metrics.get('avg_win', 0) or 0))
        avg_loss = Decimal(str(metrics.get('avg_loss', 0) or 0))
        largest_win = Decimal(str(metrics.get('largest_win', 0) or 0))
        largest_loss = Decimal(str(metrics.get('largest_loss', 0) or 0))
        avg_rr = Decimal(str(metrics.get('avg_rr', 0) or 0))

        # Get current balance
        config = await get_paper_config()
        if config:
            current_balance = Decimal(str(config['account_balance']))
            starting_balance = Decimal(str(config['starting_balance']))
            total_return_pct = ((current_balance - starting_balance) / starting_balance) * Decimal('100')
        else:
            current_balance = Decimal('0')
            starting_balance = Decimal('0')
            total_return_pct = Decimal('0')

        # Win rate progress
        win_rate_target = self.target_win_rate
        win_rate_diff = win_rate - win_rate_target

        # Format output
        logger.info("\n" + "=" * 60)
        logger.info("PAPER TRADING PERFORMANCE METRICS")
        logger.info("=" * 60)

        # Account stats
        logger.info(f"\n[ACCOUNT]")
        logger.info(f"  Starting Balance: ${starting_balance:,.2f}")
        logger.info(f"  Current Balance:  ${current_balance:,.2f}")
        logger.info(f"  Total P&L:        ${total_pnl:+,.2f}")
        logger.info(f"  Total Return:     {total_return_pct:+.2f}%")

        # Trade statistics
        logger.info(f"\n[TRADES]")
        logger.info(f"  Total Trades:     {total_trades}")
        logger.info(f"  Wins:             {wins} ({wins / total_trades * 100:.1f}%)" if total_trades > 0 else "  Wins:             0")
        logger.info(f"  Losses:           {losses} ({losses / total_trades * 100:.1f}%)" if total_trades > 0 else "  Losses:           0")
        logger.info(f"  Breakevens:       {breakevens}")

        # Win rate with target comparison
        if win_rate >= win_rate_target:
            status = f"ABOVE TARGET (+{win_rate_diff:.1f}%)"
        else:
            status = f"BELOW TARGET ({win_rate_diff:.1f}%)"

        logger.info(f"\n[WIN RATE]")
        logger.info(f"  Current:          {win_rate:.1f}%")
        logger.info(f"  Target:           {win_rate_target:.0f}%")
        logger.info(f"  Status:           {status}")

        # P&L statistics
        logger.info(f"\n[P&L STATS]")
        logger.info(f"  Avg Win:          ${avg_win:,.2f}")
        logger.info(f"  Avg Loss:         ${avg_loss:,.2f}")
        logger.info(f"  Largest Win:      ${largest_win:,.2f}")
        logger.info(f"  Largest Loss:     ${largest_loss:,.2f}")
        logger.info(f"  Avg R/R Ratio:    {avg_rr:.2f}:1")

        # Additional insights
        if total_trades >= 10:
            await self._display_insights(metrics, total_trades, win_rate)

        logger.info("\n" + "=" * 60 + "\n")

    async def _display_insights(
        self,
        metrics: Dict[str, Any],
        total_trades: int,
        win_rate: Decimal
    ) -> None:
        """
        Display additional insights when enough trades exist.

        Args:
            metrics: Performance metrics
            total_trades: Total number of trades
            win_rate: Current win rate
        """
        logger.info(f"\n[INSIGHTS]")

        # Trades to 90% goal
        if total_trades < 100:
            trades_remaining = 100 - total_trades
            logger.info(f"  Trades to 100:    {trades_remaining} more needed")

        # Win rate trend
        if win_rate >= Decimal('90.0'):
            logger.info(f"  TARGET ACHIEVED! Maintain consistency.")
        elif win_rate >= Decimal('70.0'):
            logger.info(f"  Good progress. Keep refining strategy.")
        elif win_rate >= Decimal('50.0'):
            logger.info(f"  Below target. Review losing trades.")
        else:
            logger.info(f"  Critical. System may need adjustment.")

        # Get recent trades for streak analysis
        recent_trades = await get_trade_history(limit=10)
        if recent_trades and len(recent_trades) >= 5:
            # Calculate recent win rate (last 10 trades)
            recent_wins = sum(1 for t in recent_trades if t['outcome'] == 'WIN')
            recent_win_rate = (recent_wins / len(recent_trades)) * 100
            logger.info(f"  Recent Win Rate:  {recent_win_rate:.1f}% (last {len(recent_trades)} trades)")

    async def get_current_metrics(self) -> Optional[Dict[str, Any]]:
        """
        Get current performance metrics (for external use).

        Returns:
            Performance metrics dictionary or None
        """
        try:
            return await get_performance_metrics()
        except Exception as e:
            logger.error(f"Failed to get current metrics: {e}")
            return None

    async def run(self) -> None:
        """Start the performance analytics."""
        self.running = True
        logger.info("Performance analytics started (updating every 60 seconds)")
        try:
            await self.calculate_metrics()
        except Exception as e:
            logger.error(f"Performance analytics crashed: {e}", exc_info=True)
        finally:
            self.running = False
            logger.info("Performance analytics stopped")

    def stop(self) -> None:
        """Stop the performance analytics."""
        self.running = False
        logger.info("Performance analytics stopping...")


# Global performance analytics instance
performance_analytics = PerformanceAnalytics()
