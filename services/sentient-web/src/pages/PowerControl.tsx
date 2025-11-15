import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Cpu,
  Filter,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useDeviceWebSocket } from '../hooks/useDeviceWebSocket';
import { controllers, devices, mqtt } from '../lib/api';

interface PowerDevice {
  id: string;
  device_id: string;
  friendly_name: string;
  controller_id: string;
  controller_uuid: string; // Original UUID for WebSocket lookups
  controller_name: string;
  status: string;
  state?: Record<string, unknown>;
  mqtt_topic?: string;
}

interface ControllerStatus {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastHeartbeat: Date | null;
}

export default function PowerControlPage() {
  const [loading, setLoading] = useState(true);
  const [powerDevices, setPowerDevices] = useState<PowerDevice[]>([]);
  const [controllerStatuses, setControllerStatuses] = useState<Record<string, ControllerStatus>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterController, setFilterController] = useState('all');
  const [commandLoading, setCommandLoading] = useState<Record<string, boolean>>({});

  // WebSocket connection for real-time status updates
  const { connected: wsConnected, deviceStates, deviceStatuses } = useDeviceWebSocket();

  const getControllerDisplayName = (controllerId: string): string => {
    const displayNames: Record<string, string> = {
      power_control_upper_right: 'Upper Right',
      power_control_lower_right: 'Lower Right',
      power_control_lower_left: 'Lower Left',
    };
    return displayNames[controllerId] || controllerId;
  };

  // Get real-time power state for a device from WebSocket
  const getDevicePowerState = (device: PowerDevice): { isOn: boolean; hasState: boolean } => {
    // Use the original UUID for WebSocket lookups, not the remapped controller_id
    const key = `${device.controller_uuid}/${device.device_id}`;
    const state = deviceStates.get(key);

    if (!state) {
      return { isOn: false, hasState: false };
    }

    // Check various possible state keys
    if ('power' in state) return { isOn: !!state.power, hasState: true };
    if ('state' in state)
      return {
        isOn: state.state === 'on' || state.state === 1 || state.state === true,
        hasState: true,
      };
    if ('relay_state' in state) return { isOn: !!state.relay_state, hasState: true };
    if ('on' in state) return { isOn: !!state.on, hasState: true };

    return { isOn: false, hasState: true };
  };

  const loadPowerDevices = async () => {
    try {
      setLoading(true);

      // Query ALL devices first
      const response = await devices.getAll({});

      console.log('[PowerControl] Total devices from API:', response.devices?.length || 0);

      // Build a map by checking device names that match power control patterns
      // Since controller meta-devices don't exist, we'll identify by device names
      const controllerUuidMap: Record<string, string> = {};

      // Identify ONLY actual power relay devices by voltage patterns
      (response.devices || []).forEach((device: PowerDevice) => {
        const deviceId = device.device_id?.toLowerCase() || '';
        const friendlyName = device.friendly_name?.toLowerCase() || '';

        // Only include devices that are actual power relays (have voltage ratings)
        const isPowerRelay =
          deviceId.includes('24v') ||
          deviceId.includes('12v') ||
          deviceId.includes('5v') ||
          friendlyName.includes('24v') ||
          friendlyName.includes('12v') ||
          friendlyName.includes('5v');

        if (isPowerRelay) {
          // Mark this controller UUID as a power controller
          if (!controllerUuidMap[device.controller_id]) {
            controllerUuidMap[device.controller_id] = 'power_control_unknown';
          }
        }
      });

      console.log('[PowerControl] Controller UUIDs found:', Object.keys(controllerUuidMap).length);

      const allPowerDevices: PowerDevice[] = [];

      // Collect all devices for identified power controllers
      const powerControllerUuids = Object.keys(controllerUuidMap);

      // Group devices by controller UUID to assign proper names
      const devicesByUuid: Record<string, PowerDevice[]> = {};
      (response.devices || []).forEach((device: PowerDevice) => {
        if (powerControllerUuids.includes(device.controller_id)) {
          const deviceId = device.device_id?.toLowerCase() || '';
          const friendlyName = device.friendly_name?.toLowerCase() || '';

          // Only include actual power relay devices (with voltage ratings)
          const isPowerRelay =
            deviceId.includes('24v') ||
            deviceId.includes('12v') ||
            deviceId.includes('5v') ||
            friendlyName.includes('24v') ||
            friendlyName.includes('12v') ||
            friendlyName.includes('5v');

          if (isPowerRelay) {
            if (!devicesByUuid[device.controller_id]) {
              devicesByUuid[device.controller_id] = [];
            }
            devicesByUuid[device.controller_id].push(device);
          }
        }
      });

      // Assign controller names based on device names
      Object.keys(devicesByUuid).forEach((uuid) => {
        const devices = devicesByUuid[uuid];
        let controllerIdentifier: string;

        // Check specific device patterns for each controller
        // Upper Right: main_lighting, gauges, kraken, vault, syringe, lever_boiler, pilot_light, fuse, chemical, crawl_space, floor_audio, kracken_radar
        const hasMainLighting = devices.some((d) => d.device_id?.includes('main_lighting'));

        // Lower Right: gear, floor, subpanel, gun_drawers
        const hasGear = devices.some((d) => d.device_id?.includes('gear'));
        const hasSubpanel = devices.some((d) => d.device_id?.includes('subpanel'));

        // Lower Left: clock, lever_riddle (exactly 6 devices)
        const hasClock = devices.some((d) => d.device_id?.includes('clock'));
        const hasLeverRiddle = devices.some((d) => d.device_id?.includes('lever_riddle'));

        // Lower Left is most distinctive - only has clock and lever_riddle devices (6 total)
        if (hasClock || hasLeverRiddle) {
          controllerIdentifier = 'power_control_lower_left';
        }
        // Upper Right has main_lighting (distinctive)
        else if (hasMainLighting) {
          controllerIdentifier = 'power_control_upper_right';
        }
        // Lower Right has gear and subpanel devices
        else if (hasGear || hasSubpanel) {
          controllerIdentifier = 'power_control_lower_right';
        }
        // Final fallback by device count
        else if (devices.length <= 6) {
          controllerIdentifier = 'power_control_lower_left';
        } else {
          controllerIdentifier = 'power_control_lower_right';
        }

        devices.forEach((device) => {
          allPowerDevices.push({
            ...device,
            controller_uuid: device.controller_id, // Preserve original UUID
            controller_id: controllerIdentifier, // Use logical name for MQTT
            controller_name: getControllerDisplayName(controllerIdentifier),
          });
        });
      });

      console.log('[PowerControl] Found power devices:', allPowerDevices.length);

      // Sort by controller, then by friendly name
      allPowerDevices.sort((a, b) => {
        if (a.controller_id !== b.controller_id) {
          return a.controller_id.localeCompare(b.controller_id);
        }
        return a.friendly_name.localeCompare(b.friendly_name);
      });

      setPowerDevices(allPowerDevices);
    } catch (error) {
      console.error('Failed to load power devices:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load power devices';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load controller statuses from the controllers API
  const loadControllerStatuses = async () => {
    try {
      const response = await controllers.getAll();
      const statusMap: Record<string, ControllerStatus> = {};

      response.controllers?.forEach((controller: any) => {
        // Map controller to power control IDs if they match
        let controllerId = controller.controller_id;

        // Create status entry
        statusMap[controllerId] = {
          id: controller.id,
          name: controller.name || controller.controller_id,
          status: controller.status === 'active' ? 'online' : 'offline',
          lastHeartbeat: controller.last_heartbeat ? new Date(controller.last_heartbeat) : null,
        };
      });

      setControllerStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load controller statuses:', error);
    }
  };

  // Load all devices from the three power control controllers
  useEffect(() => {
    loadPowerDevices();
    loadControllerStatuses();

    // Refresh controller statuses every 10 seconds
    const interval = setInterval(loadControllerStatuses, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPowerCommand = async (device: PowerDevice, action: 'power_on' | 'power_off') => {
    const loadingKey = `${device.id}-${action}`;
    setCommandLoading((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      // Build MQTT topic: paragon/clockwork/commands/{controller_id}/{device_id}/{command}
      // Use the assigned controller_id (power_control_upper_right) not the UUID
      const controllerName = device.controller_id || 'unknown_controller';
      const topic = `paragon/clockwork/commands/${controllerName}/${device.device_id}/${action}`;
      const payload = {
        params: {},
        timestamp: Date.now(),
      };

      console.log('[PowerControl] Sending command:', {
        topic,
        payload,
        controllerName,
        deviceId: device.device_id,
        deviceName: device.friendly_name,
        action,
        fullDevice: device,
      });
      await mqtt.publish(topic, payload);

      toast.success(`${device.friendly_name}: ${action === 'power_on' ? 'ON' : 'OFF'}`);

      // Refresh device list after a short delay to show updated status
      setTimeout(() => {
        loadPowerDevices();
      }, 500);
    } catch (error) {
      console.error('Failed to send power command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send command';
      toast.error(errorMessage);
    } finally {
      setCommandLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  const sendControllerCommand = async (
    controllerId: string,
    command: 'all_on' | 'all_off' | 'emergency_off'
  ) => {
    const loadingKey = `controller-${controllerId}-${command}`;
    setCommandLoading((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      // Build MQTT topic: paragon/clockwork/commands/{controller_id}/controller/{command}
      const topic = `paragon/clockwork/commands/${controllerId}/controller/${command}`;
      const payload = {
        params: {},
        timestamp: Date.now(),
      };

      await mqtt.publish(topic, payload);

      const displayName = getControllerDisplayName(controllerId);
      const actionText =
        command === 'all_on' ? 'All ON' : command === 'all_off' ? 'All OFF' : 'EMERGENCY OFF';
      toast.success(`${displayName}: ${actionText}`);

      // Refresh device list
      setTimeout(() => {
        loadPowerDevices();
      }, 500);
    } catch (error) {
      console.error('Failed to send controller command:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send command';
      toast.error(errorMessage);
    } finally {
      setCommandLoading((prev) => ({ ...prev, [loadingKey]: false }));
    }
  };

  // Filter devices based on search and controller filter
  const filteredDevices = useMemo(() => {
    return powerDevices.filter((device) => {
      const matchesSearch =
        searchQuery === '' ||
        device.friendly_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.device_id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesController =
        filterController === 'all' || device.controller_id === filterController;

      return matchesSearch && matchesController;
    });
  }, [powerDevices, searchQuery, filterController]);

  // Group devices by controller
  const devicesByController = useMemo(() => {
    const grouped: Record<string, PowerDevice[]> = {
      power_control_upper_right: [],
      power_control_lower_right: [],
      power_control_lower_left: [],
    };

    filteredDevices.forEach((device) => {
      if (grouped[device.controller_id]) {
        grouped[device.controller_id].push(device);
      }
    });

    return grouped;
  }, [filteredDevices]);

  // Calculate statistics for controllers and devices separately
  const stats = useMemo(() => {
    // Controller statistics (from heartbeat data)
    const powerControllerIds = [
      'power_control_upper_right',
      'power_control_lower_right',
      'power_control_lower_left',
    ];
    const powerControllers = powerControllerIds.map((id) => controllerStatuses[id]).filter(Boolean);

    const controllersOnline = powerControllers.filter((c) => c.status === 'online').length;
    const controllersOffline = powerControllers.filter((c) => c.status === 'offline').length;

    // Device power state statistics (from WebSocket real-time data)
    // If a controller is offline, all its devices are considered offline/off
    let devicesPoweredOn = 0;
    let devicesPoweredOff = 0;

    powerDevices.forEach((device) => {
      const controllerStatus = controllerStatuses[device.controller_id];
      const isControllerOnline = controllerStatus?.status === 'online';

      // If controller is offline, device is automatically off
      if (!isControllerOnline) {
        devicesPoweredOff++;
      } else {
        // Controller is online, check actual device state
        const { isOn, hasState } = getDevicePowerState(device);
        if (hasState) {
          if (isOn) {
            devicesPoweredOn++;
          } else {
            devicesPoweredOff++;
          }
        } else {
          // No state data, assume off
          devicesPoweredOff++;
        }
      }
    });

    return {
      totalDevices: powerDevices.length,
      controllersOnline,
      controllersOffline,
      devicesPoweredOn,
      devicesPoweredOff,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerDevices, controllerStatuses, deviceStates]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin-slow">
            <div className="w-12 h-12 border-4 border-cyan-500 rounded-full border-t-transparent" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">Power Control</h1>
            <p className="text-gray-500">Manage all power switches across three controllers</p>
          </div>
          <button
            onClick={loadPowerDevices}
            disabled={loading}
            className="btn-neural flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Devices */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Devices</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.totalDevices}</p>
              </div>
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          {/* Controllers Online */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Controllers Online
                </p>
                <p className="text-2xl font-bold text-green-400">{stats.controllersOnline}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>

          {/* Controllers Offline */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Controllers Offline
                </p>
                <p className="text-2xl font-bold text-red-400">{stats.controllersOffline}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          {/* Devices Powered On */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Devices ON</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.devicesPoweredOn}</p>
              </div>
              <Power className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          {/* Devices Powered Off */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Devices OFF</p>
                <p className="text-2xl font-bold text-gray-400">{stats.devicesPoweredOff}</p>
              </div>
              <Power className="w-8 h-8 text-gray-400" />
            </div>
          </div>

          {/* WebSocket Status */}
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">WebSocket</p>
                <p className="text-sm font-semibold">
                  {wsConnected ? (
                    <span className="text-green-400">Connected</span>
                  ) : (
                    <span className="text-red-400">Disconnected</span>
                  )}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card-neural">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search devices..."
                className="input-neural !pl-11 w-full"
              />
            </div>

            {/* Filter by Controller */}
            <div>
              <select
                value={filterController}
                onChange={(e) => setFilterController(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Controllers</option>
                <option value="power_control_upper_right">Upper Right</option>
                <option value="power_control_lower_right">Lower Right</option>
                <option value="power_control_lower_left">Lower Left</option>
              </select>
            </div>
          </div>
        </div>

        {/* Power Control - 3 Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.entries(devicesByController)
            .sort(([a], [b]) => a.localeCompare(b)) // Sort controllers alphabetically
            .map(([controllerId, devices]) => {
              if (devices.length === 0) return null;

              // Sort devices alphabetically
              const sortedDevices = [...devices].sort((a, b) =>
                a.friendly_name.localeCompare(b.friendly_name)
              );

              const controllerStatus = controllerStatuses[controllerId];
              const isControllerOnline = controllerStatus?.status === 'online';

              // Count powered on/off devices for this controller
              const devicesOn = devices.filter((d) => getDevicePowerState(d).isOn).length;
              const devicesOff = devices.filter(
                (d) => !getDevicePowerState(d).isOn && getDevicePowerState(d).hasState
              ).length;

              return (
                <div key={controllerId} className="space-y-3">
                  {/* Controller Header */}
                  <div className="card-neural bg-gradient-to-r from-cyan-500/10 to-magenta-500/10 p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`p-2 rounded-lg ${isControllerOnline ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                      >
                        <Power
                          className={`w-5 h-5 ${isControllerOnline ? 'text-green-400' : 'text-red-400'}`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-white">
                            {getControllerDisplayName(controllerId)}
                          </h2>
                          <div
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              isControllerOnline
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {isControllerOnline ? 'ONLINE' : 'OFFLINE'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-gray-400">{devices.length} devices</p>
                          <p className="text-xs text-emerald-400">{devicesOn} ON</p>
                          <p className="text-xs text-gray-500">{devicesOff} OFF</p>
                        </div>
                        {controllerStatus?.lastHeartbeat && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Last heartbeat:{' '}
                            {new Date(controllerStatus.lastHeartbeat).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Controller-Level Commands */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => sendControllerCommand(controllerId, 'all_on')}
                        disabled={commandLoading[`controller-${controllerId}-all_on`]}
                        className="btn-neural-success flex items-center gap-1.5 !py-1.5 !px-3 !text-xs"
                      >
                        {commandLoading[`controller-${controllerId}-all_on`] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        All ON
                      </button>

                      <button
                        type="button"
                        onClick={() => sendControllerCommand(controllerId, 'all_off')}
                        disabled={commandLoading[`controller-${controllerId}-all_off`]}
                        className="btn-neural flex items-center gap-1.5 !py-1.5 !px-3 !text-xs"
                      >
                        {commandLoading[`controller-${controllerId}-all_off`] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Power className="w-3 h-3" />
                        )}
                        All OFF
                      </button>

                      <button
                        type="button"
                        onClick={() => sendControllerCommand(controllerId, 'emergency_off')}
                        disabled={commandLoading[`controller-${controllerId}-emergency_off`]}
                        className="btn-neural-danger flex items-center gap-1.5 !py-1.5 !px-3 !text-xs"
                      >
                        {commandLoading[`controller-${controllerId}-emergency_off`] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        Emergency
                      </button>
                    </div>
                  </div>

                  {/* Device List - One Row Per Device */}
                  <div className="space-y-2">
                    {sortedDevices.map((device) => {
                      const isOnline = device.status === 'online' || device.status === 'active';
                      const onLoading = commandLoading[`${device.id}-power_on`];
                      const offLoading = commandLoading[`${device.id}-power_off`];
                      const { isOn, hasState } = getDevicePowerState(device);

                      return (
                        <motion.div
                          key={device.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="card-neural p-3 flex items-center gap-3"
                        >
                          <div
                            className={`p-1.5 rounded-lg flex-shrink-0 ${
                              isOnline ? 'bg-green-500/10' : 'bg-gray-500/10'
                            }`}
                          >
                            <Power
                              className={`w-4 h-4 ${isOnline ? 'text-green-400' : 'text-gray-500'}`}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white truncate">
                              {device.friendly_name}
                            </h3>
                            {/* Real-time power state indicator */}
                            {hasState && (
                              <div
                                className={`flex items-center gap-1.5 mt-0.5 px-2 py-1 rounded ${
                                  isOn ? 'bg-green-500/20' : 'bg-red-500/20'
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
                                />
                                <span
                                  className={`text-xs font-medium ${isOn ? 'text-green-400' : 'text-red-400'}`}
                                >
                                  {isOn ? 'POWERED ON' : 'POWERED OFF'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                              }`}
                              title={isOnline ? 'Controller Online' : 'Controller Offline'}
                            />

                            <button
                              type="button"
                              onClick={() => sendPowerCommand(device, 'power_on')}
                              disabled={!isOnline || onLoading || offLoading}
                              className={`flex items-center gap-1 !py-1 !px-3 !text-xs min-w-[50px] ${
                                isOn && hasState
                                  ? 'btn-neural-success ring-2 ring-green-400/50'
                                  : 'btn-neural-success'
                              }`}
                            >
                              {onLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              ON
                            </button>

                            <button
                              type="button"
                              onClick={() => sendPowerCommand(device, 'power_off')}
                              disabled={!isOnline || onLoading || offLoading}
                              className={`flex items-center gap-1 !py-1 !px-3 !text-xs min-w-[50px] ${
                                !isOn && hasState
                                  ? 'btn-neural ring-2 ring-gray-400/50'
                                  : 'btn-neural'
                              }`}
                            >
                              {offLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Power className="w-3 h-3" />
                              )}
                              OFF
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {filteredDevices.length === 0 && (
            <div className="col-span-full card-neural text-center py-12">
              <Filter className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No power devices found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
