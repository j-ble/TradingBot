/**
 * API Route: Open Positions
 *
 * Returns currently open trading positions with live P&L
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export interface Position {
  id: number;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  position_size_btc: number;
  position_size_usd: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  stop_loss_source: '5M_SWING' | '4H_SWING';
  trailing_stop_active: boolean;
  opened_at: string;
  duration_minutes: number;
  risk_amount: number;
  potential_profit: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position[] | { error: string }>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current BTC price from latest candle
    const priceResult = await query<{ close: number }>(
      `SELECT close FROM candles_5m
       ORDER BY timestamp DESC LIMIT 1`
    );

    const currentPrice = priceResult.rows.length > 0 ? priceResult.rows[0].close : null;

    if (!currentPrice) {
      return res.status(503).json({ error: 'Unable to fetch current price' });
    }

    // Get open positions
    const positionsResult = await query<{
      id: number;
      direction: 'LONG' | 'SHORT';
      entry_price: number;
      stop_loss: number;
      take_profit: number;
      position_size_btc: number;
      position_size_usd: number;
      stop_loss_source: '5M_SWING' | '4H_SWING';
      trailing_stop_activated: boolean;
      entry_time: Date;
      stop_loss_distance_percent: number;
    }>(
      `SELECT
        id,
        direction,
        entry_price,
        stop_loss,
        take_profit,
        position_size_btc,
        position_size_usd,
        stop_loss_source,
        trailing_stop_activated,
        entry_time,
        stop_loss_distance_percent
      FROM trades
      WHERE status = 'OPEN'
      ORDER BY entry_time DESC`
    );

    // Calculate P&L for each position
    const positions: Position[] = positionsResult.rows.map((pos) => {
      // Convert PostgreSQL numeric types to numbers
      const entryPrice = parseFloat(pos.entry_price as any);
      const stopLoss = parseFloat(pos.stop_loss as any);
      const takeProfit = parseFloat(pos.take_profit as any);
      const positionSizeBtc = parseFloat(pos.position_size_btc as any);
      const positionSizeUsd = parseFloat(pos.position_size_usd as any);
      const stopLossDistancePercent = parseFloat(pos.stop_loss_distance_percent as any);

      let unrealizedPnl: number;
      let unrealizedPnlPercent: number;

      if (pos.direction === 'LONG') {
        // LONG: profit if current > entry
        unrealizedPnl = (currentPrice - entryPrice) * positionSizeBtc;
        unrealizedPnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
      } else {
        // SHORT: profit if current < entry
        unrealizedPnl = (entryPrice - currentPrice) * positionSizeBtc;
        unrealizedPnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
      }

      // Calculate duration in minutes
      const durationMs = Date.now() - new Date(pos.entry_time).getTime();
      const durationMinutes = Math.floor(durationMs / 1000 / 60);

      // Calculate potential profit
      const potentialProfit = pos.direction === 'LONG'
        ? (takeProfit - entryPrice) * positionSizeBtc
        : (entryPrice - takeProfit) * positionSizeBtc;

      // Calculate risk amount from position size and stop loss distance
      const riskAmount = positionSizeUsd * (stopLossDistancePercent / 100);

      return {
        id: pos.id,
        direction: pos.direction,
        entry_price: entryPrice,
        current_price: currentPrice,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        position_size_btc: positionSizeBtc,
        position_size_usd: positionSizeUsd,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_percent: unrealizedPnlPercent,
        stop_loss_source: pos.stop_loss_source,
        trailing_stop_active: pos.trailing_stop_activated,
        opened_at: pos.entry_time.toISOString(),
        duration_minutes: durationMinutes,
        risk_amount: riskAmount,
        potential_profit: potentialProfit,
      };
    });

    return res.status(200).json(positions);
  } catch (error) {
    console.error('Error in positions endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Database query failed',
      message: errorMessage
    } as any);
  }
}
