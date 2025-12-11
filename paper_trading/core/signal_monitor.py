"""
Signal Monitor - Confluence Signal Polling
Polls database every 5 seconds for COMPLETE confluence signals and triggers trade execution.
"""

import asyncio
from typing import List, Dict, Any

from utils.logger import logger
from database.queries import get_complete_confluence_signals, get_open_positions
from core.trade_simulator import trade_simulator


class SignalMonitor:
    """
    Monitors for new confluence signals and triggers paper trades.
    Polls database every 5 seconds for signals with current_state='COMPLETE'.
    """

    def __init__(self):
        self.running = False
        self.poll_interval = 5  # seconds
        self.max_concurrent_positions = 1  # Only 1 position at a time
        self._processed_signals = set()  # Track processed signal IDs

    async def poll_for_signals(self) -> None:
        """
        Main polling loop - runs every 5 seconds.
        Checks for COMPLETE confluence signals and executes trades.
        """
        while self.running:
            try:
                # Check if we can take new positions
                open_positions = await get_open_positions()
                open_count = len(open_positions)

                if open_count >= self.max_concurrent_positions:
                    logger.debug(
                        f"Max positions reached ({open_count}/{self.max_concurrent_positions}), "
                        "skipping signal check"
                    )
                    await asyncio.sleep(self.poll_interval)
                    continue

                # Get complete confluence signals
                signals = await get_complete_confluence_signals()

                if signals:
                    logger.info(f"Found {len(signals)} complete confluence signal(s)")

                    for signal in signals:
                        # Skip if already processed in this session
                        signal_id = signal['id']
                        if signal_id in self._processed_signals:
                            logger.debug(f"Signal #{signal_id} already processed, skipping")
                            continue

                        # Check position limit again (in case multiple signals)
                        open_positions = await get_open_positions()
                        if len(open_positions) >= self.max_concurrent_positions:
                            logger.info(
                                "Position limit reached, stopping signal processing"
                            )
                            break

                        # Execute paper trade
                        await self._process_signal(signal)

                        # Mark as processed
                        self._processed_signals.add(signal_id)

                else:
                    logger.debug("No complete confluence signals found")

                # Wait before next poll
                await asyncio.sleep(self.poll_interval)

            except Exception as e:
                logger.error(f"Error in signal polling loop: {e}", exc_info=True)
                await asyncio.sleep(self.poll_interval)

    async def _process_signal(self, signal: Dict[str, Any]) -> None:
        """
        Process a confluence signal and execute paper trade.

        Args:
            signal: Confluence signal dictionary from database
        """
        signal_id = signal['id']
        sweep_type = signal['sweep_type']
        bias = signal['bias']
        bos_price = signal['bos_price']

        logger.info(
            f"Processing signal #{signal_id}: "
            f"{sweep_type} sweep -> {bias} bias -> BOS @ ${bos_price}"
        )

        try:
            # Execute paper trade via trade simulator
            trade_id = await trade_simulator.execute_paper_trade(signal)

            if trade_id:
                logger.info(
                    f"Signal #{signal_id} -> Trade #{trade_id} executed successfully"
                )
            else:
                logger.warning(
                    f"Signal #{signal_id} rejected (no valid swing-based stop loss)"
                )

        except Exception as e:
            logger.error(
                f"Failed to process signal #{signal_id}: {e}",
                exc_info=True
            )

    async def run(self) -> None:
        """Start the signal monitor."""
        self.running = True
        logger.info("Signal monitor started (polling every 5 seconds)")
        try:
            await self.poll_for_signals()
        except Exception as e:
            logger.error(f"Signal monitor crashed: {e}", exc_info=True)
        finally:
            self.running = False
            logger.info("Signal monitor stopped")

    def stop(self) -> None:
        """Stop the signal monitor."""
        self.running = False
        logger.info("Signal monitor stopping...")

    def reset_processed_signals(self) -> None:
        """Reset the processed signals cache (useful for testing)."""
        self._processed_signals.clear()
        logger.info("Processed signals cache cleared")


# Global signal monitor instance
signal_monitor = SignalMonitor()
