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
    Customized,
    Bar,
} from 'recharts';
import type { Candle } from '../pages/api/candles/[timeframe]';

interface CandleChartProps {
    candles: Candle[];
    children?: React.ReactNode;
}

// Custom candlestick renderer using Customized component for proper coordinate transformation
const CandlestickLayer = (props: any) => {
    const { xAxisMap, yAxisMap, offset, chartData } = props;

    if (!xAxisMap || !yAxisMap || !chartData || chartData.length === 0) return null;

    const xScale = xAxisMap[0]?.scale;
    const yScale = yAxisMap[0]?.scale;

    if (!xScale || !yScale) return null;

    return (
        <g className="candlestick-layer">
            {chartData.map((candle: any, index: number) => {
                const { open, close, high, low, timestamp } = candle;

                // Transform data values to pixel coordinates using yScale
                const highY = yScale(high);
                const lowY = yScale(low);
                const openY = yScale(open);
                const closeY = yScale(close);
                const x = xScale(timestamp);

                // Calculate candle width (based on chart width and data density)
                const candleWidth = Math.min(
                    offset.width / chartData.length * 0.6,
                    20
                );

                // Determine color
                const isGreen = close > open;
                const color = isGreen ? '#22c55e' : '#ef4444';

                // Body dimensions (min/max for SVG top-down coordinates)
                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.max(Math.abs(closeY - openY), 1);

                return (
                    <g key={`candle-${index}`}>
                        {/* Wick: from high to low */}
                        <line
                            x1={x}
                            y1={highY}
                            x2={x}
                            y2={lowY}
                            stroke={color}
                            strokeWidth={1}
                        />

                        {/* Body: from open to close */}
                        <rect
                            x={x - candleWidth / 2}
                            y={bodyTop}
                            width={candleWidth}
                            height={bodyHeight}
                            fill={color}
                            stroke={color}
                            strokeWidth={1}
                        />
                    </g>
                );
            })}
        </g>
    );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;

    // Validate candle data exists
    if (!data.open || !data.high || !data.low || !data.close) return null;

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
    }));

    // Calculate Y-axis domain from data for optimal viewport
    const allPrices = candles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.12; // 12% padding for visual comfort and overlay space

    return (
        <ResponsiveContainer width="100%" height={500}>
            <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
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
                    domain={[minPrice - padding, maxPrice + padding]}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Invisible Bar to establish coordinate system and enable tooltip */}
                <Bar
                    dataKey="close"
                    fill="transparent"
                    stroke="transparent"
                    isAnimationActive={false}
                    style={{ pointerEvents: 'none' }}
                />

                {/* Candlesticks rendered using Customized component with proper coordinate transformation */}
                <Customized component={<CandlestickLayer chartData={chartData} />} />

                {/* Children for overlays (patterns, positions, etc.) */}
                {children}
            </ComposedChart>
        </ResponsiveContainer>
    );
}
