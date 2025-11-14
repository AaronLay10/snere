/**
 * WebSocket Hook for Real-time Device Updates
 *
 * Connects to device-monitor WebSocket server and listens for:
 * - sensor-data: Real-time sensor readings
 * - state-update: Device hardware state changes
 * - device-updated: Device status changes
 */

import { useEffect, useState, useCallback, useRef } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_DEVICE_MONITOR_WS || 'ws://localhost:3003';

export interface SensorData {
  deviceId: string;
  sensorName: string;
  value: any;
  receivedAt: Date;
}

export interface DeviceState {
  deviceId: string;
  state: Record<string, any>;
  updatedAt: Date;
}

export interface WebSocketMessage {
  type: 'sensor-data' | 'state-update' | 'device-updated' | 'device-online' | 'device-offline' | 'initial';
  data: any;
}

export function useDeviceWebSocket(deviceId?: string) {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [deviceState, setDeviceState] = useState<Record<string, any> | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelayMs = 3000;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to device monitor');
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === 'sensor-data') {
            const data: SensorData = message.data;

            // Only update if deviceId is set AND matches exactly
            // Don't show data if no deviceId filter is provided (prevent showing all sensors)
            if (deviceId && data.deviceId === deviceId) {
              setSensorData(prev => {
                // Keep last 50 readings per sensor
                const updated = [data, ...prev].slice(0, 50);
                return updated;
              });
              setLastUpdate(new Date());
            }
          }
          else if (message.type === 'state-update') {
            const data: DeviceState = message.data;

            // Only update if deviceId is set AND matches exactly
            // Don't show data if no deviceId filter is provided
            if (deviceId && data.deviceId === deviceId) {
              setDeviceState(data.state);
              setLastUpdate(new Date());
            }
          }
          else if (message.type === 'device-updated') {
            // Handle device status updates
            setLastUpdate(new Date());
          }
          else if (message.type === 'initial') {
            console.log('[WebSocket] Received initial device list');
          }

        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnected(false);
        wsRef.current = null;

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[WebSocket] Reconnecting (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelayMs);
        } else {
          console.error('[WebSocket] Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;

    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      setConnected(false);
    }
  }, [deviceId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Load initial sensor data from database when deviceId changes
  useEffect(() => {
    if (!deviceId || initialDataLoaded) return;

    const loadInitialSensorData = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sentientengine.ai';
        const token = typeof window !== 'undefined' ? localStorage.getItem('sentient_auth_token') : null;

        if (!token) return;

        const response = await fetch(`${API_URL}/api/sentient/devices/${deviceId}/sensor-data?limit=50`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();

          // Convert database format to WebSocket format
          const formattedData: SensorData[] = data.sensorData.map((item: any) => ({
            deviceId: deviceId,
            sensorName: item.sensor_name,
            value: item.value,
            receivedAt: new Date(item.received_at)
          }));

          setSensorData(formattedData);
          if (formattedData.length > 0) {
            setLastUpdate(formattedData[0].receivedAt);
          }
          setInitialDataLoaded(true);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to load initial sensor data:', error);
      }
    };

    loadInitialSensorData();
  }, [deviceId, initialDataLoaded]);

  // Get latest sensor reading by name
  const getLatestSensor = useCallback((sensorName: string): SensorData | null => {
    const readings = sensorData.filter(s => s.sensorName === sensorName);
    return readings.length > 0 ? readings[0] : null;
  }, [sensorData]);

  // Get all readings for a specific sensor
  const getSensorHistory = useCallback((sensorName: string): SensorData[] => {
    return sensorData.filter(s => s.sensorName === sensorName);
  }, [sensorData]);

  return {
    connected,
    sensorData,
    deviceState,
    lastUpdate,
    getLatestSensor,
    getSensorHistory,
    reconnect: connect,
    disconnect
  };
}
