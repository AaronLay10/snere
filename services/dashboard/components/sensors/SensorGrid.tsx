/**
 * SensorGrid Component
 *
 * Grid layout for displaying multiple sensors with real-time updates
 * Includes filtering, sorting, and grouping capabilities
 */

import React, { useState, useMemo } from 'react';
import { SensorDisplay, SensorReading } from './SensorDisplay';
import { Filter, Search, Grid3x3, List } from 'lucide-react';

interface SensorGridProps {
  sensors: SensorReading[];
  previousReadings?: Map<string, number>;
  showTrends?: boolean;
  showTimestamps?: boolean;
  groupBy?: 'none' | 'device' | 'type' | 'status';
  className?: string;
}

type ViewMode = 'grid' | 'list' | 'compact';
type SortBy = 'name' | 'value' | 'status' | 'timestamp';

export function SensorGrid({
  sensors,
  previousReadings = new Map(),
  showTrends = true,
  showTimestamps = true,
  groupBy = 'none',
  className = ''
}: SensorGridProps) {

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('name');

  // Filter sensors based on search and status filter
  const filteredSensors = useMemo(() => {
    let filtered = sensors;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sensor =>
        sensor.device_id.toLowerCase().includes(term) ||
        sensor.device_name?.toLowerCase().includes(term) ||
        sensor.sensor_type.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'alert') {
        filtered = filtered.filter(sensor =>
          sensor.alert_status === 'warning' || sensor.alert_status === 'critical'
        );
      } else if (filterStatus === 'error') {
        filtered = filtered.filter(sensor => sensor.quality === 'error');
      } else {
        filtered = filtered.filter(sensor =>
          sensor.alert_status === filterStatus || sensor.quality === filterStatus
        );
      }
    }

    return filtered;
  }, [sensors, searchTerm, filterStatus]);

  // Sort sensors
  const sortedSensors = useMemo(() => {
    const sorted = [...filteredSensors];

    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) =>
          (a.device_name || a.device_id).localeCompare(b.device_name || b.device_id)
        );
        break;
      case 'value':
        sorted.sort((a, b) => b.value - a.value);
        break;
      case 'status':
        const statusOrder = { critical: 0, warning: 1, error: 2, marginal: 3, normal: 4, good: 5 };
        sorted.sort((a, b) => {
          const aStatus = a.alert_status || a.quality || 'good';
          const bStatus = b.alert_status || b.quality || 'good';
          return (statusOrder[aStatus as keyof typeof statusOrder] || 999) -
                 (statusOrder[bStatus as keyof typeof statusOrder] || 999);
        });
        break;
      case 'timestamp':
        sorted.sort((a, b) => b.timestamp - a.timestamp);
        break;
    }

    return sorted;
  }, [filteredSensors, sortBy]);

  // Group sensors
  const groupedSensors = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Sensors': sortedSensors };
    }

    const groups: Record<string, SensorReading[]> = {};

    sortedSensors.forEach(sensor => {
      let groupKey = '';

      switch (groupBy) {
        case 'device':
          groupKey = sensor.device_name || sensor.device_id;
          break;
        case 'type':
          groupKey = sensor.sensor_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          break;
        case 'status':
          groupKey = (sensor.alert_status || sensor.quality || 'normal').toUpperCase();
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(sensor);
    });

    return groups;
  }, [sortedSensors, groupBy]);

  // Count sensors by status
  const statusCounts = useMemo(() => {
    const counts = {
      total: sensors.length,
      critical: 0,
      warning: 0,
      error: 0,
      normal: 0
    };

    sensors.forEach(sensor => {
      if (sensor.alert_status === 'critical') counts.critical++;
      else if (sensor.alert_status === 'warning') counts.warning++;
      else if (sensor.quality === 'error') counts.error++;
      else counts.normal++;
    });

    return counts;
  }, [sensors]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with controls */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sensors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filters and controls */}
          <div className="flex gap-2 flex-wrap">
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Status ({statusCounts.total})</option>
              <option value="alert">Alerts ({statusCounts.critical + statusCounts.warning})</option>
              <option value="critical">Critical ({statusCounts.critical})</option>
              <option value="warning">Warning ({statusCounts.warning})</option>
              <option value="error">Error ({statusCounts.error})</option>
              <option value="normal">Normal ({statusCounts.normal})</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="name">Sort by Name</option>
              <option value="value">Sort by Value</option>
              <option value="status">Sort by Status</option>
              <option value="timestamp">Sort by Time</option>
            </select>

            {/* View mode */}
            <div className="flex gap-1 border border-gray-300 rounded-md p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1 rounded text-xs px-2 ${viewMode === 'compact' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Compact view"
              >
                C
              </button>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-600">Normal: {statusCounts.normal}</span>
          </div>
          {statusCounts.warning > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-600">Warning: {statusCounts.warning}</span>
            </div>
          )}
          {statusCounts.critical > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">Critical: {statusCounts.critical}</span>
            </div>
          )}
          {statusCounts.error > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-gray-600">Error: {statusCounts.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Sensor display */}
      {filteredSensors.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          <Filter className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No sensors match your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSensors).map(([groupName, groupSensors]) => (
            <div key={groupName}>
              {groupBy !== 'none' && (
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  {groupName}
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({groupSensors.length})
                  </span>
                </h3>
              )}

              {/* Grid view */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupSensors.map(sensor => (
                    <SensorDisplay
                      key={`${sensor.device_id}-${sensor.sensor_type}`}
                      sensor={sensor}
                      previousValue={previousReadings.get(`${sensor.device_id}-${sensor.sensor_type}`)}
                      showTrend={showTrends}
                      showTimestamp={showTimestamps}
                      compact={false}
                    />
                  ))}
                </div>
              )}

              {/* List view */}
              {viewMode === 'list' && (
                <div className="space-y-3">
                  {groupSensors.map(sensor => (
                    <SensorDisplay
                      key={`${sensor.device_id}-${sensor.sensor_type}`}
                      sensor={sensor}
                      previousValue={previousReadings.get(`${sensor.device_id}-${sensor.sensor_type}`)}
                      showTrend={showTrends}
                      showTimestamp={showTimestamps}
                      compact={false}
                      className="max-w-2xl"
                    />
                  ))}
                </div>
              )}

              {/* Compact view */}
              {viewMode === 'compact' && (
                <div className="bg-white border rounded-lg p-4 space-y-2">
                  {groupSensors.map(sensor => (
                    <SensorDisplay
                      key={`${sensor.device_id}-${sensor.sensor_type}`}
                      sensor={sensor}
                      previousValue={previousReadings.get(`${sensor.device_id}-${sensor.sensor_type}`)}
                      showTrend={showTrends}
                      showTimestamp={false}
                      compact={true}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SensorGrid;
