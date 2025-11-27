import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'trading_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

interface PerformanceMetrics {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: string;
  totalPnL: string;
  totalPnLPercent: string;
  avgRRRatio: string;
  largestWin: string;
  largestLoss: string;
  avgWinSize: string;
  avgLossSize: string;
  consecutiveWins: number;
  consecutiveLosses: number;
  currentStreak: {
    type: 'WIN' | 'LOSS' | 'NONE';
    count: number;
  };
  openPositions: number;
  profitFactor: string;
  avgTradeDuration: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all closed trades for metrics calculation
    const tradesResult = await pool.query(`
      SELECT
        id,
        outcome,
        pnl_usd,
        risk_reward_ratio,
        entry_time,
        exit_time,
        status
      FROM trades
      WHERE status = 'CLOSED'
      ORDER BY exit_time ASC
    `);

    const trades = tradesResult.rows;
    const wins = trades.filter((t: any) => t.outcome === 'WIN');
    const losses = trades.filter((t: any) => t.outcome === 'LOSS');
    const breakevens = trades.filter((t: any) => t.outcome === 'BREAKEVEN');

    // Calculate total P&L
    const totalPnL = trades.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || '0'), 0);

    // Calculate win rate
    const winRate = trades.length > 0 ? (wins.length / trades.length * 100).toFixed(2) : '0.00';

    // Calculate average R/R ratio
    const avgRRRatio = wins.length > 0
      ? (wins.reduce((sum: number, t: any) => sum + parseFloat(t.risk_reward_ratio || '0'), 0) / wins.length).toFixed(2)
      : '0.00';

    // Find largest win and loss
    const largestWin = wins.length > 0
      ? Math.max(...wins.map((t: any) => parseFloat(t.pnl_usd || '0'))).toFixed(2)
      : '0.00';
    const largestLoss = losses.length > 0
      ? Math.min(...losses.map((t: any) => parseFloat(t.pnl_usd || '0'))).toFixed(2)
      : '0.00';

    // Calculate average win/loss sizes
    const avgWinSize = wins.length > 0
      ? (wins.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || '0'), 0) / wins.length).toFixed(2)
      : '0.00';
    const avgLossSize = losses.length > 0
      ? (losses.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || '0'), 0) / losses.length).toFixed(2)
      : '0.00';

    // Calculate consecutive wins/losses
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    trades.forEach((trade: any) => {
      if (trade.outcome === 'WIN') {
        currentWinStreak++;
        currentLossStreak = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak);
      } else if (trade.outcome === 'LOSS') {
        currentLossStreak++;
        currentWinStreak = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak);
      } else {
        currentWinStreak = 0;
        currentLossStreak = 0;
      }
    });

    // Calculate current streak
    const lastTrade = trades[trades.length - 1];
    let currentStreak = { type: 'NONE' as 'WIN' | 'LOSS' | 'NONE', count: 0 };

    if (lastTrade) {
      if (lastTrade.outcome === 'WIN') {
        currentStreak = { type: 'WIN', count: currentWinStreak };
      } else if (lastTrade.outcome === 'LOSS') {
        currentStreak = { type: 'LOSS', count: currentLossStreak };
      }
    }

    // Get open positions count
    const openPositionsResult = await pool.query(`
      SELECT COUNT(*) as count FROM trades WHERE status = 'OPEN'
    `);
    const openPositions = parseInt(openPositionsResult.rows[0].count);

    // Calculate profit factor (total wins / abs(total losses))
    const totalWins = wins.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || '0'), 0);
    const totalLosses = Math.abs(losses.reduce((sum: number, t: any) => sum + parseFloat(t.pnl_usd || '0'), 0));
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : '0.00';

    // Calculate average trade duration (in hours)
    let totalDuration = 0;
    let tradesWithDuration = 0;
    trades.forEach((trade: any) => {
      if (trade.entry_time && trade.exit_time) {
        const duration = new Date(trade.exit_time).getTime() - new Date(trade.entry_time).getTime();
        totalDuration += duration;
        tradesWithDuration++;
      }
    });
    const avgTradeDurationHours = tradesWithDuration > 0
      ? (totalDuration / tradesWithDuration / (1000 * 60 * 60)).toFixed(2)
      : '0.00';

    // Calculate total P&L percentage (based on account balance changes)
    const accountResult = await pool.query(`
      SELECT account_balance FROM system_config WHERE id = 1
    `);
    const accountBalance = accountResult.rows.length > 0
      ? parseFloat(accountResult.rows[0].account_balance || '100')
      : 100;
    const totalPnLPercent = ((totalPnL / accountBalance) * 100).toFixed(2);

    const metrics: PerformanceMetrics = {
      totalTrades: trades.length,
      winCount: wins.length,
      lossCount: losses.length,
      breakevenCount: breakevens.length,
      winRate,
      totalPnL: totalPnL.toFixed(2),
      totalPnLPercent,
      avgRRRatio,
      largestWin,
      largestLoss,
      avgWinSize,
      avgLossSize,
      consecutiveWins: maxConsecutiveWins,
      consecutiveLosses: maxConsecutiveLosses,
      currentStreak,
      openPositions,
      profitFactor,
      avgTradeDuration: avgTradeDurationHours,
    };

    return res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
