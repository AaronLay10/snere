import { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { puzzles, type Puzzle } from '../../lib/api';
import toast from 'react-hot-toast';

interface PuzzleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  puzzle: Puzzle | null;
  onUpdate?: () => void;
}

export default function PuzzleSettingsModal({ isOpen, onClose, puzzle, onUpdate }: PuzzleSettingsModalProps) {
  const [loading, setLoading] = useState(false);

  // Form state
  const [puzzleName, setPuzzleName] = useState('');
  const [puzzleType, setPuzzleType] = useState('sequence');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('');

  useEffect(() => {
    if (isOpen && puzzle) {
      setPuzzleName(puzzle.name || '');
      setPuzzleType(puzzle.puzzle_type || 'sequence');
      setDescription(puzzle.description || '');

      // Convert difficulty_rating back to string
      const difficultyRating = puzzle.difficulty_rating;
      if (difficultyRating === 2) {
        setDifficulty('easy');
      } else if (difficultyRating === 3) {
        setDifficulty('medium');
      } else if (difficultyRating === 4) {
        setDifficulty('hard');
      } else {
        setDifficulty('');
      }
    }
  }, [isOpen, puzzle]);

  const handleUpdate = async () => {
    if (!puzzle) return;

    // Validation
    if (!puzzleName.trim()) {
      toast.error('Please enter a puzzle name');
      return;
    }

    setLoading(true);

    try {
      await puzzles.update(puzzle.id, {
        name: puzzleName,
        puzzle_type: puzzleType,
        description: description || undefined,
        difficulty_rating: difficulty ? (difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4) : undefined,
      });

      toast.success('Puzzle settings updated successfully!');

      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (error: any) {
      console.error('Failed to update puzzle:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update puzzle';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!puzzle) return null;

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
                    Puzzle Settings
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Update puzzle metadata and configuration
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

                {/* Puzzle ID (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Puzzle ID
                  </label>
                  <input
                    type="text"
                    value={puzzle.puzzle_id}
                    disabled
                    className="input-neural w-full font-mono text-sm bg-gray-800/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Cannot be changed after creation
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Difficulty
                  </label>
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
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-gray-300">
                    <p className="font-medium text-blue-400 mb-1">Note:</p>
                    <p>
                      Changing these settings will not affect the puzzle's timeline or configuration.
                      This only updates the puzzle metadata.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-700">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="btn-neural"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={loading || !puzzleName.trim()}
                  className="btn-neural-primary flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Save Changes'
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
