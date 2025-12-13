"""
Pydantic models for data validation
Maps to PostgreSQL database tables
"""

from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal

class ConfluenceSignal(BaseModel):
    """Complete confluence signal from 5M scanner"""
    id: int
    sweep_id: int
    bias: Literal['BULLISH', 'BEARISH']
    direction: Literal['LONG', 'SHORT']
    choch_price: Decimal
    choch_time: datetime
    fvg_zone_low: Decimal
    fvg_zone_high: Decimal
    fvg_fill_price: Decimal
    fvg_fill_time: datetime
    bos_price: Decimal
    bos_time: datetime
    sweep_type: Literal['HIGH', 'LOW']
    sweep_price: Decimal

class SwingLevel(BaseModel):
    """Swing high/low level for stop loss calculation"""
    id: int
    timestamp: datetime
    timeframe: Literal['4H', '5M']
    swing_type: Literal['HIGH', 'LOW']
    price: Decimal
    active: bool

class StopLossResult(BaseModel):
    """Result from stop loss calculation"""
    price: Decimal
    source: Literal['5M_SWING', '4H_SWING']
    swing_price: Decimal
    swing_timestamp: datetime
    distance_percent: Decimal
    minimum_take_profit: Decimal
    valid: bool

class PositionSize(BaseModel):
    """Position size calculation result"""
    btc: Decimal
    usd: Decimal
    risk_amount: Decimal
    stop_distance: Decimal
    stop_distance_percent: Decimal

    @field_validator('btc', 'usd', 'risk_amount', 'stop_distance')
    @classmethod
    def must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('Must be positive')
        return v

class PaperTrade(BaseModel):
    """Paper trade record"""
    id: Optional[int] = None
    confluence_id: Optional[int] = None
    direction: Literal['LONG', 'SHORT']
    entry_price: Decimal
    entry_time: datetime
    position_size_btc: Decimal
    position_size_usd: Decimal
    stop_loss: Decimal
    stop_loss_source: Optional[Literal['5M_SWING', '4H_SWING']] = None
    stop_loss_swing_price: Optional[Decimal] = None
    stop_loss_distance_percent: Optional[Decimal] = None
    take_profit: Decimal
    risk_reward_ratio: Decimal
    entry_slippage_percent: Decimal = Decimal('0')
    exit_slippage_percent: Decimal = Decimal('0')
    exit_price: Optional[Decimal] = None
    exit_time: Optional[datetime] = None
    exit_reason: Optional[Literal['TAKE_PROFIT', 'STOP_LOSS', 'TIME_BASED', 'MANUAL']] = None
    pnl_btc: Optional[Decimal] = None
    pnl_usd: Optional[Decimal] = None
    pnl_percent: Optional[Decimal] = None
    outcome: Optional[Literal['WIN', 'LOSS', 'BREAKEVEN']] = None
    trailing_stop_activated: bool = False
    trailing_stop_price: Optional[Decimal] = None
    trailing_stop_activated_at: Optional[datetime] = None
    status: Literal['OPEN', 'CLOSED'] = 'OPEN'
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator('risk_reward_ratio')
    @classmethod
    def min_rr_ratio(cls, v):
        if v < Decimal('2.0'):
            raise ValueError('R/R ratio must be at least 2:1')
        return v

class PaperTradingConfig(BaseModel):
    """Paper trading session configuration"""
    id: int = 1
    starting_balance: Decimal
    current_balance: Decimal
    slippage_model: Literal['FIXED', 'VOLUME_BASED', 'NONE'] = 'FIXED'
    fixed_slippage_percent: Decimal = Decimal('0.05')
    include_fees: bool = True
    maker_fee_percent: Decimal = Decimal('0.40')
    taker_fee_percent: Decimal = Decimal('0.60')
    trading_enabled: bool = True
    total_paper_trades: int = 0
    total_wins: int = 0
    total_losses: int = 0
    total_breakevens: int = 0
    current_win_rate: Decimal = Decimal('0')
    consecutive_wins: int = 0
    consecutive_losses: int = 0
    daily_pnl: Decimal = Decimal('0')
    daily_loss_percent: Decimal = Decimal('0')
    last_daily_reset: datetime
    session_started_at: datetime
    last_updated_at: datetime

class PerformanceMetrics(BaseModel):
    """Performance metrics from v_paper_performance view"""
    wins: int
    losses: int
    breakevens: int
    total_trades: int
    win_rate_percent: Optional[Decimal] = None
    avg_rr_wins: Optional[Decimal] = None
    avg_rr_all: Optional[Decimal] = None
    total_pnl_usd: Optional[Decimal] = None
    avg_pnl_per_trade: Optional[Decimal] = None
    best_trade_usd: Optional[Decimal] = None
    worst_trade_usd: Optional[Decimal] = None
    avg_trade_duration_hours: Optional[Decimal] = None
