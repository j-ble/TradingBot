import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import TradesTable from '../components/TradesTable';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TradesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('CLOSED');
  const [limit, setLimit] = useState<number>(100);

  const { data, error, isLoading } = useSWR(
    `/api/trades?status=${statusFilter}&limit=${limit}`,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
    }
  );

  return (
    <>
      <Head>
        <title>Trade History | BTC Trading Bot</title>
        <meta name="description" content="Complete trade history and execution details" />
      </Head>

      <div className="min-h-screen bg-gray-900 text-white">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold">BTC Trading Bot</h1>
                <p className="text-sm text-gray-400 mt-1">Trade History & Execution Details</p>
              </div>
              <nav className="flex gap-4">
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/analytics"
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Analytics
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Status Filter */}
          <div className="mb-6 flex gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'CLOSED'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Closed Trades
              </button>
              <button
                onClick={() => setStatusFilter('OPEN')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === 'OPEN'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Open Positions
              </button>
              <button
                onClick={() => setStatusFilter('')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === ''
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All Trades
              </button>
            </div>

            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={200}>Last 200</option>
              <option value={500}>Last 500</option>
            </select>
          </div>

          {/* Statistics Summary */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-white">
                  {data.pagination?.total || 0}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Showing</div>
                <div className="text-2xl font-bold text-white">
                  {data.trades?.length || 0}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">Status</div>
                <div className="text-2xl font-bold text-white capitalize">
                  {statusFilter || 'All'}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-400 mb-1">More Available</div>
                <div className="text-2xl font-bold text-white">
                  {data.pagination?.hasMore ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-red-500 text-2xl">⚠</span>
                <div>
                  <h3 className="text-lg font-medium text-red-300">Error Loading Trades</h3>
                  <p className="text-sm text-red-400 mt-1">
                    {error.message || 'Failed to fetch trade history. Please try again.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !data && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            </div>
          )}

          {/* Trades Table */}
          {data && data.trades && <TradesTable trades={data.trades} />}

          {/* Pagination Info */}
          {data && data.pagination && (
            <div className="mt-6 text-sm text-gray-400 text-center">
              {data.pagination.hasMore && (
                <p>
                  Showing {data.pagination.offset + 1} to{' '}
                  {data.pagination.offset + data.trades.length} of {data.pagination.total} trades
                </p>
              )}
            </div>
          )}

          {/* No Trades Message */}
          {data && data.trades && data.trades.length === 0 && (
            <div className="bg-gray-800 rounded-lg shadow-lg p-12 text-center">
              <div className="text-gray-400 text-lg mb-4">No trades found</div>
              <p className="text-gray-500 text-sm">
                {statusFilter === 'OPEN'
                  ? 'No open positions at the moment'
                  : statusFilter === 'CLOSED'
                  ? 'No closed trades yet. Start trading to see your history here.'
                  : 'No trades have been executed yet.'}
              </p>
              <Link
                href="/"
                className="inline-block mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Go to Dashboard
              </Link>
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
