"use client";

import { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServiceEntry } from '../types';

interface SocketState {
  services: ServiceEntry[];
  connected: boolean;
}

export function useGatewaySocket(baseUrl: string) {
  const [state, setState] = useState<SocketState>({ services: [], connected: false });

  const socket: Socket | null = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return io(baseUrl, { transports: ['websocket'], autoConnect: false });
  }, [baseUrl]);

  useEffect(() => {
    if (!socket) return;

    socket.connect();
    socket.on('connect', () => setState((prev) => ({ ...prev, connected: true })));
    socket.on('disconnect', () => setState((prev) => ({ ...prev, connected: false })));
    socket.on('service-status-snapshot', (services: ServiceEntry[]) => {
      setState((prev) => ({ ...prev, services }));
    });
    socket.on('service-status', (service: ServiceEntry) => {
      setState((prev) => {
        const next = prev.services.filter((entry) => entry.id !== service.id);
        next.push(service);
        return { ...prev, services: next };
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  return state;
}
