/**
 * Emergency Stop Component
 *
 * Critical button to immediately close all positions and stop trading
 */

import React, { useState } from 'react';

interface EmergencyStopProps {
  onEmergencyStop: () => Promise<void>;
}

const EmergencyStop: React.FC<EmergencyStopProps> = ({ onEmergencyStop }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const handleInitiate = () => {
    setShowConfirm(true);
    setCountdown(3);

    // Start countdown
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onEmergencyStop();
    } finally {
      setIsExecuting(false);
      setShowConfirm(false);
      setCountdown(3);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setCountdown(3);
  };

  if (!showConfirm) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-2 border-danger-500">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <svg
              className="w-8 h-8 text-danger-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-danger-500 mb-2">Emergency Stop</h3>
            <p className="text-sm text-gray-300 mb-4">
              Immediately close all open positions and stop all trading activity. Use this only
              in emergency situations.
            </p>
            <button
              onClick={handleInitiate}
              className="w-full bg-danger-600 hover:bg-danger-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-danger-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              ACTIVATE EMERGENCY STOP
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border-2 border-danger-500 animate-pulse-slow">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-danger-500 rounded-full mb-4">
            <span className="text-4xl font-bold text-white">{countdown > 0 ? countdown : '!'}</span>
          </div>
          <h3 className="text-xl font-bold text-danger-500 mb-2">
            {countdown > 0 ? 'Confirm Emergency Stop' : 'Ready to Execute'}
          </h3>
          <p className="text-sm text-gray-300">
            {countdown > 0
              ? 'This will close all positions immediately. Are you sure?'
              : 'Click CONFIRM to execute emergency stop'}
          </p>
        </div>

        <div className="bg-danger-500/10 border border-danger-500 rounded-lg p-4 mb-6">
          <p className="text-xs text-danger-400 font-medium">WARNING:</p>
          <ul className="text-xs text-gray-300 mt-2 space-y-1 text-left">
            <li>• All open positions will be closed at market price</li>
            <li>• All active trading signals will be cancelled</li>
            <li>• System will be paused until manually restarted</li>
            <li>• This action cannot be undone</li>
          </ul>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={handleCancel}
            disabled={isExecuting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={countdown > 0 || isExecuting}
            className="flex-1 bg-danger-600 hover:bg-danger-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isExecuting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                EXECUTING...
              </>
            ) : (
              'CONFIRM EMERGENCY STOP'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyStop;
