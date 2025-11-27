import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import PerformanceMetrics from '../components/PerformanceMetrics';
import WinRateChart from '../components/WinRateChart';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const [historyDays, setHistoryDays] = useState<number>(30);

  const { data: metrics, error: metricsError, isLoading: metricsLoading } = useSWR(
    '/api/metrics',
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  );

  const { data: history, error: historyError, isLoading: historyLoading } = useSWR(
    `/api/metrics/history?days=${historyDays}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  return (
    <>
      <Head>
        <title>Analytics | BTC Trading Bot</title>
        <meta name="description" content="Performance analytics and trading metrics" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">BTC Trading Bot</h1>
                <p className="text-sm text-gray-400 mt-1">Performance Analytics & Metrics</p>
              </div>
              <nav className="flex gap-4">
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/trades"
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Trades
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Goal Tracker */}
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 mb-8 border border-blue-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">🎯 Primary Goal: 90% Win Rate</h2>
                <p className="text-gray-300 text-sm">
                  Achieve and maintain 90% win rate over 100+ trades for consistent profitability
                </p>
              </div>
              {metrics && (
                <div className="text-right">
                  <div className="text-4xl font-bold text-white">
                    {parseFloat(metrics.winRate).toFixed(2)}%
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {metrics.totalTrades} trades completed
                  </div>
                  {parseFloat(metrics.winRate) >= 90 && metrics.totalTrades >= 100 && (
                    <div className="mt-2 inline-block px-3 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                      ✓ GOAL ACHIEVED
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error States */}
          {metricsError && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-red-500 text-2xl">⚠</span>
                <div>
                  <h3 className="text-lg font-medium text-red-300">Error Loading Metrics</h3>
                  <p className="text-sm text-red-400 mt-1">
                    {metricsError.message || 'Failed to fetch performance metrics. Please try again.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          <div className="mb-8">
            <PerformanceMetrics metrics={metrics} loading={metricsLoading} />
          </div>

          {/* Win Rate Chart */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Historical Performance</h3>
              <select
                value={historyDays}
                onChange={(e) => setHistoryDays(parseInt(e.target.value))}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>Last 7 Days</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={60}>Last 60 Days</option>
                <option value={90}>Last 90 Days</option>
              </select>
            </div>
            {historyError && (
              <div className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-yellow-300">
                  <span>⚠</span>
                  <div>Failed to load historical data. Showing current metrics only.</div>
                </div>
              </div>
            )}
            <WinRateChart data={history || []} loading={historyLoading} />
          </div>

          {/* Additional P&L Chart */}
          <div className="bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-white mb-4">Cumulative P&L Over Time</h3>
            {history && history.length > 0 ? (
              <div className="space-y-4">
                <div className="h-64 flex items-end gap-1">
                  {history.map((point, index) => {
                    const maxPnL = Math.max(...history.map(p => Math.abs(p.totalPnL)));
                    const height = Math.abs(point.totalPnL) / maxPnL * 100;
                    const isPositive = point.totalPnL >= 0;

                    return (
                      <div
                        key={index}
                        className="flex-1 flex flex-col justify-end items-center group relative"
                      >
                        <div
                          className={`w-full transition-all ${
                            isPositive ? 'bg-green-500 hover:bg-green-400' : 'bg-red-500 hover:bg-red-400'
                          }`}
                          style={{ height: `${height}%` }}
                        />
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                          <div className="text-gray-400">{point.date}</div>
                          <div className={isPositive ? 'text-green-400' : 'text-red-400'}>
                            ${point.totalPnL.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{history[0]?.date}</span>
                  <span>{history[history.length - 1]?.date}</span>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                No P&L data available yet
              </div>
            )}
          </div>

          {/* Risk Management Status */}
          {metrics && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Risk Management Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Open Positions</span>
                    <span className={`font-medium ${metrics.openPositions > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {metrics.openPositions} / 1
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Consecutive Losses</span>
                    <span className={`font-medium ${metrics.consecutiveLosses >= 3 ? 'text-red-400' : 'text-green-400'}`}>
                      {metrics.consecutiveLosses} / 3
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Risk Per Trade</span>
                    <span className="font-medium text-blue-400">1%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Min R/R Ratio</span>
                    <span className="font-medium text-blue-400">2:1</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4">Strategy Performance</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Profit Factor</span>
                    <span className={`font-medium ${parseFloat(metrics.profitFactor) >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {parseFloat(metrics.profitFactor).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Trade Duration</span>
                    <span className="font-medium text-blue-400">
                      {parseFloat(metrics.avgTradeDuration).toFixed(1)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Win/Loss Ratio</span>
                    <span className="font-medium text-blue-400">
                      {parseFloat(metrics.avgLossSize) !== 0
                        ? (Math.abs(parseFloat(metrics.avgWinSize) / parseFloat(metrics.avgLossSize))).toFixed(2)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total ROI</span>
                    <span className={`font-medium ${parseFloat(metrics.totalPnLPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(metrics.totalPnLPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps / Recommendations */}
          {metrics && metrics.totalTrades > 0 && (
            <div className="mt-8 bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">Recommendations</h3>
              <div className="space-y-3">
                {parseFloat(metrics.winRate) < 70 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <span className="text-yellow-500">💡</span>
                    <div className="text-sm text-yellow-200">
                      <strong>Improve Win Rate:</strong> Review losing trades and refine AI prompts or entry criteria.
                      Current win rate ({metrics.winRate}%) is below the 70% warning threshold.
                    </div>
                  </div>
                )}
                {parseFloat(metrics.avgRRRatio) < 2 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <span className="text-yellow-500">💡</span>
                    <div className="text-sm text-yellow-200">
                      <strong>Increase Risk/Reward:</strong> Average R/R ratio ({metrics.avgRRRatio}:1) is below minimum 2:1.
                      Consider adjusting take profit targets or tightening stop losses.
                    </div>
                  </div>
                )}
                {parseFloat(metrics.profitFactor) < 1.5 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <span className="text-yellow-500">💡</span>
                    <div className="text-sm text-yellow-200">
                      <strong>Improve Profit Factor:</strong> Profit factor ({metrics.profitFactor}) should be above 2.0 for strong performance.
                      Focus on letting winners run and cutting losses quickly.
                    </div>
                  </div>
                )}
                {metrics.totalTrades < 100 && parseFloat(metrics.winRate) >= 70 && (
                  <div className="flex items-start gap-3 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                    <span className="text-blue-500">📊</span>
                    <div className="text-sm text-blue-200">
                      <strong>Build Sample Size:</strong> You have {metrics.totalTrades} trades.
                      Continue trading to reach 100+ trades for statistical significance of your {metrics.winRate}% win rate.
                    </div>
                  </div>
                )}
                {parseFloat(metrics.winRate) >= 90 && metrics.totalTrades >= 100 && (
                  <div className="flex items-start gap-3 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                    <span className="text-green-500">🎉</span>
                    <div className="text-sm text-green-200">
                      <strong>Goal Achieved!</strong> You've reached the 90% win rate target with {metrics.totalTrades} trades.
                      Maintain this performance and consider scaling your capital.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 border-t border-gray-700 mt-12">
          <div className="container mx-auto px-4 py-6">
            <div className="text-center text-sm text-gray-400">
              BTC Trading Bot - Autonomous AI-Powered Futures Trading
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
