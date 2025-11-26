/**
 * Main Dashboard Page
 *
 * Real-time trading bot dashboard with system status, positions, and controls
 */

import React, { useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import SystemStatus from '../components/SystemStatus';
import AccountStats from '../components/AccountStats';
import PositionCard from '../components/PositionCard';
import EmergencyStop from '../components/EmergencyStop';
import TradingChart from '../components/TradingChart';
import type { SystemStatus as SystemStatusType } from './api/status';
import type { Position } from './api/positions';
import type { AccountStats as AccountStatsType } from './api/account';

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const [showEmergencyStop, setShowEmergencyStop] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null);

  // Fetch data with auto-refresh
  const { data: systemStatus, error: statusError } = useSWR<SystemStatusType>(
    '/api/status',
    fetcher,
    { refreshInterval: 5000 } // Refresh every 5 seconds
  );

  const { data: positions, error: positionsError, mutate: mutatePositions } = useSWR<Position[]>(
    '/api/positions',
    fetcher,
    { refreshInterval: 2000 } // Refresh every 2 seconds
  );

  const { data: accountStats, error: accountError, mutate: mutateAccount } = useSWR<AccountStatsType>(
    '/api/account',
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  // Handle emergency stop
  const handleEmergencyStop = async () => {
    try {
      const response = await fetch('/api/emergency-stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setEmergencyMessage(`✓ ${result.message}`);
        // Refresh data
        mutatePositions();
        mutateAccount();
      } else {
        setEmergencyMessage(`✗ Emergency stop failed: ${result.error || 'Unknown error'}`);
      }

      // Hide message after 10 seconds
      setTimeout(() => {
        setEmergencyMessage(null);
      }, 10000);
    } catch (error) {
      setEmergencyMessage(`✗ Error executing emergency stop: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <Head>
        <title>BTC Trading Bot Dashboard</title>
        <meta name="description" content="Real-time trading bot dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              BTC Trading Bot Dashboard
            </h1>
            <p className="text-gray-400">
              Real-time monitoring and control for autonomous AI-powered BTC futures trading
            </p>
          </div>

          {/* Emergency Message */}
          {emergencyMessage && (
            <div className={`mb-6 p-4 rounded-lg ${emergencyMessage.startsWith('✓')
              ? 'bg-success-500/10 border border-success-500 text-success-500'
              : 'bg-danger-500/10 border border-danger-500 text-danger-500'
              }`}>
              <p className="font-semibold">{emergencyMessage}</p>
            </div>
          )}

          {/* Top Row: System Status and Account Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SystemStatus
              status={systemStatus || null}
              isLoading={!systemStatus && !statusError}
              error={statusError?.message || null}
            />
            <AccountStats
              stats={accountStats || null}
              isLoading={!accountStats && !accountError}
              error={accountError?.message || null}
            />
          </div>

          {/* Trading Chart Section */}
          <div className="mb-6">
            <TradingChart positions={positions || []} />
          </div>

          {/* Open Positions Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">
                Open Positions
                {positions && positions.length > 0 && (
                  <span className="ml-3 text-lg text-gray-400">({positions.length})</span>
                )}
              </h2>
              <button
                onClick={() => mutatePositions()}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>

            {positionsError && (
              <div className="bg-danger-500/10 border border-danger-500 rounded-lg p-4">
                <p className="text-danger-500">Error loading positions: {positionsError.message}</p>
              </div>
            )}

            {!positions && !positionsError && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              </div>
            )}

            {positions && positions.length === 0 && (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-400 text-lg">No open positions</p>
                <p className="text-gray-500 text-sm mt-2">Waiting for trading signals...</p>
              </div>
            )}

            {positions && positions.length > 0 && (
              <div className="grid grid-cols-1 gap-6">
                {positions.map((position) => (
                  <PositionCard key={position.id} position={position} />
                ))}
              </div>
            )}
          </div>

          {/* Emergency Stop Section */}
          <div className="mb-6">
            <button
              onClick={() => setShowEmergencyStop(!showEmergencyStop)}
              className={`w-full mb-4 px-6 py-3 rounded-lg font-semibold transition-colors duration-200 ${showEmergencyStop
                ? 'bg-gray-700 text-gray-300'
                : 'bg-danger-600 hover:bg-danger-700 text-white'
                }`}
            >
              {showEmergencyStop ? 'Hide Emergency Stop' : 'Show Emergency Stop Controls'}
            </button>

            {showEmergencyStop && (
              <EmergencyStop onEmergencyStop={handleEmergencyStop} />
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-700 text-center text-sm text-gray-500">
            <p>BTC Trading Bot v1.0.0 | Dashboard auto-refreshes every 2-10 seconds</p>
            <p className="mt-2">
              ⚠️ Trading involves risk. Monitor positions closely and use emergency stop if needed.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
