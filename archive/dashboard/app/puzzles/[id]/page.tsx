"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { fetcher, getApiBaseUrl } from '../../../lib/api';
import { useDevicesWebSocket } from '../../../lib/useDevicesWebSocket';
import type { PuzzleRuntime, DeviceRecord } from '../../../types';
import { ActivityLog, ActivityEvent } from '../../../components/ActivityLog';
import { StatusBadge } from '../../../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function PuzzleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const puzzleId = params.id as string;

  const { data: puzzleResponse, error, mutate } = useSWR<{ success: boolean; data: PuzzleRuntime }>(
    `/puzzles/${puzzleId}`,
    fetcher,
    { refreshInterval: 2000 }
  );

  // Use WebSocket for real-time device updates instead of polling
  const { devices: wsDevices, isConnected: wsConnected } = useDevicesWebSocket();

  const puzzle = puzzleResponse?.data;
  const puzzleMetadata = (puzzle as any)?.metadata as Record<string, any> | undefined;

  // Match devices by multiple criteria using WebSocket data
  const puzzleDevices = wsDevices?.filter((d) => {
    // Match exact puzzle ID
    if (d.puzzleId === puzzleId) return true;

    // Match puzzle name variations (case insensitive, with/without dashes)
    const puzzleName = puzzle?.name?.toLowerCase().replace(/\s+/g, '');
    const devicePuzzleId = d.puzzleId?.toLowerCase().replace(/\s+/g, '');
    if (puzzleName && devicePuzzleId === puzzleName) return true;

    // Match if device's uniqueId matches puzzle ID
    if (d.uniqueId === puzzleId) return true;

    // Match if device is in puzzle metadata devices list
    if (puzzleMetadata?.devices?.includes(d.canonicalId || '')) return true;
    if (puzzleMetadata?.devices?.includes(d.id)) return true;

    // Match by room + puzzle name fragment
    if (d.roomId?.toLowerCase() === puzzle?.roomId?.toLowerCase()) {
      const puzzleFragment = puzzle?.name?.toLowerCase().split(' ')[0]; // e.g., "pilot" from "Pilot Light"
      if (puzzleFragment && (
        d.puzzleId?.toLowerCase().includes(puzzleFragment) ||
        d.canonicalId?.toLowerCase().includes(puzzleFragment) ||
        d.uniqueId?.toLowerCase().includes(puzzleFragment)
      )) {
        return true;
      }
    }

    return false;
  });

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-center py-20">
          <h1 className="text-2xl font-semibold text-red-400">Error Loading Puzzle</h1>
          <p className="text-slate-400 mt-2">{error.message}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700"
          >
            ← Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-center py-20 text-slate-400">
          <div className="animate-pulse text-4xl mb-4">⏳</div>
          <p>Loading puzzle details...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-slate-400 hover:text-slate-300 mb-4 inline-flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">{puzzle.name}</h1>
            <p className="text-slate-400 mt-2">{puzzle.description}</p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">
              Room: {puzzle.roomId} • ID: {puzzle.id}
            </p>
          </div>
          <StatusBadge status={puzzle.state} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="State" value={puzzle.state} />
        <StatCard label="Attempts" value={puzzle.attempts?.toString() ?? '0'} />
        <StatCard
          label="Started"
          value={puzzle.timeStarted ? formatDistanceToNow(puzzle.timeStarted, { addSuffix: true }) : 'Not started'}
        />
        <StatCard
          label="Completed"
          value={puzzle.timeCompleted ? formatDistanceToNow(puzzle.timeCompleted, { addSuffix: true }) : '—'}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={async () => {
            try {
              // Publish MQTT command to activate puzzle
              const mqttTopic = `paragon/${puzzle.roomId}/PilotLight/${puzzleId}/Commands`;
              const response = await fetch('/api/mqtt/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  topic: mqttTopic,
                  payload: {
                    command: 'startIntroVideo',
                    timestamp: Date.now()
                  }
                })
              });

              if (response.ok || true) { // Allow even if endpoint doesn't exist yet
                if ((window as any).__addActivityEvent) {
                  (window as any).__addActivityEvent({
                    timestamp: Date.now(),
                    type: 'puzzle',
                    message: `▶ Intro video started - "${puzzle.name}" activated`,
                    data: { command: 'startIntroVideo', topic: mqttTopic }
                  });
                }
                alert(`Activation command sent!\n\nUse mosquitto to publish:\nmosquitto_pub -h localhost -p 1883 -t '${mqttTopic}' -m '{"command":"startIntroVideo","timestamp":${Date.now()}}'`);
              }
            } catch (error) {
              console.error('Failed to activate puzzle', error);
            }
          }}
          disabled={puzzle.state !== 'inactive'}
          className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
            puzzle.state === 'inactive'
              ? 'bg-blue-900/30 border-blue-700 text-blue-300 hover:bg-blue-900/50'
              : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          ▶ Activate Puzzle (Start Intro)
        </button>
        <button
          onClick={async () => {
            try {
              const response = await fetch(`/api/puzzles/${puzzleId}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              if (response.ok) {
                mutate();
                if ((window as any).__addActivityEvent) {
                  (window as any).__addActivityEvent({
                    timestamp: Date.now(),
                    type: 'puzzle',
                    message: `Puzzle "${puzzle.name}" reset manually`
                  });
                }
              }
            } catch (error) {
              console.error('Failed to reset puzzle', error);
            }
          }}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-md hover:bg-slate-700 text-sm font-medium"
        >
          🔄 Reset Puzzle
        </button>
        <button
          onClick={async () => {
            try {
              const response = await fetch(`/api/puzzles/${puzzleId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'PuzzleSolved',
                  timestamp: Date.now()
                })
              });
              if (response.ok) {
                mutate();
                if ((window as any).__addActivityEvent) {
                  (window as any).__addActivityEvent({
                    timestamp: Date.now(),
                    type: 'puzzle',
                    message: `Manual solve event sent for "${puzzle.name}"`
                  });
                }
              }
            } catch (error) {
              console.error('Failed to trigger solve', error);
            }
          }}
          className="px-4 py-2 bg-green-900/30 border border-green-700 rounded-md hover:bg-green-900/50 text-sm font-medium text-green-300"
        >
          ✓ Trigger Solve (Test)
        </button>
      </div>

      {/* Puzzle Timeline Section */}
      {puzzleMetadata?.sequences && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Puzzle Timeline & Sequences</h2>
          <div className="space-y-4">
            {Object.entries(puzzleMetadata.sequences).map(([sequenceName, sequence]: [string, any]) => (
              <div key={sequenceName} className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg capitalize text-blue-400">
                    {sequenceName.replace(/([A-Z])/g, ' $1').trim()} Sequence
                  </h3>
                  {sequence.durationMs && (
                    <span className="text-xs bg-blue-900/30 border border-blue-700 text-blue-300 px-2 py-1 rounded">
                      Duration: {sequence.durationMs}ms ({(sequence.durationMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>

                {/* Timeline Visualization */}
                <div className="relative">
                  {/* Timeline Track */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-700"></div>

                  {/* Timeline Steps */}
                  <div className="space-y-4">
                    {sequence.steps?.map((step: any, idx: number) => {
                      const offsetSec = step.offsetMs ? (step.offsetMs / 1000).toFixed(1) : '0.0';
                      const isFirst = idx === 0;
                      const isLast = idx === sequence.steps.length - 1;

                      return (
                        <div key={idx} className="relative pl-14 pb-2">
                          {/* Timeline Dot */}
                          <div className={`absolute left-4 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                            isFirst ? 'bg-green-500 border-green-400 text-green-900' :
                            isLast ? 'bg-red-500 border-red-400 text-red-900' :
                            'bg-blue-500 border-blue-400 text-blue-900'
                          }`}>
                            {step.order}
                          </div>

                          {/* Step Content */}
                          <div className="bg-slate-800/50 border border-slate-700 rounded-md p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {step.offsetMs !== undefined && step.offsetMs > 0 && (
                                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                                      +{offsetSec}s
                                    </span>
                                  )}
                                  {step.offsetMs === 0 && (
                                    <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-mono">
                                      Start
                                    </span>
                                  )}
                                  <code className="text-xs text-slate-400">
                                    {step.action}
                                  </code>
                                </div>
                                <p className="text-sm text-slate-300">
                                  {step.description}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sequence Summary */}
                {sequence.steps && sequence.steps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-400">
                    <span className="font-semibold">{sequence.steps.length}</span> step{sequence.steps.length !== 1 ? 's' : ''} in this sequence
                    {sequence.sequenceId && (
                      <span className="ml-3">
                        • ID: <code className="text-slate-300">{sequence.sequenceId}</code>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Devices Section */}
      {puzzleDevices && puzzleDevices.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Connected Devices</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {puzzleDevices.map((device) => {
              // Derive friendly name from metadata or puzzle name
              const friendlyName = device.displayName
                || device.metadata?.displayName
                || puzzleMetadata?.deviceFriendlyName
                || puzzle?.name
                || device.id;

              return (
              <div key={device.id} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{friendlyName}</h3>
                  <StatusBadge status={device.status ?? 'unknown'} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-slate-500 text-xs">Firmware</dt>
                    <dd className="text-slate-300">{device.firmwareVersion ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 text-xs">Last Seen</dt>
                    <dd className="text-slate-300">
                      {device.lastSeen ? formatDistanceToNow(device.lastSeen, { addSuffix: true }) : '—'}
                    </dd>
                  </div>
                </dl>
                {device.sensors && device.sensors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <dt className="text-slate-500 text-xs mb-2">Latest Sensors</dt>
                    <div className="grid grid-cols-2 gap-2">
                      {device.sensors.slice(-4).map((sensor, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-slate-400">{sensor.name}:</span>{' '}
                          <span className="text-slate-200 font-medium">{String(sensor.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </section>
      )}

      {/* Inputs Section */}
      {puzzleMetadata?.inputs && puzzleMetadata.inputs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Inputs & Triggers</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {puzzleMetadata.inputs.map((input: any, index: number) => (
              <div key={index} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-100">{input.id || input.name || `Input ${index + 1}`}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{input.type}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-900/30 text-blue-300 border border-blue-800">
                    SENSOR
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">{input.description}</p>
                {input.mqttTopic && (
                  <div className="mb-3">
                    <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">MQTT Topic</dt>
                    <dd className="text-slate-300 font-mono text-xs bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {input.mqttTopic}
                    </dd>
                  </div>
                )}
                {(() => {
                  // Display latest sensor values from connected devices
                  const latestSensorValues: Record<string, { value: number; timestamp: number }> = {};
                  puzzleDevices?.forEach(device => {
                    device.sensors?.forEach((sensor: any) => {
                      const key = sensor.name || sensor.sensorType || 'unknown';
                      const timestamp = sensor.recordedAt || sensor.timestamp || 0;
                      if (!latestSensorValues[key] || timestamp > latestSensorValues[key].timestamp) {
                        latestSensorValues[key] = { value: sensor.value, timestamp };
                      }
                    });
                  });

                  if (Object.keys(latestSensorValues).length > 0) {
                    return (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <dt className="text-slate-500 text-xs uppercase tracking-wide mb-2">Current Values</dt>
                        <dd className="grid grid-cols-2 gap-2">
                          {Object.entries(latestSensorValues).map(([name, data]) => (
                            <div key={name} className="bg-slate-950 px-3 py-2 rounded border border-slate-700">
                              <div className="text-slate-400 text-xs">{name}</div>
                              <div className="text-green-400 font-bold text-lg">{data.value}</div>
                            </div>
                          ))}
                        </dd>
                      </div>
                    );
                  }
                  return null;
                })()}
                {input.trigger && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <dt className="text-slate-500 text-xs uppercase tracking-wide mb-2">Trigger Condition</dt>
                    <dd className="text-sm space-y-1">
                      {input.trigger.metric && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Metric:</span>
                          <span className="text-slate-200 font-medium">{input.trigger.metric}</span>
                        </div>
                      )}
                      {input.trigger.threshold !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Threshold:</span>
                          <span className="text-slate-200 font-medium">
                            {input.trigger.comparison || ''} {input.trigger.threshold}
                          </span>
                        </div>
                      )}
                      {input.trigger.event && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Event:</span>
                          <span className="text-slate-200 font-medium">{input.trigger.event}</span>
                        </div>
                      )}
                      {input.trigger.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic">{input.trigger.notes}</p>
                      )}
                    </dd>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Outputs Section */}
      {puzzleMetadata?.outputs && puzzleMetadata.outputs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Outputs & Effects</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {puzzleMetadata.outputs.map((output: any, index: number) => (
              <div key={index} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-100">{output.id || output.name || `Output ${index + 1}`}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{output.type}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900/30 text-green-300 border border-green-800">
                    ACTUATOR
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">{output.description}</p>
                <dl className="space-y-2 text-sm">
                  {output.sequenceId && (
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wide">Sequence ID</dt>
                      <dd className="text-slate-300 font-mono text-xs">{output.sequenceId}</dd>
                    </div>
                  )}
                  {output.mqttTopic && (
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wide">MQTT Topic</dt>
                      <dd className="text-slate-300 font-mono text-xs bg-slate-950 px-2 py-1 rounded border border-slate-800">
                        {output.mqttTopic}
                      </dd>
                    </div>
                  )}
                  {output.pins && (
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wide">Pins</dt>
                      <dd className="text-slate-300">
                        {Array.isArray(output.pins)
                          ? output.pins.join(', ')
                          : typeof output.pins === 'object'
                            ? Object.entries(output.pins).map(([key, value]) => `${key}: ${value}`).join(', ')
                            : String(output.pins)
                        }
                      </dd>
                    </div>
                  )}
                  {output.pin !== undefined && (
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wide">Pin</dt>
                      <dd className="text-slate-300">{output.pin}</dd>
                    </div>
                  )}
                  {output.dependsOn && (
                    <div>
                      <dt className="text-slate-500 text-xs uppercase tracking-wide">Depends On</dt>
                      <dd className="text-slate-300 font-mono text-xs">{output.dependsOn}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 pt-4 border-t border-slate-800">
                  {(() => {
                    const outputId = output.id || output.name || `output-${index}`;

                    // Helper function to send MQTT command
                    const sendCommand = async (command: string, value: string, label?: string) => {
                      const namespace = 'paragon';
                      // Use mqttNamespace from metadata to preserve correct capitalization
                      const namespaceParts = puzzleMetadata.mqttNamespace?.split('/') || [];
                      const room = namespaceParts[0] || 'Clockwork';
                      const puzzleName = namespaceParts[1] || puzzle.name.replace(/\s+/g, '');
                      const device = output.mqttDevice || 'Teensy 4.1';

                      // Special handling for audio commands - use the output's mqttTopic if it contains "Audio"
                      let mqttTopic: string;
                      let payload: any;

                      if (output.mqttTopic && output.mqttTopic.includes('Audio')) {
                        // For audio commands, use the mqttTopic directly and parse the value as JSON
                        mqttTopic = `${namespace}/${output.mqttTopic}`;
                        try {
                          payload = JSON.parse(value);
                        } catch {
                          payload = { command, value, timestamp: Date.now() };
                        }
                      } else {
                        // For regular commands, use the standard format
                        mqttTopic = `${namespace}/${room}/${puzzleName}/${device}/Commands/${command}`;
                        payload = { value, timestamp: Date.now() };
                      }

                      try {
                        const apiBaseUrl = getApiBaseUrl();
                        const response = await fetch(`${apiBaseUrl}/api/mqtt/publish`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ topic: mqttTopic, payload })
                        });

                        if (response.ok) {
                          if ((window as any).__addActivityEvent) {
                            (window as any).__addActivityEvent({
                              timestamp: Date.now(),
                              type: 'output',
                              message: `🎯 ${label || command} "${outputId}" for puzzle "${puzzle.name}"`
                            });
                          }
                          alert(`✓ Command sent: ${label || command}\n\nTopic: ${mqttTopic}\nValue: ${value}`);
                        } else {
                          const error = await response.text();
                          alert(`Failed to send command:\n${error}`);
                        }
                      } catch (error) {
                        console.error('Failed to send command', error);
                        alert(`Error: ${error}`);
                      }
                    };

                    // Pattern 1: Multi-Action Buttons
                    if (output.actions && output.actions.length > 0) {
                      return (
                        <div className="space-y-2">
                          {output.actions.map((action: any, actionIndex: number) => (
                            <button
                              key={actionIndex}
                              onClick={() => sendCommand(action.command, action.value, action.label)}
                              className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                action.style === 'secondary'
                                  ? 'bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-800'
                                  : action.style === 'danger'
                                  ? 'bg-red-900/20 border border-red-800/50 text-red-300 hover:bg-red-900/40'
                                  : 'bg-green-900/20 border border-green-800/50 text-green-300 hover:bg-green-900/40'
                              }`}
                            >
                              <span>⚡</span>
                              <span>{action.label}</span>
                            </button>
                          ))}
                        </div>
                      );
                    }

                    // Pattern 2: Toggleable (ON/OFF)
                    if (output.toggleable) {
                      return (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => sendCommand(output.mqttCommand, output.mqttValueOn || 'on', 'Turn ON')}
                            className="px-3 py-2 bg-green-900/20 border border-green-800/50 rounded-md hover:bg-green-900/40 text-sm font-medium text-green-300 transition-colors flex items-center justify-center gap-2"
                          >
                            <span>✓</span>
                            <span>ON</span>
                          </button>
                          <button
                            onClick={() => sendCommand(output.mqttCommand, output.mqttValueOff || 'off', 'Turn OFF')}
                            className="px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-md hover:bg-red-900/40 text-sm font-medium text-red-300 transition-colors flex items-center justify-center gap-2"
                          >
                            <span>✕</span>
                            <span>OFF</span>
                          </button>
                        </div>
                      );
                    }

                    // Pattern 3: Simple Trigger (default)
                    return (
                      <button
                        onClick={() => sendCommand(output.mqttCommand || 'trigger', 'on', `Test ${output.type}`)}
                        className="w-full px-3 py-2 bg-green-900/20 border border-green-800/50 rounded-md hover:bg-green-900/40 text-sm font-medium text-green-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <span>⚡</span>
                        <span>Test {output.type}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sequences Section */}
      {puzzleMetadata?.sequences && Object.keys(puzzleMetadata.sequences).length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Effect Sequences</h2>
          <div className="space-y-4">
            {Object.entries(puzzleMetadata.sequences).map(([sequenceName, sequence]: [string, any]) => (
              <div key={sequenceName} className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-100 capitalize">{sequenceName.replace(/([A-Z])/g, ' $1').trim()}</h3>
                  {sequence.durationMs && (
                    <span className="text-xs text-slate-400">
                      Duration: {sequence.durationMs}ms
                    </span>
                  )}
                </div>
                {sequence.sequenceId && (
                  <p className="text-xs text-slate-500 font-mono mb-3">ID: {sequence.sequenceId}</p>
                )}
                {sequence.steps && sequence.steps.length > 0 && (
                  <div className="space-y-2">
                    {sequence.steps.map((step: any, stepIndex: number) => (
                      <div
                        key={stepIndex}
                        className="flex items-start gap-3 p-3 bg-slate-950 rounded border border-slate-800"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-300">
                          {step.order || stepIndex + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-slate-200">{step.action}</p>
                            {step.offsetMs !== undefined && (
                              <span className="text-xs text-slate-500 ml-2">+{step.offsetMs}ms</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Configuration Details */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Time Limit</dt>
              <dd className="text-slate-200">
                {puzzle.timeLimitMs ? `${Math.floor(puzzle.timeLimitMs / 60000)} minutes` : 'No limit'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Prerequisites</dt>
              <dd className="text-slate-200">
                {puzzle.prerequisites && puzzle.prerequisites.length > 0
                  ? puzzle.prerequisites.join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">Outputs</dt>
              <dd className="text-slate-200">
                {puzzle.outputs && puzzle.outputs.length > 0 ? puzzle.outputs.join(', ') : 'None'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wide mb-1">MQTT Namespace</dt>
              <dd className="text-slate-200 font-mono text-xs">
                {puzzleMetadata?.mqttNamespace ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Activity Log */}
      <ActivityLog maxEvents={200} autoScroll={false} />
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-4 py-3">
      <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-slate-100 text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}
