/**
 * Pattern Overlay Component
 * 
 * Renders pattern indicators on the chart:
 * - Swing levels (horizontal dashed lines)
 * - FVG zones (shaded rectangles)
 * - CHoCH markers (circles)
 * - BOS markers (triangles)
 */

import React from 'react';
import { ReferenceLine, ReferenceArea } from 'recharts';
import type { SwingLevel, FVGZone } from '../pages/api/patterns';

interface PatternOverlayProps {
    swings: SwingLevel[];
    fvgs: FVGZone[];
}

export default function PatternOverlay({ swings, fvgs }: PatternOverlayProps) {
    return (
        <>
            {/* Swing Levels */}
            {swings.map((swing) => (
                <ReferenceLine
                    key={swing.id}
                    y={swing.price}
                    stroke={swing.type === 'HIGH' ? '#ef4444' : '#22c55e'}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    label={{
                        value: `${swing.timeframe} Swing ${swing.type}`,
                        position: 'insideTopRight',
                        fill: swing.type === 'HIGH' ? '#ef4444' : '#22c55e',
                        fontSize: 11,
                    }}
                />
            ))}

            {/* FVG Zones */}
            {fvgs.map((fvg) => (
                <ReferenceArea
                    key={fvg.id}
                    y1={fvg.top}
                    y2={fvg.bottom}
                    fill={fvg.type === 'BULLISH' ? '#22c55e' : '#ef4444'}
                    fillOpacity={0.15}
                    label={{
                        value: `FVG ${fvg.type}`,
                        position: 'insideTopLeft',
                        fill: fvg.type === 'BULLISH' ? '#22c55e' : '#ef4444',
                        fontSize: 11,
                    }}
                />
            ))}
        </>
    );
}
