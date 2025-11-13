"use client";

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { DeviceRecord } from '../types';
import { StatusBadge } from './StatusBadge';

interface DevicesPanelProps {
  devices: DeviceRecord[];
  isLoading: boolean;
  title?: string;
  onRemoveDevice?: (deviceId: string) => Promise<void> | void;
}

export function DevicesPanel({ devices, isLoading, title = 'Devices', onRemoveDevice }: DevicesPanelProps) {
  const displayDevices = useMemo(() => {
    const seen = new Set<string>();
    return devices.filter((device) => {
      const key = (device.uniqueId ?? device.canonicalId ?? device.id).toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [devices]);

  const deviceCount = displayDevices.length;

  const getMetadata = (device: DeviceRecord) =>
    device.metadata && typeof device.metadata === 'object'
      ? (device.metadata as Record<string, any>)
      : {};

  const formatTitle = (device: DeviceRecord) => {
    if (typeof device.displayName === 'string' && device.displayName.trim().length > 0) {
      return device.displayName;
    }
    const metadata = getMetadata(device);
    const fromMetadata = metadata.displayName as string | undefined;
    if (fromMetadata && typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
      return fromMetadata;
    }
    const fallback =
      device.puzzleId ??
      device.id.split('/').pop() ??
      device.roomId ??
      'Device';
    return fallback
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ''))
      .join(' ')
      .trim();
  };

  const formatSubtitle = (device: DeviceRecord) => {
    const metadata = getMetadata(device);
    const room = (metadata.roomLabel as string) ?? device.roomId ?? 'Unassigned';
    const hardware = (metadata.hardware as string) ?? metadata.deviceType ?? ((device.canonicalId ?? device.id).split('/').pop() ?? '');
    const cleanedHardware = hardware
      ? hardware.replace(/[-_]/g, ' ').toUpperCase()
      : 'DEVICE';
    return `${room.toUpperCase()} - ${cleanedHardware}`;
  };

  const getFirmwareVersion = (device: DeviceRecord) => {
    const metadata = getMetadata(device);
    const version = device.firmwareVersion ?? metadata.firmwareVersion;
    return typeof version === 'string' && version.trim().length > 0 ? version : undefined;
  };

  const getUniqueId = (device: DeviceRecord) => {
    const metadata = getMetadata(device);
    const uid = device.uniqueId ?? metadata.uniqueId;
    return typeof uid === 'string' && uid.trim().length > 0 ? uid : undefined;
  };

  const getPuzzleStatus = (device: DeviceRecord) => {
    const metadata = getMetadata(device);
    const candidate =
      device.puzzleStatus ??
      (metadata.puzzleStatus as string | undefined) ??
      (metadata.state as string | undefined);
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : undefined;
  };

  const formatPuzzleStatus = (status: string) => {
    const spaced = status
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();

    return spaced
      .split(' ')
      .filter(Boolean)
      .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1).toLowerCase()))
      .join(' ');
  };

  return (
    <section className="mb-12">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-slate-400">
          {isLoading ? 'Loading…' : `${deviceCount} device${deviceCount === 1 ? '' : 's'}`}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {displayDevices.map((device) => {
          const firmwareVersion = getFirmwareVersion(device);
          const uniqueId = getUniqueId(device);
          const puzzleStatus = getPuzzleStatus(device);
          const formattedPuzzleStatus = puzzleStatus ? formatPuzzleStatus(puzzleStatus) : undefined;
          const deviceStatus = typeof device.status === 'string' && device.status.length > 0 ? device.status : 'unknown';
          return (
            <article
              key={(device.uniqueId ?? device.canonicalId ?? device.id)}
              className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2 gap-3">
                <div>
                  <h3 className="font-semibold text-slate-100">{formatTitle(device)}</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{formatSubtitle(device)}</p>
                  {uniqueId && (
                    <p className="text-xs text-slate-500 mt-1 break-all">UID: {uniqueId}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    {formattedPuzzleStatus && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border border-slate-700 rounded-full text-slate-200 bg-slate-800/60">
                        Puzzle: {formattedPuzzleStatus}
                      </span>
                    )}
                    <StatusBadge status={deviceStatus} />
                  </div>
                  {onRemoveDevice && deviceStatus !== 'online' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove ${formatTitle(device)}?`)) {
                          onRemoveDevice(uniqueId ?? device.id);
                        }
                      }}
                      className="text-xs px-2 py-1 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-y-2 text-sm text-slate-300">
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Health</dt>
                  <dd>{device.healthScore ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Last Seen</dt>
                  <dd>
                    {device.lastSeen
                      ? formatDistanceToNow(device.lastSeen, { addSuffix: true })
                      : '—'}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Firmware</dt>
                  <dd>{firmwareVersion ?? '—'}</dd>
                </div>
              </dl>

              {device.sensors && device.sensors.length > 0 && (
                <div className="mt-3">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Latest Sensors</dt>
                  <ul className="space-y-1">
                    {device.sensors.slice(-3).map((sensor, index) => (
                      <li key={`${device.id}-sensor-${index}`} className="text-xs text-slate-300">
                        <span className="font-medium text-slate-200">{sensor.name}</span>:&nbsp;
                        <span>{String(sensor.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
        {deviceCount === 0 && !isLoading && (
          <div className="col-span-full text-center text-slate-500 py-10 border border-dashed border-slate-700 rounded-lg">
            No devices reporting yet.
          </div>
        )}
      </div>
    </section>
  );
}
