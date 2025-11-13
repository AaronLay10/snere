import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ExecutorCutsceneActionEvent = {
  sceneId: string;
  action: {
    delayMs: number;
    action: string;
    target: string;
    duration?: number;
    params?: Record<string, unknown>;
  };
  index: number; // 0-based index in the timeline
};

export type ExecutorSceneEvent = {
  id: string;
  name: string;
  roomId: string;
  state: string;
  currentActionIndex?: number;
};

export interface UseExecutorSocketOptions {
  roomId?: string;
}

/**
 * useExecutorSocket
 *
 * Connects to the executor-engine Socket.IO server and exposes real-time events:
 * - 'scene-started' | 'scene-updated' | 'scene-completed' with SceneRuntime-like payload
 * - 'cutscene-action' with { sceneId, action, index }
 *
 * Notes:
 * - URL comes from NEXT_PUBLIC_EXECUTOR_WS (ex: wss://sentientengine.ai/scene-executor, ws://localhost:3004)
 * - If a roomId is provided, the hook will subscribe to that room via 'subscribe-room'
 */
export function useExecutorSocket(options?: UseExecutorSocketOptions) {
  const { roomId } = options || {};
  const [connected, setConnected] = useState(false);
  const [lastSceneEvent, setLastSceneEvent] = useState<{
    type: 'scene-started' | 'scene-updated' | 'scene-completed';
    scene: ExecutorSceneEvent;
  } | null>(null);
  const [lastAction, setLastAction] = useState<ExecutorCutsceneActionEvent | null>(null);

  const socketRef = useRef<Socket | null>(null);

  const baseUrl = useMemo(() => {
    // Allow env override; fall back to reverse-proxied same-origin, then localhost dev port
    if (typeof window !== 'undefined') {
      const envUrl = import.meta.env.VITE_EXECUTOR_WS;
      if (envUrl && envUrl.trim().length > 0) return envUrl.trim();

      const loc = window.location;
      const isHttps = loc.protocol === 'https:';
      const wsProto = isHttps ? 'wss' : 'ws';

      // Preferred: same-origin reverse proxy path (expects Nginx to proxy /executor/ws → executor service)
      // This avoids hardcoding a port that may not be publicly exposed.
      const sameOriginPath = `${wsProto}://${loc.host}/executor/ws`;

      // Always use nginx proxy
      return sameOriginPath;
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!baseUrl) return;
    if (socketRef.current) return; // singleton per hook instance

    // Support dual-endpoint fallback encoded as "urlA||urlB"
    const endpoints = baseUrl.includes('||') ? baseUrl.split('||') : [baseUrl];

    let socket: Socket | null = null;
    let endpointIndex = 0;
    let isCleaningUp = false;

    const connectTo = (url: string) => {
      // Parse URL to determine if it includes /scene-executor path
      // Socket.IO needs: url = origin only, path = full route including /scene-executor
      const isDirectPort = /:\d{2,5}(\/?|$)/.test(url) || url.includes(':3004');
      
      if (isDirectPort) {
        // Direct port: url includes port, path is default /socket.io
        return io(url, {
          transports: ['websocket'],
          autoConnect: true,
          withCredentials: false,
          path: '/socket.io',
        });
      } else {
        // Reverse proxy: split url into origin + path
        // Input: wss://host/scene-executor
        // Socket.IO needs: url=wss://host, path=/scene-executor/socket.io
        const urlObj = new URL(url);
        const origin = `${urlObj.protocol}//${urlObj.host}`;
        const pathPrefix = urlObj.pathname.replace(/\/$/, ''); // /scene-executor
        const socketPath = `${pathPrefix}/socket.io`;
        
        return io(origin, {
          transports: ['websocket'],
          autoConnect: true,
          withCredentials: false,
          path: socketPath,
        });
      }
    };

    const attachCoreListeners = (sock: Socket) => {
      sock.on('connect', () => {
        setConnected(true);
        // Optionally scope updates by room
        if (roomId) {
          sock.emit('subscribe-room', roomId);
        }
      });

      sock.on('disconnect', () => {
        setConnected(false);
      });

      sock.on('scene-started', (scene: ExecutorSceneEvent) => {
        setLastSceneEvent({ type: 'scene-started', scene });
      });

      sock.on('scene-updated', (scene: ExecutorSceneEvent) => {
        setLastSceneEvent({ type: 'scene-updated', scene });
      });

      sock.on('scene-completed', (scene: ExecutorSceneEvent) => {
        setLastSceneEvent({ type: 'scene-completed', scene });
      });

      sock.on('cutscene-action', (payload: ExecutorCutsceneActionEvent) => {
        setLastAction(payload);
      });
    };

    const tryConnect = () => {
      if (isCleaningUp) return;
      
      const url = endpoints[endpointIndex];
      socket = connectTo(url);
      
      // Attach listeners immediately
      attachCoreListeners(socket);
      
      // Store in ref
      socketRef.current = socket;

      socket.on('connect_error', (_err) => {
        // Attempt next endpoint once if available
        if (!isCleaningUp && endpointIndex < endpoints.length - 1) {
          endpointIndex += 1;
          socket?.removeAllListeners();
          socket?.close();
          socket = null;
          socketRef.current = null;
          tryConnect();
        }
      });
    };

    tryConnect();

    return () => {
      isCleaningUp = true;
      const currentSocket = socketRef.current;
      if (currentSocket) {
        if (roomId) currentSocket.emit('unsubscribe-room', roomId);
        currentSocket.removeAllListeners();
        currentSocket.close();
      }
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, roomId]);

  return {
    connected,
    lastSceneEvent,
    lastAction,
  } as const;
}
