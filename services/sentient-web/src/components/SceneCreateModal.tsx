/**
 * Scene Create Modal Component
 * Modal for creating new scenes in a room
 */

import { useState } from 'react';
import { X, Save, Film } from 'lucide-react';
import { scenes } from '../lib/api';
import toast from 'react-hot-toast';

interface SceneCreateModalProps {
  roomId: string;
  roomName: string;
  onClose: () => void;
  onSceneCreated: (sceneId: string) => void;
}

interface SceneFormData {
  name: string;
  slug: string;
  sceneNumber: number | '';
  description: string;
  estimatedDuration: number | '';
  transitionType: string;
  autoAdvance: boolean;
  autoAdvanceDelay: number | '';
}

export default function SceneCreateModal({
  roomId,
  roomName,
  onClose,
  onSceneCreated
}: SceneCreateModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<SceneFormData>({
    name: '',
    slug: '',
    sceneNumber: '',
    description: '',
    estimatedDuration: '',
    transitionType: 'manual',
    autoAdvance: false,
    autoAdvanceDelay: ''
  });

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Scene name is required');
      return;
    }

    if (!formData.slug.trim()) {
      setError('Scene slug is required');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9_]+$/.test(formData.slug)) {
      setError('Slug must contain only lowercase letters, numbers, and underscores');
      return;
    }

    setSaving(true);

    try {
      // Prepare scene data
      const sceneData: any = {
        room_id: roomId,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        transition_type: formData.transitionType,
        auto_advance: formData.transitionType === 'automatic' // Set based on transition type
      };

      // Add optional fields if provided
      if (formData.sceneNumber !== '') {
        sceneData.scene_number = parseInt(formData.sceneNumber.toString());
      }

      if (formData.description.trim()) {
        sceneData.description = formData.description.trim();
      }

      if (formData.estimatedDuration !== '') {
        // Convert minutes to seconds for storage
        sceneData.estimated_duration_seconds = parseInt(formData.estimatedDuration.toString()) * 60;
      }

      if (formData.transitionType === 'automatic' && formData.autoAdvanceDelay !== '') {
        sceneData.auto_advance_delay_ms = parseInt(formData.autoAdvanceDelay.toString());
      }

      // Create the scene
      const newScene = await scenes.create(sceneData);

      toast.success(`Scene "${formData.name}" created successfully`);
      onSceneCreated(newScene.id);
    } catch (err: any) {
      console.error('Create scene error:', err);
      const errorMessage = err.response?.data?.message || 'Failed to create scene';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-cyan-500/30 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-cyan-400" />
            <div>
              <h2 className="text-2xl font-bold text-cyan-400">Create New Scene</h2>
              <p className="text-sm text-gray-400">Room: {roomName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={saving}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>

            {/* Scene Name */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Scene Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                placeholder="e.g., Intro Cutscene"
                required
                disabled={saving}
              />
            </div>

            {/* Scene Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Scene Slug * <span className="text-xs text-gray-500">(auto-generated from name)</span>
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                placeholder="intro_cutscene"
                required
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Used in MQTT topics and URLs. Only lowercase letters, numbers, and underscores.
              </p>
            </div>

            {/* Scene Number */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Scene Number
              </label>
              <input
                type="number"
                value={formData.sceneNumber}
                onChange={(e) => setFormData({ ...formData, sceneNumber: e.target.value ? parseInt(e.target.value) : '' })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                placeholder="1"
                min="1"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Sequence number for ordering scenes (optional)
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                rows={3}
                placeholder="Brief description of what happens in this scene..."
                disabled={saving}
              />
            </div>
          </div>

          {/* Scene Configuration */}
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <h3 className="text-lg font-semibold text-white">Configuration</h3>

            {/* Estimated Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: e.target.value ? parseInt(e.target.value) : '' })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                placeholder="5"
                min="1"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">
                Estimated time in minutes for this scene
              </p>
            </div>

            {/* Transition Type */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Transition Type
              </label>
              <select
                value={formData.transitionType}
                onChange={(e) => setFormData({ ...formData, transitionType: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                disabled={saving}
              >
                <option value="manual">Manual (Game Master controls)</option>
                <option value="automatic">Automatic</option>
                <option value="puzzle_trigger">Puzzle Trigger</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Automatic transitions will advance to the next scene after a delay
              </p>
            </div>

            {/* Auto-advance Delay - shown when Automatic is selected */}
            {formData.transitionType === 'automatic' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Transition Delay (milliseconds)
                </label>
                <input
                  type="number"
                  value={formData.autoAdvanceDelay}
                  onChange={(e) => setFormData({ ...formData, autoAdvanceDelay: e.target.value ? parseInt(e.target.value) : '' })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="3000"
                  min="0"
                  disabled={saving}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Delay before advancing to next scene (1000ms = 1 second)
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Creating Scene...' : 'Create Scene'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
