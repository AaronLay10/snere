import { useEffect, useState, useRef, useMemo } from 'react';
import type { DeviceRecord } from '../types';

export function useDevicesWebSocket() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdatesRef = useRef<Map<string, DeviceRecord>>(new Map());
  const batchTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let isMounted = true;

    // Batch update function - applies all pending updates at once
    const applyBatchUpdates = () => {
      if (pendingUpdatesRef.current.size === 0) return;

      const updates = Array.from(pendingUpdatesRef.current.values());
      pendingUpdatesRef.current.clear();

      setDevices((prevDevices) => {
        const deviceMap = new Map(prevDevices.map(d => [d.id || d.uniqueId || '', d]));

        // Apply all updates
        updates.forEach(update => {
          const key = update.id || update.uniqueId || '';
          deviceMap.set(key, update);
        });

        return Array.from(deviceMap.values());
      });
    };

    // Schedule a batched update
    const scheduleBatchUpdate = (device: DeviceRecord) => {
      const key = device.id || device.uniqueId || '';
      pendingUpdatesRef.current.set(key, device);

      // Clear existing timer and schedule new batch
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }

      batchTimerRef.current = setTimeout(() => {
        applyBatchUpdates();
      }, 100); // Batch updates every 100ms
    };

    const connect = () => {
      if (!isMounted) return;

      // Determine WebSocket URL based on window location
      // The dashboard runs on port 3001, device-monitor runs on port 3003
      // Both are exposed on localhost, so connect to localhost:3003
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname; // Will be 'localhost' or the actual host
      const port = '3003'; // device-monitor port
      const wsUrl = `${protocol}//${host}:${port}`;

      console.log('Connecting to WebSocket:', wsUrl);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log('[WebSocket] ✅ Connected to device-monitor at', wsUrl);
          setIsConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;

          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'initial':
                // Initial device list
                console.log('[WebSocket] 📦 Received initial device list:', message.data?.length, 'devices');
                setDevices(message.data || []);
                break;

              case 'device-updated':
              case 'device-online':
                // Update or add device - use batching to prevent render storms
                scheduleBatchUpdate(message.data);
                break;

              case 'device-offline':
                // Update device status to offline - use batching
                scheduleBatchUpdate({ ...message.data, status: 'offline' });
                break;

              default:
                console.warn('Unknown WebSocket message type:', message.type);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (event) => {
          console.error('[WebSocket] ❌ Connection error:', event);
          console.error('[WebSocket] Failed to connect to:', wsUrl);
          setError(new Error(`WebSocket connection error to ${wsUrl}`));
        };

        ws.onclose = (event) => {
          if (!isMounted) return;
          console.log('[WebSocket] ⚠️ Disconnected (code:', event.code, 'reason:', event.reason || 'none', ')');
          console.log('[WebSocket] Will attempt reconnect in 2 seconds...');
          setIsConnected(false);
          wsRef.current = null;

          // Attempt to reconnect after 2 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connect();
            }
          }, 2000);
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setError(err as Error);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { devices, isConnected, error };
}
