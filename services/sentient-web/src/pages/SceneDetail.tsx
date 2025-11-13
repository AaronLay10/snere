import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, scenes, sceneSteps, type Room, type Scene } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import Breadcrumbs from '../components/navigation/Breadcrumbs';
import SceneEditModal from '../components/SceneEditModal';
import { motion } from 'framer-motion';
import {
  Film,
  ArrowLeft,
  Edit,
  Trash2,
  List,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SceneDetailPage() {
  const navigate = useNavigate();
  const { roomId, sceneId } = useParams<{ roomId: string; sceneId: string }>();
  const { user } = useAuthStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [stepsCount, setStepsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (roomId && sceneId) {
      loadData();
    }
  }, [roomId, sceneId]);

  const loadData = async () => {
    if (!roomId || !sceneId) return;
    try {
      setLoading(true);
      const [roomData, sceneData, stepsData] = await Promise.all([
        rooms.getById(roomId),
        scenes.getById(sceneId),
        sceneSteps.getAll({ scene_id: sceneId }),
      ]);

      setRoom(roomData);
      setScene(sceneData);
      setStepsCount(stepsData.steps?.length || 0);
    } catch (error: any) {
      console.error('Failed to load scene:', error);
      toast.error('Failed to load scene');
      navigate(`/dashboard/rooms/${roomId}/scenes`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!scene || !roomId || !sceneId) return;

    if (!confirm(`Are you sure you want to delete scene "${scene.name}"?`)) {
      return;
    }

    try {
      await scenes.delete(sceneId);
      toast.success('Scene deleted successfully');
      navigate(`/dashboard/rooms/${roomId}/scenes`);
    } catch (error: any) {
      console.error('Failed to delete scene:', error);
      toast.error(error.response?.data?.message || 'Failed to delete scene');
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

  if (!scene || !room) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-gray-400">Scene not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const breadcrumbs = room && scene ? [
    { label: 'Rooms', href: '/dashboard/rooms' },
    { label: room.name, href: `/dashboard/rooms/${roomId}` },
    { label: 'Scenes', href: `/dashboard/rooms/${roomId}/scenes` },
    { label: scene.name, href: `/dashboard/rooms/${roomId}/scenes/${sceneId}` },
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
              onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes`)}
              className="p-2 hover:bg-cyan-500/10 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-cyan-400" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Film className="w-8 h-8 text-cyan-400" />
                <h1 className="text-3xl font-light text-gradient-cyan-magenta">
                  {scene.name}
                </h1>
              </div>
              <p className="text-sm text-gray-500">
                {room.name} / Scenes / {scene.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {['admin', 'editor'].includes(user?.role || '') && (
              <>
                <button
                  onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}/timeline`)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-danger flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scene Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-neural"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">Scene Information</h2>

              {scene.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-white">{scene.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Slug</p>
                  <p className="text-white font-mono text-sm">/{scene.slug}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Number</p>
                  <p className="text-white">{scene.scene_number || scene.sequence || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Steps</p>
                  <p className="text-white">{stepsCount}</p>
                </div>
              </div>

              {scene.prerequisites && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-1">Prerequisites</p>
                  <pre className="text-xs text-gray-400 bg-black/50 p-3 rounded-lg overflow-auto">
                    {JSON.stringify(scene.prerequisites, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-cyan-500/20">
            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}/timeline`)}
              className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
            >
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <List className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Edit Timeline</p>
                <p className="text-xs text-gray-500">Manage scene steps</p>
              </div>
            </button>

            <button
              onClick={() => {
                toast('Scene execution coming soon!', { icon: 'ℹ️' });
              }}
              className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 transition-all"
            >
              <div className="p-2 rounded-lg bg-green-500/20">
                <Play className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Execute Scene</p>
                <p className="text-xs text-gray-500">Run this scene now</p>
              </div>
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all"
            >
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">Scene Settings</p>
                <p className="text-xs text-gray-500">Edit scene properties</p>
              </div>
            </button>
          </div>
        </motion.div>

        {/* Timeline Preview */}
        {stepsCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-neural"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-cyan-400">Timeline Steps</h2>
              <span className="text-sm text-gray-500">{stepsCount} steps</span>
            </div>

            <div className="flex items-center justify-center py-12 border-2 border-dashed border-cyan-500/20 rounded-xl">
              <div className="text-center">
                <List className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">View and edit timeline steps</p>
                <button
                  onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}/timeline`)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <List className="w-4 h-4" />
                  <span>Open Timeline Editor</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {stepsCount === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-neural text-center py-12"
          >
            <Info className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No Timeline Steps
            </h3>
            <p className="text-gray-600 mb-6">
              This scene doesn't have any steps yet. Add steps to create the scene flow.
            </p>
            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}/timeline`)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <List className="w-4 h-4" />
              <span>Create Timeline</span>
            </button>
          </motion.div>
        )}
      </div>

      {/* Edit Scene Modal */}
      {showEditModal && scene && room && (
        <SceneEditModal
          scene={scene}
          roomName={room.name}
          onClose={() => setShowEditModal(false)}
          onSceneUpdated={() => {
            setShowEditModal(false); // Close modal first
            loadData(); // Then reload scene data
          }}
        />
      )}
    </DashboardLayout>
  );
}
