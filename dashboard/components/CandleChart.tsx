/**
 * Candlestick Chart Component
 * 
 * Renders candlestick chart using Recharts
 * Custom rendering for OHLC data with color coding
 */

import React from 'react';
import {
    ComposedChart,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Bar,
} from 'recharts';
import type { Candle } from '../pages/api/candles/[timeframe]';

interface CandleChartProps {
    candles: Candle[];
    children?: React.ReactNode;
}

// Custom candlestick shape
const CandleStick = (props: any) => {
    const { x, y, width, height, payload } = props;

    if (!payload) return null;

    const { open, close, high, low } = payload;
    const isGreen = close > open;
    const color = isGreen ? '#22c55e' : '#ef4444';

    // Calculate positions
    const candleWidth = Math.max(width * 0.6, 2);
    const centerX = x + width / 2;

    // Body dimensions
    const bodyTop = Math.min(open, close);
    const bodyHeight = Math.abs(close - open);

    return (
        <g>
            {/* Wick (high to low) */}
            <line
                x1={centerX}
                y1={high}
                x2={centerX}
                y2={low}
                stroke={color}
                strokeWidth={1}
            />

            {/* Body (open to close) */}
            <rect
                x={centerX - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(bodyHeight, 1)}
                fill={color}
                stroke={color}
                strokeWidth={1}
            />
        </g>
    );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const isGreen = data.close > data.open;

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-400 text-xs mb-2">
                {new Date(data.timestamp).toLocaleString()}
            </p>
            <div className="space-y-1 text-sm">
                <p className="text-gray-300">
                    <span className="text-gray-500">O:</span> ${data.open.toLocaleString()}
                </p>
                <p className="text-gray-300">
                    <span className="text-gray-500">H:</span> ${data.high.toLocaleString()}
                </p>
                <p className="text-gray-300">
                    <span className="text-gray-500">L:</span> ${data.low.toLocaleString()}
                </p>
                <p className={isGreen ? 'text-success-500' : 'text-danger-500'}>
                    <span className="text-gray-500">C:</span> ${data.close.toLocaleString()}
                </p>
                <p className="text-gray-400 text-xs mt-2">
                    Vol: {data.volume.toFixed(2)} BTC
                </p>
            </div>
        </div>
    );
};

export default function CandleChart({ candles, children }: CandleChartProps) {
    // Transform candles for Recharts
    const chartData = candles.map((candle) => ({
        ...candle,
        timestamp: new Date(candle.timestamp).getTime(),
        high: candle.high,
        low: candle.low,
    }));

    return (
        <ResponsiveContainer width="100%" height={500}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />

                <XAxis
                    dataKey="timestamp"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) => {
                        const date = new Date(timestamp);
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }}
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                />

                <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Candlesticks rendered as bars with custom shape */}
                <Bar
                    dataKey="high"
                    shape={<CandleStick />}
                    isAnimationActive={false}
                />

                {/* Children for overlays (patterns, positions, etc.) */}
                {children}
            </ComposedChart>
        </ResponsiveContainer>
    );
}
