import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, clients, type Room, type Client } from '../lib/api';
import { motion } from 'framer-motion';
import {
  DoorOpen,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Users,
  Clock,
  BarChart,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import toast from 'react-hot-toast';

export default function RoomsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [clientsList, setClientsList] = useState<Client[]>([]);

  useEffect(() => {
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, clientFilter]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadClients();
    }
  }, [user]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (user?.role !== 'admin') {
        params.client_id = user?.client_id;
      } else if (clientFilter !== 'all') {
        params.client_id = clientFilter;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const data = await rooms.getAll(params);
      setRoomsList(data.rooms || []);
    } catch (error: any) {
      console.error('Failed to load rooms:', error);
      toast.error(error.response?.data?.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await clients.getAll();
      setClientsList(data.clients || []);
    } catch (error: any) {
      console.error('Failed to load clients:', error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"?`)) return;

    try {
      await rooms.delete(id);
      toast.success('Room archived successfully');
      loadRooms();
    } catch (error: any) {
      console.error('Failed to delete room:', error);
      toast.error(error.response?.data?.message || 'Failed to archive room');
    }
  };

  const filteredRooms = roomsList.filter(
    (room) =>
      room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">Escape Rooms</h1>
            <p className="text-gray-500">Manage room configurations and experiences</p>
          </div>

          {['admin', 'editor'].includes(user?.role || '') && (
            <button
              onClick={() => navigate('/dashboard/rooms/new')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Room</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card-neural">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-neural !pl-11"
              />
            </div>

            {/* Client Filter (Admin only) */}
            {user?.role === 'admin' && clientsList.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="input-neural w-full md:w-48"
                >
                  <option value="all">All Clients</option>
                  {clientsList.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-neural w-full md:w-48"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="testing">Testing</option>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin-slow">
              <div className="w-12 h-12 border-4 border-cyan-500 rounded-full border-t-transparent" />
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="card-neural text-center py-20">
            <DoorOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No rooms found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? 'Try adjusting your search'
                : 'Create your first escape room to get started'}
            </p>
            {!searchTerm && ['admin', 'editor'].includes(user?.role || '') && (
              <button
                onClick={() => navigate('/dashboard/rooms/new')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Room</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card-neural group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-cyan-500/10">
                      <DoorOpen className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-gray-500">/{room.slug}</p>
                      {user?.role === 'admin' && room.client_name && (
                        <p className="text-xs text-cyan-400/60 mt-0.5">{room.client_name}</p>
                      )}
                    </div>
                  </div>

                  <div className={`status-badge status-${room.status}`}>{room.status}</div>
                </div>

                {/* Description */}
                {room.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{room.description}</p>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-cyan-500/10">
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Users className="w-3 h-3" />
                      <span className="text-xs">Capacity</span>
                    </div>
                    <p className="text-sm font-semibold text-white">{room.capacity || 'N/A'}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">Duration</span>
                    </div>
                    <p className="text-sm font-semibold text-white">
                      {room.duration ? `${room.duration}m` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-gray-500 mb-1">
                      <BarChart className="w-3 h-3" />
                      <span className="text-xs">Level</span>
                    </div>
                    <p className="text-sm font-semibold text-white capitalize">
                      {room.difficulty || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">View</span>
                  </button>

                  {['admin', 'editor'].includes(user?.role || '') && (
                    <>
                      {/* Edit not yet implemented in UI */}
                      {false && (
                        <button
                          onClick={() => navigate(`/dashboard/rooms/${room.id}/edit`)}
                          className="flex items-center justify-center px-4 py-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(room.id, room.name)}
                        className="flex items-center justify-center px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
