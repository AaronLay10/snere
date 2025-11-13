import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { controllers, type Controller, type Device } from '../lib/api';
import { motion } from 'framer-motion';
import { Cpu, ArrowLeft, Wifi, WifiOff, DoorOpen, Clock, Filter } from 'lucide-react';

export default function ControllerDetail() {
  const { controllerId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [controller, setController] = useState<Controller | null>(null);
  const [devicesList, setDevicesList] = useState<Device[]>([]);

  useEffect(() => {
    if (!controllerId) return;
    const load = async () => {
      try {
        setLoading(true);
        const ctrl = await controllers.getById(controllerId);
        setController(ctrl);
        const devRes = await controllers.getDevices(controllerId);
        const list: Device[] = (devRes.devices || devRes.data || devRes || []) as Device[];
        setDevicesList(list);
      } catch (e) {
        console.error('Failed to load controller detail:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [controllerId]);

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

  if (!controller) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <button onClick={() => navigate(-1)} className="btn-neural inline-flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="card-neural text-gray-400">Controller not found</div>
        </div>
      </DashboardLayout>
    );
  }

  const online = ((controller.status || '').toLowerCase() === 'online' || (controller.status || '').toLowerCase() === 'active');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">
              {controller.friendly_name || controller.controller_id}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>{controller.controller_id}</span>
              </div>
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-gray-500" />
                <span>{controller.room_name || controller.room_id}</span>
              </div>
              {controller.firmware_version && (
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-gray-500" />
                  <span>FW {controller.firmware_version}</span>
                </div>
              )}
              {controller.last_heartbeat && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Last heartbeat: {new Date(controller.last_heartbeat).toLocaleString()}</span>
                </div>
              )}
              <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs ${online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {online ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>

          <button onClick={() => navigate('/dashboard/controllers')} className="btn-neural inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> All Controllers
          </button>
        </div>

        {/* Devices on this controller */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-neural">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-cyan-400">Devices on this controller</h2>
            <div className="text-sm text-gray-500">{devicesList.length} devices</div>
          </div>

          {devicesList.length === 0 ? (
            <div className="text-gray-500">No devices registered for this controller.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devicesList.map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-neural cursor-pointer hover:bg-white/5 transition-all"
                  onClick={() => navigate(`/dashboard/rooms/${d.room_id}/devices/${d.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/10">
                        <Cpu className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{d.friendly_name || d.device_id}</h3>
                        {d.friendly_name && <p className="text-xs text-gray-500">{d.device_id}</p>}
                      </div>
                    </div>
                    {/* Status indicator (if present) */}
                    {(d.status || '').toLowerCase() === 'active' ? (
                      <Wifi className="w-5 h-5 text-green-400" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">{d.room_id}</span>
                    </div>
                    {d.device_type && (
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-400">{d.device_type}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
