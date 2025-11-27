import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface HistoricalDataPoint {
  date: string;
  winRate: number;
  totalPnL: number;
  tradesCount: number;
}

interface WinRateChartProps {
  data: HistoricalDataPoint[];
  loading?: boolean;
}

export default function WinRateChart({ data, loading = false }: WinRateChartProps) {
  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">Win Rate Over Time</h2>
        <div className="h-80 bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">Win Rate Over Time</h2>
        <div className="h-80 flex items-center justify-center text-gray-400">
          No historical data available yet. Start trading to see your performance over time.
        </div>
      </div>
    );
  }

  const formattedData = data.map(point => ({
    ...point,
    displayDate: format(new Date(point.date), 'MMM dd'),
    fullDate: point.date,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">
            {format(new Date(data.fullDate), 'MMM dd, yyyy')}
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-400">
              Win Rate: <span className="font-bold">{data.winRate.toFixed(2)}%</span>
            </p>
            <p className={data.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}>
              Total P&L: <span className="font-bold">${data.totalPnL.toFixed(2)}</span>
            </p>
            <p className="text-gray-400">
              Trades: <span className="font-medium">{data.tradesCount}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const latestWinRate = data[data.length - 1]?.winRate || 0;
  const targetWinRate = 90;

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Win Rate Over Time</h2>
          <p className="text-sm text-gray-400 mt-1">
            Current: <span className={`font-medium ${latestWinRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
              {latestWinRate.toFixed(2)}%
            </span>
            {' | '}
            Target: <span className="font-medium text-gray-300">90%</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Total Trades</div>
          <div className="text-2xl font-bold text-white">
            {data[data.length - 1]?.tradesCount || 0}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="displayDate"
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Target line at 90% */}
          <ReferenceLine
            y={targetWinRate}
            stroke="#22c55e"
            strokeDasharray="5 5"
            label={{
              value: 'Target 90%',
              fill: '#22c55e',
              fontSize: 12,
              position: 'right',
            }}
          />

          {/* Warning line at 70% */}
          <ReferenceLine
            y={70}
            stroke="#eab308"
            strokeDasharray="3 3"
            label={{
              value: 'Warning 70%',
              fill: '#eab308',
              fontSize: 10,
              position: 'right',
            }}
          />

          <Line
            type="monotone"
            dataKey="winRate"
            name="Win Rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Performance Summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Best Day</div>
          <div className="text-lg font-bold text-green-400">
            {Math.max(...data.map(d => d.winRate)).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Worst Day</div>
          <div className="text-lg font-bold text-red-400">
            {Math.min(...data.map(d => d.winRate)).toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Avg Win Rate</div>
          <div className="text-lg font-bold text-blue-400">
            {(data.reduce((sum, d) => sum + d.winRate, 0) / data.length).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      {latestWinRate < 90 && data[data.length - 1]?.tradesCount >= 10 && (
        <div className="mt-4 bg-yellow-900/20 border border-yellow-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-yellow-500">📊</span>
            <div className="text-yellow-300">
              <span className="font-medium">{(90 - latestWinRate).toFixed(2)}%</span> away from target.
              Keep refining your strategy!
            </div>
          </div>
        </div>
      )}

      {latestWinRate >= 90 && (
        <div className="mt-4 bg-green-900/20 border border-green-500 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-500">🎯</span>
            <div className="text-green-300">
              <span className="font-medium">Target achieved!</span> Maintain this performance for long-term success.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
