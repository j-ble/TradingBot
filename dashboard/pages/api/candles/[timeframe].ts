/**
 * Candles API Route
 * 
 * Fetches candlestick data for specified timeframe (5M or 4H)
 * GET /api/candles/[timeframe]?limit=100
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'trading_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

export interface Candle {
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Candle[] | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { timeframe } = req.query;
        const limit = parseInt(req.query.limit as string) || 100;

        // Validate timeframe
        if (timeframe !== '5M' && timeframe !== '4H') {
            return res.status(400).json({ error: 'Invalid timeframe. Must be 5M or 4H' });
        }

        // Determine table name
        const tableName = timeframe === '5M' ? 'candles_5m' : 'candles_4h';

        // Fetch candles from database
        const query = `
      SELECT 
        timestamp,
        open::float as open,
        high::float as high,
        low::float as low,
        close::float as close,
        volume::float as volume
      FROM ${tableName}
      ORDER BY timestamp DESC
      LIMIT $1
    `;

        const result = await pool.query(query, [limit]);

        // Reverse to get chronological order (oldest to newest)
        const candles = result.rows.reverse();

        res.status(200).json(candles);
    } catch (error) {
        console.error('Error fetching candles:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to fetch candles'
        });
    }
}
