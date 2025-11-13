
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, scenes, type Room, type Scene } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import Breadcrumbs from '../components/navigation/Breadcrumbs';
import SceneCreateModal from '../components/SceneCreateModal';
import { motion } from 'framer-motion';
import {
  Film,
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Clock,
  ArrowUpDown,
  Play,
  Pause,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RoomScenesPage() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuthStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [scenesList, setScenesList] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (roomId) {
      loadRoom();
      loadScenes();
    }
  }, [roomId]);

  const loadRoom = async () => {
    if (!roomId) return;
    try {
      const data = await rooms.getById(roomId);
      setRoom(data);
    } catch (error: any) {
      console.error('Failed to load room:', error);
      toast.error('Failed to load room');
      navigate('/dashboard/rooms');
    } finally {
      setLoadingRoom(false);
    }
  };

  const loadScenes = async () => {
    try {
      setLoading(true);
      const data = await scenes.getAll({ room_id: roomId });
      // Sort by scene number
      const sortedScenes = (data.scenes || []).sort(
        (a: any, b: any) => (a.scene_number || 0) - (b.scene_number || 0)
      );
      setScenesList(sortedScenes);
    } catch (error: any) {
      console.error('Failed to load scenes:', error);
      toast.error(error.response?.data?.message || 'Failed to load scenes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sceneId: string, sceneName: string) => {
    if (!confirm(`Are you sure you want to delete scene "${sceneName}"?`)) {
      return;
    }

    try {
      await scenes.delete(sceneId);
      toast.success('Scene deleted successfully');
      loadScenes();
    } catch (error: any) {
      console.error('Failed to delete scene:', error);
      toast.error(error.response?.data?.message || 'Failed to delete scene');
    }
  };

  if (loadingRoom || loading) {
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

  const breadcrumbs = room ? [
    { label: 'Rooms', href: '/dashboard/rooms' },
    { label: room.name, href: `/dashboard/rooms/${roomId}` },
    { label: 'Scenes', href: `/dashboard/rooms/${roomId}/scenes` },
  ] : undefined;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Breadcrumbs */}
        {breadcrumbs && <Breadcrumbs customSegments={breadcrumbs} />}
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}`)}
              className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">
                Scenes - {room?.name}
              </h1>
              <p className="text-gray-500">Manage narrative scenes and sequences</p>
            </div>
          </div>

          {['admin', 'editor'].includes(user?.role || '') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Scene</span>
            </button>
          )}
        </div>

        {/* Scenes List */}
        {scenesList.length === 0 ? (
          <div className="card-neural text-center py-20">
            <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No scenes configured</h3>
            <p className="text-gray-600 mb-6">Create your first scene to begin building the room experience</p>
            {['admin', 'editor'].includes(user?.role || '') && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create First Scene</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {scenesList.map((scene: any, index) => (
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card-neural group hover:border-cyan-500/40 transition-all"
              >
                <div className="flex items-center gap-6">
                  {/* Scene Number Badge */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{scene.scene_number}</span>
                    </div>
                  </div>

                  {/* Scene Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {scene.name}
                      </h3>
                      {scene.slug && (
                        <span className="text-xs text-gray-600 font-mono">/{scene.slug}</span>
                      )}
                    </div>

                    {scene.description && (
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{scene.description}</p>
                    )}

                    <div className="flex items-center gap-6 text-sm">
                      {scene.estimated_duration_seconds && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span>{Math.floor(scene.estimated_duration_seconds / 60)} minutes</span>
                        </div>
                      )}

                      {scene.transition_type && (
                        <div className="flex items-center gap-2 text-gray-500">
                          {scene.auto_advance ? (
                            <Play className="w-4 h-4 text-green-400" />
                          ) : (
                            <Pause className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className="capitalize">
                            {scene.auto_advance ? 'Auto-advance' : 'Manual'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${scene.id}`)}
                      className="flex items-center justify-center p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {['admin', 'editor'].includes(user?.role || '') && (
                      <>
                        <button
                          onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${scene.id}/timeline`)}
                          className="flex items-center justify-center p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                          title="Edit Scene"
                        >
                          <Edit className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDelete(scene.id, scene.name)}
                          className="flex items-center justify-center p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete Scene"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Scene Count Summary */}
        {scenesList.length > 0 && (
          <div className="card-neural bg-cyan-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Scenes</p>
                <p className="text-2xl font-bold text-cyan-400">{scenesList.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Estimated Total Duration</p>
                <p className="text-2xl font-bold text-white">
                  {Math.floor(
                    scenesList.reduce((sum: number, s: any) => sum + (s.estimated_duration_seconds || 0), 0) / 60
                  )} minutes
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Auto-Advance Scenes</p>
                <p className="text-2xl font-bold text-green-400">
                  {scenesList.filter((s: any) => s.auto_advance).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create Scene Modal */}
        {showCreateModal && room && roomId && (
          <SceneCreateModal
            roomId={roomId}
            roomName={room.name}
            onClose={() => setShowCreateModal(false)}
            onSceneCreated={(sceneId) => {
              setShowCreateModal(false);
              loadScenes(); // Reload scenes list
              // Navigate to the newly created scene
              navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}`);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
