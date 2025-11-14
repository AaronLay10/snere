"use client";

import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher, getApiBaseUrl, deleteDevice } from '../lib/api';
import { useDevicesWebSocket } from '../lib/useDevicesWebSocket';
import type { DeviceListResponse, PuzzleListResponse, ServicesResponse } from '../types';
import { DevicesPanel } from '../components/DevicesPanel';
import { PuzzleGrid } from '../components/PuzzleGrid';
import { ServiceStatusPanel } from '../components/ServiceStatusPanel';
import { ActivityLog } from '../components/ActivityLog';
import { LightingControlPanel } from '../components/LightingControlPanel';
import { useGatewaySocket } from '../hooks/useGatewaySocket';

export default function DashboardPage() {
  const apiBaseUrl = getApiBaseUrl();

  // Use WebSocket for real-time device updates instead of polling
  const { devices: wsDevices, isConnected: wsConnected } = useDevicesWebSocket();

  const { data: puzzleData, isLoading: puzzleLoading } = useSWR<PuzzleListResponse>('/puzzles', fetcher, {
    refreshInterval: 5000
  });

  const { data: serviceData } = useSWR<ServicesResponse>('/system/services', fetcher, {
    refreshInterval: 10_000
  });

  const socketState = useGatewaySocket(apiBaseUrl);

  const handleRemoveDevice = async (deviceId: string) => {
    if (!deviceId) {
      return;
    }
    try {
      await deleteDevice(deviceId);
      // WebSocket will automatically update the device list
    } catch (error) {
      console.error('Failed to delete device', error);
      alert('Failed to remove device. Check logs for details.');
    }
  };

  const filteredDevices =
    wsDevices?.filter(
      (device) => !(device.roomId === 'paragon' && device.puzzleId === 'test')
    ) ?? [];

  const dedupedDevices = useMemo(() => {
    const seen = new Set<string>();
    return filteredDevices.filter((device) => {
      const key = (device.uniqueId ?? device.canonicalId ?? device.id).toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [filteredDevices]);

  return (
    <main className="space-y-10">
      <section className="grid gap-6 md:grid-cols-3">
        <SummaryCard
          title="Connected Devices"
          value={dedupedDevices.length}
          loading={!wsConnected}
        />
        <SummaryCard
          title="Active Puzzles"
          value={puzzleData?.data.filter((puzzle) => puzzle.state === 'active').length ?? 0}
          loading={puzzleLoading}
          detail={`${puzzleData?.data.length ?? 0} total`}
        />
        <SummaryCard
          title="Gateway Socket"
          value={socketState.connected ? 'Connected' : 'Disconnected'}
          loading={false}
          variant={socketState.connected ? 'success' : 'danger'}
        />
      </section>

      <ServiceStatusPanel services={socketState.services.length ? socketState.services : serviceData?.data ?? []} />

      <LightingControlPanel />

      <DevicesPanel devices={dedupedDevices} isLoading={!wsConnected} onRemoveDevice={handleRemoveDevice} />

      <PuzzleGrid puzzles={puzzleData?.data ?? []} isLoading={puzzleLoading} />

      <ActivityLog maxEvents={150} autoScroll={true} />
    </main>
  );
}

function SummaryCard({
  title,
  value,
  loading,
  detail,
  variant = 'default'
}: {
  title: string;
  value: string | number;
  loading: boolean;
  detail?: string;
  variant?: 'default' | 'success' | 'danger';
}) {
  const colors = {
    default: 'bg-slate-900/70 border-slate-800',
    success: 'bg-emerald-950/70 border-emerald-900 text-emerald-200',
    danger: 'bg-rose-950/70 border-rose-900 text-rose-200'
  };

  return (
    <div className={`border rounded-xl px-6 py-4 shadow-sm ${colors[variant] ?? colors.default}`}>
      <p className="text-sm uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-3xl font-semibold mt-2">{loading ? '—' : value}</p>
      {detail && <p className="text-sm text-slate-400 mt-1">{detail}</p>}
    </div>
  );
}
