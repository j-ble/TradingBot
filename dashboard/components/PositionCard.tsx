/**
 * Position Card Component
 *
 * Displays individual position details with live P&L
 */

import React from 'react';
import { Position } from '../pages/api/positions';

interface PositionCardProps {
  position: Position;
}

const PositionCard: React.FC<PositionCardProps> = ({ position }) => {
  const isProfitable = position.unrealized_pnl > 0;
  const isLong = position.direction === 'LONG';

  // Calculate progress to take profit
  const progressToTP = isLong
    ? ((position.current_price - position.entry_price) / (position.take_profit - position.entry_price)) * 100
    : ((position.entry_price - position.current_price) / (position.entry_price - position.take_profit)) * 100;

  const progressPercentage = Math.max(0, Math.min(100, progressToTP));

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format duration
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className={`bg-gray-800 rounded-lg p-6 shadow-lg border-l-4 ${
      isLong ? 'border-success-500' : 'border-danger-500'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            isLong ? 'bg-success-500/20 text-success-500' : 'bg-danger-500/20 text-danger-500'
          }`}>
            {position.direction}
          </span>
          <span className="text-gray-400 text-sm">#{position.id}</span>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${
            isProfitable ? 'text-success-500' : 'text-danger-500'
          }`}>
            {formatCurrency(position.unrealized_pnl)}
          </p>
          <p className={`text-sm ${
            isProfitable ? 'text-success-400' : 'text-danger-400'
          }`}>
            {position.unrealized_pnl_percent > 0 ? '+' : ''}
            {position.unrealized_pnl_percent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Price Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Entry Price</p>
          <p className="text-white font-medium">{formatCurrency(position.entry_price)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Current Price</p>
          <p className="text-white font-medium">{formatCurrency(position.current_price)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Stop Loss</p>
          <p className="text-danger-400 font-medium">{formatCurrency(position.stop_loss)}</p>
          <p className="text-xs text-gray-500">{position.stop_loss_source}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Take Profit</p>
          <p className="text-success-400 font-medium">{formatCurrency(position.take_profit)}</p>
        </div>
      </div>

      {/* Progress Bar to Take Profit */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress to TP</span>
          <span>{progressPercentage.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              progressPercentage >= 80 ? 'bg-success-500' :
              progressPercentage >= 50 ? 'bg-warning-500' :
              'bg-primary-500'
            }`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Position Size and Risk */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-xs text-gray-400">Size (BTC)</p>
          <p className="text-white text-sm font-medium">{position.position_size_btc.toFixed(8)}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-xs text-gray-400">Size (USD)</p>
          <p className="text-white text-sm font-medium">{formatCurrency(position.position_size_usd)}</p>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <p className="text-xs text-gray-400">Risk</p>
          <p className="text-white text-sm font-medium">{formatCurrency(position.risk_amount)}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div className="flex items-center space-x-4">
          {position.trailing_stop_active && (
            <span className="flex items-center space-x-1 text-xs text-warning-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Trailing Stop</span>
            </span>
          )}
          <span className="text-xs text-gray-400">
            Duration: {formatDuration(position.duration_minutes)}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          Opened: {new Date(position.opened_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default PositionCard;
