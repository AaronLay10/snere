
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, scenes, sceneSteps, devices, type Room, type Scene, type SceneStep, type Device } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  List,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Play,
  Puzzle,
  Film,
  Music,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Save,
  X,
  Settings,
  TestTube,
  Repeat,
  Tag,
  StopCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Step type icons
const stepTypeIcons = {
  puzzle: Puzzle,
  video: Film,
  audio: Music,
  effect: Zap,
  wait: Clock,
  stopLoop: StopCircle,
};

// Step type colors
const stepTypeColors = {
  puzzle: 'purple',
  video: 'blue',
  audio: 'green',
  effect: 'yellow',
  wait: 'gray',
  stopLoop: 'red',
};

// Sortable Step Component
function SortableStepItem({
  step,
  index,
  onEdit,
  onDelete,
  onTest,
  isCurrent,
  isCompleted,
  isTesting,
}: {
  step: SceneStep;
  index: number;
  onEdit: (step: SceneStep) => void;
  onDelete: (step: SceneStep) => void;
  onTest: (step: SceneStep) => void;
  isCurrent?: boolean;
  isCompleted?: boolean;
  isTesting?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = stepTypeIcons[step.step_type as keyof typeof stepTypeIcons] || List;
  const color = stepTypeColors[step.step_type as keyof typeof stepTypeColors] || 'gray';

  // Determine card styling based on state
  let cardClass = "card-neural group hover:border-cyan-500/40 transition-all";
  if (isCurrent) {
    cardClass = "card-neural group border-2 border-yellow-500 bg-yellow-500/10 animate-pulse";
  } else if (isCompleted) {
    cardClass = "card-neural group border-2 border-green-500/50 bg-green-500/5";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClass}
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-30 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-5 h-5 text-gray-500" />
        </div>

        {/* Step Number */}
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl bg-${color}-500/20 border-2 border-${color}-500/40 flex items-center justify-center`}>
            <span className={`text-lg font-bold text-${color}-400`}>
              {step.step_number}
            </span>
          </div>
        </div>

        {/* Step Icon & Type */}
        <div className="flex-shrink-0">
          <div className={`p-3 rounded-xl bg-${color}-500/10`}>
            <Icon className={`w-6 h-6 text-${color}-400`} />
          </div>
        </div>

        {/* Step Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-semibold text-white">
              {step.name}
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded bg-${color}-500/20 text-${color}-400 uppercase`}>
              {step.step_type}
            </span>
            {isCurrent && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-500/20 text-yellow-400 flex items-center gap-1 animate-pulse">
                <Play className="w-3 h-3" />
                EXECUTING
              </span>
            )}
            {isCompleted && !isCurrent && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                COMPLETED
              </span>
            )}
            {step.required && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-red-500/20 text-red-400">
                Required
              </span>
            )}
          </div>

          {step.description && (
            <p className="text-sm text-gray-400 line-clamp-2 mb-2">
              {step.description}
            </p>
          )}

          {/* Step Configuration Display */}
          {step.step_type === 'video' && step.config?.video_id && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                Video: {step.config.video_id}
              </span>
              {step.config.duration_seconds && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Duration: {step.config.duration_seconds}s
                </span>
              )}
              {step.config.device_id && (
                <span className="flex items-center gap-1">
                  <Settings className="w-3 h-3" />
                  Device: {step.config.device_id}
                </span>
              )}
            </div>
          )}

          {step.step_type === 'wait' && step.config?.duration_ms && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Duration: {step.config.duration_ms >= 1000
                  ? `${(step.config.duration_ms / 1000).toFixed(1)}s`
                  : `${step.config.duration_ms}ms`}
              </span>
            </div>
          )}

          {/* Loop Execution Info */}
          {step.execution_mode === 'loop' && step.execution_interval && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1 text-orange-400">
                <Repeat className="w-3 h-3" />
                Loops every {step.execution_interval >= 60000
                  ? `${(step.execution_interval / 60000).toFixed(1)} min`
                  : step.execution_interval >= 1000
                  ? `${(step.execution_interval / 1000).toFixed(1)}s`
                  : `${step.execution_interval}ms`}
              </span>
              {step.loop_id && (
                <span className="flex items-center gap-1 text-orange-400">
                  <Tag className="w-3 h-3" />
                  ID: {step.loop_id}
                </span>
              )}
            </div>
          )}

          {/* Stop Loop Info */}
          {step.step_type === 'stopLoop' && step.config?.loop_id && (
            <div className="flex items-center gap-4 text-xs text-red-400">
              <span className="flex items-center gap-1">
                <StopCircle className="w-3 h-3" />
                Stops Loop: {step.config.loop_id}
              </span>
            </div>
          )}

          {/* Delay After Execution Info */}
          {step.timing_config?.delayAfterMs && step.timing_config.delayAfterMs > 0 && (
            <div className="flex items-center gap-4 text-xs text-cyan-400 mt-2">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Delay After: {step.timing_config.delayAfterMs >= 1000
                  ? `${(step.timing_config.delayAfterMs / 1000).toFixed(1)}s`
                  : `${step.timing_config.delayAfterMs}ms`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {step.repeatable && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Repeatable
              </span>
            )}
            {step.max_attempts && step.max_attempts > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Max {step.max_attempts} attempts
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTest(step)}
            className="p-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Test Step"
          >
            <TestTube className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(step)}
            className="p-2 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Edit Step"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(step)}
            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Step"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { user } = useAuthStore();
  const roomId = params?.id as string;
  const sceneId = params?.sceneId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [steps, setSteps] = useState<SceneStep[]>([]);
  const [videoDevices, setVideoDevices] = useState<Device[]>([]);
  const [effectDevices, setEffectDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStep, setEditingStep] = useState<SceneStep | null>(null);

  // Timeline test state
  const [testingTimeline, setTestingTimeline] = useState(false);
  const [savingToJson, setSavingToJson] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Search state for Effect step dropdowns
  const [deviceSearch, setDeviceSearch] = useState('');
  const [commandSearch, setCommandSearch] = useState('');

  // New step form state
  const [newStep, setNewStep] = useState<{
    step_type: 'puzzle' | 'video' | 'audio' | 'effect' | 'wait' | 'stopLoop';
    name: string;
    description: string;
    required: boolean;
    repeatable: boolean;
    max_attempts: number;
    execution_mode: 'once' | 'loop';
    execution_interval: number | null;
    loop_id: string | null;
    timing_config: {
      delayAfterMs?: number;
    };
    config: any;
  }>({
    step_type: 'puzzle',
    name: '',
    description: '',
    required: true,
    repeatable: false,
    max_attempts: 0,
    execution_mode: 'once',
    execution_interval: null,
    loop_id: null,
    timing_config: {},
    config: {},
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (roomId && sceneId) {
      loadData();
    }
  }, [roomId, sceneId]);

  // Auto-generate loop ID when device/command changes
  useEffect(() => {
    if (newStep.execution_mode === 'loop' && newStep.step_type === 'effect') {
      const deviceId = newStep.config?.device_id || '';
      const command = newStep.config?.command || '';

      if (deviceId && command) {
        const autoLoopId = `${deviceId}_${command}`;
        if (newStep.loop_id !== autoLoopId) {
          setNewStep({ ...newStep, loop_id: autoLoopId });
        }
      }
    }
  }, [newStep.execution_mode, newStep.config?.device_id, newStep.config?.command, newStep.step_type]);


  const loadData = async () => {
    try {
      setLoading(true);
      const [roomData, sceneData, stepsData, devicesData] = await Promise.all([
        rooms.getById(roomId),
        scenes.getById(sceneId),
        sceneSteps.getAll({ sceneId }),
        devices.getAll({ roomId }),
      ]);

      setRoom(roomData);
      setScene(sceneData);
      setSteps(stepsData.steps || []);

      // Filter video playback devices
      const videoDevs = (devicesData.devices || []).filter(
        (dev: Device) => dev.device_category === 'media_playback'
      );
      setVideoDevices(videoDevs);

      // Filter effect devices (output or bidirectional devices with commands)
      const effectDevs = (devicesData.devices || []).filter(
        (dev: Device) =>
          (dev.device_category === 'output' || dev.device_category === 'bidirectional') &&
          ((dev.capabilities?.commands?.length ?? 0) > 0)
      );
      setEffectDevices(effectDevs);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load timeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = async () => {
    if (!newStep.name) {
      toast.error('Please enter a step name');
      return;
    }

    // Validation for video steps
    if (newStep.step_type === 'video') {
      if (!newStep.config.device_id) {
        toast.error('Please select a Video Manager device');
        return;
      }
      if (!newStep.config.video_id) {
        toast.error('Please enter a Video ID');
        return;
      }
      if (!newStep.config.duration_seconds || newStep.config.duration_seconds <= 0) {
        toast.error('Please enter a valid video duration in seconds');
        return;
      }
    }

    // Validation for effect steps
    if (newStep.step_type === 'effect') {
      if (!newStep.config.device_id) {
        toast.error('Please select an Effect device');
        return;
      }
      if (!newStep.config.command) {
        toast.error('Please select a command');
        return;
      }
    }

    try {
      const nextStepNumber = steps.length + 1;

      await sceneSteps.create({
        scene_id: sceneId,
        step_number: nextStepNumber,
        step_type: newStep.step_type,
        name: newStep.name,
        description: newStep.description,
        required: newStep.required,
        repeatable: newStep.repeatable,
        max_attempts: newStep.max_attempts || undefined,
        timing_config: newStep.timing_config,
        config: newStep.config,
      });

      toast.success('Timeline step added successfully!');
      await loadData(); // Reload steps

      setShowAddModal(false);
      setNewStep({
        step_type: 'puzzle',
        name: '',
        description: '',
        required: true,
        repeatable: false,
        max_attempts: 0,
        execution_mode: 'once',
        execution_interval: null,
        loop_id: null,
        timing_config: {},
        config: {},
      });
    } catch (error: any) {
      console.error('Failed to add step:', error);
      toast.error(error.response?.data?.message || 'Failed to add timeline step');
    }
  };

  const handleEditStep = (step: SceneStep) => {
    setEditingStep(step);
    setNewStep({
      step_type: step.step_type as any,
      name: step.name,
      description: step.description || '',
      required: step.required,
      repeatable: step.repeatable,
      max_attempts: step.max_attempts || 0,
      execution_mode: step.execution_mode || 'once',
      execution_interval: step.execution_interval || null,
      loop_id: step.loop_id || null,
      timing_config: step.timing_config || {},
      config: step.config || {},
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingStep || !newStep.name) {
      toast.error('Please enter a step name');
      return;
    }

    if (newStep.step_type === 'stopLoop' && !newStep.config?.loop_id) {
      toast.error('Please select a loop to stop');
      return;
    }

    if (newStep.execution_mode === 'loop' && !newStep.loop_id) {
      toast.error('Loop ID is required for loop execution mode');
      return;
    }

    if (newStep.execution_mode === 'loop' && (!newStep.execution_interval || newStep.execution_interval < 100)) {
      toast.error('Loop interval must be at least 100ms');
      return;
    }

    // Validation for video steps
    if (newStep.step_type === 'video') {
      if (!newStep.config.device_id) {
        toast.error('Please select a Video Manager device');
        return;
      }
      if (!newStep.config.video_id) {
        toast.error('Please enter a Video ID');
        return;
      }
    }

    // Validation for effect steps
    if (newStep.step_type === 'effect') {
      if (!newStep.config.device_id) {
        toast.error('Please select an Effect device');
        return;
      }
      if (!newStep.config.command) {
        toast.error('Please select a command');
        return;
      }
    }

    try {
      await sceneSteps.update(editingStep.id, {
        name: newStep.name,
        description: newStep.description,
        required: newStep.required,
        repeatable: newStep.repeatable,
        max_attempts: newStep.max_attempts || undefined,
        execution_mode: newStep.execution_mode || 'once',
        execution_interval: newStep.execution_mode === 'loop' ? newStep.execution_interval : null,
        loop_id: newStep.execution_mode === 'loop' ? newStep.loop_id : null,
        timing_config: newStep.timing_config,
        config: newStep.config,
      });

      toast.success('Timeline step updated successfully!');
      await loadData();

      setShowEditModal(false);
      setEditingStep(null);
      setNewStep({
        step_type: 'puzzle',
        name: '',
        description: '',
        required: true,
        repeatable: false,
        max_attempts: 0,
        execution_mode: 'once',
        execution_interval: null,
        loop_id: null,
        timing_config: {},
        config: {},
      });
    } catch (error: any) {
      console.error('Failed to update step:', error);
      toast.error(error.response?.data?.message || 'Failed to update timeline step');
    }
  };

  const handleDeleteStep = async (step: SceneStep) => {
    if (!confirm(`Are you sure you want to delete the step "${step.name}"?`)) {
      return;
    }

    try {
      await sceneSteps.delete(step.id);
      toast.success('Timeline step deleted successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete step:', error);
      toast.error(error.response?.data?.message || 'Failed to delete timeline step');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = steps.findIndex((step) => step.id === active.id);
    const newIndex = steps.findIndex((step) => step.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistically update UI
    const reorderedSteps = arrayMove(steps, oldIndex, newIndex);

    // Update step_number for each step to match new positions
    const newSteps = reorderedSteps.map((step, index) => ({
      ...step,
      step_number: index + 1,
    }));

    setSteps(newSteps);

    // Use the dedicated reorder endpoint
    try {
      const updates = newSteps.map((step, index) => ({
        id: step.id,
        step_number: index + 1,
      }));

      await sceneSteps.reorder(sceneId, updates);
      toast.success('Timeline steps reordered successfully!');
    } catch (error: any) {
      console.error('Failed to reorder steps:', error);
      toast.error('Failed to reorder timeline steps');
      // Revert on error
      await loadData();
    }
  };

  const handleTestStep = async (step: SceneStep) => {
    try {
      const result = await sceneSteps.test(step.id);
      toast.success(result.message || 'Test triggered successfully!');
      console.log('Test action:', result.action);
    } catch (error: any) {
      console.error('Failed to test step:', error);
      toast.error(error.response?.data?.message || 'Failed to test timeline step');
    }
  };

  const handleSaveToJson = async () => {
    if (steps.length === 0) {
      toast.error('No timeline steps to save');
      return;
    }

    setSavingToJson(true);

    try {
      toast.loading('Exporting timeline to JSON...', { duration: 1500 });

      const result = await scenes.exportToJson(sceneId);

      console.log('Export result:', result);

      // Reload scene-executor to pick up the new JSON
      // Note: This makes a direct call to scene-executor from the browser
      // CORS errors are expected and non-fatal - the backend API handles reload
      try {
        const reloadResponse = await fetch('http://localhost:3004/configuration/reload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors' // Suppress CORS errors in console
        });
        console.log('Scene-executor reload requested');
      } catch (reloadError) {
        // Silently fail - reload happens on backend anyway
      }

      // Update last saved time
      setLastSavedTime(new Date());

      toast.success(`✅ Saved to JSON and reloaded scene-executor`);
      toast(`${result.sequence_length} actions, ${Math.round(result.total_duration_ms / 1000)}s duration`, {
        icon: 'ℹ️',
      });
    } catch (error: any) {
      console.error('Failed to save to JSON:', error);
      toast.error(error.response?.data?.message || 'Failed to export timeline to JSON');
    } finally {
      setSavingToJson(false);
    }
  };

  const handleTestTimeline = async () => {
    if (steps.length === 0) {
      toast.error('No timeline steps to test');
      return;
    }

    if (!scene?.slug) {
      toast.error('Scene slug not found');
      return;
    }

    setTestingTimeline(true);

    try {
      toast.loading('Starting scene on scene-executor...', { duration: 2000 });

      // Call scene-executor to start the scene
      const response = await fetch(`http://localhost:3004/scenes/${scene.slug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipSafety: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start scene');
      }

      const result = await response.json();

      console.log('Scene started:', result);

      if (result.success) {
        toast.success(`Scene "${scene.name}" started on scene-executor!`);
        toast('Commands are being executed on production hardware', { icon: '⚡' });
      } else {
        toast.error(result.error?.message || 'Failed to start scene');
      }
    } catch (error: any) {
      console.error('Failed to start scene:', error);
      toast.error(error.message || 'Failed to start scene on scene-executor');
    } finally {
      setTestingTimeline(false);
    }
  };

  const getStepIcon = (type: string) => {
    const Icon = stepTypeIcons[type as keyof typeof stepTypeIcons] || List;
    return Icon;
  };

  const getStepColor = (type: string) => {
    return stepTypeColors[type as keyof typeof stepTypeColors] || 'gray';
  };

  const renderStepConfig = () => {
    if (newStep.step_type === 'video') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Manager Device <span className="text-red-400">*</span>
            </label>
            <select
              value={newStep.config.device_id || ''}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, device_id: e.target.value }
              })}
              className="input-neural w-full"
            >
              <option value="">Select Video Manager...</option>
              {videoDevices.map((device) => (
                <option key={device.id} value={device.device_id}>
                  {device.friendly_name || device.device_id} - {device.physical_location}
                </option>
              ))}
            </select>
            {videoDevices.length === 0 && (
              <p className="text-xs text-yellow-500 mt-1">
                No video playback devices found. Please add a media_playback device to this room first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video ID <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newStep.config.video_id || ''}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, video_id: e.target.value }
              })}
              className="input-neural w-full"
              placeholder="e.g., intro_video_01.mp4"
            />
            <p className="text-xs text-gray-500 mt-1">
              The filename or ID of the video to play
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video Duration (seconds) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={newStep.config.duration_seconds || ''}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, duration_seconds: parseFloat(e.target.value) || 0 }
              })}
              className="input-neural w-full"
              placeholder="e.g., 45.5"
            />
            <p className="text-xs text-gray-500 mt-1">
              How long the video lasts. The timeline will wait for this duration before continuing to the next step.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MQTT Topic
            </label>
            <input
              type="text"
              value={newStep.config.mqtt_topic || `sentient/${room?.client_id}/video/command`}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, mqtt_topic: e.target.value }
              })}
              className="input-neural w-full font-mono text-sm"
              placeholder="sentient/{client}/video/command"
            />
            <p className="text-xs text-gray-500 mt-1">
              MQTT topic for sending video playback commands
            </p>
          </div>
        </div>
      );
    }

    if (newStep.step_type === 'audio') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Audio Cue <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newStep.config.audio_cue || ''}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, audio_cue: e.target.value }
              })}
              className="input-neural w-full"
              placeholder="e.g., narration_01"
            />
          </div>
        </div>
      );
    }

    if (newStep.step_type === 'effect') {
      const selectedDevice = effectDevices.find(
        (dev) => dev.device_id === newStep.config.device_id
      );
      const availableCommands = selectedDevice?.capabilities?.commands || [];

      // Filter devices and commands by search term
      const filteredDevices = effectDevices.filter((dev) =>
        (dev.friendly_name || dev.device_id).toLowerCase().includes(deviceSearch.toLowerCase())
      );

      const filteredCommands = availableCommands.filter((cmd: string) =>
        cmd.toLowerCase().includes(commandSearch.toLowerCase())
      );

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Effect Device <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Search devices..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="input-neural w-full mb-2"
            />
            <select
              value={newStep.config.device_id || ''}
              onChange={(e) => {
                setCommandSearch('');
                setNewStep({
                  ...newStep,
                  config: { ...newStep.config, device_id: e.target.value, command: '' }
                });
              }}
              className="input-neural w-full"
              size={8}
            >
              <option value="">Select Device...</option>
              {filteredDevices.map((device) => (
                <option key={device.id} value={device.device_id}>
                  {device.friendly_name || device.device_id}
                </option>
              ))}
            </select>
            {effectDevices.length === 0 && (
              <p className="text-xs text-yellow-500 mt-1">
                No effect devices found. Please ensure devices have commands registered.
              </p>
            )}
            {effectDevices.length > 0 && filteredDevices.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">
                No devices match your search.
              </p>
            )}
          </div>

          {newStep.config.device_id && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Command <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Search commands..."
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                className="input-neural w-full mb-2"
              />
              <select
                value={newStep.config.command || ''}
                onChange={(e) => setNewStep({
                  ...newStep,
                  config: { ...newStep.config, command: e.target.value }
                })}
                className="input-neural w-full"
                size={6}
              >
                <option value="">Select Command...</option>
                {filteredCommands.map((cmd: string) => (
                  <option key={cmd} value={cmd}>
                    {cmd}
                  </option>
                ))}
              </select>
              {availableCommands.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">
                  No commands available for this device.
                </p>
              )}
              {availableCommands.length > 0 && filteredCommands.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  No commands match your search.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Command Parameters (Optional)
            </label>
            <textarea
              value={newStep.config.params ? JSON.stringify(newStep.config.params, null, 2) : ''}
              onChange={(e) => {
                try {
                  const params = e.target.value ? JSON.parse(e.target.value) : {};
                  setNewStep({
                    ...newStep,
                    config: { ...newStep.config, params }
                  });
                } catch (err) {
                  // Invalid JSON - ignore
                }
              }}
              className="input-neural w-full font-mono text-sm"
              placeholder='{"duration": 5000, "intensity": 100}'
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              JSON format for command parameters (e.g., duration, intensity)
            </p>
          </div>
        </div>
      );
    }

    if (newStep.step_type === 'wait') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Duration (milliseconds)
            </label>
            <input
              type="number"
              min="0"
              value={newStep.config.duration_ms || 0}
              onChange={(e) => setNewStep({
                ...newStep,
                config: { ...newStep.config, duration_ms: parseInt(e.target.value) || 0 }
              })}
              className="input-neural w-full"
            />
          </div>
        </div>
      );
    }

    return null;
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/dashboard/rooms/${roomId}/scenes/${sceneId}`)}
              className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">
                Scene Timeline
              </h1>
              <p className="text-gray-500">
                {scene?.name} - {room?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastSavedTime && (
              <div className="text-sm text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Saved {lastSavedTime.toLocaleTimeString()}</span>
              </div>
            )}
            {steps.length > 0 && ['admin', 'game_master', 'technician'].includes(user?.role || '') && (
              <>
                <button
                  onClick={handleSaveToJson}
                  disabled={savingToJson}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{savingToJson ? 'Saving...' : 'Save to JSON'}</span>
                </button>
                <button
                  onClick={handleTestTimeline}
                  disabled={testingTimeline}
                  className="btn-primary flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  <span>Test Timeline</span>
                </button>
              </>
            )}
            {['admin', 'editor', 'creative_director'].includes(user?.role || '') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Step</span>
              </button>
            )}
          </div>
        </div>

        {/* Timeline Steps */}
        {steps.length === 0 ? (
          <div className="card-neural text-center py-20">
            <List className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No timeline steps</h3>
            <p className="text-gray-600 mb-6">
              Build a sequence of puzzles, media, effects, and events
            </p>
            {['admin', 'editor', 'creative_director'].includes(user?.role || '') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add First Step</span>
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <SortableStepItem
                    key={step.id}
                    step={step}
                    index={index}
                    onEdit={handleEditStep}
                    onDelete={handleDeleteStep}
                    onTest={handleTestStep}
                    isCurrent={currentStepIndex === index}
                    isCompleted={completedSteps.has(step.id)}
                    isTesting={testingTimeline}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Add/Edit Step Modal */}
        <AnimatePresence>
          {(showAddModal || showEditModal) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-neural max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white">
                    {showEditModal ? 'Edit Timeline Step' : 'Add Timeline Step'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingStep(null);
                      setDeviceSearch('');
                      setCommandSearch('');
                      setNewStep({
                        step_type: 'puzzle',
                        name: '',
                        description: '',
                        required: true,
                        repeatable: false,
                        max_attempts: 0,
                        execution_mode: 'once',
                        execution_interval: null,
                        loop_id: null,
                        timing_config: {},
                        config: {},
                      });
                    }}
                    className="p-2 rounded-xl bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Step Type (only for new steps) */}
                  {!showEditModal && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Step Type <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {Object.entries(stepTypeIcons).map(([type, Icon]) => {
                          const color = getStepColor(type);
                          const isSelected = newStep.step_type === type;

                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setNewStep({ ...newStep, step_type: type as any, config: {} })}
                              className={`p-4 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? `border-${color}-500 bg-${color}-500/20`
                                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                              }`}
                            >
                              <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? `text-${color}-400` : 'text-gray-500'}`} />
                              <p className={`text-sm font-medium capitalize ${isSelected ? `text-${color}-400` : 'text-gray-400'}`}>
                                {type}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Step Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newStep.name}
                      onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
                      className="input-neural"
                      placeholder="e.g., Solve Pilot Light Puzzle"
                    />
                  </div>

                  {/* 🔴 DELAY AFTER EXECUTION - MOVED TO TOP FOR VISIBILITY 🔴 */}
                  <div className="p-4 bg-red-500/20 border-2 border-red-500">
                    <label className="block text-sm font-medium text-white mb-2 text-lg font-bold">
                      ⏱️ DELAY AFTER EXECUTION (milliseconds) ⏱️
                      <span className="ml-2 text-xs text-yellow-300">(Wait time after step completes)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={newStep.timing_config?.delayAfterMs || 0}
                      onChange={(e) =>
                        setNewStep({
                          ...newStep,
                          timing_config: {
                            ...newStep.timing_config,
                            delayAfterMs: parseInt(e.target.value) || 0
                          }
                        })
                      }
                      className="input-neural max-w-xs text-lg font-bold"
                      placeholder="e.g., 3000 for 3 seconds"
                    />
                    <p className="text-xs text-yellow-300 mt-1 font-bold">
                      Time to wait after this step executes before moving to the next step.
                      Example: TV needs 3 seconds to power on → enter 3000
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newStep.description}
                      onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                      className="input-neural min-h-[80px]"
                      placeholder="Describe what happens in this step..."
                      rows={3}
                    />
                  </div>

                  {/* Step-Type Specific Configuration */}
                  {renderStepConfig()}

                  {/* Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={newStep.required}
                        onChange={(e) => setNewStep({ ...newStep, required: e.target.checked })}
                        className="w-5 h-5 rounded bg-black/50 border-cyan-500/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                          Required Step
                        </span>
                        <p className="text-xs text-gray-500">
                          Must be completed before advancing
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={newStep.repeatable}
                        onChange={(e) => setNewStep({ ...newStep, repeatable: e.target.checked })}
                        className="w-5 h-5 rounded bg-black/50 border-cyan-500/30 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                          Repeatable
                        </span>
                        <p className="text-xs text-gray-500">
                          Can be triggered multiple times
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Max Attempts */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Attempts
                      <span className="ml-2 text-xs text-gray-500">(0 = unlimited)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newStep.max_attempts}
                      onChange={(e) =>
                        setNewStep({ ...newStep, max_attempts: parseInt(e.target.value) || 0 })
                      }
                      className="input-neural max-w-xs"
                    />
                  </div>

                  {/* Delay After Execution */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Delay After Execution (milliseconds)
                      <span className="ml-2 text-xs text-gray-500">(Wait time after step completes)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={newStep.timing_config?.delayAfterMs || 0}
                      onChange={(e) =>
                        setNewStep({
                          ...newStep,
                          timing_config: {
                            ...newStep.timing_config,
                            delayAfterMs: parseInt(e.target.value) || 0
                          }
                        })
                      }
                      className="input-neural max-w-xs"
                      placeholder="e.g., 3000 for 3 seconds"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Time to wait after this step executes before moving to the next step.
                      Example: TV needs 3 seconds to power on → enter 3000
                    </p>
                  </div>


                  {/* Execution Mode (not for stopLoop, puzzle, or wait types) */}
                  {newStep.step_type !== 'stopLoop' && newStep.step_type !== 'puzzle' && newStep.step_type !== 'wait' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          Execution Mode
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setNewStep({ ...newStep, execution_mode: 'once', execution_interval: null, loop_id: null })}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              newStep.execution_mode === 'once'
                                ? 'border-cyan-500 bg-cyan-500/20'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <Play className={`w-6 h-6 mx-auto mb-2 ${newStep.execution_mode === 'once' ? 'text-cyan-400' : 'text-gray-500'}`} />
                            <p className={`text-sm font-medium ${newStep.execution_mode === 'once' ? 'text-cyan-400' : 'text-gray-400'}`}>
                              Run Once
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Execute one time only</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const deviceId = newStep.config?.device_id || '';
                              const action = newStep.config?.command || newStep.step_type;
                              const autoLoopId = deviceId && action ? `${deviceId}_${action}` : '';
                              setNewStep({
                                ...newStep,
                                execution_mode: 'loop',
                                execution_interval: 60000,
                                loop_id: autoLoopId
                              });
                            }}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              newStep.execution_mode === 'loop'
                                ? 'border-orange-500 bg-orange-500/20'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                            }`}
                          >
                            <Repeat className={`w-6 h-6 mx-auto mb-2 ${newStep.execution_mode === 'loop' ? 'text-orange-400' : 'text-gray-500'}`} />
                            <p className={`text-sm font-medium ${newStep.execution_mode === 'loop' ? 'text-orange-400' : 'text-gray-400'}`}>
                              Loop at Interval
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Repeat continuously</p>
                          </button>
                        </div>
                      </div>

                      {/* Loop Configuration */}
                      {newStep.execution_mode === 'loop' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Loop Interval (milliseconds) <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="number"
                              min="100"
                              value={newStep.execution_interval ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewStep({
                                  ...newStep,
                                  execution_interval: val === '' ? null : parseInt(val)
                                });
                              }}
                              className="input-neural"
                              placeholder="60000"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Current: {newStep.execution_interval && newStep.execution_interval >= 60000
                                ? `${(newStep.execution_interval / 60000).toFixed(1)} minutes`
                                : newStep.execution_interval && newStep.execution_interval >= 1000
                                ? `${(newStep.execution_interval / 1000).toFixed(1)} seconds`
                                : `${newStep.execution_interval || 0}ms`}
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              Loop ID <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={newStep.loop_id || ''}
                              readOnly
                              className="input-neural bg-gray-800/50"
                              placeholder="auto-generated"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Auto-generated based on device and action. Used to stop this loop later.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* StopLoop Configuration */}
                  {newStep.step_type === 'stopLoop' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Loop ID to Stop <span className="text-red-400">*</span>
                        </label>
                        <select
                          value={(newStep.config?.loop_id as string) || ''}
                          onChange={(e) => setNewStep({
                            ...newStep,
                            config: { ...newStep.config, loop_id: e.target.value }
                          })}
                          className="input-neural"
                        >
                          <option value="">Select loop to stop...</option>
                          {steps
                            .filter(s => s.execution_mode === 'loop' && s.loop_id)
                            .map(s => {
                              const loopId = s.loop_id as string;
                              return (
                                <option key={loopId} value={loopId}>
                                  {loopId} - {s.name}
                                </option>
                              );
                            })}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Select which loop to stop when this step executes
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Help Text */}
                  <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-300">
                        <p className="font-medium text-blue-400 mb-1">Step Type Guide:</p>
                        <ul className="space-y-1 text-xs">
                          <li><strong>Puzzle:</strong> Interactive challenge requiring player solution</li>
                          <li><strong>Video:</strong> Visual media playback (narrative, instructions)</li>
                          <li><strong>Audio:</strong> Voice acting, dialog, sound effects</li>
                          <li><strong>Effect:</strong> Lighting, fog, mechanical movements</li>
                          <li><strong>Wait:</strong> Pause for player action or game master intervention</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-cyan-500/20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingStep(null);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={showEditModal ? handleSaveEdit : handleAddStep}
                    className="btn-primary flex items-center gap-2"
                  >
                    {showEditModal ? (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save Changes</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Save Step</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Loops in This Scene Panel */}
        {steps.filter(s => s.execution_mode === 'loop' && s.loop_id).length > 0 && (
          <div className="mt-8 card-neural">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-orange-400" />
              Loops in This Scene
            </h3>
            <div className="space-y-2">
              {steps
                .filter(s => s.execution_mode === 'loop' && s.loop_id)
                .map(step => (
                  <div
                    key={step.id}
                    className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-400">
                          {step.loop_id}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {step.name} • Every {step.execution_interval && step.execution_interval >= 60000
                            ? `${(step.execution_interval / 60000).toFixed(1)} minutes`
                            : step.execution_interval && step.execution_interval >= 1000
                            ? `${(step.execution_interval / 1000).toFixed(1)} seconds`
                            : `${step.execution_interval || 0}ms`}
                        </p>
                      </div>
                      <Repeat className="w-4 h-4 text-orange-400 animate-spin-slow" />
                    </div>
                  </div>
                ))}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              These loops will repeat continuously until stopped by a stopLoop step or scene end.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
