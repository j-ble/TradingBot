"""
Configuration module for Paper Trading System
Loads settings from environment variables
"""

import os
from dotenv import load_dotenv
from decimal import Decimal

# Load environment variables
load_dotenv()

class Config:
    """Paper trading system configuration"""

    # Database
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', '5432'))
    DB_NAME = os.getenv('DB_NAME', 'trading_bot')
    DB_USER = os.getenv('DB_USER', 'trading_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')

    # Coinbase API
    COINBASE_API_KEY = os.getenv('COINBASE_API_KEY', '')
    COINBASE_API_SECRET = os.getenv('COINBASE_API_SECRET', '')

    # Trading Parameters
    STARTING_BALANCE = Decimal(os.getenv('ACCOUNT_BALANCE', '10000'))
    RISK_PER_TRADE = Decimal(os.getenv('RISK_PER_TRADE', '0.01'))  # 1%
    MIN_RR_RATIO = Decimal('2.0')  # Minimum 2:1 risk/reward

    # Stop Loss Constraints (from Node.js stop_loss_calculator.js)
    BUFFER_BELOW_LOW = Decimal('0.002')  # 0.2%
    BUFFER_ABOVE_HIGH = Decimal('0.003')  # 0.3%
    MIN_STOP_DISTANCE_PERCENT = Decimal('0.5')  # 0.5%
    MAX_STOP_DISTANCE_PERCENT = Decimal('3.0')  # 3.0%

    # Slippage & Fees
    SLIPPAGE_MODEL = 'FIXED'  # FIXED, VOLUME_BASED, or NONE
    FIXED_SLIPPAGE_PERCENT = Decimal('0.05')  # 0.05% (5 basis points)
    INCLUDE_FEES = True
    TAKER_FEE_PERCENT = Decimal('0.60')  # 0.60%
    MAKER_FEE_PERCENT = Decimal('0.40')  # 0.40%

    # Risk Management
    MAX_POSITIONS = 1
    DAILY_LOSS_LIMIT_PERCENT = Decimal(os.getenv('DAILY_LOSS_LIMIT', '0.03'))  # 3%
    CONSECUTIVE_LOSS_LIMIT = int(os.getenv('CONSECUTIVE_LOSS_LIMIT', '3'))
    MAX_TRADE_DURATION_HOURS = int(os.getenv('MAX_TRADE_DURATION_HOURS', '72'))
    MIN_ACCOUNT_BALANCE = Decimal('100')

    # Position Monitoring
    SIGNAL_POLL_INTERVAL = 5  # seconds
    POSITION_CHECK_INTERVAL = 1  # seconds
    PERFORMANCE_UPDATE_INTERVAL = 60  # seconds

    # Trailing Stop
    TRAILING_STOP_ACTIVATION_PERCENT = Decimal('80')  # Activate at 80% to TP

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO').upper()

    @classmethod
    def get_database_url(cls):
        """Get PostgreSQL connection URL"""
        return f"postgresql://{cls.DB_USER}:{cls.DB_PASSWORD}@{cls.DB_HOST}:{cls.DB_PORT}/{cls.DB_NAME}"

# Export singleton instance
config = Config()
