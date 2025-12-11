"""
Paper Trading System - Main Event Loop
Orchestrates all components for autonomous paper trading.
"""

import asyncio
import signal
import sys
from typing import Optional

from utils.logger import logger
from config import config
from database.connection import db
from market.price_feed import price_feed
from core.signal_monitor import signal_monitor
from core.position_manager import position_manager
from analytics.performance import performance_analytics


class PaperTradingSystem:
    """
    Main paper trading system orchestrator.
    Manages lifecycle of all components and runs concurrent tasks.
    """

    def __init__(self):
        self.running = False
        self._tasks = []

    async def initialize(self) -> None:
        """
        Initialize all system components.
        Connects to database and price feed.
        """
        logger.info("=" * 60)
        logger.info("PAPER TRADING SYSTEM - INITIALIZATION")
        logger.info("=" * 60)

        try:
            # Connect to database
            logger.info("Connecting to database...")
            await db.connect()
            logger.info(" Database connected")

            # Connect to price feed
            logger.info("Connecting to Coinbase price feed...")
            await price_feed.connect()
            logger.info(" Price feed connected")

            # Display configuration
            logger.info("\n=  CONFIGURATION:")
            logger.info(f"  Risk per trade:       {config.RISK_PERCENT * 100:.0f}%")
            logger.info(f"  Min R/R ratio:        {config.MIN_RR_RATIO:.1f}:1")
            logger.info(f"  Slippage:             {config.SLIPPAGE_PERCENT * 100:.2f}%")
            logger.info(f"  Trading fee:          {config.FEE_PERCENT * 100:.2f}%")
            logger.info(f"  Stop loss buffer:     {config.BUFFER_BELOW_LOW * 100:.1f}% (LONG), {config.BUFFER_ABOVE_HIGH * 100:.1f}% (SHORT)")
            logger.info(f"  Stop distance range:  {config.MIN_STOP_DISTANCE_PERCENT:.1f}% - {config.MAX_STOP_DISTANCE_PERCENT:.1f}%")

            logger.info("\n System initialization complete")
            logger.info("=" * 60 + "\n")

        except Exception as e:
            logger.error(f"L Initialization failed: {e}", exc_info=True)
            raise

    async def shutdown(self) -> None:
        """
        Graceful shutdown of all components.
        Stops tasks and disconnects from external services.
        """
        logger.info("\n" + "=" * 60)
        logger.info("SHUTTING DOWN PAPER TRADING SYSTEM")
        logger.info("=" * 60)

        self.running = False

        # Stop all monitors
        logger.info("Stopping monitors...")
        signal_monitor.stop()
        position_manager.stop()
        performance_analytics.stop()

        # Cancel all running tasks
        if self._tasks:
            logger.info(f"Cancelling {len(self._tasks)} running task(s)...")
            for task in self._tasks:
                task.cancel()

            # Wait for tasks to complete cancellation
            await asyncio.gather(*self._tasks, return_exceptions=True)
            logger.info("All tasks cancelled")

        # Disconnect from external services
        logger.info("Disconnecting from services...")
        await price_feed.disconnect()
        await db.disconnect()

        logger.info(" Shutdown complete")
        logger.info("=" * 60 + "\n")

    async def run(self) -> None:
        """
        Main run loop - starts all concurrent tasks.
        Runs 3 concurrent tasks:
        1. Signal monitor (polls every 5s)
        2. Position manager (checks every 1s)
        3. Performance analytics (updates every 60s)
        """
        self.running = True

        logger.info("=" * 60)
        logger.info("STARTING PAPER TRADING SYSTEM")
        logger.info("=" * 60)
        logger.info("=  System is now running...")
        logger.info("Press Ctrl+C to stop\n")

        try:
            # Create concurrent tasks
            self._tasks = [
                asyncio.create_task(signal_monitor.run(), name="signal_monitor"),
                asyncio.create_task(position_manager.run(), name="position_manager"),
                asyncio.create_task(performance_analytics.run(), name="performance_analytics")
            ]

            # Run all tasks concurrently
            await asyncio.gather(*self._tasks, return_exceptions=True)

        except asyncio.CancelledError:
            logger.info("Tasks cancelled")
        except Exception as e:
            logger.error(f"System error: {e}", exc_info=True)
        finally:
            self.running = False


# Global system instance
system: Optional[PaperTradingSystem] = None


def setup_signal_handlers(event_loop: asyncio.AbstractEventLoop) -> None:
    """
    Setup signal handlers for graceful shutdown.

    Args:
        event_loop: The asyncio event loop
    """
    def handle_shutdown(sig):
        """Handle shutdown signals (SIGINT, SIGTERM)."""
        logger.info(f"\nReceived signal {sig.name}, initiating shutdown...")
        if system:
            event_loop.create_task(system.shutdown())
        else:
            event_loop.stop()

    # Register signal handlers
    for sig in (signal.SIGINT, signal.SIGTERM):
        event_loop.add_signal_handler(
            sig,
            lambda s=sig: handle_shutdown(s)
        )


async def main() -> None:
    """
    Main entry point for the paper trading system.
    """
    global system

    try:
        # Create system instance
        system = PaperTradingSystem()

        # Initialize
        await system.initialize()

        # Run system
        await system.run()

    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt received")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Ensure cleanup
        if system:
            await system.shutdown()


if __name__ == "__main__":
    """
    Entry point when running as a script.
    """
    try:
        # Create event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        # Setup signal handlers for graceful shutdown
        setup_signal_handlers(loop)

        # Run main
        loop.run_until_complete(main())

    except Exception as e:
        logger.error(f"Failed to start system: {e}", exc_info=True)
        sys.exit(1)
    finally:
        # Close event loop
        loop.close()
