/**
 * Position Markers Component
 * 
 * Displays position markers on the trading chart:
 * - Entry price line
 * - Stop loss line (red dashed)
 * - Take profit line (green dashed)
 */

import React from 'react';
import { ReferenceLine } from 'recharts';

interface PositionMarkersProps {
    entry: number;
    stopLoss: number;
    takeProfit: number;
    direction: 'LONG' | 'SHORT';
}

export default function PositionMarkers({
    entry,
    stopLoss,
    takeProfit,
    direction,
}: PositionMarkersProps) {
    return (
        <>
            {/* Entry Price Line */}
            <ReferenceLine
                y={entry}
                stroke={direction === 'LONG' ? '#22c55e' : '#ef4444'}
                strokeWidth={2}
                label={{
                    value: `Entry: $${entry.toLocaleString()}`,
                    position: 'right',
                    fill: '#fff',
                    fontSize: 12,
                }}
            />

            {/* Stop Loss Line */}
            <ReferenceLine
                y={stopLoss}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                    value: `SL: $${stopLoss.toLocaleString()}`,
                    position: 'right',
                    fill: '#ef4444',
                    fontSize: 12,
                }}
            />

            {/* Take Profit Line */}
            <ReferenceLine
                y={takeProfit}
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{
                    value: `TP: $${takeProfit.toLocaleString()}`,
                    position: 'right',
                    fill: '#22c55e',
                    fontSize: 12,
                }}
            />
        </>
    );
}
