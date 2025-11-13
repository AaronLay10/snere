/**
 * SensorDisplay Component
 *
 * Real-time sensor data visualization for Sentient Engine dashboard
 * Displays individual sensor readings with status indicators, trends, and alerts
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export interface SensorReading {
  device_id: string;
  device_name?: string;
  sensor_type: string;
  value: number;
  unit: string;
  timestamp: number;
  quality?: 'good' | 'marginal' | 'poor' | 'error';
  metadata?: Record<string, any>;

  // Controller status (CRITICAL for determining if data is current)
  controller_id?: string;
  controller_status?: 'online' | 'offline' | 'unknown';
  controller_last_seen?: number;

  // Threshold info (if configured)
  min_warning?: number;
  min_critical?: number;
  max_warning?: number;
  max_critical?: number;
  alert_status?: 'normal' | 'warning' | 'critical';
}

interface SensorDisplayProps {
  sensor: SensorReading;
  previousValue?: number;
  showTrend?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
  className?: string;
}

export function SensorDisplay({
  sensor,
  previousValue,
  showTrend = true,
  showTimestamp = true,
  compact = false,
  className = ''
}: SensorDisplayProps) {

  // Calculate trend
  const trend = useMemo(() => {
    if (!previousValue || previousValue === sensor.value) return 'stable';
    return sensor.value > previousValue ? 'up' : 'down';
  }, [sensor.value, previousValue]);

  // Calculate time since reading
  const timeSince = useMemo(() => {
    const now = Date.now();
    const diff = (now - sensor.timestamp) / 1000; // seconds

    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }, [sensor.timestamp]);

  // Check if controller is online and data is fresh
  const isControllerOnline = useMemo(() => {
    // If controller status is explicitly offline, sensor data is stale
    if (sensor.controller_status === 'offline') return false;

    // If we have controller_last_seen, check if it's recent (within 30 seconds)
    if (sensor.controller_last_seen) {
      const timeSinceLastSeen = (Date.now() - sensor.controller_last_seen) / 1000;
      if (timeSinceLastSeen > 30) return false;
    }

    // If sensor reading itself is old (more than 60 seconds), consider it stale
    const timeSinceReading = (Date.now() - sensor.timestamp) / 1000;
    if (timeSinceReading > 60) return false;

    return true;
  }, [sensor.controller_status, sensor.controller_last_seen, sensor.timestamp]);

  // Determine status color and icon
  const getStatusInfo = () => {
    // PRIORITY 1: Controller offline - data is stale regardless of reading
    if (!isControllerOnline) {
      return {
        color: 'text-gray-600 bg-gray-50 border-gray-300',
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Offline',
        isStale: true
      };
    }

    // PRIORITY 2: Sensor error
    if (sensor.quality === 'error') {
      return {
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Error',
        isStale: false
      };
    }

    // PRIORITY 3: Critical threshold violation
    if (sensor.alert_status === 'critical') {
      return {
        color: 'text-red-600 bg-red-50 border-red-200',
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Critical',
        isStale: false
      };
    }

    // PRIORITY 4: Warning threshold or poor quality
    if (sensor.alert_status === 'warning' || sensor.quality === 'poor') {
      return {
        color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Warning',
        isStale: false
      };
    }

    // PRIORITY 5: Marginal quality
    if (sensor.quality === 'marginal') {
      return {
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Marginal',
        isStale: false
      };
    }

    // Normal operation
    return {
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: <CheckCircle className="h-4 w-4" />,
      label: 'Good',
      isStale: false
    };
  };

  const statusInfo = getStatusInfo();

  // Format sensor value with appropriate precision
  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000) return value.toFixed(0);
    if (Math.abs(value) >= 10) return value.toFixed(1);
    return value.toFixed(2);
  };

  // Get friendly sensor type name
  const getSensorTypeName = (type: string) => {
    const names: Record<string, string> = {
      temperature: 'Temperature',
      humidity: 'Humidity',
      pressure: 'Pressure',
      position: 'Position',
      rotation: 'Rotation',
      distance: 'Distance',
      motion: 'Motion',
      light_intensity: 'Light',
      voltage: 'Voltage',
      current: 'Current',
      switch_state: 'Switch',
      contact: 'Contact',
      sound_level: 'Sound Level'
    };
    return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-600">{getSensorTypeName(sensor.sensor_type)}:</span>
          <span className="text-sm font-semibold">
            {formatValue(sensor.value)} {sensor.unit}
          </span>
        </div>

        {showTrend && previousValue !== undefined && (
          <div className="flex items-center">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-blue-500" />}
            {trend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
          </div>
        )}

        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${statusInfo.color} border`}>
          {statusInfo.icon}
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${statusInfo.color} ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-700">
            {sensor.device_name || sensor.device_id}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {getSensorTypeName(sensor.sensor_type)}
          </p>
        </div>

        <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusInfo.color}`}>
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Value Display */}
      <div className="mb-3">
        {statusInfo.isStale ? (
          // Controller offline - show stale data warning
          <div className="space-y-2">
            <div className="flex items-baseline gap-2 opacity-50">
              <span className="text-3xl font-bold line-through">
                {formatValue(sensor.value)}
              </span>
              <span className="text-lg text-gray-600">
                {sensor.unit}
              </span>
            </div>
            <div className="bg-gray-100 border border-gray-300 rounded-md p-2 text-sm text-gray-700">
              <strong>Controller Offline</strong>
              <br />
              Last reading from {timeSince}. Data may be stale.
              {sensor.controller_last_seen && (
                <>
                  <br />
                  Controller last seen: {Math.floor((Date.now() - sensor.controller_last_seen) / 1000)}s ago
                </>
              )}
            </div>
          </div>
        ) : (
          // Controller online - show live data
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {formatValue(sensor.value)}
            </span>
            <span className="text-lg text-gray-600">
              {sensor.unit}
            </span>

            {showTrend && previousValue !== undefined && (
              <div className="ml-auto flex items-center gap-1">
                {trend === 'up' && (
                  <>
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      +{formatValue(sensor.value - previousValue)}
                    </span>
                  </>
                )}
                {trend === 'down' && (
                  <>
                    <TrendingDown className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-blue-600">
                      {formatValue(sensor.value - previousValue)}
                    </span>
                  </>
                )}
                {trend === 'stable' && (
                  <>
                    <Minus className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Stable</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Threshold indicators */}
        {(sensor.min_warning || sensor.max_warning) && (
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            {sensor.max_critical && (
              <div className="flex justify-between">
                <span>Critical Max:</span>
                <span className="font-medium">{formatValue(sensor.max_critical)} {sensor.unit}</span>
              </div>
            )}
            {sensor.max_warning && (
              <div className="flex justify-between">
                <span>Warning Max:</span>
                <span className="font-medium">{formatValue(sensor.max_warning)} {sensor.unit}</span>
              </div>
            )}
            {sensor.min_warning && (
              <div className="flex justify-between">
                <span>Warning Min:</span>
                <span className="font-medium">{formatValue(sensor.min_warning)} {sensor.unit}</span>
              </div>
            )}
            {sensor.min_critical && (
              <div className="flex justify-between">
                <span>Critical Min:</span>
                <span className="font-medium">{formatValue(sensor.min_critical)} {sensor.unit}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      {sensor.metadata && Object.keys(sensor.metadata).length > 0 && (
        <div className="border-t border-gray-200 pt-2 mt-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {Object.entries(sensor.metadata).slice(0, 4).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key.replace(/_/g, ' ')}:</span>
                <span className="font-medium text-gray-700">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      {showTimestamp && (
        <div className="border-t border-gray-200 pt-2 mt-2 text-xs text-gray-500">
          Last updated: {timeSince}
        </div>
      )}
    </div>
  );
}

export default SensorDisplay;
