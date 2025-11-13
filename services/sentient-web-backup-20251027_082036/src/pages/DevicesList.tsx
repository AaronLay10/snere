
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { devices, rooms, type Room } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { motion } from 'framer-motion';
import {
  Cpu,
  Search,
  Filter,
  DoorOpen,
  AlertCircle,
  CheckCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Device {
  id: string;
  room_id: string;
  device_id: string;
  friendly_name?: string;
  device_type?: string;
  status?: string;
  room_name?: string;
  mqtt_topic?: string;
  emergency_stop_required?: boolean;
}

export default function AllDevicesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [devicesList, setDevicesList] = useState<Device[]>([]);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterType, setFilterType] = useState('all');
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

      // Load devices for each room
      const allDevices: Device[] = [];
      for (const room of allRooms) {
        try {
          const devicesData = await devices.getAll({ roomId: room.id });
          const roomDevices = (devicesData.devices || []).map((device: Device) => ({
            ...device,
            room_name: room.name,
          }));
          allDevices.push(...roomDevices);
        } catch (error) {
          console.error(`Failed to load devices for room ${room.name}:`, error);
        }
      }

      setDevicesList(allDevices);
    } catch (error: any) {
      console.error('Failed to load devices:', error);
      toast.error(error.response?.data?.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devicesList.filter((device) => {
    const displayName = device.friendly_name || device.device_id;
    const matchesSearch =
      searchQuery === '' ||
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.device_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (device.room_name && device.room_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRoom = filterRoom === 'all' || device.room_id === filterRoom;
    const matchesType = filterType === 'all' || device.device_type === filterType;
    const matchesStatus = filterStatus === 'all' || device.status === filterStatus;

    return matchesSearch && matchesRoom && matchesType && matchesStatus;
  });

  const stats = {
    total: devicesList.length,
    active: devicesList.filter((d) => d.status === 'active').length,
    offline: devicesList.filter((d) => d.status === 'offline').length,
    withEStop: devicesList.filter((d) => d.emergency_stop_required).length,
  };

  const deviceTypes = Array.from(new Set(devicesList.map((d) => d.device_type))).filter(Boolean);

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
          <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">All Devices</h1>
          <p className="text-gray-500">Manage all hardware devices across all rooms</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Devices</p>
                <p className="text-2xl font-bold text-cyan-400">{stats.total}</p>
              </div>
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Active</p>
                <p className="text-2xl font-bold text-green-400">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
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

          <div className="card-neural">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  With E-Stop
                </p>
                <p className="text-2xl font-bold text-yellow-400">{stats.withEStop}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card-neural">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search devices..."
                className="input-neural !pl-11 w-full"
              />
            </div>

            {/* Filter by Room */}
            <div>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Rooms</option>
                {roomsList.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Type */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Types</option>
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-neural w-full"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="offline">Offline</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        {/* Devices List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.length === 0 ? (
            <div className="col-span-full card-neural text-center py-12">
              <Cpu className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500">No devices found</p>
            </div>
          ) : (
            filteredDevices.map((device) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-neural cursor-pointer hover:bg-white/5 transition-all"
                onClick={() =>
                  navigate(`/dashboard/rooms/${device.room_id}/devices/${device.id}`)
                }
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10">
                      <Cpu className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{device.friendly_name || device.device_id}</h3>
                      {device.friendly_name && (
                        <p className="text-xs text-gray-500">{device.device_id}</p>
                      )}
                    </div>
                  </div>

                  {device.status === 'active' ? (
                    <Wifi className="w-5 h-5 text-green-400" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-400">{device.room_name}</span>
                  </div>

                  {device.device_type && (
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-400">{device.device_type}</span>
                    </div>
                  )}

                  {device.emergency_stop_required && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      Emergency Stop
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
