"""
Trade Simulator - Paper Trading System
Simulates trade execution with swing-based stop loss and 1% risk position sizing.

CRITICAL: This module MUST exactly match the Node.js implementation in:
- lib/trading/stop_loss_calculator.js
- lib/trading/position_sizer.js
"""

from decimal import Decimal
from typing import Optional, Dict, Any
from datetime import datetime

from config import config
from utils.logger import logger
from database.connection import db
from database.queries import (
    get_swing_levels,
    insert_paper_trade,
    get_paper_config
)
from database.models import StopLossResult, PositionSize, ConfluenceSignal
from market.price_feed import price_feed


# Stop loss configuration (MUST match Node.js exactly)
class StopLossConfig:
    """Stop loss calculation constants - matches Node.js CONFIG"""
    BUFFER_BELOW_LOW = Decimal('0.002')      # 0.2% for LONG
    BUFFER_ABOVE_HIGH = Decimal('0.003')     # 0.3% for SHORT
    MIN_RR_RATIO = Decimal('1.0')            # 1:1 minimum
    MAX_RR_RATIO = Decimal('2.0')            # 2:1 maximum


class TradeSimulator:
    """
    Simulates paper trades based on confluence signals.
    Implements swing-based stop loss and 1% risk position sizing.
    """

    def __init__(self):
        self.config = StopLossConfig()

    async def calculate_stop_with_buffer(
        self,
        swing_price: Decimal,
        direction: str
    ) -> Decimal:
        """
        Calculate stop loss with buffer beyond swing level.

        Args:
            swing_price: The swing level price
            direction: 'LONG' or 'SHORT'

        Returns:
            Stop loss price with buffer applied
        """
        if direction == 'LONG':
            # Stop below swing low - 0.2% buffer
            stop_loss = swing_price * (Decimal('1') - self.config.BUFFER_BELOW_LOW)
            logger.debug(
                f"LONG stop with buffer: swing=${swing_price}, "
                f"buffer={self.config.BUFFER_BELOW_LOW}, stop=${stop_loss}"
            )
        elif direction == 'SHORT':
            # Stop above swing high + 0.3% buffer
            stop_loss = swing_price * (Decimal('1') + self.config.BUFFER_ABOVE_HIGH)
            logger.debug(
                f"SHORT stop with buffer: swing=${swing_price}, "
                f"buffer={self.config.BUFFER_ABOVE_HIGH}, stop=${stop_loss}"
            )
        else:
            raise ValueError(f"Invalid direction: {direction}")

        return stop_loss

    def calculate_distance_percent(
        self,
        entry_price: Decimal,
        stop_price: Decimal
    ) -> Decimal:
        """
        Calculate stop loss distance as percentage.

        Args:
            entry_price: Entry price
            stop_price: Stop loss price

        Returns:
            Distance as percentage (e.g., Decimal('1.5') for 1.5%)
        """
        distance = abs(entry_price - stop_price)
        distance_percent = (distance / entry_price) * Decimal('100')
        return distance_percent

    def is_valid_stop(
        self,
        entry_price: Decimal,
        stop_price: Decimal
    ) -> Dict[str, Any]:
        """
        Validate stop loss (no distance constraints - accept any swing level).

        Args:
            entry_price: Entry price
            stop_price: Stop loss price

        Returns:
            Dict with 'valid', 'distance', 'reason'
        """
        distance_percent = self.calculate_distance_percent(entry_price, stop_price)

        # No distance constraints - any swing level is valid
        return {
            'valid': True,
            'distance': distance_percent,
            'reason': 'Stop at swing level (no distance constraints)'
        }

    def is_stop_on_correct_side(
        self,
        entry_price: Decimal,
        stop_price: Decimal,
        direction: str
    ) -> bool:
        """
        Validate stop is on correct side of entry.

        Args:
            entry_price: Entry price
            stop_price: Stop loss price
            direction: 'LONG' or 'SHORT'

        Returns:
            True if stop is on correct side
        """
        if direction == 'LONG':
            return stop_price < entry_price
        elif direction == 'SHORT':
            return stop_price > entry_price
        return False

    def calculate_minimum_take_profit(
        self,
        entry_price: Decimal,
        stop_price: Decimal,
        direction: str
    ) -> Decimal:
        """
        Calculate minimum take profit for 1:1 R/R ratio (will be capped at 2:1 max).

        Args:
            entry_price: Entry price
            stop_price: Stop loss price
            direction: 'LONG' or 'SHORT'

        Returns:
            Minimum take profit price (1:1 R/R)
        """
        stop_distance = abs(entry_price - stop_price)
        target_distance = stop_distance * self.config.MIN_RR_RATIO

        if direction == 'LONG':
            return entry_price + target_distance
        elif direction == 'SHORT':
            return entry_price - target_distance
        else:
            raise ValueError(f"Invalid direction: {direction}")

    async def calculate_stop_loss(
        self,
        entry_price: Decimal,
        direction: str,
        bias: str
    ) -> Optional[StopLossResult]:
        """
        Calculate swing-based stop loss with priority logic.
        Priority: 5M swing -> 4H swing -> None (reject trade)

        Args:
            entry_price: Expected entry price
            direction: 'LONG' or 'SHORT'
            bias: 'BULLISH' or 'BEARISH' (for validation)

        Returns:
            StopLossResult or None if no valid stop found
        """
        logger.info(
            f"Calculating swing-based stop loss: "
            f"entry=${entry_price}, direction={direction}, bias={bias}"
        )

        # Validate direction matches bias
        expected_direction = 'LONG' if bias == 'BULLISH' else 'SHORT'
        if direction != expected_direction:
            raise ValueError(
                f"Direction {direction} does not match bias {bias} "
                f"(expected {expected_direction})"
            )

        # Determine swing type (LONG needs LOW, SHORT needs HIGH)
        swing_type = 'LOW' if direction == 'LONG' else 'HIGH'

        # Try 5M swing first
        swings_5m = await get_swing_levels('5M', swing_type, limit=1)
        if swings_5m:
            swing_5m = swings_5m[0]
            swing_price = Decimal(str(swing_5m['price']))

            logger.info(
                f"Trying 5M swing: price=${swing_price}, "
                f"time={swing_5m['candle_time']}"
            )

            stop_5m = await self.calculate_stop_with_buffer(swing_price, direction)
            validation = self.is_valid_stop(entry_price, stop_5m)

            if validation['valid'] and self.is_stop_on_correct_side(
                entry_price, stop_5m, direction
            ):
                min_tp = self.calculate_minimum_take_profit(
                    entry_price, stop_5m, direction
                )

                logger.info(
                    f"5M swing stop VALID: stop=${stop_5m}, "
                    f"distance={validation['distance']:.2f}%, min_tp=${min_tp}"
                )

                return StopLossResult(
                    price=stop_5m,
                    source='5M_SWING',
                    swing_price=swing_price,
                    distance_percent=validation['distance'],
                    minimum_take_profit=min_tp
                )
            else:
                logger.warning(
                    f"5M swing stop INVALID: {validation['reason']}, "
                    f"correct_side={self.is_stop_on_correct_side(entry_price, stop_5m, direction)}"
                )

        # Fallback to 4H swing
        swings_4h = await get_swing_levels('4H', swing_type, limit=1)
        if swings_4h:
            swing_4h = swings_4h[0]
            swing_price = Decimal(str(swing_4h['price']))

            logger.info(
                f"Trying 4H swing (fallback): price=${swing_price}, "
                f"time={swing_4h['candle_time']}"
            )

            stop_4h = await self.calculate_stop_with_buffer(swing_price, direction)
            validation = self.is_valid_stop(entry_price, stop_4h)

            if validation['valid'] and self.is_stop_on_correct_side(
                entry_price, stop_4h, direction
            ):
                min_tp = self.calculate_minimum_take_profit(
                    entry_price, stop_4h, direction
                )

                logger.info(
                    f"4H swing stop VALID: stop=${stop_4h}, "
                    f"distance={validation['distance']:.2f}%, min_tp=${min_tp}"
                )

                return StopLossResult(
                    price=stop_4h,
                    source='4H_SWING',
                    swing_price=swing_price,
                    distance_percent=validation['distance'],
                    minimum_take_profit=min_tp
                )
            else:
                logger.warning(
                    f"4H swing stop INVALID: {validation['reason']}, "
                    f"correct_side={self.is_stop_on_correct_side(entry_price, stop_4h, direction)}"
                )

        # No valid swing found - REJECT TRADE
        logger.error(
            f"NO VALID SWING-BASED STOP FOUND - Trade rejected: "
            f"entry=${entry_price}, direction={direction}"
        )
        return None

    def calculate_position_size(
        self,
        account_balance: Decimal,
        entry_price: Decimal,
        stop_loss: Decimal
    ) -> PositionSize:
        """
        Calculate position size based on 1% fixed risk.

        Formula: Position Size = (Account Balance * 1%) / Stop Distance

        Args:
            account_balance: Total account balance in USD
            entry_price: Entry price for the trade
            stop_loss: Stop loss price

        Returns:
            PositionSize with BTC and USD amounts
        """
        # Validate inputs
        if account_balance <= 0:
            raise ValueError("Account balance must be positive")
        if entry_price <= 0:
            raise ValueError("Entry price must be positive")
        if stop_loss <= 0:
            raise ValueError("Stop loss must be positive")

        # Calculate 1% risk amount (NON-NEGOTIABLE)
        risk_amount = account_balance * Decimal('0.01')

        # Calculate stop distance
        stop_distance = abs(entry_price - stop_loss)

        if stop_distance == 0:
            raise ValueError("Stop loss cannot equal entry price")

        # Calculate position size in BTC
        position_btc = risk_amount / stop_distance

        # Calculate position size in USD
        position_usd = position_btc * entry_price

        # Calculate stop distance percentage
        stop_distance_percent = (stop_distance / entry_price) * Decimal('100')

        logger.debug(
            f"Position size calculated: {position_btc:.8f} BTC (${position_usd:.2f}), "
            f"risk=${risk_amount:.2f}, stop_distance={stop_distance_percent:.2f}%"
        )

        return PositionSize(
            btc=position_btc,
            usd=position_usd,
            risk_amount=risk_amount,
            stop_distance=stop_distance,
            stop_distance_percent=stop_distance_percent
        )

    def apply_slippage(
        self,
        price: Decimal,
        direction: str,
        is_entry: bool = True
    ) -> Decimal:
        """
        Apply slippage to execution price (FIXED 0.05% model).

        Args:
            price: Market price
            direction: 'LONG' or 'SHORT'
            is_entry: True for entry, False for exit

        Returns:
            Filled price after slippage
        """
        slippage_percent = config.FIXED_SLIPPAGE_PERCENT  # 0.05%

        if is_entry:
            # Entry: Always worse
            if direction == 'LONG':
                # Buy higher
                filled_price = price * (Decimal('1') + slippage_percent)
            else:  # SHORT
                # Sell lower
                filled_price = price * (Decimal('1') - slippage_percent)
        else:
            # Exit: Always worse
            if direction == 'LONG':
                # Sell lower
                filled_price = price * (Decimal('1') - slippage_percent)
            else:  # SHORT
                # Buy higher
                filled_price = price * (Decimal('1') + slippage_percent)

        logger.debug(
            f"Slippage applied: ${price:.2f} � ${filled_price:.2f} "
            f"({direction}, {'entry' if is_entry else 'exit'})"
        )

        return filled_price

    def calculate_fee(self, position_usd: Decimal) -> Decimal:
        """
        Calculate trading fee (Coinbase Advanced Trade taker fee: 0.60%).

        Args:
            position_usd: Position size in USD

        Returns:
            Fee amount in USD
        """
        fee = position_usd * config.FEE_PERCENT
        return fee

    async def execute_paper_trade(
        self,
        signal: Dict[str, Any]
    ) -> Optional[int]:
        """
        Execute a paper trade based on confluence signal.

        Steps:
        1. Get current price
        2. Calculate stop loss (swing-based)
        3. Calculate position size (1% risk)
        4. Apply slippage (0.05% FIXED)
        5. Apply fees (0.60% taker)
        6. Insert into paper_trades table

        Args:
            signal: Confluence signal dictionary from database

        Returns:
            Trade ID if successful, None if rejected
        """
        try:
            # Extract signal data
            direction = 'LONG' if signal['bias'] == 'BULLISH' else 'SHORT'
            bias = signal['bias']
            confluence_id = signal['id']

            logger.info(
                f"Executing paper trade for signal #{confluence_id}: "
                f"{direction} ({bias})"
            )

            # 1. Get current market price
            current_price = await price_feed.get_current_price()
            logger.info(f"Current BTC-USD price: ${current_price:,.2f}")

            # 2. Calculate swing-based stop loss
            stop_result = await self.calculate_stop_loss(
                current_price, direction, bias
            )

            if not stop_result:
                logger.warning(
                    f"Trade REJECTED: No valid swing-based stop loss for signal #{confluence_id}"
                )
                return None

            # 3. Get account balance and calculate position size
            paper_config = await get_paper_config()
            if not paper_config:
                raise RuntimeError("Paper trading config not found in database")

            account_balance = Decimal(str(paper_config['account_balance']))
            logger.info(f"Account balance: ${account_balance:.2f}")

            position = self.calculate_position_size(
                account_balance,
                current_price,
                stop_result.price
            )

            # 4. Apply entry slippage
            entry_price_with_slippage = self.apply_slippage(
                current_price, direction, is_entry=True
            )

            # 5. Calculate fees
            entry_fee = self.calculate_fee(position.position_usd)

            # 6. Calculate take profit (minimum 2:1 R/R)
            take_profit = stop_result.minimum_take_profit

            # Calculate actual R/R ratio
            stop_distance = abs(entry_price_with_slippage - stop_result.price)
            target_distance = abs(take_profit - entry_price_with_slippage)
            rr_ratio = target_distance / stop_distance

            # 7. Insert into database
            trade_data = {
                'confluence_id': confluence_id,
                'direction': direction,
                'entry_price': entry_price_with_slippage,
                'stop_loss': stop_result.price,
                'take_profit': take_profit,
                'position_size_btc': position.btc,
                'position_size_usd': position.usd,
                'risk_amount_usd': position.risk_amount,
                'risk_reward_ratio': rr_ratio,
                'stop_loss_source': stop_result.source,
                'stop_loss_swing_price': stop_result.swing_price,
                'stop_loss_distance_percent': stop_result.distance_percent,
                'entry_slippage_percent': config.FIXED_SLIPPAGE_PERCENT * Decimal('100'),
                'entry_fee_usd': entry_fee
            }

            trade_id = await insert_paper_trade(trade_data)

            logger.info(
                f"Paper trade #{trade_id} EXECUTED: {direction} "
                f"{position.btc:.8f} BTC @ ${entry_price_with_slippage:.2f}\n"
                f"  SL: ${stop_result.price:.2f} ({stop_result.source})\n"
                f"  TP: ${take_profit:.2f} (R/R: {rr_ratio:.2f}:1)\n"
                f"  Risk: ${position.risk_amount:.2f} (1%)\n"
                f"  Fee: ${entry_fee:.2f}"
            )

            return trade_id

        except Exception as e:
            logger.error(f"Failed to execute paper trade: {e}", exc_info=True)
            return None


# Global trade simulator instance
trade_simulator = TradeSimulator()
