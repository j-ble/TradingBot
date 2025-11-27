import React from 'react';

interface PerformanceMetrics {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: string;
  totalPnL: string;
  totalPnLPercent: string;
  avgRRRatio: string;
  largestWin: string;
  largestLoss: string;
  avgWinSize: string;
  avgLossSize: string;
  consecutiveWins: number;
  consecutiveLosses: number;
  currentStreak: {
    type: 'WIN' | 'LOSS' | 'NONE';
    count: number;
  };
  openPositions: number;
  profitFactor: string;
  avgTradeDuration: string;
}

interface PerformanceMetricsProps {
  metrics: PerformanceMetrics | null;
  loading?: boolean;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  target?: string;
  progress?: number;
  status?: 'success' | 'warning' | 'error' | 'neutral';
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, subtitle, target, progress, status = 'neutral', trend }: MetricCardProps) {
  const statusColors = {
    success: 'border-green-500 bg-green-900/20',
    warning: 'border-yellow-500 bg-yellow-900/20',
    error: 'border-red-500 bg-red-900/20',
    neutral: 'border-gray-600 bg-gray-800',
  };

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→',
  };

  return (
    <div className={`rounded-lg p-4 border ${statusColors[status]}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        {trend && (
          <span className={`text-lg ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
            {trendIcons[trend]}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-sm text-gray-400">
          {subtitle}
        </div>
      )}
      {target && (
        <div className="text-xs text-gray-500 mt-1">
          Target: {target}
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                progress >= 90 ? 'bg-green-500' : progress >= 70 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PerformanceMetrics({ metrics, loading = false }: PerformanceMetricsProps) {
  if (loading || !metrics) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-gray-700 rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const winRate = parseFloat(metrics.winRate);
  const totalPnL = parseFloat(metrics.totalPnL);
  const avgRR = parseFloat(metrics.avgRRRatio);

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-white mb-6">Performance Metrics</h2>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Win Rate"
          value={`${winRate.toFixed(2)}%`}
          target="90%"
          progress={winRate}
          status={winRate >= 90 ? 'success' : winRate >= 70 ? 'warning' : 'error'}
        />

        <MetricCard
          title="Total P&L"
          value={`$${totalPnL.toLocaleString()}`}
          subtitle={`${metrics.totalPnLPercent}% ROI`}
          status={totalPnL >= 0 ? 'success' : 'error'}
          trend={totalPnL > 0 ? 'up' : totalPnL < 0 ? 'down' : 'neutral'}
        />

        <MetricCard
          title="Avg R/R Ratio"
          value={`${avgRR.toFixed(2)}:1`}
          target="≥2:1"
          status={avgRR >= 2 ? 'success' : 'warning'}
        />

        <MetricCard
          title="Total Trades"
          value={metrics.totalTrades}
          subtitle={`${metrics.winCount}W / ${metrics.lossCount}L / ${metrics.breakevenCount}BE`}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Largest Win"
          value={`$${parseFloat(metrics.largestWin).toFixed(2)}`}
          status="success"
        />

        <MetricCard
          title="Largest Loss"
          value={`$${parseFloat(metrics.largestLoss).toFixed(2)}`}
          status="error"
        />

        <MetricCard
          title="Profit Factor"
          value={metrics.profitFactor}
          subtitle={parseFloat(metrics.profitFactor) > 1 ? 'Profitable' : 'Unprofitable'}
          status={parseFloat(metrics.profitFactor) >= 2 ? 'success' : parseFloat(metrics.profitFactor) > 1 ? 'warning' : 'error'}
        />

        <MetricCard
          title="Avg Trade Duration"
          value={`${parseFloat(metrics.avgTradeDuration).toFixed(1)}h`}
          subtitle="Average holding time"
        />
      </div>

      {/* Streak & Position Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Current Streak"
          value={metrics.currentStreak.type !== 'NONE' ? metrics.currentStreak.count : 0}
          subtitle={metrics.currentStreak.type !== 'NONE' ? `${metrics.currentStreak.type}s` : 'No active streak'}
          status={
            metrics.currentStreak.type === 'WIN'
              ? 'success'
              : metrics.currentStreak.type === 'LOSS'
              ? 'error'
              : 'neutral'
          }
        />

        <MetricCard
          title="Max Win Streak"
          value={metrics.consecutiveWins}
          subtitle="Consecutive wins"
          status="success"
        />

        <MetricCard
          title="Max Loss Streak"
          value={metrics.consecutiveLosses}
          subtitle="Consecutive losses"
          status={metrics.consecutiveLosses >= 3 ? 'error' : 'warning'}
        />

        <MetricCard
          title="Open Positions"
          value={metrics.openPositions}
          subtitle={`Max: 1`}
          status={metrics.openPositions > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {/* Average Win/Loss Comparison */}
      <div className="mt-6 bg-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Win/Loss Analysis</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Average Win</div>
            <div className="text-lg font-bold text-green-400">
              ${parseFloat(metrics.avgWinSize).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Average Loss</div>
            <div className="text-lg font-bold text-red-400">
              ${parseFloat(metrics.avgLossSize).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-400">
          Win/Loss Ratio: {
            parseFloat(metrics.avgLossSize) !== 0
              ? (Math.abs(parseFloat(metrics.avgWinSize) / parseFloat(metrics.avgLossSize))).toFixed(2)
              : 'N/A'
          }
        </div>
      </div>

      {/* Warnings */}
      {metrics.consecutiveLosses >= 3 && (
        <div className="mt-4 bg-red-900/20 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">⚠</span>
            <div>
              <div className="text-sm font-medium text-red-300">
                Risk Alert: {metrics.consecutiveLosses} Consecutive Losses
              </div>
              <div className="text-xs text-red-400 mt-1">
                Trading paused for 24 hours per risk management rules
              </div>
            </div>
          </div>
        </div>
      )}

      {winRate < 70 && metrics.totalTrades >= 10 && (
        <div className="mt-4 bg-yellow-900/20 border border-yellow-500 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 text-xl">⚠</span>
            <div>
              <div className="text-sm font-medium text-yellow-300">
                Performance Warning: Win Rate Below 70%
              </div>
              <div className="text-xs text-yellow-400 mt-1">
                Review recent trades and consider adjusting AI prompts or entry criteria
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
