/**
 * Patterns API Route
 * 
 * Fetches pattern data for chart visualization:
 * - Swing levels (HIGH/LOW)
 * - FVG zones
 * - CHoCH markers
 * - BOS markers
 * 
 * GET /api/patterns
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

export interface SwingLevel {
    id: number;
    timestamp: string;
    timeframe: string;
    type: 'HIGH' | 'LOW';
    price: number;
}

export interface FVGZone {
    id: number;
    top: number;
    bottom: number;
    type: 'BULLISH' | 'BEARISH';
    detected_at: string;
}

export interface CHoCHMarker {
    time: string;
    price: number;
    type: 'BULLISH' | 'BEARISH';
}

export interface BOSMarker {
    time: string;
    price: number;
    type: 'BULLISH' | 'BEARISH';
}

export interface PatternsData {
    swings: SwingLevel[];
    fvgs: FVGZone[];
    choch: CHoCHMarker | null;
    bos: BOSMarker | null;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<PatternsData | { error: string }>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Fetch active swing levels
        const swingsQuery = `
      SELECT 
        id,
        timestamp,
        timeframe,
        swing_type as type,
        price::numeric::float8 as price
      FROM swing_levels
      WHERE active = true
      ORDER BY timestamp DESC
      LIMIT 10
    `;
        const swingsResult = await pool.query(swingsQuery);

        // Fetch active confluence state for FVG, CHoCH, BOS
        const confluenceQuery = `
      SELECT 
        cs.id,
        cs.current_state,
        cs.choch_detected,
        cs.choch_time,
        cs.choch_price::numeric::float8 as choch_price,
        cs.fvg_detected,
        cs.fvg_zone_low::numeric::float8 as fvg_zone_low,
        cs.fvg_zone_high::numeric::float8 as fvg_zone_high,
        cs.bos_detected,
        cs.bos_time,
        cs.bos_price::numeric::float8 as bos_price,
        ls.bias
      FROM confluence_state cs
      JOIN liquidity_sweeps ls ON cs.sweep_id = ls.id
      WHERE ls.active = true
        AND cs.current_state NOT IN ('EXPIRED')
      ORDER BY cs.created_at DESC
      LIMIT 1
    `;
        const confluenceResult = await pool.query(confluenceQuery);

        // Build FVG zones
        const fvgs: FVGZone[] = [];
        if (confluenceResult.rows.length > 0) {
            const confluence = confluenceResult.rows[0];
            if (confluence.fvg_detected && confluence.fvg_zone_low && confluence.fvg_zone_high) {
                fvgs.push({
                    id: confluence.id,
                    top: confluence.fvg_zone_high,
                    bottom: confluence.fvg_zone_low,
                    type: confluence.bias === 'BULLISH' ? 'BULLISH' : 'BEARISH',
                    detected_at: new Date().toISOString(),
                });
            }
        }

        // Build CHoCH marker
        let choch: CHoCHMarker | null = null;
        if (confluenceResult.rows.length > 0) {
            const confluence = confluenceResult.rows[0];
            if (confluence.choch_detected && confluence.choch_time && confluence.choch_price) {
                choch = {
                    time: confluence.choch_time,
                    price: confluence.choch_price,
                    type: confluence.bias === 'BULLISH' ? 'BULLISH' : 'BEARISH',
                };
            }
        }

        // Build BOS marker
        let bos: BOSMarker | null = null;
        if (confluenceResult.rows.length > 0) {
            const confluence = confluenceResult.rows[0];
            if (confluence.bos_detected && confluence.bos_time && confluence.bos_price) {
                bos = {
                    time: confluence.bos_time,
                    price: confluence.bos_price,
                    type: confluence.bias === 'BULLISH' ? 'BULLISH' : 'BEARISH',
                };
            }
        }

        const patterns: PatternsData = {
            swings: swingsResult.rows,
            fvgs,
            choch,
            bos,
        };

        res.status(200).json(patterns);
    } catch (error) {
        console.error('Error fetching patterns:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to fetch patterns'
        });
    }
}
