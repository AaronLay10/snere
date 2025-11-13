import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { devices, type Device } from '../lib/api';
import { motion } from 'framer-motion';
import { ArrowLeft, Cpu, DoorOpen, Wifi, WifiOff, Activity, Rocket, ShieldAlert, ListChecks, Clock, FileCode, Trash2, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DeviceDetail() {
  const { deviceId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [commands, setCommands] = useState<string[]>([]);
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [paramText, setParamText] = useState('{\n  "value": "on"\n}');
  const [fogDurationMs, setFogDurationMs] = useState<number>(500);
  type SensorRow = { sensor_name: string; value: unknown; received_at: string };
  const [sensorData, setSensorData] = useState<SensorRow[]>([]);

  const online = useMemo(() => (device && ((device.status || '').toLowerCase() === 'active' || (device.status || '').toLowerCase() === 'online')), [device]);

  useEffect(() => {
    if (!deviceId) return;
    const load = async () => {
      try {
        setLoading(true);
        const d = await devices.getById(deviceId);
        setDevice(d);
        const cmdList = (d as unknown as { capabilities?: { commands?: string[] } })?.capabilities?.commands || [];
        setCommands(Array.isArray(cmdList) ? cmdList : []);
        // Load recent sensor data (optional, non-blocking)
        try {
          const sd = await devices.getSensorData(deviceId, 20);
          const sensorShape = sd as unknown as { sensorData?: SensorRow[]; readings?: SensorRow[] };
          const list = (sensorShape.sensorData || sensorShape.readings || []) as SensorRow[];
          setSensorData(list);
        } catch {
          // ignore sensors fetch failure
        }
      } catch (e) {
        // @ts-expect-error axios error shape
        toast.error(e?.response?.data?.message || 'Failed to load device');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [deviceId]);

  const handleTest = async (action: string) => {
    if (!deviceId) return;
    setTesting(action);
    try {
      let parsed: Record<string, unknown> = {};
      if (paramText?.trim()) {
        try {
          parsed = JSON.parse(paramText);
        } catch {
          toast.error('Parameters must be valid JSON');
          return;
        }
      }
      // Convenience: if testing fog_trigger and no explicit duration provided in JSON,
      // inject the UI-provided duration_ms (default 500ms)
      if (action === 'fog_trigger') {
        const hasDuration = Object.prototype.hasOwnProperty.call(parsed, 'duration_ms')
          || Object.prototype.hasOwnProperty.call(parsed, 'duration')
          || Object.prototype.hasOwnProperty.call(parsed, 'value');
        if (!hasDuration && Number.isFinite(fogDurationMs)) {
          const clamped = Math.max(100, Math.min(3000, Math.floor(fogDurationMs)));
          parsed.duration_ms = clamped;
        }
      }
      const res = await devices.test(deviceId, action, parsed, confirmSafety);
      toast.success(res?.message || 'Command sent');
    } catch (e) {
      // @ts-expect-error axios error shape
      const msg = e?.response?.data?.message || 'Failed to send test command';
      // @ts-expect-error axios error shape
      if (e?.response?.data?.requires_confirmation) {
        toast.error('Safety confirmation required. Enable the toggle and retry.');
      } else {
        toast.error(msg);
      }
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async () => {
    if (!deviceId) return;
    if (!confirm('Delete this device? This cannot be undone.')) return;
    try {
      await devices.delete(deviceId);
      toast.success('Device deleted');
      navigate('/dashboard/devices');
    } catch (e) {
      // @ts-expect-error axios error shape
      toast.error(e?.response?.data?.message || 'Failed to delete device');
    }
  };

  const refreshDevice = async () => {
    if (!deviceId) return;
    try {
      setLoading(true);
      const d = await devices.getById(deviceId);
      setDevice(d);
      const cmdList = (d as unknown as { capabilities?: { commands?: string[] } })?.capabilities?.commands || [];
      setCommands(Array.isArray(cmdList) ? cmdList : []);
  const sd = await devices.getSensorData(deviceId, 20);
  const sensorShape = sd as unknown as { sensorData?: SensorRow[]; readings?: SensorRow[] };
  const list = (sensorShape.sensorData || sensorShape.readings || []) as SensorRow[];
      setSensorData(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin-slow">
            <div className="w-12 h-12 border-4 border-cyan-500 rounded-full border-t-transparent" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!device) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => navigate(-1)} className="btn-neural inline-flex items-center gap-2 mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
          <div className="card-neural text-gray-400">Device not found</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">{device.friendly_name || device.device_id}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-400" /><span>{device.device_id}</span></div>
              <div className="flex items-center gap-2"><DoorOpen className="w-4 h-4 text-gray-500" /><span>{(device as unknown as { room_name?: string }).room_name || device.room_id}</span></div>
              <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {online ? 'Online' : 'Offline'}
              </div>
              {device.emergency_stop_required && (
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-400"><ShieldAlert className="w-3 h-3" /> E-Stop Required</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshDevice} className="btn-neural inline-flex items-center gap-2"><RefreshCcw className="w-4 h-4" /> Refresh</button>
            <button onClick={() => navigate('/dashboard/devices')} className="btn-neural inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> All Devices</button>
            <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </div>

        {/* Commands Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-neural">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2"><ListChecks className="w-5 h-5" /> Device Commands</h2>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" className="accent-cyan-500" checked={confirmSafety} onChange={(e) => setConfirmSafety(e.target.checked)} />
                Confirm Safety (E-Stop)
              </label>
            </div>
          </div>

          {commands.length === 0 ? (
            <div className="text-gray-500">No commands registered for this device.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Command List */}
              <div className="lg:col-span-1 space-y-2">
                {commands.map((cmd) => (
                  <button key={cmd} onClick={() => handleTest(cmd)} disabled={testing === cmd} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${testing === cmd ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-cyan-500/20 hover:border-cyan-500/40 hover:bg-cyan-500/10 text-white'}`}>
                    <span className="text-sm">{cmd}</span>
                    <Rocket className="w-4 h-4 text-cyan-400" />
                  </button>
                ))}
              </div>

              {/* Parameters Editor */}
              <div className="lg:col-span-2">
                <div className="mb-2 text-sm text-gray-400 flex items-center gap-2"><FileCode className="w-4 h-4" /> Parameters JSON</div>
                {commands.includes('fog_trigger') && (
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">
                      <span className="text-gray-400">Fog trigger duration (ms)</span>
                      <input
                        type="number"
                        min={100}
                        max={3000}
                        step={50}
                        value={fogDurationMs}
                        onChange={(e) => setFogDurationMs(parseInt(e.target.value || '500', 10))}
                        className="w-28 input-neural !py-1 !px-2 !text-sm"
                      />
                    </label>
                    <span className="text-gray-500">Applied automatically when you click fog_trigger unless duration is provided in the JSON.</span>
                    <button
                      type="button"
                      onClick={() => setParamText(JSON.stringify({ duration_ms: Math.max(100, Math.min(3000, Math.floor(fogDurationMs))) }, null, 2))}
                      className="btn-neural !py-1 !px-2"
                    >
                      Insert into JSON
                    </button>
                  </div>
                )}
                <textarea value={paramText} onChange={(e) => setParamText(e.target.value)} className="w-full h-48 input-neural !font-mono" />
                <p className="text-xs text-gray-500 mt-2">
                  Tip: Include a "value" field for simple on/off. For fog_trigger you can provide
                  <code className="mx-1">{"{\"duration_ms\": 1200}"}</code> or use the helper above. Duration is clamped to 100–3000 ms.
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Sensor Data (recent) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-neural">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2"><Activity className="w-5 h-5" /> Recent Sensor Data</h2>
            <div className="text-sm text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Latest {sensorData.length}</div>
          </div>
          {sensorData.length === 0 ? (
            <div className="text-gray-500">No recent sensor data.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sensorData.map((s, idx) => (
                <div key={`${s.sensor_name}-${idx}`} className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-cyan-300">{s.sensor_name}</div>
                    <div className="text-xs text-gray-500">{new Date(s.received_at).toLocaleTimeString()}</div>
                  </div>
                  <div className="mt-1 text-white text-sm break-all">{typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value)}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
