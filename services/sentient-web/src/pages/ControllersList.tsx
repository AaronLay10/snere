import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import { controllers, rooms, type Room, type Controller } from '../lib/api';
import { motion } from 'framer-motion';
import { Cpu, Search, Wifi, WifiOff, Filter, DoorOpen, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ControllersList() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [controllersList, setControllersList] = useState<Controller[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all rooms
      const roomsData = await rooms.getAll();
      const allRooms = roomsData.rooms || [];
      setRoomsList(allRooms);

      // Fetch all controllers
      // Prefer single call; if API is room-scoped only, fallback to per-room aggregation
      type ControllersResponse = { controllers?: Controller[] };
      let allControllers: Controller[] = [];
      try {
        const res = (await controllers.getAll()) as unknown as ControllersResponse;
        allControllers = res.controllers || [];
      } catch {
        // Fallback: query per room
        for (const room of allRooms) {
          try {
            const res = (await controllers.getAll({ room_id: room.id })) as unknown as ControllersResponse;
            const list = res.controllers || [];
            allControllers.push(
              ...list.map((c) => ({
                ...c,
                room_name: c.room_name || room.name,
              }))
            );
          } catch (err) {
            console.error(`Failed to load controllers for room ${room.name}:`, err);
          }
        }
      }

      // Attach room_name if missing
      const roomById: Record<string, Room> = Object.fromEntries(
        allRooms.map((r: Room) => [r.id, r] as const)
      );
      const withRooms = allControllers.map((c) => ({
        ...c,
        room_name: c.room_name || roomById[c.room_id]?.name,
      }));

      setControllersList(withRooms);
    } catch (error) {
      console.error('Failed to load controllers:', error);
      // Best-effort error message
      // @ts-expect-error dynamic error shape from axios
      const msg = error?.response?.data?.message || 'Failed to load controllers';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const filtered = controllersList.filter((c) => {
    const displayName = c.friendly_name || c.controller_id;
    const matchesSearch =
      searchQuery === '' ||
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.controller_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.room_name && c.room_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRoom = filterRoom === 'all' || c.room_id === filterRoom;
    const matchesStatus = filterStatus === 'all' || (c.status || 'unknown') === filterStatus;

    return matchesSearch && matchesRoom && matchesStatus;
  });

  const stats = {
    total: controllersList.length,
    online: controllersList.filter((c) => (c.status || '').toLowerCase() === 'online' || (c.status || '').toLowerCase() === 'active').length,
    offline: controllersList.filter((c) => (c.status || '').toLowerCase() === 'offline').length,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">Controllers</h1>
          <p className="text-gray-500">Microcontroller nodes (Teensy 4.1 and others) registered to rooms</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Controllers</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
              </div>
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Online</p>
                <p className="text-2xl font-bold text-green-400">{stats.online}</p>
              </div>
              <Wifi className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Offline</p>
                <p className="text-2xl font-bold text-red-400">{stats.offline}</p>
              </div>
              <WifiOff className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card-neural">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search controllers..."
                className="input-neural !pl-11 w-full"
              />
            </div>

            <div>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Rooms</option>
                {roomsList.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="active">Active</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full card-neural text-center py-12">
              <Cpu className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No controllers found</p>
            </div>
          ) : (
            filtered.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-neural cursor-pointer hover:bg-white/5 transition-all"
                onClick={() => navigate(`/dashboard/controllers/${c.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Cpu className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{c.friendly_name || c.controller_id}</h3>
                      {c.friendly_name && (
                        <p className="text-xs text-gray-500">{c.controller_id}</p>
                      )}
                    </div>
                  </div>

                  {((c.status || '').toLowerCase() === 'online' || (c.status || '').toLowerCase() === 'active') ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">{c.room_name || c.room_id}</span>
                  </div>

                  {c.firmware_version && (
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">FW {c.firmware_version}</span>
                    </div>
                  )}

                  {typeof c.device_count === 'number' && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">{c.device_count} devices</span>
                    </div>
                  )}

                  {c.last_heartbeat && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-500">Last heartbeat: {new Date(c.last_heartbeat).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
