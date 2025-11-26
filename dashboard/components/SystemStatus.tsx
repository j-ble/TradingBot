/**
 * System Status Component
 *
 * Displays real-time status of all system components
 */

import React from 'react';
import { SystemStatus as SystemStatusType } from '../pages/api/status';

interface SystemStatusProps {
  status: SystemStatusType | null;
  isLoading: boolean;
  error: string | null;
}

const StatusBadge: React.FC<{ status: boolean; label: string }> = ({ status, label }) => {
  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-3 h-3 rounded-full ${
          status ? 'bg-success-500 animate-pulse-slow' : 'bg-danger-500'
        }`}
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
};

const SystemStatus: React.FC<SystemStatusProps> = ({ status, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">System Status</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white">System Status</h2>
        <div className="bg-danger-500/10 border border-danger-500 rounded p-4">
          <p className="text-danger-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Determine overall status color
  const getOverallColor = () => {
    switch (status.overall) {
      case 'healthy':
        return 'bg-success-500';
      case 'degraded':
        return 'bg-warning-500';
      case 'offline':
        return 'bg-danger-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">System Status</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getOverallColor()} animate-pulse-slow`} />
          <span className="text-sm font-semibold uppercase text-white">
            {status.overall}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Database Status */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <StatusBadge status={status.database.connected} label="Database" />
          {status.database.connected && status.database.latency !== null && (
            <p className="text-xs text-gray-400 mt-2">
              Latency: {status.database.latency}ms
            </p>
          )}
        </div>

        {/* Coinbase API Status */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <StatusBadge status={status.coinbase.connected} label="Coinbase API" />
          {status.coinbase.lastUpdate && (
            <p className="text-xs text-gray-400 mt-2">
              Last update: {new Date(status.coinbase.lastUpdate).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* AI Model Status */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <StatusBadge status={status.ai.available} label="AI Model" />
          {status.ai.model && (
            <p className="text-xs text-gray-400 mt-2">Model: {status.ai.model}</p>
          )}
        </div>

        {/* n8n Workflow Status */}
        <div className="bg-gray-700/50 rounded-lg p-4">
          <StatusBadge status={status.n8n.running} label="n8n Workflows" />
          {status.n8n.lastActivity && (
            <p className="text-xs text-gray-400 mt-2">
              Last activity: {new Date(status.n8n.lastActivity).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-400 text-right">
        Last updated: {new Date(status.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default SystemStatus;
