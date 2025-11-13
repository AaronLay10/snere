/**
 * Device Sensor Display Component
 *
 * Displays real-time sensor readings for a device
 */

import React from 'react';
import { Radio, Activity, Thermometer, Gauge, Zap } from 'lucide-react';

interface SensorData {
  sensorName: string;
  value: any;
  receivedAt: Date | string;
}

interface DeviceSensorDisplayProps {
  sensorData: SensorData[];
  lastUpdate: Date | null;
}

export default function DeviceSensorDisplay({ sensorData, lastUpdate }: DeviceSensorDisplayProps) {
  // Get unique sensor names
  const sensorNames = Array.from(new Set(sensorData.map(s => s.sensorName)));

  // Get latest reading for each sensor
  const latestReadings = sensorNames.map(name => {
    const readings = sensorData.filter(s => s.sensorName === name);
    return readings.length > 0 ? readings[0] : null;
  }).filter(Boolean) as SensorData[];

  const getSensorIcon = (sensorName: string) => {
    const name = sensorName.toLowerCase();
    if (name.includes('temp') || name.includes('color')) return Thermometer;
    if (name.includes('psi') || name.includes('pressure')) return Gauge;
    if (name.includes('lux') || name.includes('light')) return Zap;
    return Radio;
  };

  const formatSensorValue = (value: any): string => {
    if (typeof value === 'object' && value !== null) {
      // Extract the most important value from object
      if ('psi' in value) return `${value.psi} PSI`;
      if ('color_temp' in value) return `${value.color_temp}K`;
      if ('lux' in value) return `${value.lux} lux`;
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (latestReadings.length === 0) {
    return (
      <div className="text-center py-8">
        <Radio className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No sensor data available</p>
        <p className="text-gray-600 text-xs mt-1">
          Waiting for sensor readings from device...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live indicator */}
      {lastUpdate && (
        <div className="flex items-center justify-between text-xs mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">LIVE</span>
            </div>
            <span className="text-gray-500">
              Updated {getTimeAgo(lastUpdate)}
            </span>
          </div>
        </div>
      )}

      {/* Sensor readings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {latestReadings.map((reading, index) => {
          const SensorIcon = getSensorIcon(reading.sensorName);

          return (
            <div
              key={`${reading.sensorName}-${index}`}
              className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
            >
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <SensorIcon className="w-5 h-5 text-cyan-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 truncate">
                  {reading.sensorName.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-white font-semibold">
                  {formatSensorValue(reading.value)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-600">
                  {getTimeAgo(new Date(reading.receivedAt))}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sensor count */}
      <div className="text-center pt-2">
        <p className="text-xs text-gray-600">
          {latestReadings.length} sensor{latestReadings.length !== 1 ? 's' : ''} active
        </p>
      </div>
    </div>
  );
}
