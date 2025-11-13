/**
 * Device State Display Component
 *
 * Displays current hardware state for a device (on/off, active/inactive, etc.)
 */

import React from 'react';
import { Power, Circle, CheckCircle, XCircle, Zap, Radio } from 'lucide-react';

interface DeviceStateDisplayProps {
  deviceState: Record<string, any> | null;
  deviceType?: string;
}

export default function DeviceStateDisplay({ deviceState, deviceType }: DeviceStateDisplayProps) {
  if (!deviceState || Object.keys(deviceState).length === 0) {
    return (
      <div className="text-center py-8">
        <Circle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No state data available</p>
        <p className="text-gray-600 text-xs mt-1">
          Device has not reported state yet
        </p>
      </div>
    );
  }

  // Format state key to human readable
  const formatKey = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // Determine if value is boolean-like
  const isBooleanValue = (value: any): boolean => {
    return typeof value === 'boolean' ||
           value === 'on' || value === 'off' ||
           value === 'true' || value === 'false' ||
           value === 1 || value === 0 ||
           value === 'active' || value === 'inactive';
  };

  // Get boolean value
  const getBooleanValue = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'on' || lower === 'true' || lower === 'active' || lower === '1';
    }
    return false;
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (typeof value === 'boolean') return value ? 'ON' : 'OFF';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value.toUpperCase();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Filter out internal/timestamp fields
  const stateEntries = Object.entries(deviceState).filter(([key]) => {
    const lower = key.toLowerCase();
    return !lower.includes('timestamp') &&
           !lower.includes('ts') &&
           !lower.includes('uptime') &&
           !lower.includes('uid');
  });

  return (
    <div className="space-y-3">
      {stateEntries.map(([key, value]) => {
        const isBoolean = isBooleanValue(value);
        const boolValue = isBoolean ? getBooleanValue(value) : false;

        return (
          <div
            key={key}
            className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-blue-500/20"
          >
            <div className="flex items-center gap-3">
              {isBoolean ? (
                <div className={`p-2 rounded-lg ${boolValue ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                  {boolValue ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Radio className="w-5 h-5 text-blue-400" />
                </div>
              )}

              <div>
                <p className="text-sm text-gray-400">{formatKey(key)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isBoolean ? (
                <>
                  <div className={`w-2 h-2 rounded-full ${boolValue ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
                  <span className={`text-sm font-semibold ${boolValue ? 'text-green-400' : 'text-gray-500'}`}>
                    {boolValue ? 'ON' : 'OFF'}
                  </span>
                </>
              ) : (
                <span className="text-white font-mono text-sm">
                  {formatValue(value)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* State count */}
      <div className="text-center pt-2">
        <p className="text-xs text-gray-600">
          {stateEntries.length} state value{stateEntries.length !== 1 ? 's' : ''} tracked
        </p>
      </div>
    </div>
  );
}
