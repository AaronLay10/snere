'use client';

import { useState } from 'react';
import { Power, Lightbulb, Loader2 } from 'lucide-react';
import { mqtt } from '../lib/api';
import toast from 'react-hot-toast';

interface RoomControlPanelProps {
  roomSlug?: string;
}

interface LightControl {
  id: string;
  label: string;
  icon: typeof Lightbulb;
}

export default function RoomControlPanel({ roomSlug = 'Clockwork' }: RoomControlPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const lights: LightControl[] = [
    { id: 'boiler', label: 'Boiler Room', icon: Lightbulb },
    { id: 'study', label: 'Study Room', icon: Lightbulb },
    { id: 'lab', label: 'Lab Room', icon: Lightbulb },
    { id: 'crawlspace', label: 'Crawlspace', icon: Lightbulb },
  ];

  const handlePowerControl = async (action: 'on' | 'off') => {
    const loadingKey = `power-${action}`;
    setLoading(loadingKey);

    try {
      // Topic: paragon/Clockwork/power_control with payload "on" or "off"
      await mqtt.publish('paragon/Clockwork/power_control', action);
      toast.success(`Clockwork Power ${action === 'on' ? 'On' : 'Off'}`);
    } catch (error: any) {
      console.error('Failed to control power:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to control power');
    } finally {
      setLoading(null);
    }
  };

  const handleLightControl = async (lightId: string, action: 'on' | 'off') => {
    const loadingKey = `light-${lightId}-${action}`;
    setLoading(loadingKey);

    try {
      // TODO: Update these topics once the Main Lighting Teensy is reconfigured
      // Placeholder topic format: paragon/Clockwork/lights/{room_name}
      const topic = `paragon/Clockwork/lights/${lightId}`;
      await mqtt.publish(topic, action);
      const light = lights.find((l) => l.id === lightId);
      toast.success(`${light?.label} Lights ${action === 'on' ? 'On' : 'Off'}`);
    } catch (error: any) {
      console.error('Failed to control lights:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to control lights');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="card-neural">
      <h2 className="text-xl font-semibold text-white mb-4">Room Controls</h2>

      {/* Power Controls */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Main Power
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handlePowerControl('on')}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'power-on' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Power className="w-5 h-5" />
            )}
            <span className="font-medium">Power On</span>
          </button>

          <button
            onClick={() => handlePowerControl('off')}
            disabled={loading !== null}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'power-off' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Power className="w-5 h-5" />
            )}
            <span className="font-medium">Power Off</span>
          </button>
        </div>
      </div>

      {/* Light Controls */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
          Room Lights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lights.map((light) => (
            <div
              key={light.id}
              className="flex items-center gap-2 p-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
            >
              <light.icon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <span className="text-sm text-gray-300 flex-1">{light.label}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLightControl(light.id, 'on')}
                  disabled={loading !== null}
                  className="px-3 py-1 text-xs rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === `light-${light.id}-on` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'On'
                  )}
                </button>
                <button
                  onClick={() => handleLightControl(light.id, 'off')}
                  disabled={loading !== null}
                  className="px-3 py-1 text-xs rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === `light-${light.id}-off` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Off'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
