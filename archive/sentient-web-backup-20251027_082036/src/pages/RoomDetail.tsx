
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, scenes, devices, puzzles, type Room } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RoomDetailPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuthStore();
  const roomId = params?.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    scenes: 0,
    devices: 0,
    puzzles: 0,
  });
  const [scenesList, setScenesList] = useState<any[]>([]);

  useEffect(() => {
    if (roomId) {
      loadRoom();
      loadStats();
    }
  }, [roomId]);

  const loadRoom = async () => {
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
    try {
      const [scenesData, devicesData, puzzlesData] = await Promise.all([
        scenes.getAll({ roomId }),
        devices.getAll({ roomId }),
        puzzles.getAll({ roomId }),
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

  const handleDelete = async () => {
    if (!room) return;

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
              <p className="text-gray-500">/{room.slug}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`status-badge status-${room.status}`}>{room.status}</div>
            {['admin', 'editor'].includes(user?.role || '') && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/rooms/${roomId}/edit`)}
                  className="btn-secondary flex items-center gap-2"
                >
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
    </DashboardLayout>
  );
}
