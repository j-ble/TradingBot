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
      trailing_stop_active: boolean;
      opened_at: Date;
      risk_amount: number;
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
        trailing_stop_active,
        opened_at,
        risk_amount
      FROM trades
      WHERE status = 'OPEN'
      ORDER BY opened_at DESC`
    );

    // Calculate P&L for each position
    const positions: Position[] = positionsResult.rows.map((pos) => {
      let unrealizedPnl: number;
      let unrealizedPnlPercent: number;

      if (pos.direction === 'LONG') {
        // LONG: profit if current > entry
        unrealizedPnl = (currentPrice - pos.entry_price) * pos.position_size_btc;
        unrealizedPnlPercent = ((currentPrice - pos.entry_price) / pos.entry_price) * 100;
      } else {
        // SHORT: profit if current < entry
        unrealizedPnl = (pos.entry_price - currentPrice) * pos.position_size_btc;
        unrealizedPnlPercent = ((pos.entry_price - currentPrice) / pos.entry_price) * 100;
      }

      // Calculate duration in minutes
      const durationMs = Date.now() - new Date(pos.opened_at).getTime();
      const durationMinutes = Math.floor(durationMs / 1000 / 60);

      // Calculate potential profit
      const potentialProfit = pos.direction === 'LONG'
        ? (pos.take_profit - pos.entry_price) * pos.position_size_btc
        : (pos.entry_price - pos.take_profit) * pos.position_size_btc;

      return {
        id: pos.id,
        direction: pos.direction,
        entry_price: pos.entry_price,
        current_price: currentPrice,
        stop_loss: pos.stop_loss,
        take_profit: pos.take_profit,
        position_size_btc: pos.position_size_btc,
        position_size_usd: pos.position_size_usd,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_percent: unrealizedPnlPercent,
        stop_loss_source: pos.stop_loss_source,
        trailing_stop_active: pos.trailing_stop_active,
        opened_at: pos.opened_at.toISOString(),
        duration_minutes: durationMinutes,
        risk_amount: pos.risk_amount,
        potential_profit: potentialProfit,
      };
    });

    return res.status(200).json(positions);
  } catch (error) {
    console.error('Error in positions endpoint:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
