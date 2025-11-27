import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'trading_bot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

interface Trade {
  id: number;
  direction: 'LONG' | 'SHORT';
  entry_price: string;
  entry_time: string;
  exit_price: string | null;
  exit_time: string | null;
  exit_reason: string | null;
  position_size_btc: string;
  position_size_usd: string;
  stop_loss: string;
  stop_loss_source: string | null;
  take_profit: string;
  risk_reward_ratio: string;
  pnl_btc: string | null;
  pnl_usd: string | null;
  pnl_percent: string | null;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | null;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED';
  ai_confidence: number | null;
  ai_reasoning: string | null;
  trailing_stop_activated: boolean;
  created_at: string;
  updated_at: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { status, limit = '100', offset = '0', orderBy = 'entry_time', direction = 'DESC' } = req.query;

    // Build query with optional filters
    let query = `
      SELECT
        id,
        direction,
        entry_price,
        entry_time,
        exit_price,
        exit_time,
        exit_reason,
        position_size_btc,
        position_size_usd,
        stop_loss,
        stop_loss_source,
        take_profit,
        risk_reward_ratio,
        pnl_btc,
        pnl_usd,
        pnl_percent,
        outcome,
        status,
        ai_confidence,
        ai_reasoning,
        trailing_stop_activated,
        created_at,
        updated_at
      FROM trades
    `;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Validate orderBy to prevent SQL injection
    const validOrderColumns = ['entry_time', 'exit_time', 'pnl_usd', 'risk_reward_ratio', 'created_at'];
    const validDirection = ['ASC', 'DESC'];

    const orderColumn = validOrderColumns.includes(orderBy as string) ? orderBy : 'entry_time';
    const orderDirection = validDirection.includes((direction as string).toUpperCase()) ? direction : 'DESC';

    query += ` ORDER BY ${orderColumn} ${orderDirection}`;

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query<Trade>(query, values);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM trades';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await pool.query(countQuery, values.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return res.status(200).json({
      trades: result.rows,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + result.rows.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return res.status(500).json({
      error: 'Failed to fetch trades',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
