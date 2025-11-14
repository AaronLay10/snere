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

export interface UseDeviceWebSocketReturn {
  connected: boolean;
  deviceStates: Map<string, Record<string, any>>;
  deviceStatuses: Map<string, DeviceStatus>;
  sensorData: Map<string, SensorData[]>;
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
  const [sensorData, setSensorData] = useState<Map<string, SensorData[]>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const disconnectDelayRef = useRef<NodeJS.Timeout | null>(null);

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
                return newMap;
              });
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
    sensorData,
  };
}
