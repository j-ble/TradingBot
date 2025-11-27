import React, { useState } from 'react';
import { format } from 'date-fns';

interface Trade {
  id: number;
  direction: 'LONG' | 'SHORT';
  entry_price: string;
  entry_time: string;
  exit_price: string | null;
  exit_time: string | null;
  exit_reason: string | null;
  position_size_btc: string;
  position_size_usd: string;
  stop_loss: string;
  stop_loss_source: string | null;
  take_profit: string;
  risk_reward_ratio: string;
  pnl_btc: string | null;
  pnl_usd: string | null;
  pnl_percent: string | null;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | null;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'FAILED';
  ai_confidence: number | null;
  trailing_stop_activated: boolean;
}

interface TradesTableProps {
  trades: Trade[];
}

export default function TradesTable({ trades }: TradesTableProps) {
  const [sortField, setSortField] = useState<string>('entry_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredTrades = trades.filter(trade => {
    if (filterOutcome === 'all') return true;
    return trade.outcome === filterOutcome;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let aValue: any = a[sortField as keyof Trade];
    let bValue: any = b[sortField as keyof Trade];

    // Handle null values
    if (aValue === null) return 1;
    if (bValue === null) return -1;

    // Convert to numbers for numeric fields
    if (sortField === 'pnl_usd' || sortField === 'risk_reward_ratio') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
    }

    // Convert dates
    if (sortField === 'entry_time' || sortField === 'exit_time') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM dd, HH:mm');
    } catch {
      return '-';
    }
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">-</span>;

    const colors = {
      WIN: 'bg-green-900 text-green-300',
      LOSS: 'bg-red-900 text-red-300',
      BREAKEVEN: 'bg-yellow-900 text-yellow-300',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded font-medium ${colors[outcome as keyof typeof colors]}`}>
        {outcome}
      </span>
    );
  };

  const getDirectionBadge = (direction: string) => {
    const colors = {
      LONG: 'bg-blue-900 text-blue-300',
      SHORT: 'bg-purple-900 text-purple-300',
    };

    return (
      <span className={`px-2 py-1 text-xs rounded font-medium ${colors[direction as keyof typeof colors]}`}>
        {direction}
      </span>
    );
  };

  const exportToCSV = () => {
    const headers = [
      'ID', 'Direction', 'Entry Time', 'Entry Price', 'Exit Time', 'Exit Price',
      'Size (BTC)', 'Size (USD)', 'Stop Loss', 'Take Profit', 'R/R', 'P&L (USD)',
      'P&L (%)', 'Outcome', 'Exit Reason', 'AI Confidence'
    ];

    const csvData = sortedTrades.map(trade => [
      trade.id,
      trade.direction,
      trade.entry_time,
      trade.entry_price,
      trade.exit_time || '',
      trade.exit_price || '',
      trade.position_size_btc,
      trade.position_size_usd,
      trade.stop_loss,
      trade.take_profit,
      trade.risk_reward_ratio,
      trade.pnl_usd || '',
      trade.pnl_percent || '',
      trade.outcome || '',
      trade.exit_reason || '',
      trade.ai_confidence || ''
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Trade History</h2>
        <div className="flex gap-4">
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Outcomes</option>
            <option value="WIN">Wins</option>
            <option value="LOSS">Losses</option>
            <option value="BREAKEVEN">Breakeven</option>
          </select>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th
                className="text-left py-3 px-4 text-gray-400 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('entry_time')}
              >
                Time {sortField === 'entry_time' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">
                Direction
              </th>
              <th
                className="text-right py-3 px-4 text-gray-400 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('entry_price')}
              >
                Entry {sortField === 'entry_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-4 text-gray-400 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('exit_price')}
              >
                Exit {sortField === 'exit_price' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-4 text-gray-400 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('risk_reward_ratio')}
              >
                R/R {sortField === 'risk_reward_ratio' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="text-right py-3 px-4 text-gray-400 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('pnl_usd')}
              >
                P&L (USD) {sortField === 'pnl_usd' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center py-3 px-4 text-gray-400 text-sm font-medium">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400">
                  No trades found
                </td>
              </tr>
            ) : (
              sortedTrades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-gray-300">
                    {formatDate(trade.entry_time)}
                  </td>
                  <td className="py-3 px-4">
                    {getDirectionBadge(trade.direction)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300 text-right">
                    ${parseFloat(trade.entry_price).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300 text-right">
                    {trade.exit_price ? `$${parseFloat(trade.exit_price).toLocaleString()}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300 text-right">
                    {parseFloat(trade.risk_reward_ratio).toFixed(2)}:1
                  </td>
                  <td className={`py-3 px-4 text-sm text-right font-medium ${
                    trade.pnl_usd && parseFloat(trade.pnl_usd) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.pnl_usd ? `$${parseFloat(trade.pnl_usd).toFixed(2)}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getOutcomeBadge(trade.outcome)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedTrades.length > 0 && (
        <div className="mt-4 text-sm text-gray-400">
          Showing {sortedTrades.length} of {trades.length} trades
        </div>
      )}
    </div>
  );
}
