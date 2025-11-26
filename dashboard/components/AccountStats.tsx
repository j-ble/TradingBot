/**
 * Account Statistics Component
 *
 * Displays account balance, total P&L, win rate, and performance metrics
 */

import React from 'react';
import { AccountStats as AccountStatsType } from '../pages/api/account';

interface AccountStatsProps {
  stats: AccountStatsType | null;
  isLoading: boolean;
  error: string | null;
}

const AccountStats: React.FC<AccountStatsProps> = ({ stats, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">Account Overview</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">Account Overview</h2>
        <div className="bg-danger-500/10 border border-danger-500 rounded p-4">
          <p className="text-danger-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calculate win rate progress (goal: 90%)
  const winRateProgress = Math.min(100, (stats.winRate / 90) * 100);
  const winRateColor = stats.winRate >= 90 ? 'success' :
                        stats.winRate >= 70 ? 'warning' : 'danger';

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-6 text-white">Account Overview</h2>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Balance */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">Account Balance</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(stats.balance)}</p>
        </div>

        {/* Total P&L */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${
            stats.totalPnl >= 0 ? 'text-success-500' : 'text-danger-500'
          }`}>
            {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
          </p>
          <p className={`text-sm ${
            stats.totalPnl >= 0 ? 'text-success-400' : 'text-danger-400'
          }`}>
            {stats.totalPnlPercent >= 0 ? '+' : ''}{stats.totalPnlPercent.toFixed(2)}%
          </p>
        </div>

        {/* Daily P&L */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">Today's P&L</p>
          <p className={`text-2xl font-bold ${
            stats.dailyPnl >= 0 ? 'text-success-500' : 'text-danger-500'
          }`}>
            {stats.dailyPnl >= 0 ? '+' : ''}{formatCurrency(stats.dailyPnl)}
          </p>
          <p className={`text-sm ${
            stats.dailyPnl >= 0 ? 'text-success-400' : 'text-danger-400'
          }`}>
            {stats.dailyPnlPercent >= 0 ? '+' : ''}{stats.dailyPnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Win Rate Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-sm text-gray-400">Win Rate Progress to 90% Goal</p>
            <p className="text-xs text-gray-500">{stats.totalTrades} trades completed</p>
          </div>
          <p className={`text-xl font-bold text-${winRateColor}-500`}>
            {stats.winRate.toFixed(1)}%
          </p>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 bg-${winRateColor}-500`}
            style={{ width: `${winRateProgress}%` }}
          />
        </div>
      </div>

      {/* Trade Breakdown */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Wins</p>
          <p className="text-lg font-bold text-success-500">{stats.wins}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Losses</p>
          <p className="text-lg font-bold text-danger-500">{stats.losses}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Breakeven</p>
          <p className="text-lg font-bold text-gray-400">{stats.breakevens}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3 text-center">
          <p className="text-xs text-gray-400 mb-1">Total</p>
          <p className="text-lg font-bold text-white">{stats.totalTrades}</p>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded p-3">
          <p className="text-xs text-gray-400">Best Trade</p>
          <p className="text-success-500 font-semibold">{formatCurrency(stats.bestTrade)}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3">
          <p className="text-xs text-gray-400">Worst Trade</p>
          <p className="text-danger-500 font-semibold">{formatCurrency(stats.worstTrade)}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3">
          <p className="text-xs text-gray-400">Avg Win</p>
          <p className="text-success-400 font-semibold">{formatCurrency(stats.averageWin)}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-3">
          <p className="text-xs text-gray-400">Avg Loss</p>
          <p className="text-danger-400 font-semibold">{formatCurrency(stats.averageLoss)}</p>
        </div>
      </div>

      {/* Risk Alerts */}
      {(stats.consecutiveLosses >= 2 || stats.dailyPnlPercent <= -2) && (
        <div className="mt-4 bg-warning-500/10 border border-warning-500 rounded-lg p-4">
          <p className="text-warning-500 font-semibold text-sm mb-2">⚠️ Risk Alerts</p>
          <ul className="text-xs text-gray-300 space-y-1">
            {stats.consecutiveLosses >= 2 && (
              <li>• {stats.consecutiveLosses} consecutive losses detected</li>
            )}
            {stats.consecutiveLosses >= 3 && (
              <li className="text-danger-400">• CRITICAL: 3 consecutive losses - system should pause</li>
            )}
            {stats.dailyPnlPercent <= -2 && (
              <li>• Daily loss at {stats.dailyPnlPercent.toFixed(2)}%</li>
            )}
            {stats.dailyPnlPercent <= -3 && (
              <li className="text-danger-400">• CRITICAL: Daily loss limit reached (-3%)</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AccountStats;
