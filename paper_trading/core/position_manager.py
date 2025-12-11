"""
Position Manager - Real-time Position Monitoring
Monitors open positions for stop loss, take profit, trailing stops, and time limits.
"""

import asyncio
from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from config import config
from utils.logger import logger
from database.queries import (
    get_open_positions,
    close_paper_trade,
    activate_trailing_stop,
    update_paper_trade
)
from market.price_feed import price_feed
from core.trade_simulator import TradeSimulator


class PositionManager:
    """
    Monitors open positions in real-time.
    Checks every 1 second for:
    - Stop loss hits
    - Take profit hits
    - Trailing stop activation (80% to TP)
    - 72-hour time limit
    """

    def __init__(self):
        self.running = False
        self.check_interval = 1  # seconds
        self.trade_simulator = TradeSimulator()

        # Trailing stop config
        self.trailing_activation_percent = Decimal('0.80')  # 80% to TP
        self.max_trade_duration_hours = 72  # 72 hours

    async def monitor_positions(self) -> None:
        """
        Main monitoring loop - runs every 1 second.
        Checks all open positions for exit conditions.
        """
        while self.running:
            try:
                # Get current price (use cache to avoid API spam)
                current_price = await price_feed.get_current_price(use_cache=True)

                # Get all open positions
                open_positions = await get_open_positions()

                if not open_positions:
                    logger.debug("No open positions to monitor")
                else:
                    logger.debug(
                        f"Monitoring {len(open_positions)} open position(s) "
                        f"at price ${current_price:,.2f}"
                    )

                    for position in open_positions:
                        await self._check_position(position, current_price)

                # Wait 1 second before next check
                await asyncio.sleep(self.check_interval)

            except Exception as e:
                logger.error(f"Error in position monitoring loop: {e}", exc_info=True)
                await asyncio.sleep(self.check_interval)

    async def _check_position(
        self,
        position: Dict[str, Any],
        current_price: Decimal
    ) -> None:
        """
        Check a single position for all exit conditions.

        Priority order:
        1. Time limit (72 hours)
        2. Stop loss hit
        3. Take profit hit
        4. Trailing stop activation (80% to TP)
        """
        trade_id = position['id']
        direction = position['direction']
        entry_price = Decimal(str(position['entry_price']))
        stop_loss = Decimal(str(position['stop_loss']))
        take_profit = Decimal(str(position['take_profit']))
        trailing_activated = position['trailing_stop_activated']
        trailing_price = (
            Decimal(str(position['trailing_stop_price']))
            if position['trailing_stop_price'] else None
        )
        entry_time = position['entry_time']

        # 1. Check time limit (72 hours)
        time_limit_hit = await self._check_time_limit(
            trade_id, entry_time, current_price, direction
        )
        if time_limit_hit:
            return  # Position closed

        # 2. Check stop loss (or trailing stop if activated)
        effective_stop = trailing_price if trailing_activated else stop_loss

        stop_hit = self._is_stop_loss_hit(
            current_price, effective_stop, direction
        )

        if stop_hit:
            reason = 'TRAILING_STOP' if trailing_activated else 'STOP_LOSS'
            await self._close_position(
                trade_id, current_price, direction, entry_price,
                effective_stop, reason
            )
            return  # Position closed

        # 3. Check take profit
        tp_hit = self._is_take_profit_hit(
            current_price, take_profit, direction
        )

        if tp_hit:
            await self._close_position(
                trade_id, current_price, direction, entry_price,
                take_profit, 'TAKE_PROFIT'
            )
            return  # Position closed

        # 4. Check trailing stop activation (80% to TP)
        if not trailing_activated:
            should_activate = self._should_activate_trailing_stop(
                entry_price, current_price, take_profit, direction
            )

            if should_activate:
                # Move stop to breakeven (entry price)
                await activate_trailing_stop(trade_id, entry_price)
                logger.info(
                    f"Trailing stop ACTIVATED for trade #{trade_id}: "
                    f"moved to breakeven @ ${entry_price:.2f}"
                )

    def _is_stop_loss_hit(
        self,
        current_price: Decimal,
        stop_price: Decimal,
        direction: str
    ) -> bool:
        """Check if stop loss has been hit."""
        if direction == 'LONG':
            # LONG: Stop hit when price <= stop
            return current_price <= stop_price
        else:  # SHORT
            # SHORT: Stop hit when price >= stop
            return current_price >= stop_price

    def _is_take_profit_hit(
        self,
        current_price: Decimal,
        tp_price: Decimal,
        direction: str
    ) -> bool:
        """Check if take profit has been hit."""
        if direction == 'LONG':
            # LONG: TP hit when price >= target
            return current_price >= tp_price
        else:  # SHORT
            # SHORT: TP hit when price <= target
            return current_price <= tp_price

    def _should_activate_trailing_stop(
        self,
        entry_price: Decimal,
        current_price: Decimal,
        take_profit: Decimal,
        direction: str
    ) -> bool:
        """
        Check if trailing stop should be activated (80% to TP).

        Args:
            entry_price: Original entry price
            current_price: Current market price
            take_profit: Take profit target
            direction: 'LONG' or 'SHORT'

        Returns:
            True if should activate trailing stop
        """
        # Calculate target distance
        target_distance = abs(take_profit - entry_price)

        # Calculate current progress
        current_progress = abs(current_price - entry_price)

        # Calculate progress percentage
        progress_percent = current_progress / target_distance

        # Check if we've reached 80% of target
        if progress_percent >= self.trailing_activation_percent:
            # Ensure price is moving in correct direction
            if direction == 'LONG' and current_price > entry_price:
                return True
            elif direction == 'SHORT' and current_price < entry_price:
                return True

        return False

    async def _check_time_limit(
        self,
        trade_id: int,
        entry_time: datetime,
        current_price: Decimal,
        direction: str
    ) -> bool:
        """
        Check if trade has exceeded 72-hour time limit.

        Args:
            trade_id: Trade ID
            entry_time: Entry timestamp
            current_price: Current market price
            direction: Trade direction

        Returns:
            True if position was closed due to time limit
        """
        now = datetime.utcnow()
        time_open = now - entry_time
        max_duration = timedelta(hours=self.max_trade_duration_hours)

        if time_open > max_duration:
            logger.warning(
                f"Trade #{trade_id} exceeded {self.max_trade_duration_hours}h time limit "
                f"(open for {time_open.total_seconds() / 3600:.1f}h)"
            )

            # Close at current market price
            await self._close_position(
                trade_id, current_price, direction, None, None, 'TIME_LIMIT'
            )
            return True

        return False

    async def _close_position(
        self,
        trade_id: int,
        market_price: Decimal,
        direction: str,
        entry_price: Optional[Decimal],
        target_price: Optional[Decimal],
        reason: str
    ) -> None:
        """
        Close a position with P&L calculation and fee/slippage simulation.

        Args:
            trade_id: Trade ID
            market_price: Current market price
            direction: 'LONG' or 'SHORT'
            entry_price: Entry price (for P&L calculation)
            target_price: Target price (SL/TP) or None for time limit
            reason: Close reason (STOP_LOSS, TAKE_PROFIT, TRAILING_STOP, TIME_LIMIT)
        """
        try:
            # Apply exit slippage
            exit_price_with_slippage = self.trade_simulator.apply_slippage(
                market_price, direction, is_entry=False
            )

            # Get position details from database for P&L calculation
            positions = await get_open_positions()
            position = next((p for p in positions if p['id'] == trade_id), None)

            if not position:
                logger.error(f"Position #{trade_id} not found, cannot close")
                return

            # Extract position data
            if entry_price is None:
                entry_price = Decimal(str(position['entry_price']))
            position_btc = Decimal(str(position['position_size_btc']))
            position_usd = Decimal(str(position['position_size_usd']))

            # Calculate exit fee
            exit_fee = self.trade_simulator.calculate_fee(position_usd)

            # Calculate P&L
            if direction == 'LONG':
                # LONG: profit when exit > entry
                price_diff = exit_price_with_slippage - entry_price
                gross_pnl = price_diff * position_btc
            else:  # SHORT
                # SHORT: profit when exit < entry
                price_diff = entry_price - exit_price_with_slippage
                gross_pnl = price_diff * position_btc

            # Subtract fees (entry fee already subtracted from balance, just exit)
            net_pnl = gross_pnl - exit_fee

            # Determine outcome
            if net_pnl > Decimal('0.01'):  # > $0.01
                outcome = 'WIN'
            elif net_pnl < Decimal('-0.01'):  # < -$0.01
                outcome = 'LOSS'
            else:
                outcome = 'BREAKEVEN'

            # Close the trade in database
            await close_paper_trade(
                trade_id=trade_id,
                exit_price=exit_price_with_slippage,
                pnl_usd=net_pnl,
                outcome=outcome,
                close_reason=reason,
                exit_slippage_percent=config.SLIPPAGE_PERCENT * Decimal('100'),
                exit_fee_usd=exit_fee
            )

            logger.info(
                f"Position #{trade_id} CLOSED ({reason}):\n"
                f"  Exit: ${exit_price_with_slippage:.2f}\n"
                f"  P&L: ${net_pnl:.2f} ({outcome})\n"
                f"  Exit Fee: ${exit_fee:.2f}"
            )

        except Exception as e:
            logger.error(f"Failed to close position #{trade_id}: {e}", exc_info=True)

    async def run(self) -> None:
        """Start the position manager."""
        self.running = True
        logger.info("Position manager started")
        try:
            await self.monitor_positions()
        except Exception as e:
            logger.error(f"Position manager crashed: {e}", exc_info=True)
        finally:
            self.running = False
            logger.info("Position manager stopped")

    def stop(self) -> None:
        """Stop the position manager."""
        self.running = False
        logger.info("Position manager stopping...")


# Global position manager instance
position_manager = PositionManager()
