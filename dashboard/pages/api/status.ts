/**
 * API Route: System Status
 *
 * Returns current system status including database, API connections,
 * and trading bot health
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { query, testConnection } from '../../lib/db';

export interface SystemStatus {
  timestamp: string;
  database: {
    connected: boolean;
    latency: number | null;
  };
  coinbase: {
    connected: boolean;
    lastUpdate: string | null;
  };
  ai: {
    available: boolean;
    model: string | null;
  };
  n8n: {
    running: boolean;
    lastActivity: string | null;
  };
  overall: 'healthy' | 'degraded' | 'offline';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemStatus | { error: string }>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status: SystemStatus = {
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        latency: null,
      },
      coinbase: {
        connected: false,
        lastUpdate: null,
      },
      ai: {
        available: false,
        model: null,
      },
      n8n: {
        running: false,
        lastActivity: null,
      },
      overall: 'offline',
    };

    // Check database connection
    const dbStart = Date.now();
    const dbConnected = await testConnection();
    status.database.connected = dbConnected;
    status.database.latency = dbConnected ? Date.now() - dbStart : null;

    if (dbConnected) {
      // Check Coinbase API status (last candle update)
      try {
        const candleResult = await query<{ timestamp: Date }>(
          `SELECT timestamp FROM candles_5m
           ORDER BY timestamp DESC LIMIT 1`
        );

        if (candleResult.rows.length > 0) {
          status.coinbase.lastUpdate = candleResult.rows[0].timestamp.toISOString();
          // Consider connected if data is recent (within 10 minutes)
          const lastUpdate = new Date(candleResult.rows[0].timestamp);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;
          status.coinbase.connected = diffMinutes < 10;
        }
      } catch (error) {
        console.error('Error checking Coinbase status:', error);
      }

      // Check AI model availability (mock - would need actual Ollama check)
      // For now, assume available if configured
      status.ai.available = !!process.env.OLLAMA_HOST;
      status.ai.model = process.env.AI_MODEL || 'gpt-oss:20b';

      // Check n8n activity (last workflow execution)
      try {
        const activityResult = await query<{ timestamp: Date }>(
          `SELECT timestamp FROM liquidity_sweeps
           ORDER BY timestamp DESC LIMIT 1`
        );

        if (activityResult.rows.length > 0) {
          status.n8n.lastActivity = activityResult.rows[0].timestamp.toISOString();
          // Consider running if activity within 1 hour
          const lastActivity = new Date(activityResult.rows[0].timestamp);
          const now = new Date();
          const diffMinutes = (now.getTime() - lastActivity.getTime()) / 1000 / 60;
          status.n8n.running = diffMinutes < 60;
        }
      } catch (error) {
        console.error('Error checking n8n status:', error);
      }
    }

    // Determine overall health
    if (
      status.database.connected &&
      status.coinbase.connected &&
      status.ai.available &&
      status.n8n.running
    ) {
      status.overall = 'healthy';
    } else if (status.database.connected) {
      status.overall = 'degraded';
    } else {
      status.overall = 'offline';
    }

    return res.status(200).json(status);
  } catch (error) {
    console.error('Error in status endpoint:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
