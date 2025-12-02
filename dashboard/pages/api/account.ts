/**
 * API Route: Account Statistics
 *
 * Returns account balance, total P&L, win rate, and other metrics
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export interface AccountStats {
  balance: number;
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  consecutiveLosses: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  bestTrade: number;
  worstTrade: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountStats | { error: string }>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get account balance (mock - would need Coinbase API integration)
    const balance = parseFloat(process.env.ACCOUNT_BALANCE || '10000');

    // Get trade statistics
    const statsResult = await query<{
      total_trades: number;
      wins: number;
      losses: number;
      breakevens: number;
      total_pnl: number;
      best_trade: number;
      worst_trade: number;
      avg_win: number;
      avg_loss: number;
      total_win_amount: number;
      total_loss_amount: number;
    }>(
      `SELECT
        COUNT(*)::int as total_trades,
        COUNT(*) FILTER (WHERE outcome = 'WIN')::int as wins,
        COUNT(*) FILTER (WHERE outcome = 'LOSS')::int as losses,
        COUNT(*) FILTER (WHERE outcome = 'BREAKEVEN')::int as breakevens,
        COALESCE(SUM(pnl_usd), 0) as total_pnl,
        COALESCE(MAX(pnl_usd), 0) as best_trade,
        COALESCE(MIN(pnl_usd), 0) as worst_trade,
        COALESCE(AVG(pnl_usd) FILTER (WHERE outcome = 'WIN'), 0) as avg_win,
        COALESCE(AVG(pnl_usd) FILTER (WHERE outcome = 'LOSS'), 0) as avg_loss,
        COALESCE(SUM(pnl_usd) FILTER (WHERE outcome = 'WIN'), 0) as total_win_amount,
        COALESCE(ABS(SUM(pnl_usd)) FILTER (WHERE outcome = 'LOSS'), 0) as total_loss_amount
      FROM trades
      WHERE status = 'CLOSED'`
    );

    const stats = statsResult.rows[0];

    // Calculate win rate
    const winRate = stats.total_trades > 0
      ? (stats.wins / stats.total_trades) * 100
      : 0;

    // Calculate consecutive losses
    const consecutiveResult = await query<{ consecutive_losses: number }>(
      `WITH recent_trades AS (
        SELECT outcome,
               ROW_NUMBER() OVER (ORDER BY exit_time DESC) as rn
        FROM trades
        WHERE status = 'CLOSED'
        ORDER BY exit_time DESC
        LIMIT 10
      )
      SELECT COUNT(*)::int as consecutive_losses
      FROM recent_trades
      WHERE rn <= (
        SELECT COALESCE(MIN(rn), 0)
        FROM recent_trades
        WHERE outcome != 'LOSS'
      )
      AND outcome = 'LOSS'`
    );

    const consecutiveLosses = consecutiveResult.rows[0]?.consecutive_losses || 0;

    // Calculate daily P&L (last 24 hours)
    const dailyResult = await query<{ daily_pnl: number }>(
      `SELECT COALESCE(SUM(pnl_usd), 0) as daily_pnl
       FROM trades
       WHERE status = 'CLOSED'
       AND exit_time >= NOW() - INTERVAL '24 hours'`
    );

    const dailyPnl = parseFloat(dailyResult.rows[0]?.daily_pnl as any) || 0;

    // Convert PostgreSQL numeric types to numbers
    const totalPnl = parseFloat(stats.total_pnl as any);
    const bestTrade = parseFloat(stats.best_trade as any);
    const worstTrade = parseFloat(stats.worst_trade as any);
    const avgWin = parseFloat(stats.avg_win as any);
    const avgLoss = parseFloat(stats.avg_loss as any);
    const totalWinAmount = parseFloat(stats.total_win_amount as any);
    const totalLossAmount = parseFloat(stats.total_loss_amount as any);

    // Calculate profit factor (total wins / total losses)
    const profitFactor = totalLossAmount > 0
      ? totalWinAmount / totalLossAmount
      : totalWinAmount > 0 ? Infinity : 0;

    const accountStats: AccountStats = {
      balance: balance,
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      totalPnlPercent: balance > 0 ? (totalPnl / balance) * 100 : 0,
      winRate: parseFloat(winRate.toFixed(2)),
      totalTrades: stats.total_trades,
      wins: stats.wins,
      losses: stats.losses,
      breakevens: stats.breakevens,
      consecutiveLosses: consecutiveLosses,
      dailyPnl: parseFloat(dailyPnl.toFixed(2)),
      dailyPnlPercent: balance > 0 ? (dailyPnl / balance) * 100 : 0,
      bestTrade: parseFloat(bestTrade.toFixed(2)),
      worstTrade: parseFloat(worstTrade.toFixed(2)),
      averageWin: parseFloat(avgWin.toFixed(2)),
      averageLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor: profitFactor === Infinity ? 0 : parseFloat(profitFactor.toFixed(2)),
    };

    return res.status(200).json(accountStats);
  } catch (error) {
    console.error('Error in account endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      error: 'Database query failed',
      message: errorMessage
    } as any);
  }
}
