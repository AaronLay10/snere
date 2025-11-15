import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, clients, scenes, devices, puzzles, type Room, type Client } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import Breadcrumbs from '../components/navigation/Breadcrumbs';
import RoomControlPanel from '../components/RoomControlPanel';
import { motion } from 'framer-motion';
import {
  DoorOpen,
  Edit,
  Trash2,
  ArrowLeft,
  Users,
  Clock,
  BarChart,
  Globe,
  Accessibility,
  FileText,
  Cpu,
  Puzzle,
  Film,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  List,
  Play,
  Settings,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RoomDetailPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    scenes: 0,
    devices: 0,
    puzzles: 0,
  });
  const [scenesList, setScenesList] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (roomId === 'new') {
      toast.error('Room creation is not yet implemented. Please use the API.');
      navigate('/dashboard/rooms');
      return;
    }

    if (roomId) {
      loadRoom();
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, navigate]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadClients();
    }
  }, [user]);

  const loadRoom = async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      const data = await rooms.getById(roomId);
      setRoom(data);
    } catch (error: any) {
      console.error('Failed to load room:', error);
      toast.error(error.response?.data?.message || 'Failed to load room');
      navigate('/dashboard/rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!roomId) return;
    try {
      const [scenesData, devicesData, puzzlesData] = await Promise.all([
        scenes.getAll({ room_id: roomId }),
        devices.getAll({ room_id: roomId }),
        puzzles.getAll({ room_id: roomId }),
      ]);

      setStats({
        scenes: scenesData.scenes?.length || 0,
        devices: devicesData.devices?.length || 0,
        puzzles: puzzlesData.puzzles?.length || 0,
      });

      // Store scenes list for quick access buttons
      setScenesList(scenesData.scenes || []);
    } catch (error) {
      console.error('Failed to load stats:', error);
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

  const handleEdit = () => {
    if (!room) return;
    setFormData({
      name: room.name,
      slug: room.slug,
      short_name: room.short_name || '',
      description: room.description || '',
      client_id: room.client_id,
      status: room.status,
      min_players: room.min_players || 2,
      max_players: room.max_players || 8,
      duration_minutes: room.duration_minutes || 60,
      difficulty_level: room.difficulty_level || '',
      theme: room.theme || '',
    });
    setShowEditModal(true);
  };

  const handleSaveRoom = async () => {
    if (!room || !roomId) return;

    try {
      await rooms.update(roomId, formData);
      toast.success('Room updated successfully');
      setShowEditModal(false);
      loadRoom();
    } catch (error: any) {
      console.error('Failed to update room:', error);
      toast.error(error.response?.data?.message || 'Failed to update room');
    }
  };

  const handleDelete = async () => {
    if (!room || !roomId) return;

    if (!confirm(`Are you sure you want to archive "${room.name}"? This action can be undone.`)) {
      return;
    }

    try {
      await rooms.delete(roomId);
      toast.success('Room archived successfully');
      navigate('/dashboard/rooms');
    } catch (error: any) {
      console.error('Failed to delete room:', error);
      toast.error(error.response?.data?.message || 'Failed to archive room');
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

  if (!room) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Room Not Found</h2>
          <button onClick={() => navigate('/dashboard/rooms')} className="btn-primary mt-4">
            Back to Rooms
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const breadcrumbs = room
    ? [
        { label: 'Rooms', href: '/dashboard/rooms' },
        { label: room.name, href: `/dashboard/rooms/${roomId}` },
      ]
    : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumbs */}
        {breadcrumbs && <Breadcrumbs customSegments={breadcrumbs} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard/rooms')}
              className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">{room.name}</h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-500">/{room.slug}</p>
                {user?.role === 'admin' && room.client_name && (
                  <>
                    <span className="text-gray-600">•</span>
                    <p className="text-cyan-400/70">{room.client_name}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`status-badge status-${room.status}`}>{room.status}</div>
            {['admin', 'editor'].includes(user?.role || '') && (
              <>
                <button onClick={handleEdit} className="btn-secondary flex items-center gap-2">
                  <Edit className="w-5 h-5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-secondary flex items-center gap-2 !bg-red-500/10 !text-red-400 hover:!bg-red-500/20"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Archive</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions - Scene Timelines */}
        {scenesList.length > 0 && (
          <div className="card-neural">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Scene Timelines - Quick Access</h2>
              <button
                onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes`)}
                className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Manage All Scenes
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {scenesList.map((scene: any) => (
                <button
                  key={scene.id}
                  onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${scene.id}`)}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 hover:from-cyan-500/20 hover:to-blue-500/20 transition-all border border-cyan-500/20 hover:border-cyan-500/40"
                >
                  <List className="w-5 h-5 flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold truncate">{scene.name}</p>
                    <p className="text-xs text-gray-500">Scene {scene.scene_number}</p>
                  </div>
                  <Play className="w-4 h-4 flex-shrink-0 opacity-50" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Configuration Options */}
        <div className="card-neural">
          <h2 className="text-xl font-semibold text-white mb-4">Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <Film className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Manage Scenes</p>
                <p className="text-xs text-gray-500">{stats.scenes} scenes</p>
              </div>
            </button>

            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/devices`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <Cpu className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Manage Devices</p>
                <p className="text-xs text-gray-500">{stats.devices} devices</p>
              </div>
            </button>

            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/puzzles`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
            >
              <Puzzle className="w-6 h-6" />
              <div className="text-left">
                <p className="font-semibold">Manage Puzzles</p>
                <p className="text-xs text-gray-500">{stats.puzzles} puzzles</p>
              </div>
            </button>
          </div>
        </div>

        {/* Room Controls */}
        <RoomControlPanel roomSlug={room.slug} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-neural"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Scenes</p>
                <p className="text-3xl font-bold text-white">{stats.scenes}</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Film className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-neural"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Devices</p>
                <p className="text-3xl font-bold text-white">{stats.devices}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Cpu className="w-8 h-8 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-neural"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Puzzles</p>
                <p className="text-3xl font-bold text-white">{stats.puzzles}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Puzzle className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="card-neural">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <DoorOpen className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Basic Information</h2>
              </div>
            </div>

            <div className="space-y-4">
              {room.short_name && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Short Name</p>
                  <p className="text-white">{room.short_name}</p>
                </div>
              )}

              {room.theme && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Theme</p>
                  <p className="text-white">{room.theme}</p>
                </div>
              )}

              {room.description && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-white text-sm">{room.description}</p>
                </div>
              )}

              {room.objective && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Player Objective</p>
                  <p className="text-white text-sm">{room.objective}</p>
                </div>
              )}
            </div>
          </div>

          {/* Player Configuration */}
          <div className="card-neural">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Player Configuration</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Players</p>
                <p className="text-white">
                  {room.min_players || 2} - {room.max_players || 8}
                  {room.recommended_players && (
                    <span className="text-sm text-gray-500 ml-2">
                      (Rec: {room.recommended_players})
                    </span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Duration</p>
                <p className="text-white">{room.duration_minutes || 60} minutes</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Difficulty</p>
                <p className="text-white capitalize">{room.difficulty_level || 'medium'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Rating</p>
                <p className="text-white">{room.difficulty_rating || 3} / 5</p>
              </div>

              {room.physical_difficulty && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-500 mb-1">Physical Difficulty</p>
                  <p className="text-white capitalize">{room.physical_difficulty}</p>
                </div>
              )}
            </div>
          </div>

          {/* Accessibility */}
          <div className="card-neural">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Accessibility className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Accessibility</h2>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Age Recommendation</p>
                <p className="text-white">{room.age_recommendation || '12+'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {room.wheelchair_accessible ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-600" />
                  )}
                  <span className="text-sm text-gray-300">Wheelchair Accessible</span>
                </div>

                <div className="flex items-center gap-2">
                  {room.hearing_impaired_friendly ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-600" />
                  )}
                  <span className="text-sm text-gray-300">Hearing Impaired Friendly</span>
                </div>

                <div className="flex items-center gap-2">
                  {room.vision_impaired_friendly ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-600" />
                  )}
                  <span className="text-sm text-gray-300">Vision Impaired Friendly</span>
                </div>
              </div>

              {room.accessibility_notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-white text-sm">{room.accessibility_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Technical Configuration */}
          <div className="card-neural">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Globe className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Technical Configuration</h2>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">MQTT Topic Base</p>
                <p className="text-white font-mono text-sm bg-black/30 px-3 py-2 rounded">
                  {room.mqtt_topic_base || 'N/A'}
                </p>
              </div>

              {room.network_segment && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Network Segment</p>
                  <p className="text-white font-mono text-sm">{room.network_segment}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-500 mb-1">Version</p>
                <p className="text-white">{room.version || '1.0.0'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative Section */}
        {room.narrative && (
          <div className="card-neural">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <FileText className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Narrative Story</h2>
              </div>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {room.narrative}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Room Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 rounded-xl border border-cyan-500/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">Edit Room</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Room Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-neural"
                      placeholder="Escape Room Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Slug *</label>
                    <input
                      type="text"
                      value={formData.slug || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
                        })
                      }
                      className="input-neural"
                      placeholder="room-slug"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Short Name
                    </label>
                    <input
                      type="text"
                      value={formData.short_name || ''}
                      onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                      className="input-neural"
                      placeholder="Short display name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                    <input
                      type="text"
                      value={formData.theme || ''}
                      onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                      className="input-neural"
                      placeholder="e.g., Steampunk, Horror"
                    />
                  </div>
                </div>

                {/* Client (Admin only) */}
                {user?.role === 'admin' && clientsList.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Client *</label>
                    <select
                      value={formData.client_id || ''}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      className="input-neural"
                    >
                      <option value="">Select Client</option>
                      {clientsList.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-neural"
                    rows={3}
                    placeholder="Brief description of the room..."
                  />
                </div>

                {/* Players & Duration */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Min Players
                    </label>
                    <input
                      type="number"
                      value={formData.min_players || 2}
                      onChange={(e) =>
                        setFormData({ ...formData, min_players: parseInt(e.target.value) })
                      }
                      className="input-neural"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Players
                    </label>
                    <input
                      type="number"
                      value={formData.max_players || 8}
                      onChange={(e) =>
                        setFormData({ ...formData, max_players: parseInt(e.target.value) })
                      }
                      className="input-neural"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      value={formData.duration_minutes || 60}
                      onChange={(e) =>
                        setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                      }
                      className="input-neural"
                      min="15"
                      step="15"
                    />
                  </div>
                </div>

                {/* Difficulty & Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={formData.difficulty_level || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, difficulty_level: e.target.value })
                      }
                      className="input-neural"
                    >
                      <option value="">Not Set</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                    <select
                      value={formData.status || 'draft'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input-neural"
                    >
                      <option value="draft">Draft</option>
                      <option value="testing">Testing</option>
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRoom}
                  className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}
