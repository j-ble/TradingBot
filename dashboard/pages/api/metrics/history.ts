import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'trading_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

interface HistoricalDataPoint {
  date: string;
  winRate: number;
  totalPnL: number;
  tradesCount: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { days = '30' } = req.query;

    // Get trades grouped by day
    const result = await pool.query(`
      WITH daily_trades AS (
        SELECT
          DATE(exit_time) as trade_date,
          COUNT(*) as trades_count,
          SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
          SUM(pnl_usd) as daily_pnl
        FROM trades
        WHERE status = 'CLOSED'
          AND exit_time >= NOW() - INTERVAL '${parseInt(days as string)} days'
        GROUP BY DATE(exit_time)
        ORDER BY DATE(exit_time) ASC
      ),
      cumulative_stats AS (
        SELECT
          trade_date,
          trades_count,
          wins,
          daily_pnl,
          SUM(wins) OVER (ORDER BY trade_date) as cumulative_wins,
          SUM(trades_count) OVER (ORDER BY trade_date) as cumulative_trades,
          SUM(daily_pnl) OVER (ORDER BY trade_date) as cumulative_pnl
        FROM daily_trades
      )
      SELECT
        trade_date::TEXT as date,
        CASE
          WHEN cumulative_trades > 0 THEN ROUND((cumulative_wins::DECIMAL / cumulative_trades * 100)::NUMERIC, 2)
          ELSE 0
        END as win_rate,
        ROUND(cumulative_pnl::NUMERIC, 2) as total_pnl,
        cumulative_trades as trades_count
      FROM cumulative_stats
      ORDER BY trade_date ASC
    `);

    const history: HistoricalDataPoint[] = result.rows.map(row => ({
      date: row.date,
      winRate: parseFloat(row.win_rate),
      totalPnL: parseFloat(row.total_pnl),
      tradesCount: parseInt(row.trades_count),
    }));

    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching metrics history:', error);
    return res.status(500).json({
      error: 'Failed to fetch metrics history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
