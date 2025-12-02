/**
 * Trading Chart Component
 * 
 * Main chart component with timeframe selector and pattern visualization
 * Integrates candlestick chart, pattern overlays, and position markers
 */

import React, { useState } from 'react';
import useSWR from 'swr';
import CandleChart from './CandleChart';
import PatternOverlay from './PatternOverlay';
import PositionMarkers from './PositionMarkers';
import type { Position } from '../pages/api/positions';

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TradingChartProps {
    positions?: Position[];
}

export default function TradingChart({ positions = [] }: TradingChartProps) {
    const [timeframe, setTimeframe] = useState<'5M' | '4H'>('5M');

    // Fetch candle data
    const { data: candlesData, error: candlesError } = useSWR(
        `/api/candles/${timeframe}?limit=100`,
        fetcher,
        { refreshInterval: timeframe === '5M' ? 30000 : 120000 } // 30s for 5M, 2min for 4H
    );

    // Fetch pattern data
    const { data: patternsData, error: patternsError } = useSWR(
        '/api/patterns',
        fetcher,
        { refreshInterval: 30000 } // Refresh every 30 seconds
    );

    const candles = candlesData || [];
    const patterns = patternsData || { swings: [], fvgs: [], choch: null, bos: null };

    return (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            {/* Header with Timeframe Selector */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">BTC-USD Chart</h2>

                <div className="flex space-x-2">
                    <button
                        onClick={() => setTimeframe('5M')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${timeframe === '5M'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        5M
                    </button>
                    <button
                        onClick={() => setTimeframe('4H')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${timeframe === '4H'
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        4H
                    </button>
                </div>
            </div>

            {/* Error States */}
            {candlesError && (
                <div className="bg-danger-500/10 border border-danger-500 rounded-lg p-4 mb-4">
                    <p className="text-danger-500">Error loading candles: {candlesError.message}</p>
                </div>
            )}

            {patternsError && (
                <div className="bg-warning-500/10 border border-warning-500 rounded-lg p-4 mb-4">
                    <p className="text-warning-500">Error loading patterns: {patternsError.message}</p>
                </div>
            )}

            {/* Loading State */}
            {!candles.length && !candlesError && (
                <div className="flex items-center justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
            )}

            {/* Chart */}
            {candles.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4">
                    <CandleChart candles={candles}>
                        {/* Pattern Overlays */}
                        <PatternOverlay swings={patterns.swings} fvgs={patterns.fvgs} />

                        {/* Position Markers */}
                        {positions.map((position) => (
                            <PositionMarkers
                                key={position.id}
                                entry={position.entry_price}
                                stopLoss={position.stop_loss}
                                takeProfit={position.take_profit}
                                direction={position.direction}
                            />
                        ))}
                    </CandleChart>

                    {/* Chart Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-0.5 bg-success-500"></div>
                            <span className="text-gray-400">Bullish Candle</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-0.5 bg-danger-500"></div>
                            <span className="text-gray-400">Bearish Candle</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-0.5 border-t-2 border-dashed border-success-500"></div>
                            <span className="text-gray-400">Swing Low</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-0.5 border-t-2 border-dashed border-danger-500"></div>
                            <span className="text-gray-400">Swing High</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-3 bg-success-500 opacity-20"></div>
                            <span className="text-gray-400">Bullish FVG</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-4 h-3 bg-danger-500 opacity-20"></div>
                            <span className="text-gray-400">Bearish FVG</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Chart Info */}
            <div className="mt-4 text-sm text-gray-500">
                <p>
                    Showing {candles.length} candles on {timeframe} timeframe
                    {patterns.swings.length > 0 && ` • ${patterns.swings.length} swing levels`}
                    {patterns.fvgs.length > 0 && ` • ${patterns.fvgs.length} FVG zones`}
                </p>
            </div>
        </div>
    );
}
