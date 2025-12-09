"""
Logging utility for Paper Trading System
Uses loguru for modern, formatted logging
"""

import sys
from loguru import logger
from config import config

# Remove default logger
logger.remove()

# Add custom logger with formatting
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=config.LOG_LEVEL,
    colorize=True
)

# Add file logger for paper trading
logger.add(
    "logs/paper_trading_{time:YYYY-MM-DD}.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level=config.LOG_LEVEL,
    rotation="00:00",  # New file at midnight
    retention="30 days",  # Keep logs for 30 days
    compression="zip"
)

def get_logger(name: str):
    """Get a logger with a specific name"""
    return logger.bind(name=name)

# Export the logger
__all__ = ['logger', 'get_logger']
