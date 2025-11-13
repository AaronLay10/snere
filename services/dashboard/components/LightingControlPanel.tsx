"use client";

import { useState } from 'react';
import { publishMqttMessage } from '../lib/api';

interface LightingControl {
  id: string;
  name: string;
  topic: string;
  command: string;
  state: 'on' | 'off' | 'unknown';
}

interface LightingControlConfig extends LightingControl {
  type: 'dimmer' | 'switch';
}

const LIGHTING_CONTROLS: LightingControlConfig[] = [
  { id: 'lab', name: 'Lab Room Lighting', topic: 'paragon/Clockwork/SystemLighting/MainLights/Commands/lab', command: 'lab', state: 'unknown', type: 'switch' },
  { id: 'study', name: 'Study Lighting', topic: 'paragon/Clockwork/SystemLighting/MainLights/Commands/study', command: 'study', state: 'unknown', type: 'dimmer' },
  { id: 'boiler', name: 'Boiler Lighting', topic: 'paragon/Clockwork/SystemLighting/MainLights/Commands/boiler', command: 'boiler', state: 'unknown', type: 'dimmer' }
];

export function LightingControlPanel() {
  const [lights, setLights] = useState<LightingControlConfig[]>(LIGHTING_CONTROLS);
  const [loading, setLoading] = useState<string | null>(null);

  const handleToggleLight = async (light: LightingControlConfig, command: 'on' | 'off') => {
    setLoading(light.id);
    try {
      // Send appropriate value based on light type
      // Dimmer controls need numeric values (0-255), switches need "on"/"off"
      let value: string | number;
      if (light.type === 'dimmer') {
        value = command === 'on' ? 255 : 0;  // Full brightness or off for dimmers
      } else {
        value = command;  // "on" or "off" for switches
      }

      // Send JSON payload with "value" field as expected by Teensy firmware
      await publishMqttMessage(light.topic, { value: value.toString() });

      // Update local state
      setLights(prev =>
        prev.map(l => l.id === light.id ? { ...l, state: command } : l)
      );
    } catch (error) {
      console.error('Failed to toggle light', error);
      alert(`Failed to turn ${command} ${light.name}. Check logs for details.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="mb-12">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Lighting Controls</h2>
        <p className="text-sm text-slate-400">{lights.length} zones</p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lights.map((light) => (
          <article
            key={light.id}
            className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-100">{light.name}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">
                  {light.topic}
                </p>
              </div>
              {light.state !== 'unknown' && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border rounded-full ${
                    light.state === 'on'
                      ? 'border-emerald-700 text-emerald-200 bg-emerald-900/60'
                      : 'border-slate-700 text-slate-300 bg-slate-800/60'
                  }`}
                >
                  {light.state}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleToggleLight(light, 'on')}
                disabled={loading === light.id}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                  light.state === 'on'
                    ? 'bg-emerald-600 text-white border border-emerald-500'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === light.id ? 'Loading...' : 'ON'}
              </button>
              <button
                type="button"
                onClick={() => handleToggleLight(light, 'off')}
                disabled={loading === light.id}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
                  light.state === 'off'
                    ? 'bg-slate-700 text-white border border-slate-600'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading === light.id ? 'Loading...' : 'OFF'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
