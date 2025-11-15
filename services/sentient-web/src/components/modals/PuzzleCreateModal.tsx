import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { puzzles, rooms, type Room } from '../../lib/api';

interface PuzzleCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedRoomId?: string;
}

export default function PuzzleCreateModal({
  isOpen,
  onClose,
  preselectedRoomId,
}: PuzzleCreateModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Form state
  const [roomId, setRoomId] = useState(preselectedRoomId || '');
  const [puzzleName, setPuzzleName] = useState('');
  const [puzzleId, setPuzzleId] = useState('');
  const [puzzleType, setPuzzleType] = useState('sequence');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');

  // Auto-generate puzzle_id from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '_') // Replace hyphens with underscores
      .replace(/_+/g, '_') // Remove duplicate underscores
      .replace(/^_|_$/g, ''); // Trim underscores from start/end
  };

  useEffect(() => {
    if (isOpen) {
      loadRooms();
      if (preselectedRoomId) {
        setRoomId(preselectedRoomId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedRoomId]);

  useEffect(() => {
    // Auto-generate puzzle_id from name
    if (puzzleName) {
      setPuzzleId(generateSlug(puzzleName));
    }
  }, [puzzleName]);

  const loadRooms = async () => {
    try {
      setLoadingRooms(true);
      const response = await rooms.getAll();
      setAvailableRooms(response.rooms || []);

      // Auto-select first room if none selected
      if (!roomId && response.rooms?.length > 0) {
        setRoomId(response.rooms[0].id);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!roomId) {
      toast.error('Please select a room');
      return;
    }
    if (!puzzleName.trim()) {
      toast.error('Please enter a puzzle name');
      return;
    }
    if (!puzzleId.trim()) {
      toast.error('Please enter a puzzle ID');
      return;
    }

    setLoading(true);

    try {
      // Create initial puzzle config with basic structure
      const initialConfig = {
        name: puzzleName,
        version: '2.0',
        timeline: [
          {
            id: 'on_start',
            type: 'state',
            name: 'ON START',
            description: 'Actions when puzzle begins',
            childBlocks: [],
          },
        ],
        variables: [],
      };

      const newPuzzle = await puzzles.create({
        room_id: roomId,
        puzzle_id: puzzleId,
        name: puzzleName,
        puzzle_type: puzzleType,
        difficulty_rating: difficulty
          ? difficulty === 'easy'
            ? 2
            : difficulty === 'medium'
              ? 3
              : 4
          : undefined,
        config: initialConfig,
      });

      toast.success(`Puzzle "${puzzleName}" created successfully!`);

      // Navigate to puzzle editor
      navigate(`/dashboard/puzzles/${newPuzzle.id}`);

      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Failed to create puzzle:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to create puzzle';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPuzzleName('');
    setPuzzleId('');
    setPuzzleType('sequence');
    setDescription('');
    setDifficulty('');
    if (!preselectedRoomId) {
      setRoomId('');
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="card-neural w-full max-w-2xl max-h-[calc(100vh-6rem)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
                <div>
                  <h2 className="text-2xl font-light text-gradient-cyan-magenta">
                    Create New Puzzle
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Create a reusable puzzle that can be added to scenes
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-6">
                {/* Room Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Room <span className="text-red-400">*</span>
                  </label>
                  {loadingRooms ? (
                    <div className="flex items-center gap-2 text-gray-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading rooms...
                    </div>
                  ) : (
                    <select
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      disabled={loading || preselectedRoomId !== undefined}
                      className="input-neural w-full"
                    >
                      <option value="">Select a room...</option>
                      {availableRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Puzzle Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puzzle Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={puzzleName}
                    onChange={(e) => setPuzzleName(e.target.value)}
                    disabled={loading}
                    placeholder="e.g., Pilot Light Puzzle"
                    className="input-neural w-full"
                  />
                </div>

                {/* Puzzle ID (Slug) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puzzle ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={puzzleId}
                    onChange={(e) => setPuzzleId(e.target.value)}
                    disabled={loading}
                    placeholder="e.g., pilot_light_puzzle"
                    className="input-neural w-full font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier (lowercase letters, numbers, underscores)
                  </p>
                </div>

                {/* Puzzle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puzzle Type
                  </label>
                  <select
                    value={puzzleType}
                    onChange={(e) => setPuzzleType(e.target.value)}
                    disabled={loading}
                    className="input-neural w-full"
                  >
                    <option value="sequence">Sequence - Steps in order</option>
                    <option value="logic">Logic - Conditional branching</option>
                    <option value="pattern">Pattern - Match a pattern</option>
                    <option value="physical">Physical - Mechanical interaction</option>
                    <option value="timed">Timed - Time-based challenge</option>
                    <option value="observational">Observational - Find clues</option>
                    <option value="combination">Combination - Multiple types</option>
                  </select>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    disabled={loading}
                    className="input-neural w-full"
                  >
                    <option value="">Not specified</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                    placeholder="Brief description of the puzzle..."
                    rows={3}
                    className="input-neural w-full resize-none"
                  />
                </div>

                {/* Info Box */}
                <div className="flex items-start gap-3 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-cyan-400 mb-1">After creation:</p>
                    <p>
                      You'll be redirected to the Puzzle Editor where you can configure the puzzle's
                      timeline, add sensor watches, actions, audio cues, and set win conditions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-700">
                <button onClick={handleClose} disabled={loading} className="btn-neural">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading || !roomId || !puzzleName.trim() || !puzzleId.trim()}
                  className="btn-neural-primary flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Puzzle'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
