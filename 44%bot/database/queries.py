"""
SQL queries for paper trading system.
Handles all database operations for signals, trades, swings, and configuration.
"""

from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import datetime
from database.connection import db
from database.models import PaperTrade, ConfluenceSignal, SwingLevel
from utils.logger import logger


async def get_complete_confluence_signals() -> List[Dict[str, Any]]:
    """
    Get all COMPLETE confluence signals that haven't been traded yet.

    Returns signals with:
    - current_state = 'COMPLETE'
    - Not already in paper_trades table
    - Include liquidity sweep bias for direction

    Returns:
        List of signal dictionaries with all pattern data
    """
    query = """
        SELECT
            cs.id,
            cs.sweep_id,
            cs.current_state,
            cs.choch_detected,
            cs.choch_price,
            cs.choch_time,
            cs.fvg_detected,
            cs.fvg_zone_low,
            cs.fvg_zone_high,
            cs.fvg_fill_time,
            cs.bos_detected,
            cs.bos_price,
            cs.bos_time,
            cs.created_at,
            cs.updated_at,
            ls.bias,
            ls.sweep_type,
            ls.price as sweep_price,
            ls.timestamp as sweep_time
        FROM confluence_state cs
        JOIN liquidity_sweeps ls ON cs.sweep_id = ls.id
        WHERE cs.current_state = 'COMPLETE'
          AND cs.id NOT IN (SELECT confluence_id FROM paper_trades WHERE confluence_id IS NOT NULL)
        ORDER BY cs.updated_at DESC
    """

    try:
        rows = await db.fetch_all(query)
        logger.info(f"Found {len(rows)} complete confluence signals ready for trading")
        return rows
    except Exception as e:
        logger.error(f"Failed to fetch confluence signals: {e}")
        raise


async def get_swing_levels(
    timeframe: str,
    swing_type: str,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Get active swing levels for stop loss calculation.

    Args:
        timeframe: '5M' or '4H'
        swing_type: 'HIGH' or 'LOW'
        limit: Maximum number of swings to return (default 5)

    Returns:
        List of swing level dictionaries ordered by most recent
    """
    query = """
        SELECT
            id,
            timeframe,
            swing_type,
            price,
            candle_time,
            active,
            created_at
        FROM swing_levels
        WHERE timeframe = $1
          AND swing_type = $2
          AND active = true
        ORDER BY candle_time DESC
        LIMIT $3
    """

    try:
        rows = await db.fetch_all(query, timeframe, swing_type, limit)
        logger.debug(
            f"Found {len(rows)} active {swing_type} swings on {timeframe} timeframe"
        )
        return rows
    except Exception as e:
        logger.error(f"Failed to fetch swing levels: {e}")
        raise


async def insert_paper_trade(trade_data: Dict[str, Any]) -> int:
    """
    Insert a new paper trade into the database.

    Args:
        trade_data: Dictionary containing all trade fields

    Returns:
        ID of the inserted trade

    Required fields in trade_data:
        - confluence_id
        - direction
        - entry_price
        - stop_loss
        - take_profit
        - position_size_btc
        - position_size_usd
        - risk_amount_usd
        - risk_reward_ratio
        - stop_loss_source
        - stop_loss_swing_price
        - stop_loss_distance_percent
        - entry_slippage_percent
        - entry_fee_usd
    """
    query = """
        INSERT INTO paper_trades (
            confluence_id,
            direction,
            entry_price,
            stop_loss,
            take_profit,
            position_size_btc,
            position_size_usd,
            risk_amount_usd,
            risk_reward_ratio,
            stop_loss_source,
            stop_loss_swing_price,
            stop_loss_distance_percent,
            entry_slippage_percent,
            entry_fee_usd,
            status,
            entry_time
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, 'OPEN', NOW()
        )
        RETURNING id
    """

    try:
        trade_id = await db.fetch_val(
            query,
            trade_data['confluence_id'],
            trade_data['direction'],
            trade_data['entry_price'],
            trade_data['stop_loss'],
            trade_data['take_profit'],
            trade_data['position_size_btc'],
            trade_data['position_size_usd'],
            trade_data['risk_amount_usd'],
            trade_data['risk_reward_ratio'],
            trade_data['stop_loss_source'],
            trade_data['stop_loss_swing_price'],
            trade_data['stop_loss_distance_percent'],
            trade_data['entry_slippage_percent'],
            trade_data['entry_fee_usd']
        )

        logger.info(
            f"Inserted paper trade #{trade_id}: {trade_data['direction']} "
            f"@ ${trade_data['entry_price']} (SL: ${trade_data['stop_loss']}, "
            f"TP: ${trade_data['take_profit']})"
        )
        return trade_id

    except Exception as e:
        logger.error(f"Failed to insert paper trade: {e}")
        raise


async def get_open_positions() -> List[Dict[str, Any]]:
    """
    Get all open paper trading positions.

    Returns:
        List of open trade dictionaries with all fields
    """
    query = """
        SELECT * FROM paper_trades
        WHERE status = 'OPEN'
        ORDER BY entry_time ASC
    """

    try:
        rows = await db.fetch_all(query)
        logger.debug(f"Found {len(rows)} open positions")
        return rows
    except Exception as e:
        logger.error(f"Failed to fetch open positions: {e}")
        raise


async def update_paper_trade(trade_id: int, updates: Dict[str, Any]) -> None:
    """
    Update specific fields of a paper trade.

    Args:
        trade_id: ID of the trade to update
        updates: Dictionary of field_name: value pairs to update

    Common update scenarios:
    - Trailing stop: {'trailing_stop_activated': True, 'trailing_stop_price': price}
    - Close position: {'status': 'CLOSED', 'exit_price': price, 'exit_time': time,
                       'pnl_usd': pnl, 'outcome': 'WIN'/'LOSS'/'BREAKEVEN',
                       'close_reason': reason, 'exit_slippage_percent': slippage,
                       'exit_fee_usd': fee}
    """
    if not updates:
        logger.warning(f"No updates provided for trade #{trade_id}")
        return

    # Build dynamic UPDATE query
    set_clauses = []
    values = []
    param_count = 1

    for field, value in updates.items():
        set_clauses.append(f"{field} = ${param_count}")
        values.append(value)
        param_count += 1

    # Add trade_id as final parameter
    values.append(trade_id)

    query = f"""
        UPDATE paper_trades
        SET {', '.join(set_clauses)}
        WHERE id = ${param_count}
    """

    try:
        await db.execute(query, *values)
        logger.info(f"Updated paper trade #{trade_id}: {list(updates.keys())}")
    except Exception as e:
        logger.error(f"Failed to update paper trade #{trade_id}: {e}")
        raise


async def close_paper_trade(
    trade_id: int,
    exit_price: Decimal,
    pnl_usd: Decimal,
    outcome: str,
    close_reason: str,
    exit_slippage_percent: Decimal,
    exit_fee_usd: Decimal
) -> None:
    """
    Close a paper trade with all exit details.

    Args:
        trade_id: ID of the trade to close
        exit_price: Actual exit price after slippage
        pnl_usd: Net profit/loss in USD (after fees)
        outcome: 'WIN', 'LOSS', or 'BREAKEVEN'
        close_reason: 'STOP_LOSS', 'TAKE_PROFIT', 'TRAILING_STOP', 'TIME_LIMIT', 'MANUAL'
        exit_slippage_percent: Exit slippage percentage
        exit_fee_usd: Exit fee in USD
    """
    updates = {
        'status': 'CLOSED',
        'exit_price': exit_price,
        'exit_time': datetime.utcnow(),
        'pnl_usd': pnl_usd,
        'outcome': outcome,
        'close_reason': close_reason,
        'exit_slippage_percent': exit_slippage_percent,
        'exit_fee_usd': exit_fee_usd
    }

    await update_paper_trade(trade_id, updates)

    logger.info(
        f"Closed paper trade #{trade_id}: {outcome} @ ${exit_price} "
        f"(P&L: ${pnl_usd:.2f}, Reason: {close_reason})"
    )


async def activate_trailing_stop(trade_id: int, trailing_price: Decimal) -> None:
    """
    Activate trailing stop by moving stop to breakeven.

    Args:
        trade_id: ID of the trade
        trailing_price: New trailing stop price (typically entry price for breakeven)
    """
    updates = {
        'trailing_stop_activated': True,
        'trailing_stop_price': trailing_price
    }

    await update_paper_trade(trade_id, updates)

    logger.info(
        f"Activated trailing stop for trade #{trade_id} at ${trailing_price}"
    )


async def get_paper_config() -> Optional[Dict[str, Any]]:
    """
    Get the current paper trading configuration.

    Returns:
        Configuration dictionary or None if not found
    """
    query = """
        SELECT * FROM paper_trading_config
        WHERE id = 1
    """

    try:
        config = await db.fetch_one(query)
        if config:
            logger.debug("Loaded paper trading configuration")
        else:
            logger.warning("No paper trading configuration found in database")
        return config
    except Exception as e:
        logger.error(f"Failed to fetch paper trading config: {e}")
        raise


async def update_paper_config(updates: Dict[str, Any]) -> None:
    """
    Update paper trading configuration.

    Args:
        updates: Dictionary of field_name: value pairs to update

    Common updates:
    - Balance: {'account_balance': new_balance}
    - Session control: {'session_active': True/False}
    """
    if not updates:
        logger.warning("No config updates provided")
        return

    # Build dynamic UPDATE query
    set_clauses = []
    values = []
    param_count = 1

    for field, value in updates.items():
        set_clauses.append(f"{field} = ${param_count}")
        values.append(value)
        param_count += 1

    # Always update updated_at timestamp
    set_clauses.append(f"updated_at = NOW()")

    query = f"""
        UPDATE paper_trading_config
        SET {', '.join(set_clauses)}
        WHERE id = 1
    """

    try:
        await db.execute(query, *values)
        logger.info(f"Updated paper trading config: {list(updates.keys())}")
    except Exception as e:
        logger.error(f"Failed to update paper trading config: {e}")
        raise


async def get_performance_metrics() -> Optional[Dict[str, Any]]:
    """
    Get performance metrics from the database view.

    Returns:
        Performance metrics dictionary with win_rate, total_pnl, etc.
    """
    query = """
        SELECT * FROM v_paper_performance
    """

    try:
        metrics = await db.fetch_one(query)
        if metrics:
            logger.debug(
                f"Performance: {metrics.get('win_rate', 0):.1f}% win rate, "
                f"${metrics.get('total_pnl', 0):.2f} total P&L"
            )
        return metrics
    except Exception as e:
        logger.error(f"Failed to fetch performance metrics: {e}")
        raise


async def get_trade_history(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get recent trade history.

    Args:
        limit: Maximum number of trades to return (default 50)

    Returns:
        List of trade dictionaries ordered by most recent
    """
    query = """
        SELECT
            id,
            direction,
            entry_price,
            stop_loss,
            take_profit,
            position_size_btc,
            position_size_usd,
            pnl_usd,
            outcome,
            close_reason,
            entry_time,
            exit_time,
            risk_reward_ratio,
            trailing_stop_activated
        FROM paper_trades
        WHERE status = 'CLOSED'
        ORDER BY exit_time DESC
        LIMIT $1
    """

    try:
        rows = await db.fetch_all(query, limit)
        logger.debug(f"Retrieved {len(rows)} recent trades")
        return rows
    except Exception as e:
        logger.error(f"Failed to fetch trade history: {e}")
        raise
