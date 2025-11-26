/**
 * API Route: Emergency Stop
 *
 * Immediately closes all positions and stops all trading activity
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../lib/db';

export interface EmergencyStopResponse {
  success: boolean;
  message: string;
  positionsClosed: number;
  timestamp: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<EmergencyStopResponse | { error: string }>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('EMERGENCY STOP TRIGGERED');

    // 1. Mark all open positions as emergency closed
    const closeResult = await query(
      `UPDATE trades
       SET status = 'CLOSED',
           outcome = 'EMERGENCY_STOP',
           closed_at = NOW(),
           notes = COALESCE(notes, '') || ' [EMERGENCY STOP]'
       WHERE status = 'OPEN'
       RETURNING id`
    );

    const positionsClosed = closeResult.rowCount || 0;

    // 2. Deactivate all active liquidity sweeps
    await query(
      `UPDATE liquidity_sweeps
       SET active = false
       WHERE active = true`
    );

    // 3. Expire all active confluence states
    await query(
      `UPDATE confluence_state
       SET current_state = 'EXPIRED',
           updated_at = NOW()
       WHERE current_state != 'EXPIRED'
       AND current_state != 'COMPLETE'`
    );

    // 4. Log emergency stop event
    await query(
      `INSERT INTO system_events (event_type, severity, message, timestamp)
       VALUES ('EMERGENCY_STOP', 'CRITICAL', 'Emergency stop triggered from dashboard', NOW())`
    );

    console.log(`Emergency stop completed: ${positionsClosed} positions closed`);

    return res.status(200).json({
      success: true,
      message: `Emergency stop executed successfully. ${positionsClosed} position(s) closed.`,
      positionsClosed: positionsClosed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in emergency stop:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Emergency stop failed',
    });
  }
}
