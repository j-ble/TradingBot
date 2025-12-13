"""
Test script to validate Paper Trading System setup
Tests: config, logger, and data models
"""

import sys
from decimal import Decimal
from datetime import datetime

def test_config():
    """Test configuration loading"""
    print("\n=== Testing Configuration ===")
    try:
        from config import config

        print(f"✅ Config loaded successfully")
        print(f"   Database: {config.DB_NAME}@{config.DB_HOST}:{config.DB_PORT}")
        print(f"   Starting Balance: ${config.STARTING_BALANCE}")
        print(f"   Risk per Trade: {config.RISK_PER_TRADE * 100}%")
        print(f"   Min R/R Ratio: {config.MIN_RR_RATIO}:1")
        print(f"   Slippage Model: {config.SLIPPAGE_MODEL} ({config.FIXED_SLIPPAGE_PERCENT}%)")
        print(f"   Taker Fee: {config.TAKER_FEE_PERCENT}%")
        print(f"   Log Level: {config.LOG_LEVEL}")
        return True
    except Exception as e:
        print(f"❌ Config test failed: {e}")
        return False

def test_logger():
    """Test logger setup"""
    print("\n=== Testing Logger ===")
    try:
        from utils.logger import logger, get_logger

        # Test basic logging
        logger.info("Testing basic logger")

        # Test named logger
        test_logger = get_logger("test_module")
        test_logger.info("Testing named logger")
        test_logger.debug("This is a debug message")
        test_logger.warning("This is a warning")

        print("✅ Logger working correctly")
        return True
    except Exception as e:
        print(f"❌ Logger test failed: {e}")
        return False

def test_models():
    """Test Pydantic data models"""
    print("\n=== Testing Pydantic Models ===")
    try:
        from database.models import (
            PositionSize, StopLossResult, PaperTrade,
            PaperTradingConfig, PerformanceMetrics
        )

        # Test PositionSize
        print("Testing PositionSize model...")
        position = PositionSize(
            btc=Decimal('0.037'),
            usd=Decimal('3333.33'),
            risk_amount=Decimal('100'),
            stop_distance=Decimal('2700'),
            stop_distance_percent=Decimal('3.0')
        )
        print(f"   ✅ PositionSize: {position.btc} BTC = ${position.usd}")

        # Test StopLossResult
        print("Testing StopLossResult model...")
        stop_loss = StopLossResult(
            price=Decimal('87300'),
            source='5M_SWING',
            swing_price=Decimal('87480'),
            swing_timestamp=datetime.now(),
            distance_percent=Decimal('3.0'),
            minimum_take_profit=Decimal('95400'),
            valid=True
        )
        print(f"   ✅ StopLossResult: ${stop_loss.price} ({stop_loss.source})")

        # Test PaperTrade
        print("Testing PaperTrade model...")
        trade = PaperTrade(
            direction='LONG',
            entry_price=Decimal('90000'),
            entry_time=datetime.now(),
            position_size_btc=Decimal('0.037'),
            position_size_usd=Decimal('3333.33'),
            stop_loss=Decimal('87300'),
            stop_loss_source='5M_SWING',
            take_profit=Decimal('95400'),
            risk_reward_ratio=Decimal('2.0'),
            status='OPEN'
        )
        print(f"   ✅ PaperTrade: {trade.direction} @ ${trade.entry_price}")

        # Test validation - should fail with R/R < 2.0
        print("Testing validation (R/R < 2.0 should fail)...")
        try:
            invalid_trade = PaperTrade(
                direction='LONG',
                entry_price=Decimal('90000'),
                entry_time=datetime.now(),
                position_size_btc=Decimal('0.037'),
                position_size_usd=Decimal('3333.33'),
                stop_loss=Decimal('87300'),
                take_profit=Decimal('92000'),
                risk_reward_ratio=Decimal('1.5'),  # Invalid: < 2.0
                status='OPEN'
            )
            print("   ❌ Validation should have failed but didn't")
            return False
        except ValueError as e:
            print(f"   ✅ Validation correctly rejected R/R < 2.0: {e}")

        print("✅ All Pydantic models working correctly")
        return True

    except Exception as e:
        print(f"❌ Models test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_database_tables():
    """Test that database tables exist"""
    print("\n=== Testing Database Tables ===")
    try:
        import asyncio
        import asyncpg
        from config import config

        async def check_tables():
            conn = await asyncpg.connect(
                host=config.DB_HOST,
                port=config.DB_PORT,
                database=config.DB_NAME,
                user=config.DB_USER,
                password=config.DB_PASSWORD
            )

            # Check paper_trades table
            result = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'paper_trades'"
            )
            if result == 1:
                print("   ✅ paper_trades table exists")
            else:
                print("   ❌ paper_trades table not found")
                return False

            # Check paper_trading_config table
            result = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'paper_trading_config'"
            )
            if result == 1:
                print("   ✅ paper_trading_config table exists")
            else:
                print("   ❌ paper_trading_config table not found")
                return False

            # Check config row exists
            config_row = await conn.fetchrow("SELECT * FROM paper_trading_config WHERE id = 1")
            if config_row:
                print(f"   ✅ Config row exists: balance=${config_row['current_balance']}, slippage={config_row['slippage_model']}")
            else:
                print("   ❌ Config row not found")
                return False

            # Check views
            result = await conn.fetchval(
                "SELECT COUNT(*) FROM information_schema.views WHERE table_name = 'v_paper_performance'"
            )
            if result == 1:
                print("   ✅ v_paper_performance view exists")
            else:
                print("   ❌ v_paper_performance view not found")
                return False

            await conn.close()
            return True

        success = asyncio.run(check_tables())
        if success:
            print("✅ Database tables verified")
        return success

    except Exception as e:
        print(f"❌ Database test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("Paper Trading System - Setup Validation")
    print("=" * 60)

    results = {
        'config': test_config(),
        'logger': test_logger(),
        'models': test_models(),
        'database': test_database_tables()
    }

    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name.capitalize()}")

    all_passed = all(results.values())
    print("=" * 60)

    if all_passed:
        print("🎉 All tests passed! System is ready.")
        return 0
    else:
        print("⚠️  Some tests failed. Please review errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
