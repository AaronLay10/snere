import { useCallback, useEffect, useRef, useState } from 'react';

export interface SensorData {
  sensorName: string;
  value: any;
  receivedAt: Date | string;
}

export interface DeviceStateUpdate {
  controllerId: string;
  deviceId: string;
  state: Record<string, any>;
  timestamp: number;
}

export interface DeviceStatus {
  id: string;
  device_id: string;
  controller_id: string;
  status: 'online' | 'offline';
  lastHeartbeat?: number;
}

export interface ControllerRegisteredEvent {
  id: string;
  controller_id: string;
  room_id: string;
  device_count: number;
}

export interface ControllerStatus {
  controller_id: string;
  status: 'online' | 'offline' | 'partial';
  online_devices: number;
  total_devices: number;
  last_heartbeat?: number;
}

export interface UseDeviceWebSocketReturn {
  connected: boolean;
  deviceStates: Map<string, Record<string, any>>;
  deviceStatuses: Map<string, DeviceStatus>;
  controllerStatuses: Map<string, ControllerStatus>;
  sensorData: Map<string, SensorData[]>;
  lastControllerRegistered: ControllerRegisteredEvent | null;
}

// Dynamically determine WebSocket URL based on environment
const getWebSocketUrl = (): string => {
  // In development, connect directly to device-monitor service
  // In production, use nginx proxy
  const isDev = import.meta.env.DEV;
  if (isDev) {
    return 'ws://localhost:3003';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/monitor/ws`;
};

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useDeviceWebSocket(): UseDeviceWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [deviceStates, setDeviceStates] = useState<Map<string, Record<string, any>>>(new Map());
  const [deviceStatuses, setDeviceStatuses] = useState<Map<string, DeviceStatus>>(new Map());
  const [controllerStatuses, setControllerStatuses] = useState<Map<string, ControllerStatus>>(new Map());
  const [sensorData, setSensorData] = useState<Map<string, SensorData[]>>(new Map());
  const [lastControllerRegistered, setLastControllerRegistered] = useState<ControllerRegisteredEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectDelayRef = useRef<NodeJS.Timeout | null>(null);

  // Function to aggregate device statuses by controller
  const updateControllerStatuses = useCallback((deviceStatusesMap: Map<string, DeviceStatus>) => {
    const controllerMap = new Map<string, ControllerStatus>();

    deviceStatusesMap.forEach((device) => {
      const controllerId = device.controller_id;
      if (!controllerId) return;

      const existing = controllerMap.get(controllerId) || {
        controller_id: controllerId,
        status: 'offline' as const,
        online_devices: 0,
        total_devices: 0,
        last_heartbeat: undefined
      };

      existing.total_devices++;
      if (device.status === 'online') {
        existing.online_devices++;
      }

      // Update last heartbeat to the most recent
      if (device.lastHeartbeat) {
        existing.last_heartbeat = Math.max(existing.last_heartbeat || 0, device.lastHeartbeat);
      }

      controllerMap.set(controllerId, existing);
    });

    // Determine overall controller status
    controllerMap.forEach((controller) => {
      if (controller.online_devices === 0) {
        controller.status = 'offline';
      } else if (controller.online_devices === controller.total_devices) {
        controller.status = 'online';
      } else {
        controller.status = 'partial';
      }
    });

    setControllerStatuses(controllerMap);
  }, []);

  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWebSocketUrl();
    console.log('[useDeviceWebSocket] Connecting to device-monitor WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[useDeviceWebSocket] Connected to device-monitor');

      // Cancel any pending disconnect delay
      if (disconnectDelayRef.current) {
        clearTimeout(disconnectDelayRef.current);
        disconnectDelayRef.current = null;
      }

      setConnected(true);
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'initial':
            // Initial device list
            console.log('[useDeviceWebSocket] Received initial device list', message.data?.length);
            if (Array.isArray(message.data)) {
              const statusMap = new Map<string, DeviceStatus>();
              message.data.forEach((device: any) => {
                const key = `${device.controller_id}/${device.device_id}`;
                statusMap.set(key, {
                  id: device.id,
                  device_id: device.device_id,
                  controller_id: device.controller_id,
                  status: device.status || 'offline',
                  lastHeartbeat: device.lastHeartbeat,
                });
              });
              setDeviceStatuses(statusMap);
              updateControllerStatuses(statusMap);
            }
            break;

          case 'state-update':
            // Device state update (e.g., relay on/off)
            if (message.data) {
              const { controllerId, deviceId, state, timestamp } = message.data;
              const key = `${controllerId}/${deviceId}`;
              console.log('[useDeviceWebSocket] State update:', key, state);

              setDeviceStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(key, { ...state, _timestamp: timestamp });
                return newMap;
              });
            }
            break;

          case 'sensor-data':
            // Sensor data update
            if (message.data) {
              const { controllerId, deviceId, sensorName, value, receivedAt } = message.data;
              const key = `${controllerId}/${deviceId}`;

              setSensorData((prev) => {
                const newMap = new Map(prev);
                const existing = newMap.get(key) || [];
                const updated = [
                  { sensorName, value, receivedAt },
                  ...existing.slice(0, 99), // Keep last 100 readings
                ];
                newMap.set(key, updated);
                return newMap;
              });
            }
            break;

          case 'device-updated':
          case 'device-online':
          case 'device-offline':
            // Device status update
            if (message.data) {
              const device = message.data;
              const key = `${device.controller_id}/${device.device_id}`;
              console.log('[useDeviceWebSocket] Device status update:', key, device.status);

              setDeviceStatuses((prev) => {
                const newMap = new Map(prev);
                newMap.set(key, {
                  id: device.id,
                  device_id: device.device_id,
                  controller_id: device.controller_id,
                  status: device.status || 'offline',
                  lastHeartbeat: device.lastHeartbeat,
                });
                // Update controller statuses based on new device statuses
                updateControllerStatuses(newMap);
                return newMap;
              });
            }
            break;

          case 'controller-registered':
            // Controller registration event (new controller added)
            console.log('[useDeviceWebSocket] Controller registered:', message.data);
            if (message.data) {
              setLastControllerRegistered(message.data);
            }
            break;

          default:
            console.log('[useDeviceWebSocket] Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('[useDeviceWebSocket] Error parsing message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[useDeviceWebSocket] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[useDeviceWebSocket] Disconnected from device-monitor');

      // Delay showing disconnect state to prevent UI flashing during brief reconnections
      // Only show as disconnected if we're still disconnected after 500ms
      disconnectDelayRef.current = setTimeout(() => {
        setConnected(false);
      }, 500);

      // Attempt to reconnect
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(
          `[useDeviceWebSocket] Reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
        );
        reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        console.error('[useDeviceWebSocket] Max reconnection attempts reached');
      }
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (disconnectDelayRef.current) {
        clearTimeout(disconnectDelayRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    deviceStates,
    deviceStatuses,
    controllerStatuses,
    sensorData,
    lastControllerRegistered,
  };
}
