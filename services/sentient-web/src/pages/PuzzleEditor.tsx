import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { puzzles, devices, mqtt, type Puzzle, type Device } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Play,
  CheckCircle,
  AlertCircle,
  Eye,
  Zap,
  Activity,
  Settings,
  Database,
  GitBranch,
  Square,
  Info,
  Music,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PuzzleSettingsModal from '../components/modals/PuzzleSettingsModal';
import { useExecutorSocket } from '../hooks/useExecutorSocket';

// Timeline Block Types
type BlockType =
  | 'state'           // State block (contains sub-blocks)
  | 'watch'           // Sensor watch
  | 'action'          // Execute action
  | 'audio'           // Play audio cue
  | 'check'           // Check condition
  | 'set_variable'    // Set puzzle variable
  | 'solve'           // Solve puzzle (terminal)
  | 'fail'            // Fail puzzle (terminal)
  | 'reset';          // Reset puzzle

type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'between' | 'in';

interface TimelineCondition {
  deviceId: string;
  sensorName: string;
  field: string;
  operator: ConditionOperator;
  value: any;
  tolerance?: number;
}

interface TimelineAction {
  type: string;
  target: string;
  payload?: Record<string, any>;
  delayMs?: number;
}

interface TimelineBlock {
  id: string;
  type: BlockType;
  name: string;
  description?: string;
  expanded?: boolean;

  // For 'state' blocks
  childBlocks?: TimelineBlock[];

  // For 'watch' blocks
  watchConditions?: {
    logic: 'AND' | 'OR';
    conditions: TimelineCondition[];
  };

  // For 'action' blocks
  action?: TimelineAction;

  // For 'audio' blocks
  audioCue?: string;
  audioDevice?: string;

  // For 'check' blocks
  checkConditions?: {
    logic: 'AND' | 'OR';
    conditions: TimelineCondition[];
  };
  onTrue?: string; // Block ID to jump to
  onFalse?: string; // Block ID to jump to

  // For 'set_variable' blocks
  variableName?: string;
  variableValue?: any;
  variableSource?: 'static' | 'sensor' | 'calculation';

  // Metadata
  order?: number;
}

interface PuzzleVariable {
  name: string;
  type: 'number' | 'string' | 'boolean';
  defaultValue: any;
  description?: string;
}

export default function PuzzleEditor() {
  const navigate = useNavigate();
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingBlockId, setTestingBlockId] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Timeline state
  const [puzzleName, setPuzzleName] = useState<string>('');
  const [timelineBlocks, setTimelineBlocks] = useState<TimelineBlock[]>([]);
  const [puzzleVariables, setPuzzleVariables] = useState<PuzzleVariable[]>([]);
  const [draggedBlock, setDraggedBlock] = useState<TimelineBlock | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [draggedChildBlock, setDraggedChildBlock] = useState<{ block: TimelineBlock; parentId: string } | null>(null);
  const [dragOverChildIndex, setDragOverChildIndex] = useState<number | null>(null);

  // Real-time execution tracking
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeSensorData, setActiveSensorData] = useState<Record<string, any>>({});
  const [completedBlockIds, setCompletedBlockIds] = useState<Set<string>>(new Set());

  // Connect to executor WebSocket
  const executorSocket = useExecutorSocket();

  useEffect(() => {
    loadPuzzle();
  }, [puzzleId]);

  // Listen for timeline execution events
  useEffect(() => {
    if (!executorSocket.lastSceneEvent) return;

    const { type, scene } = executorSocket.lastSceneEvent;

    // Check if this event is for our puzzle
    if (scene.id !== puzzleId) return;

    if (type === 'scene-started') {
      // Reset tracking when puzzle starts
      setActiveBlockId(null);
      setActiveSensorData({});
      setCompletedBlockIds(new Set());
      toast.success('Puzzle execution started', { icon: '▶️' });
    } else if (type === 'scene-completed') {
      setActiveBlockId(null);
      toast.success('Puzzle execution completed', { icon: '✅' });
    }
  }, [executorSocket.lastSceneEvent, puzzleId]);

  // Listen for timeline block events
  useEffect(() => {
    const handleTimelineBlockStarted = (data: any) => {
      if (data.sceneId !== puzzleId) return;
      setActiveBlockId(data.block.id);
      console.log('Timeline block started:', data);
    };

    const handleTimelineBlockActive = (data: any) => {
      if (data.sceneId !== puzzleId) return;
      // Update sensor data for active watch blocks
      if (data.sensorData) {
        setActiveSensorData(data.sensorData);
      }
    };

    const handleTimelineBlockCompleted = (data: any) => {
      if (data.sceneId !== puzzleId) return;
      setCompletedBlockIds(prev => new Set(prev).add(data.blockId));
      console.log('Timeline block completed:', data);
    };

    const handleTimelineCompleted = (data: any) => {
      if (data.sceneId !== puzzleId) return;
      setActiveBlockId(null);
      toast.success(`Timeline completed! ${data.totalBlocks} blocks executed in ${Math.round(data.totalTimeMs / 1000)}s`);
    };

    const handleTimelineError = (data: any) => {
      if (data.sceneId !== puzzleId) return;
      toast.error(`Timeline error: ${data.error?.message || 'Unknown error'}`);
      console.error('Timeline error:', data);
    };

    // Subscribe to WebSocket events (assuming Socket.IO client is available globally)
    if (typeof window !== 'undefined' && (window as any).io) {
      const socket = (window as any).io;
      socket.on('timeline-block-started', handleTimelineBlockStarted);
      socket.on('timeline-block-active', handleTimelineBlockActive);
      socket.on('timeline-block-completed', handleTimelineBlockCompleted);
      socket.on('timeline-completed', handleTimelineCompleted);
      socket.on('timeline-error', handleTimelineError);

      return () => {
        socket.off('timeline-block-started', handleTimelineBlockStarted);
        socket.off('timeline-block-active', handleTimelineBlockActive);
        socket.off('timeline-block-completed', handleTimelineBlockCompleted);
        socket.off('timeline-completed', handleTimelineCompleted);
        socket.off('timeline-error', handleTimelineError);
      };
    }
  }, [puzzleId]);

  const loadPuzzle = async () => {
    if (!puzzleId) return;

    try {
      setLoading(true);

      // Load puzzle
      const puzzleData = await puzzles.getById(puzzleId);
      setPuzzle(puzzleData);

      // Load available devices
      const devicesData = await devices.getAll();
      const allDevices = devicesData.devices || [];
      setAvailableDevices(allDevices);

      // Initialize from config
      const config = puzzleData.config || {};
      setPuzzleName(config.name || puzzleData.name || '');

      // Load timeline blocks from config
      if (config.timeline) {
        setTimelineBlocks(config.timeline);

        // Initialize expanded blocks based on block.expanded property
        const expandedIds = new Set<string>();
        config.timeline.forEach((block: any) => {
          if (block.expanded) {
            expandedIds.add(block.id);
          }
        });
        setExpandedBlocks(expandedIds);
      } else {
        // Initialize with empty ON START block
        const initialBlock: TimelineBlock = {
          id: 'on_start',
          type: 'state',
          name: 'ON START',
          description: 'Actions when puzzle begins',
          childBlocks: [],
          expanded: true
        };
        setTimelineBlocks([initialBlock]);
        setExpandedBlocks(new Set(['on_start']));
      }

      if (config.variables) {
        setPuzzleVariables(config.variables);
      }

    } catch (error: any) {
      console.error('Failed to load puzzle:', error);
      toast.error('Failed to load puzzle configuration');
    } finally {
      setLoading(false);
    }
  };

  const savePuzzle = async () => {
    if (!puzzleId) return;

    try {
      setSaving(true);

      // Sync expanded state from Set back into blocks before saving
      const blocksWithExpandedState = timelineBlocks.map(block => ({
        ...block,
        expanded: expandedBlocks.has(block.id)
      }));

      const config = {
        name: puzzleName,
        timeline: blocksWithExpandedState,
        variables: puzzleVariables,
        version: '2.0',
        lastModified: new Date().toISOString()
      };

      await puzzles.update(puzzleId, { config });
      toast.success('Puzzle configuration saved');

    } catch (error: any) {
      console.error('Failed to save puzzle:', error);
      toast.error('Failed to save puzzle configuration');
    } finally {
      setSaving(false);
    }
  };

  const testPuzzle = async () => {
    if (!puzzleId) return;

    if (timelineBlocks.length === 0) {
      toast.error('No timeline blocks to test');
      return;
    }

    setTesting(true);

    try {
      toast.loading('Starting puzzle on executor...', { duration: 2000 });

      // Start the puzzle on the executor
      const result = await puzzles.startPuzzle(puzzleId, { skip_safety: true });

      console.log('Puzzle started:', result);

      if (result.success) {
        toast.dismiss();
        toast.success(`Puzzle "${puzzleName}" started on executor!`);
        toast('Timeline blocks are being executed', { icon: '⚡' });
      } else {
        toast.dismiss();
        toast.error(result.error?.message || 'Failed to start puzzle');
      }
    } catch (error: any) {
      console.error('Failed to start puzzle:', error);
      toast.dismiss();
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to start puzzle on executor');
    } finally {
      setTesting(false);
    }
  };

  const resetPuzzle = async () => {
    if (!puzzleId) return;

    try {
      toast.loading('Resetting puzzle...', { duration: 2000 });

      const result = await puzzles.resetPuzzle(puzzleId);

      console.log('Puzzle reset:', result);

      if (result.success) {
        toast.dismiss();
        toast.success(`Puzzle "${puzzleName}" has been reset!`);
      } else {
        toast.dismiss();
        toast.error(result.error?.message || 'Failed to reset puzzle');
      }
    } catch (error: any) {
      console.error('Failed to reset puzzle:', error);
      toast.dismiss();
      toast.error(error.response?.data?.error?.message || error.message || 'Failed to reset puzzle on executor');
    }
  };

  const testBlock = async (block: TimelineBlock) => {
    setTestingBlockId(block.id);

    try {
      // Only test action and audio blocks (blocks that execute commands)
      if (block.type === 'action' && block.action) {
        if (!block.action.target) {
          toast.error('No MQTT topic configured for this action');
          setTestingBlockId(null);
          return;
        }

        const topic = block.action.target;
        const payload = block.action.payload || {};

        toast.loading(`Testing: ${block.name}...`);
        await mqtt.publish(topic, payload);

        toast.dismiss();
        toast.success(`✓ Executed: ${block.name}`);
        console.log('Block tested:', { block, topic, payload });
      } else if (block.type === 'audio' && block.audioCue && block.audioDevice) {
        const device = availableDevices.find(d => d.device_id === block.audioDevice);
        if (!device) {
          toast.error('Audio device not found');
          setTestingBlockId(null);
          return;
        }

        const topic = `${device.mqtt_topic}/${block.audioCue}`;
        const payload = { timestamp: Date.now() };

        toast.loading(`Playing: ${block.name}...`);
        await mqtt.publish(topic, payload);

        toast.dismiss();
        toast.success(`✓ Triggered: ${block.name}`);
        console.log('Audio block tested:', { block, topic, payload });
      } else {
        toast.error(`Cannot test ${block.type} blocks individually`);
      }
    } catch (error: any) {
      console.error('Failed to test block:', error);
      toast.dismiss();
      toast.error(error.response?.data?.message || 'Failed to execute block');
    } finally {
      setTestingBlockId(null);
    }
  };

  // Block management functions
  const addBlock = (type: BlockType, insertAfterIndex?: number) => {
    const newBlock: TimelineBlock = {
      id: `block_${Date.now()}`,
      type,
      name: getDefaultBlockName(type),
      description: '',
      expanded: true,
      ...(type === 'state' && { childBlocks: [] }),
      ...(type === 'watch' && {
        watchConditions: { logic: 'AND', conditions: [] }
      }),
      ...(type === 'check' && {
        checkConditions: { logic: 'AND', conditions: [] }
      }),
    };

    const newBlocks = [...timelineBlocks];
    const insertIndex = insertAfterIndex !== undefined ? insertAfterIndex + 1 : newBlocks.length;
    newBlocks.splice(insertIndex, 0, newBlock);
    setTimelineBlocks(newBlocks);

    // Expand the new block
    setExpandedBlocks(prev => new Set(prev).add(newBlock.id));
  };

  const addChildBlock = (parentId: string, type: BlockType) => {
    console.log('🔵 addChildBlock called:', { parentId, type });

    const newBlock: TimelineBlock = {
      id: `block_${Date.now()}`,
      type,
      name: getDefaultBlockName(type),
      description: '',
      expanded: true,
      ...(type === 'watch' && {
        watchConditions: { logic: 'AND', conditions: [] }
      }),
      ...(type === 'action' && {
        action: { type: 'mqtt.publish', target: '', payload: {} }
      }),
      ...(type === 'check' && {
        checkConditions: { logic: 'AND', conditions: [] }
      }),
      ...(type === 'set_variable' && {
        variableName: '',
        variableValue: '',
        variableSource: 'static'
      }),
    };

    console.log('🔵 New child block created:', newBlock);

    setTimelineBlocks(blocks => {
      const updatedBlocks = blocks.map(block => {
        if (block.id === parentId && block.type === 'state') {
          const updatedBlock = {
            ...block,
            childBlocks: [...(block.childBlocks || []), newBlock]
          };
          console.log('🔵 Updated parent block:', updatedBlock);
          return updatedBlock;
        }
        return block;
      });
      console.log('🔵 All timeline blocks after update:', updatedBlocks);
      return updatedBlocks;
    });

    setExpandedBlocks(prev => new Set(prev).add(newBlock.id));
    console.log('🔵 Child block added successfully');
  };

  const getDefaultBlockName = (type: BlockType): string => {
    const names: Record<BlockType, string> = {
      state: 'New State',
      watch: 'Sensor Watch',
      action: 'Execute Action',
      audio: 'Play Audio',
      check: 'Check Condition',
      set_variable: 'Set Variable',
      solve: 'Puzzle Solved',
      fail: 'Puzzle Failed',
      reset: 'Reset Puzzle'
    };
    return names[type];
  };

  const updateBlock = (blockId: string, updates: Partial<TimelineBlock>, parentId?: string) => {
    if (parentId) {
      // Update child block
      setTimelineBlocks(blocks =>
        blocks.map(block => {
          if (block.id === parentId && block.type === 'state') {
            return {
              ...block,
              childBlocks: block.childBlocks?.map(child =>
                child.id === blockId ? { ...child, ...updates } : child
              )
            };
          }
          return block;
        })
      );
    } else {
      // Update top-level block
      setTimelineBlocks(blocks =>
        blocks.map(block =>
          block.id === blockId ? { ...block, ...updates } : block
        )
      );
    }
  };

  const deleteBlock = (blockId: string, parentId?: string) => {
    if (parentId) {
      // Delete child block
      setTimelineBlocks(blocks =>
        blocks.map(block => {
          if (block.id === parentId && block.type === 'state') {
            return {
              ...block,
              childBlocks: block.childBlocks?.filter(child => child.id !== blockId)
            };
          }
          return block;
        })
      );
    } else {
      // Delete top-level block
      setTimelineBlocks(blocks => blocks.filter(block => block.id !== blockId));
    }
  };

  const toggleBlockExpansion = (blockId: string) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        newSet.delete(blockId);
      } else {
        newSet.add(blockId);
      }
      return newSet;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, block: TimelineBlock, index: number) => {
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (!draggedBlock) return;

    const newBlocks = [...timelineBlocks];
    const dragIndex = newBlocks.findIndex(b => b.id === draggedBlock.id);

    if (dragIndex !== -1 && dragIndex !== dropIndex) {
      newBlocks.splice(dragIndex, 1);
      const insertIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
      newBlocks.splice(insertIndex, 0, draggedBlock);
      setTimelineBlocks(newBlocks);
    }

    setDraggedBlock(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
    setDragOverIndex(null);
  };

  // Child block drag and drop handlers
  const handleChildDragStart = (e: React.DragEvent, block: TimelineBlock, parentId: string, index: number) => {
    setDraggedChildBlock({ block, parentId });
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleChildDragOver = (e: React.DragEvent, parentId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverChildIndex(index);
  };

  const handleChildDrop = (e: React.DragEvent, parentId: string, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedChildBlock || draggedChildBlock.parentId !== parentId) return;

    setTimelineBlocks(blocks =>
      blocks.map(block => {
        if (block.id === parentId && block.type === 'state') {
          const childBlocks = [...(block.childBlocks || [])];
          const dragIndex = childBlocks.findIndex(b => b.id === draggedChildBlock.block.id);

          if (dragIndex !== -1 && dragIndex !== dropIndex) {
            childBlocks.splice(dragIndex, 1);
            const insertIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
            childBlocks.splice(insertIndex, 0, draggedChildBlock.block);
          }

          return { ...block, childBlocks };
        }
        return block;
      })
    );

    setDraggedChildBlock(null);
    setDragOverChildIndex(null);
  };

  const handleChildDragEnd = () => {
    setDraggedChildBlock(null);
    setDragOverChildIndex(null);
  };

  // Render block type icon
  const getBlockIcon = (type: BlockType) => {
    const icons: Record<BlockType, any> = {
      state: Square,
      watch: Eye,
      action: Zap,
      audio: Music,
      check: GitBranch,
      set_variable: Database,
      solve: CheckCircle,
      fail: AlertCircle,
      reset: Activity
    };
    return icons[type];
  };

  // Render block type color
  const getBlockColor = (type: BlockType): string => {
    const colors: Record<BlockType, string> = {
      state: 'border-purple-500/30 bg-purple-500/10',
      watch: 'border-blue-500/30 bg-blue-500/10',
      action: 'border-yellow-500/30 bg-yellow-500/10',
      audio: 'border-green-500/30 bg-green-500/10',
      check: 'border-orange-500/30 bg-orange-500/10',
      set_variable: 'border-cyan-500/30 bg-cyan-500/10',
      solve: 'border-green-600/30 bg-green-600/10',
      fail: 'border-red-500/30 bg-red-500/10',
      reset: 'border-gray-500/30 bg-gray-500/10'
    };
    return colors[type];
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading puzzle...</div>
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
              onClick={() => navigate('/dashboard/puzzles')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <span
                  onClick={() => navigate('/dashboard/puzzles')}
                  className="cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  Puzzles
                </span>
                <span>›</span>
                <span className="text-white">{puzzleName || 'Puzzle Editor'}</span>
              </div>
              <h1 className="text-3xl font-bold text-white">{puzzleName || 'Puzzle Editor'}</h1>
              <p className="text-gray-400 text-sm mt-1">
                Build your puzzle timeline with drag-and-drop blocks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-4 py-2 bg-gray-700/80 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-600/50"
              title="Edit puzzle settings"
            >
              <Settings className="w-5 h-5" />
              Settings
            </button>
            <button
              onClick={testPuzzle}
              disabled={testing}
              className="px-6 py-2 bg-emerald-600/80 hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 border border-emerald-500/30"
              title="Test puzzle timeline on executor"
            >
              <Play className="w-5 h-5" />
              {testing ? 'Testing...' : 'Test Puzzle'}
            </button>
            <button
              onClick={resetPuzzle}
              className="px-6 py-2 bg-gray-700/80 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2 border border-gray-600/50"
              title="Reset puzzle to inactive state"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>
            <button
              onClick={savePuzzle}
              disabled={saving}
              className="px-6 py-2 bg-cyan-600/80 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 border border-cyan-500/30"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : 'Save Puzzle'}
            </button>
          </div>
        </div>

        {/* Puzzle Variables Section */}
        <div className="bg-gray-800/50 rounded-xl border border-cyan-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Puzzle Variables</h3>
              <span className="text-xs text-gray-500">
                Store intermediate values for use in conditions
              </span>
            </div>
            <button
              onClick={() => {
                setPuzzleVariables([
                  ...puzzleVariables,
                  { name: 'new_variable', type: 'number', defaultValue: 0 }
                ]);
              }}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Variable
            </button>
          </div>

          {puzzleVariables.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              No variables defined. Add variables to store puzzle state.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {puzzleVariables.map((variable, index) => (
                <div key={index} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => {
                        const newVars = [...puzzleVariables];
                        newVars[index].name = e.target.value;
                        setPuzzleVariables(newVars);
                      }}
                      placeholder="variable_name"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white font-mono"
                    />
                    <button
                      onClick={() => {
                        setPuzzleVariables(puzzleVariables.filter((_, i) => i !== index));
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={variable.type}
                      onChange={(e) => {
                        const newVars = [...puzzleVariables];
                        newVars[index].type = e.target.value as any;
                        setPuzzleVariables(newVars);
                      }}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="number">Number</option>
                      <option value="string">String</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <input
                      type="text"
                      value={variable.defaultValue}
                      onChange={(e) => {
                        const newVars = [...puzzleVariables];
                        newVars[index].defaultValue = e.target.value;
                        setPuzzleVariables(newVars);
                      }}
                      placeholder="Default"
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={variable.description || ''}
                    onChange={(e) => {
                      const newVars = [...puzzleVariables];
                      newVars[index].description = e.target.value;
                      setPuzzleVariables(newVars);
                    }}
                    placeholder="Description (optional)"
                    className="w-full mt-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-gray-800/50 rounded-xl border border-cyan-500/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Puzzle Timeline</h3>
            </div>
          </div>

          {/* Timeline Blocks */}
          <div className="space-y-3">
            {timelineBlocks.map((block, index) => (
              <div key={block.id}>
                {/* Drop zone indicator */}
                {dragOverIndex === index && (
                  <div className="h-1 bg-cyan-500 rounded mb-2 animate-pulse" />
                )}

                {/* Block */}
                <TimelineBlockComponent
                  block={block}
                  index={index}
                  isExpanded={expandedBlocks.has(block.id)}
                  availableDevices={availableDevices}
                  puzzleVariables={puzzleVariables}
                  allBlocks={timelineBlocks}
                  onToggleExpansion={() => toggleBlockExpansion(block.id)}
                  onUpdate={(updates) => updateBlock(block.id, updates)}
                  onDelete={() => deleteBlock(block.id)}
                  onAddChild={(type) => addChildBlock(block.id, type)}
                  onUpdateChild={(childId, updates) => updateBlock(childId, updates, block.id)}
                  onDeleteChild={(childId) => deleteBlock(childId, block.id)}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onChildDragStart={handleChildDragStart}
                  onChildDragOver={handleChildDragOver}
                  onChildDrop={handleChildDrop}
                  onChildDragEnd={handleChildDragEnd}
                  onTestBlock={testBlock}
                  testingBlockId={testingBlockId}
                  onSave={savePuzzle}
                  saving={saving}
                  isActive={activeBlockId === block.id}
                  isCompleted={completedBlockIds.has(block.id)}
                  activeSensorData={activeSensorData}
                />
              </div>
            ))}

            {/* Add Block Menu */}
            <AddBlockMenu onAddBlock={(type) => addBlock(type)} />
          </div>
        </div>
      </div>

      {/* Puzzle Settings Modal */}
      <PuzzleSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        puzzle={puzzle}
        onUpdate={loadPuzzle}
      />
    </DashboardLayout>
  );
}

// Timeline Block Component
interface TimelineBlockComponentProps {
  block: TimelineBlock;
  index: number;
  isExpanded: boolean;
  availableDevices: Device[];
  puzzleVariables: PuzzleVariable[];
  allBlocks: TimelineBlock[];
  onToggleExpansion: () => void;
  onUpdate: (updates: Partial<TimelineBlock>) => void;
  onDelete: () => void;
  onAddChild: (type: BlockType) => void;
  onUpdateChild: (childId: string, updates: Partial<TimelineBlock>) => void;
  onDeleteChild: (childId: string) => void;
  onDragStart: (e: React.DragEvent, block: TimelineBlock, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onChildDragStart: (e: React.DragEvent, block: TimelineBlock, parentId: string, index: number) => void;
  onChildDragOver: (e: React.DragEvent, parentId: string, index: number) => void;
  onChildDrop: (e: React.DragEvent, parentId: string, index: number) => void;
  onChildDragEnd: () => void;
  onTestBlock: (block: TimelineBlock) => void;
  testingBlockId: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
  isActive?: boolean;
  isCompleted?: boolean;
  activeSensorData?: Record<string, any>;
}

function TimelineBlockComponent({
  block,
  index,
  isExpanded,
  availableDevices,
  puzzleVariables,
  allBlocks,
  onToggleExpansion,
  onUpdate,
  onDelete,
  onAddChild,
  onUpdateChild,
  onDeleteChild,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onChildDragStart,
  onChildDragOver,
  onChildDrop,
  onChildDragEnd,
  onTestBlock,
  testingBlockId,
  onSave,
  saving,
  isActive = false,
  isCompleted = false,
  activeSensorData = {}
}: TimelineBlockComponentProps) {
  const Icon = getBlockIcon(block.type);
  const colorClass = getBlockColor(block.type);
  const canHaveChildren = block.type === 'state';
  const isTerminal = block.type === 'solve' || block.type === 'fail';
  const canCollapse = block.type === 'state' || block.type === 'watch' || block.type === 'check' || block.type === 'action' || block.type === 'audio' || block.type === 'set_variable';

  // Determine border styling based on execution state
  let borderStyle = colorClass;
  if (isActive) {
    borderStyle = 'border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/50 animate-pulse';
  } else if (isCompleted) {
    borderStyle = 'border-green-600/50 bg-green-600/10';
  }

  return (
    <div
      draggable={!isTerminal}
      onDragStart={(e) => !isTerminal && onDragStart(e, block, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className={`bg-gray-900 rounded-lg border-2 ${borderStyle} overflow-visible transition-all ${
        !isTerminal ? 'cursor-move' : ''
      } ${isActive ? 'ring-4 ring-emerald-400/30' : ''}`}
    >
      {/* Block Header */}
      <div className="flex items-center gap-3 p-4">
        {!isTerminal && (
          <GripVertical className="w-5 h-5 text-gray-600 flex-shrink-0" />
        )}

        <Icon className="w-5 h-5 text-cyan-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={block.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="flex-1 bg-transparent text-white font-semibold focus:outline-none focus:bg-gray-800 rounded px-2 py-1"
            />
            {isActive && (
              <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded uppercase animate-pulse">
                ⚡ Executing
              </span>
            )}
            {isCompleted && !isActive && (
              <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded uppercase">
                ✓ Done
              </span>
            )}
          </div>
          {block.description !== undefined && (
            <input
              type="text"
              value={block.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Add description..."
              className="w-full mt-1 bg-transparent text-gray-400 text-sm focus:outline-none focus:bg-gray-800 rounded px-2 py-1"
            />
          )}

          {/* Show state block child count when collapsed */}
          {!isExpanded && block.type === 'state' && (
            <div className="mt-2 text-xs text-gray-500">
              {(block.childBlocks?.length || 0) > 0 ? (
                <span>
                  Contains <span className="text-cyan-400">{block.childBlocks?.length}</span> {block.childBlocks?.length === 1 ? 'block' : 'blocks'}
                </span>
              ) : (
                <span className="text-gray-600">No blocks added</span>
              )}
            </div>
          )}

          {/* Show condition summary when collapsed */}
          {!isExpanded && block.type === 'watch' && (block.watchConditions?.conditions.length || 0) > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {block.watchConditions?.conditions.map((cond, idx) => {
                const device = availableDevices.find(d => d.device_id === cond.deviceId);
                const deviceName = device?.friendly_name || cond.deviceId;
                const valueDisplay = Array.isArray(cond.value) ? cond.value.join(' & ') : cond.value;

                // Get live sensor value if block is active
                const sensorKey = cond.sensorName ? `${cond.deviceId}.${cond.sensorName}` : cond.deviceId;
                const liveValue = isActive && activeSensorData[sensorKey];

                return (
                  <div key={idx} className="truncate">
                    {idx > 0 && <span className="text-gray-600"> {block.watchConditions?.logic} </span>}
                    When <span className="text-cyan-400">{deviceName}</span>
                    {cond.sensorName && <span className="text-cyan-400">.{cond.sensorName}</span>}
                    {' '}{cond.operator}{' '}
                    <span className="text-yellow-400">{valueDisplay}</span>
                    {liveValue !== undefined && (
                      <span className="ml-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono">
                        Live: {liveValue}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Show check condition summary when collapsed */}
          {!isExpanded && block.type === 'check' && (block.checkConditions?.conditions.length || 0) > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {block.checkConditions?.conditions.map((cond, idx) => {
                const device = availableDevices.find(d => d.device_id === cond.deviceId);
                const deviceName = device?.friendly_name || cond.deviceId;
                const valueDisplay = Array.isArray(cond.value) ? cond.value.join(' & ') : cond.value;

                return (
                  <div key={idx} className="truncate">
                    {idx > 0 && <span className="text-gray-600"> {block.checkConditions?.logic} </span>}
                    If <span className="text-cyan-400">{deviceName}</span>
                    {cond.sensorName && <span className="text-cyan-400">.{cond.sensorName}</span>}
                    {' '}{cond.operator}{' '}
                    <span className="text-yellow-400">{valueDisplay}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show action summary when collapsed */}
          {!isExpanded && block.type === 'action' && block.action?.target && (() => {
            // Parse target format: deviceId/commandName
            const [deviceId, commandName] = block.action.target.split('/');

            // Find the device
            const device = availableDevices.find(d => d.device_id === deviceId);

            // Look for the friendly name in device capabilities
            let displayName = block.action.target; // fallback to raw target

            if (device && commandName) {
              const commands = device.capabilities?.commands || [];

              // Find the command with matching name
              const command = commands.find((cmd: any) => {
                const cmdName = cmd.name || cmd.command_name || cmd;
                return cmdName === commandName;
              });

              if (command && (command.friendly_name || command.display_name)) {
                displayName = command.friendly_name || command.display_name;
              } else {
                // Fallback: show device name + command name
                displayName = `${device.friendly_name || deviceId} - ${commandName}`;
              }
            }

            return (
              <div className="mt-2 text-xs text-gray-500 truncate">
                Execute: <span className="text-cyan-400">{displayName}</span>
                {block.action.delayMs! > 0 && <span className="text-gray-600"> (wait {block.action.delayMs}ms)</span>}
              </div>
            );
          })()}

          {/* Show audio summary when collapsed */}
          {!isExpanded && block.type === 'audio' && block.audioCue && (() => {
            // Find the audio device
            const device = availableDevices.find(d => d.device_id === block.audioDevice);
            let displayName = block.audioCue; // fallback to cue ID

            if (device) {
              const commands = device.capabilities?.commands || [];

              // Find the command with matching name
              const command = commands.find((cmd: any) => {
                const cmdName = cmd.name || cmd.command_name || cmd;
                return cmdName === block.audioCue;
              });

              if (command && (command.friendly_name || command.display_name)) {
                displayName = command.friendly_name || command.display_name;
              } else if (device.friendly_name) {
                // Fallback: show device name + cue
                displayName = `${device.friendly_name} - ${block.audioCue}`;
              }
            }

            return (
              <div className="mt-2 text-xs text-gray-500 truncate">
                Play: <span className="text-green-400">{displayName}</span>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-2">
          {canCollapse && (
            <button
              onClick={onToggleExpansion}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}

          {(block.type === 'action' || block.type === 'audio') && (
            <button
              onClick={() => onTestBlock(block)}
              disabled={testingBlockId === block.id}
              className="text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
              title="Run this block"
            >
              <Play className="w-5 h-5" />
            </button>
          )}

          {!isTerminal && (
            <button
              onClick={onDelete}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 p-4 space-y-4">
          {/* State Block - Show children */}
          {block.type === 'state' && (
            <div className="space-y-3">
              {block.childBlocks && block.childBlocks.length > 0 ? (
                <div className="space-y-2 ml-8">
                  {block.childBlocks.map((childBlock, childIndex) => (
                    <ChildBlockComponent
                      key={childBlock.id}
                      block={childBlock}
                      index={childIndex}
                      parentId={block.id}
                      availableDevices={availableDevices}
                      puzzleVariables={puzzleVariables}
                      allBlocks={allBlocks}
                      onUpdate={(updates) => onUpdateChild(childBlock.id, updates)}
                      onDelete={() => onDeleteChild(childBlock.id)}
                      onTestBlock={onTestBlock}
                      testingBlockId={testingBlockId}
                      onSave={onSave}
                      saving={saving}
                      onDragStart={onChildDragStart}
                      onDragOver={onChildDragOver}
                      onDrop={onChildDrop}
                      onDragEnd={onChildDragEnd}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 text-sm ml-8">
                  No blocks in this state. Add blocks below.
                </div>
              )}

              {/* Add Child Block Menu */}
              <div className="ml-8">
                <AddChildBlockMenu onAddBlock={onAddChild} />
              </div>
            </div>
          )}

          {/* Watch Block - Conditions and Actions */}
          {block.type === 'watch' && (
            <WatchBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {/* Action Block - Single action */}
          {block.type === 'action' && (
            <ActionBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {/* Audio Block - Play audio cue */}
          {block.type === 'audio' && (
            <AudioBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {/* Check Block - Conditions and branches */}
          {block.type === 'check' && (
            <CheckBlockEditor
              block={block}
              availableDevices={availableDevices}
              allBlocks={allBlocks}
              onUpdate={onUpdate}
            />
          )}

          {/* Set Variable Block */}
          {block.type === 'set_variable' && (
            <SetVariableBlockEditor
              block={block}
              availableDevices={availableDevices}
              puzzleVariables={puzzleVariables}
              onUpdate={onUpdate}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Child Block Component (draggable for reordering)
interface ChildBlockComponentProps {
  block: TimelineBlock;
  index: number;
  parentId: string;
  availableDevices: Device[];
  puzzleVariables: PuzzleVariable[];
  allBlocks: TimelineBlock[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
  onDelete: () => void;
  onTestBlock: (block: TimelineBlock) => void;
  testingBlockId: string | null;
  onSave: () => Promise<void>;
  saving: boolean;
  onDragStart: (e: React.DragEvent, block: TimelineBlock, parentId: string, index: number) => void;
  onDragOver: (e: React.DragEvent, parentId: string, index: number) => void;
  onDrop: (e: React.DragEvent, parentId: string, index: number) => void;
  onDragEnd: () => void;
}

function ChildBlockComponent({
  block,
  index,
  parentId,
  availableDevices,
  puzzleVariables,
  allBlocks,
  onUpdate,
  onDelete,
  onTestBlock,
  testingBlockId,
  onSave,
  saving,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: ChildBlockComponentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = getBlockIcon(block.type);
  const colorClass = getBlockColor(block.type);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, block, parentId, index)}
      onDragOver={(e) => onDragOver(e, parentId, index)}
      onDrop={(e) => onDrop(e, parentId, index)}
      onDragEnd={onDragEnd}
      className={`bg-gray-800/50 rounded-lg border ${colorClass} cursor-move transition-all hover:border-opacity-50`}
    >
      <div className="flex items-center gap-3 p-3">
        <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <Icon className="w-4 h-4 text-cyan-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={block.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full bg-transparent text-white text-sm font-medium focus:outline-none focus:bg-gray-700 rounded px-2 py-1"
          />

          {/* Show summary when collapsed */}
          {!isExpanded && (
            <>
              {/* Watch block summary */}
              {block.type === 'watch' && (block.watchConditions?.conditions.length || 0) > 0 && (
                <div className="mt-1 text-xs text-gray-500 truncate">
                  {block.watchConditions?.conditions.map((cond, idx) => {
                    const device = availableDevices.find(d => d.device_id === cond.deviceId);
                    const deviceName = device?.friendly_name || cond.deviceId;
                    const valueDisplay = Array.isArray(cond.value) ? cond.value.join(' & ') : cond.value;

                    return (
                      <span key={idx}>
                        {idx > 0 && <span className="text-gray-600"> {block.watchConditions?.logic} </span>}
                        When <span className="text-cyan-400">{deviceName}</span>
                        {cond.sensorName && <span className="text-cyan-400">.{cond.sensorName}</span>}
                        {' '}{cond.operator}{' '}
                        <span className="text-yellow-400">{valueDisplay}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Check block summary */}
              {block.type === 'check' && (block.checkConditions?.conditions.length || 0) > 0 && (
                <div className="mt-1 text-xs text-gray-500 truncate">
                  {block.checkConditions?.conditions.map((cond, idx) => {
                    const device = availableDevices.find(d => d.device_id === cond.deviceId);
                    const deviceName = device?.friendly_name || cond.deviceId;
                    const valueDisplay = Array.isArray(cond.value) ? cond.value.join(' & ') : cond.value;

                    return (
                      <span key={idx}>
                        {idx > 0 && <span className="text-gray-600"> {block.checkConditions?.logic} </span>}
                        If <span className="text-cyan-400">{deviceName}</span>
                        {cond.sensorName && <span className="text-cyan-400">.{cond.sensorName}</span>}
                        {' '}{cond.operator}{' '}
                        <span className="text-yellow-400">{valueDisplay}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Action block summary */}
              {block.type === 'action' && block.action?.target && (() => {
                // Parse target format: deviceId/commandName
                const [deviceId, commandName] = block.action.target.split('/');

                // Find the device
                const device = availableDevices.find(d => d.device_id === deviceId);

                // Look for the friendly name in device capabilities
                let displayName = block.action.target; // fallback to raw target

                if (device && commandName) {
                  const commands = device.capabilities?.commands || [];

                  // Find the command with matching name
                  const command = commands.find((cmd: any) => {
                    const cmdName = cmd.name || cmd.command_name || cmd;
                    return cmdName === commandName;
                  });

                  if (command && (command.friendly_name || command.display_name)) {
                    displayName = command.friendly_name || command.display_name;
                  } else {
                    // Fallback: show device name + command name
                    displayName = `${device.friendly_name || deviceId} - ${commandName}`;
                  }
                }

                return (
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    Execute: <span className="text-cyan-400">{displayName}</span>
                    {block.action.delayMs! > 0 && <span className="text-gray-600"> (wait {block.action.delayMs}ms)</span>}
                  </div>
                );
              })()}

              {/* Audio block summary */}
              {block.type === 'audio' && block.audioCue && (() => {
                // Find the audio device
                const device = availableDevices.find(d => d.device_id === block.audioDevice);
                let displayName = block.audioCue; // fallback to cue ID

                if (device) {
                  const commands = device.capabilities?.commands || [];

                  // Find the command with matching name
                  const command = commands.find((cmd: any) => {
                    const cmdName = cmd.name || cmd.command_name || cmd;
                    return cmdName === block.audioCue;
                  });

                  if (command && (command.friendly_name || command.display_name)) {
                    displayName = command.friendly_name || command.display_name;
                  } else if (device.friendly_name) {
                    // Fallback: show device name + cue
                    displayName = `${device.friendly_name} - ${block.audioCue}`;
                  }
                }

                return (
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    Play: <span className="text-green-400">{displayName}</span>
                  </div>
                );
              })()}

              {/* Set Variable block summary */}
              {block.type === 'set_variable' && block.variableName && (
                <div className="mt-1 text-xs text-gray-500 truncate">
                  Set <span className="text-purple-400">{block.variableName}</span>
                  {' = '}
                  <span className="text-yellow-400">{block.variableValue || '(not set)'}</span>
                </div>
              )}
            </>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {(block.type === 'action' || block.type === 'audio') && (
          <button
            onClick={() => onTestBlock(block)}
            disabled={testingBlockId === block.id}
            className="text-emerald-400 hover:text-emerald-300 disabled:text-gray-600 transition-colors"
            title="Run this block"
          >
            <Play className="w-4 h-4" />
          </button>
        )}

        {isExpanded && (
          <button
            onClick={async () => {
              await onSave();
              setIsExpanded(false);
            }}
            disabled={saving}
            className="text-cyan-400 hover:text-cyan-300 disabled:text-gray-600 transition-colors flex items-center gap-1"
            title="Save and collapse"
          >
            <Save className="w-4 h-4" />
            {saving && <span className="text-xs">Saving...</span>}
          </button>
        )}

        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-700 p-3 space-y-3">
          {block.type === 'watch' && (
            <WatchBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {block.type === 'action' && (
            <ActionBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {block.type === 'audio' && (
            <AudioBlockEditor
              block={block}
              availableDevices={availableDevices}
              onUpdate={onUpdate}
            />
          )}

          {block.type === 'check' && (
            <CheckBlockEditor
              block={block}
              availableDevices={availableDevices}
              allBlocks={allBlocks}
              onUpdate={onUpdate}
            />
          )}

          {block.type === 'set_variable' && (
            <SetVariableBlockEditor
              block={block}
              availableDevices={availableDevices}
              puzzleVariables={puzzleVariables}
              onUpdate={onUpdate}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Watch Block Editor
function WatchBlockEditor({
  block,
  availableDevices,
  onUpdate
}: {
  block: TimelineBlock;
  availableDevices: Device[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
}) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const addCondition = () => {
    const newCondition: TimelineCondition = {
      deviceId: '',
      sensorName: '',
      field: 'value',
      operator: '==',
      value: ''
    };

    onUpdate({
      watchConditions: {
        logic: block.watchConditions?.logic || 'AND',
        conditions: [...(block.watchConditions?.conditions || []), newCondition]
      }
    });
  };

  const updateCondition = (index: number, updates: Partial<TimelineCondition>) => {
    const newConditions = [...(block.watchConditions?.conditions || [])];
    newConditions[index] = { ...newConditions[index], ...updates };

    onUpdate({
      watchConditions: {
        logic: block.watchConditions?.logic || 'AND',
        conditions: newConditions
      }
    });
  };

  const deleteCondition = (index: number) => {
    onUpdate({
      watchConditions: {
        logic: block.watchConditions?.logic || 'AND',
        conditions: (block.watchConditions?.conditions || []).filter((_, i) => i !== index)
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        <strong>Sensor Watch:</strong> Wait for conditions to be met, then continue to next block
      </div>

      {/* Logic Operator */}
      {(block.watchConditions?.conditions.length || 0) > 1 && (
        <div>
          <label className="block text-xs text-gray-400 mb-2">Logic</label>
          <select
            value={block.watchConditions?.logic || 'AND'}
            onChange={(e) => onUpdate({
              watchConditions: {
                ...block.watchConditions!,
                logic: e.target.value as 'AND' | 'OR'
              }
            })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="AND">All conditions must be true (AND)</option>
            <option value="OR">Any condition can be true (OR)</option>
          </select>
        </div>
      )}

      {/* Conditions */}
      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-blue-400">CONDITIONS TO WATCH</div>
          <button
            onClick={addCondition}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Condition
          </button>
        </div>

        {(!block.watchConditions?.conditions || block.watchConditions.conditions.length === 0) ? (
          <div className="text-center py-4 text-gray-500 text-xs">
            No conditions defined. Add a condition to start monitoring.
          </div>
        ) : (
          <div className="space-y-3">
            {block.watchConditions.conditions.map((condition, index) => (
              <ConditionEditor
                key={index}
                condition={condition}
                availableDevices={availableDevices}
                onChange={(updates) => updateCondition(index, updates)}
                onDelete={() => deleteCondition(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info message */}
      <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/20">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-cyan-400">
            <strong>Note:</strong> When all conditions are met, the puzzle will automatically continue to the next block in the timeline.
          </div>
        </div>
      </div>
    </div>
  );
}

// Action Block Editor (Single action)
function ActionBlockEditor({
  block,
  availableDevices,
  onUpdate
}: {
  block: TimelineBlock;
  availableDevices: Device[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
}) {
  if (!block.action) {
    onUpdate({
      action: { type: 'mqtt.publish', target: '', payload: {}, delayMs: 0 }
    });
    return null;
  }

  return (
    <div className="space-y-3">
      <ActionEditor
        action={block.action}
        availableDevices={availableDevices}
        onChange={(updates) => onUpdate({ action: { ...block.action!, ...updates } })}
        onDelete={undefined}
      />
    </div>
  );
}

// Audio Block Editor
function AudioBlockEditor({
  block,
  availableDevices,
  onUpdate
}: {
  block: TimelineBlock;
  availableDevices: Device[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
}) {
  const [selectedDevice, setSelectedDevice] = useState(block.audioDevice || '');
  const [selectedCue, setSelectedCue] = useState(block.audioCue || '');

  // Filter to audio devices
  const audioDevices = availableDevices.filter(d =>
    d.device_type === 'audio_playback' || d.device_category === 'media_playback'
  );

  const device = audioDevices.find(d => d.device_id === selectedDevice);
  const commands = device?.capabilities?.commands || [];

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    setSelectedCue('');
    onUpdate({ audioDevice: deviceId, audioCue: '' });
  };

  const handleCueChange = (cue: string) => {
    setSelectedCue(cue);
    onUpdate({ audioCue: cue });
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Audio Device</label>
          <select
            value={selectedDevice}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
          >
            <option value="">Select device...</option>
            {audioDevices.map((dev) => (
              <option key={dev.id} value={dev.device_id}>
                {dev.friendly_name || dev.device_id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Audio Cue</label>
          <select
            value={selectedCue}
            onChange={(e) => handleCueChange(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
            disabled={!selectedDevice}
          >
            <option value="">Select cue...</option>
            {commands.map((cmd: any, idx: number) => (
              <option key={idx} value={cmd.name}>
                {cmd.friendly_name || cmd.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// Check Block Editor
function CheckBlockEditor({
  block,
  availableDevices,
  allBlocks,
  onUpdate
}: {
  block: TimelineBlock;
  availableDevices: Device[];
  allBlocks: TimelineBlock[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
}) {
  const addCondition = () => {
    const newCondition: TimelineCondition = {
      deviceId: '',
      sensorName: '',
      field: 'value',
      operator: '==',
      value: ''
    };

    onUpdate({
      checkConditions: {
        logic: block.checkConditions?.logic || 'AND',
        conditions: [...(block.checkConditions?.conditions || []), newCondition]
      }
    });
  };

  const updateCondition = (index: number, updates: Partial<TimelineCondition>) => {
    const newConditions = [...(block.checkConditions?.conditions || [])];
    newConditions[index] = { ...newConditions[index], ...updates };

    onUpdate({
      checkConditions: {
        logic: block.checkConditions?.logic || 'AND',
        conditions: newConditions
      }
    });
  };

  const deleteCondition = (index: number) => {
    onUpdate({
      checkConditions: {
        logic: block.checkConditions?.logic || 'AND',
        conditions: (block.checkConditions?.conditions || []).filter((_, i) => i !== index)
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Logic Operator */}
      {(block.checkConditions?.conditions.length || 0) > 1 && (
        <div>
          <label className="block text-xs text-gray-400 mb-2">Logic</label>
          <select
            value={block.checkConditions?.logic || 'AND'}
            onChange={(e) => onUpdate({
              checkConditions: {
                ...block.checkConditions!,
                logic: e.target.value as 'AND' | 'OR'
              }
            })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="AND">All conditions must be true (AND)</option>
            <option value="OR">Any condition can be true (OR)</option>
          </select>
        </div>
      )}

      {/* Conditions */}
      <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-orange-400">CONDITIONS TO CHECK</div>
          <button
            onClick={addCondition}
            className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add Condition
          </button>
        </div>

        {(!block.checkConditions?.conditions || block.checkConditions.conditions.length === 0) ? (
          <div className="text-center py-4 text-gray-500 text-xs">
            No conditions defined. Add a condition to check.
          </div>
        ) : (
          <div className="space-y-3">
            {block.checkConditions.conditions.map((condition, index) => (
              <ConditionEditor
                key={index}
                condition={condition}
                availableDevices={availableDevices}
                onChange={(updates) => updateCondition(index, updates)}
                onDelete={() => deleteCondition(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Branches */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-2">If TRUE, jump to:</label>
          <select
            value={block.onTrue || ''}
            onChange={(e) => onUpdate({ onTrue: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-white"
          >
            <option value="">Continue to next block</option>
            {allBlocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">If FALSE, jump to:</label>
          <select
            value={block.onFalse || ''}
            onChange={(e) => onUpdate({ onFalse: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-white"
          >
            <option value="">Continue to next block</option>
            {allBlocks.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// Set Variable Block Editor
function SetVariableBlockEditor({
  block,
  availableDevices,
  puzzleVariables,
  onUpdate
}: {
  block: TimelineBlock;
  availableDevices: Device[];
  puzzleVariables: PuzzleVariable[];
  onUpdate: (updates: Partial<TimelineBlock>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-2">Variable</label>
        <select
          value={block.variableName || ''}
          onChange={(e) => onUpdate({ variableName: e.target.value })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
        >
          <option value="">Select variable...</option>
          {puzzleVariables.map(v => (
            <option key={v.name} value={v.name}>${v.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Source</label>
        <select
          value={block.variableSource || 'static'}
          onChange={(e) => onUpdate({ variableSource: e.target.value as any })}
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
        >
          <option value="static">Static Value</option>
          <option value="sensor">From Sensor</option>
          <option value="calculation">Calculation</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-2">Value</label>
        <input
          type="text"
          value={block.variableValue || ''}
          onChange={(e) => onUpdate({ variableValue: e.target.value })}
          placeholder="Enter value or expression"
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
        />
      </div>
    </div>
  );
}

// Add Block Menu
function AddBlockMenu({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const blockTypes: { type: BlockType; label: string; icon: any }[] = [
    { type: 'state', label: 'State', icon: Square },
    { type: 'watch', label: 'Sensor Watch', icon: Eye },
    { type: 'action', label: 'Action', icon: Zap },
    { type: 'audio', label: 'Play Audio', icon: Music },
    { type: 'check', label: 'Check Condition', icon: GitBranch },
    { type: 'set_variable', label: 'Set Variable', icon: Database },
    { type: 'solve', label: 'Solve Puzzle', icon: CheckCircle },
    { type: 'fail', label: 'Fail Puzzle', icon: AlertCircle },
    { type: 'reset', label: 'Reset Puzzle', icon: Activity },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full px-4 py-3 bg-gray-800/50 hover:bg-gray-800 border-2 border-dashed border-gray-700 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-cyan-400"
      >
        <Plus className="w-5 h-5" />
        Add Block
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 p-2 grid grid-cols-2 gap-2">
          {blockTypes.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => {
                onAddBlock(type);
                setShowMenu(false);
              }}
              className={`px-3 py-2 rounded-lg border ${getBlockColor(type)} hover:opacity-80 transition-opacity flex items-center gap-2 text-sm`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Add Child Block Menu
function AddChildBlockMenu({ onAddBlock }: { onAddBlock: (type: BlockType) => void }) {
  const [showMenu, setShowMenu] = useState(false);

  const blockTypes: { type: BlockType; label: string; icon: any }[] = [
    { type: 'watch', label: 'Sensor Watch', icon: Eye },
    { type: 'action', label: 'Action', icon: Zap },
    { type: 'audio', label: 'Play Audio', icon: Music },
    { type: 'check', label: 'Check Condition', icon: GitBranch },
    { type: 'set_variable', label: 'Set Variable', icon: Database },
  ];

  return (
    <div className="relative z-[60]">
      <button
        onClick={() => {
          console.log('🟢 Add Block to State button clicked, showMenu:', !showMenu);
          setShowMenu(!showMenu);
        }}
        className="w-full px-3 py-2 bg-gray-800/30 hover:bg-gray-800/50 border border-dashed border-gray-700 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 text-gray-500 hover:text-cyan-400 text-sm"
      >
        <Plus className="w-4 h-4" />
        Add Block to State
      </button>

      {showMenu && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[70] p-2 grid grid-cols-2 gap-2">
          {blockTypes.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => {
                console.log('🟢 Block type selected:', type);
                onAddBlock(type);
                setShowMenu(false);
              }}
              className={`px-3 py-2 rounded-lg border ${getBlockColor(type)} hover:opacity-80 transition-opacity flex items-center gap-2 text-sm`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Condition Editor Component
function ConditionEditor({
  condition,
  availableDevices,
  onChange,
  onDelete
}: {
  condition: TimelineCondition;
  availableDevices: Device[];
  onChange: (updates: Partial<TimelineCondition>) => void;
  onDelete: () => void;
}) {
  const [liveSensorValue, setLiveSensorValue] = useState<any>(null);

  // Filter devices to only show sensors (input devices or bidirectional)
  const sensorDevices = availableDevices.filter(d =>
    d.device_category === 'sensor' ||
    d.device_category === 'input' ||  // Teensy controllers register sensors as 'input'
    d.device_category === 'bidirectional' ||
    (d.capabilities && typeof d.capabilities === 'object' && 'sensors' in d.capabilities)
  );

  // Get selected device (the sensor itself)
  const selectedDevice = sensorDevices.find(d => d.device_id === condition.deviceId);

  // Get sensor output values from device capabilities
  // Some sensors output multiple values (e.g., color_temp AND lux)
  const sensorOutputs = selectedDevice?.capabilities?.sensors || [];
  const hasMultipleOutputs = sensorOutputs.length > 1;

  // TODO: Subscribe to MQTT sensor values for live updates
  // For now, we'll show a placeholder

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-3">
          {/* Sensor Device Selection */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sensor</label>
            <select
              value={condition.deviceId}
              onChange={(e) => onChange({ deviceId: e.target.value, sensorName: '' })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
            >
              <option value="">Select sensor...</option>
              {sensorDevices.map((device) => (
                <option key={device.id} value={device.device_id}>
                  {device.friendly_name || device.device_id}
                </option>
              ))}
            </select>
            {liveSensorValue !== null && (
              <div className="mt-1 text-xs text-green-400">
                Live value: <span className="font-mono font-bold">{liveSensorValue}</span>
              </div>
            )}
          </div>

          {/* Value selector - only show if sensor outputs multiple values */}
          {condition.deviceId && hasMultipleOutputs && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Value Type</label>
              <select
                value={condition.sensorName}
                onChange={(e) => onChange({ sensorName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="">Select value type...</option>
                {sensorOutputs.map((sensor: any, idx: number) => (
                  <option key={idx} value={sensor.name || sensor}>
                    {sensor.name || sensor}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Operator and Value */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Operator</label>
              <select
                value={condition.operator}
                onChange={(e) => onChange({ operator: e.target.value as ConditionOperator })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="==">=</option>
                <option value="!=">≠</option>
                <option value=">">{'>'}</option>
                <option value="<">{'<'}</option>
                <option value=">=">{'>='}</option>
                <option value="<=">{'<='}</option>
                <option value="between">Between</option>
                <option value="in">In</option>
              </select>
            </div>

            {condition.operator === 'between' ? (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Min</label>
                  <input
                    type="text"
                    value={Array.isArray(condition.value) ? condition.value[0] || '' : ''}
                    onChange={(e) => {
                      const currentValue = Array.isArray(condition.value) ? condition.value : ['', ''];
                      onChange({ value: [e.target.value, currentValue[1] || ''] });
                    }}
                    placeholder="1600"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max</label>
                  <input
                    type="text"
                    value={Array.isArray(condition.value) ? condition.value[1] || '' : ''}
                    onChange={(e) => {
                      const currentValue = Array.isArray(condition.value) ? condition.value : ['', ''];
                      onChange({ value: [currentValue[0] || '', e.target.value] });
                    }}
                    placeholder="1800"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">Value</label>
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => onChange({ value: e.target.value })}
                    placeholder={condition.operator === 'in' ? 'val1, val2, val3' : '100'}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
              </>
            )}
          </div>

          {/* Tolerance (optional) */}
          {condition.operator !== 'between' && condition.operator !== 'in' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tolerance (±) Optional</label>
              <input
                type="number"
                value={condition.tolerance || ''}
                onChange={(e) => onChange({ tolerance: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="5"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
              />
            </div>
          )}

          {/* Condition Summary */}
          {condition.deviceId && (
            <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
              When <span className="text-cyan-400 font-mono">
                {condition.deviceId}
                {condition.sensorName && `.${condition.sensorName}`}
              </span>
              {' '}{condition.operator}{' '}
              <span className="text-yellow-400">
                {Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
              </span>
              {condition.tolerance && <span> (±{condition.tolerance})</span>}
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 mt-6"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Action Editor Component
function ActionEditor({
  action,
  availableDevices,
  onChange,
  onDelete
}: {
  action: TimelineAction;
  availableDevices: Device[];
  onChange: (updates: Partial<TimelineAction>) => void;
  onDelete?: () => void;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedCommandName, setSelectedCommandName] = useState<string>('');

  // Filter to output devices only (devices that can receive commands)
  const outputDevices = availableDevices.filter(d =>
    d.device_category === 'output' ||
    d.device_category === 'bidirectional' ||
    (d.capabilities && typeof d.capabilities === 'object' && 'commands' in d.capabilities)
  );

  // Get selected device object
  const selectedDevice = outputDevices.find(d => d.device_id === selectedDeviceId);

  // Get commands from device (could be in capabilities.commands or device_commands)
  const deviceCommands = selectedDevice?.capabilities?.commands || [];

  // Handle device selection
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setSelectedCommandName('');
    // Clear target when device changes
    onChange({ target: '' });
  };

  // Handle command selection and build MQTT topic
  const handleCommandChange = (commandName: string) => {
    setSelectedCommandName(commandName);

    if (selectedDeviceId && commandName) {
      // Build MQTT topic from database data
      // The topic will be built by the backend using room_id/controller_id/device_id
      // For now, store the command reference
      const topic = `${selectedDeviceId}/${commandName}`;
      onChange({ target: topic });
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          {/* Device Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Device</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="">Select device...</option>
                {outputDevices.map((device) => (
                  <option key={device.id} value={device.device_id}>
                    {device.friendly_name || device.device_id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Command</label>
              <select
                value={selectedCommandName}
                onChange={(e) => handleCommandChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
                disabled={!selectedDeviceId}
              >
                <option value="">Select command...</option>
                {deviceCommands.length > 0 ? (
                  deviceCommands.map((cmd: any, idx: number) => (
                    <option key={idx} value={cmd.name || cmd.command_name || cmd}>
                      {cmd.friendly_name || cmd.name || cmd.command_name || cmd}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No commands registered for this device</option>
                )}
              </select>
            </div>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Delay After (ms)</label>
            <input
              type="number"
              value={action.delayMs || 0}
              onChange={(e) => onChange({ delayMs: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
            />
          </div>

          {/* Action Summary */}
          {selectedDeviceId && selectedCommandName && (
            <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
              Execute: <span className="text-cyan-400 font-mono">
                {selectedDevice?.friendly_name || selectedDeviceId}.{selectedCommandName}
              </span>
              {action.delayMs! > 0 && <span> (wait {action.delayMs}ms after)</span>}
            </div>
          )}
        </div>

        {onDelete && (
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 mt-6"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Helper functions (need to be defined outside component)
function getBlockIcon(type: BlockType) {
  const icons: Record<BlockType, any> = {
    state: Square,
    watch: Eye,
    action: Zap,
    audio: Music,
    check: GitBranch,
    set_variable: Database,
    solve: CheckCircle,
    fail: AlertCircle,
    reset: Activity
  };
  return icons[type];
}

function getBlockColor(type: BlockType): string {
  const colors: Record<BlockType, string> = {
    state: 'border-purple-500/30 bg-purple-500/10',
    watch: 'border-blue-500/30 bg-blue-500/10',
    action: 'border-yellow-500/30 bg-yellow-500/10',
    audio: 'border-green-500/30 bg-green-500/10',
    check: 'border-orange-500/30 bg-orange-500/10',
    set_variable: 'border-cyan-500/30 bg-cyan-500/10',
    solve: 'border-green-600/30 bg-green-600/10',
    fail: 'border-red-500/30 bg-red-500/10',
    reset: 'border-gray-500/30 bg-gray-500/10'
  };
  return colors[type];
}
