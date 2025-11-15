import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, puzzles, type Room, type Puzzle } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';
import PuzzleCreateModal from '../components/modals/PuzzleCreateModal';
import { motion } from 'framer-motion';
import {
  Puzzle as PuzzleIcon,
  Plus,
  Edit,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PuzzlesList() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [puzzlesByRoom, setPuzzlesByRoom] = useState<Record<string, Puzzle[]>>({});
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPuzzles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.client_id]);

  const loadPuzzles = async () => {
    try {
      setLoading(true);

      // Load all rooms
      const roomsData = await rooms.getAll({ client_id: user?.client_id });
      const roomsArray = roomsData.rooms || [];
      setRoomsList(roomsArray);

      // Load puzzles for each room
      const puzzleMap: Record<string, Puzzle[]> = {};

      for (const room of roomsArray) {
        try {
          const puzzlesData = await puzzles.getAll({ room_id: room.id });
          const puzzlesArray = puzzlesData.puzzles || [];

          if (puzzlesArray.length > 0) {
            puzzleMap[room.id] = puzzlesArray;
          }
        } catch (err) {
          console.error(`Failed to load puzzles for room ${room.id}:`, err);
        }
      }

      setPuzzlesByRoom(puzzleMap);
    } catch (error) {
      console.error('Failed to load puzzles:', error);
      toast.error('Failed to load puzzles');
    } finally {
      setLoading(false);
    }
  };

  // Get puzzles for display based on selected room
  const getDisplayPuzzles = () => {
    if (selectedRoom === 'all') {
      // Return all puzzles from all rooms
      return Object.entries(puzzlesByRoom).flatMap(([roomId, puzzles]) =>
        puzzles.map((puzzle) => ({ ...puzzle, roomId }))
      );
    } else {
      // Return puzzles for selected room
      return (puzzlesByRoom[selectedRoom] || []).map((puzzle) => ({
        ...puzzle,
        roomId: selectedRoom,
      }));
    }
  };

  const displayPuzzles = getDisplayPuzzles();
  const totalPuzzles = Object.values(puzzlesByRoom).reduce(
    (sum, puzzles) => sum + puzzles.length,
    0
  );

  // Get room name by ID
  const getRoomName = (roomId: string) => {
    const room = roomsList.find((r) => r.id === roomId);
    return room?.name || 'Unknown Room';
  };

  // Get puzzle status info
  const getPuzzleStatusInfo = (puzzle: Puzzle) => {
    const config = puzzle.config || {};
    const timeline = config.timeline || [];
    const variables = config.variables || [];

    const hasTimeline = timeline.length > 0;
    const hasVariables = variables.length > 0;
    const hasWinCondition =
      puzzle.solve_conditions || timeline.some((block: any) => block.type === 'solve');

    return {
      hasTimeline,
      hasVariables,
      hasWinCondition,
      blockCount: timeline.length,
      variableCount: variables.length,
      configured: hasTimeline && hasWinCondition,
    };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading puzzles...</p>
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
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">Puzzle Library</h1>
            <p className="text-gray-500">
              Create and manage reusable puzzles for your escape rooms
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-neural-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create New Puzzle
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-neural"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <PuzzleIcon className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Puzzles</p>
                <p className="text-2xl font-bold text-white">{totalPuzzles}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card-neural"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Target className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Rooms</p>
                <p className="text-2xl font-bold text-white">{Object.keys(puzzlesByRoom).length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-neural"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/10">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Configured</p>
                <p className="text-2xl font-bold text-white">
                  {displayPuzzles.filter((p) => getPuzzleStatusInfo(p).configured).length}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card-neural"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Incomplete</p>
                <p className="text-2xl font-bold text-white">
                  {totalPuzzles -
                    displayPuzzles.filter((p) => getPuzzleStatusInfo(p).configured).length}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Room Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Filter by room:</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="input-neural !py-2 min-w-[200px]"
          >
            <option value="all">All Rooms ({totalPuzzles})</option>
            {roomsList.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({puzzlesByRoom[room.id]?.length || 0})
              </option>
            ))}
          </select>
        </div>

        {/* Puzzles List */}
        {displayPuzzles.length === 0 ? (
          <div className="card-neural text-center py-16">
            <div className="max-w-md mx-auto">
              <PuzzleIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No Puzzles Yet</h3>
              <p className="text-gray-500 mb-6">
                Get started by creating your first puzzle. Puzzles can be configured with timelines,
                sensor watches, actions, and win conditions.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-neural-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Your First Puzzle
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {displayPuzzles.map((puzzle, index) => {
              const statusInfo = getPuzzleStatusInfo(puzzle);

              return (
                <motion.div
                  key={puzzle.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-neural group hover:border-cyan-500/40 transition-all cursor-pointer"
                  onClick={() => navigate(`/dashboard/puzzles/${puzzle.id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`p-4 rounded-xl ${statusInfo.configured ? 'bg-green-500/10' : 'bg-purple-500/10'}`}
                    >
                      <PuzzleIcon
                        className={`w-8 h-8 ${statusInfo.configured ? 'text-green-400' : 'text-purple-400'}`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="text-xl font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                            {puzzle.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{getRoomName(puzzle.roomId || puzzle.room_id)}</span>
                            {puzzle.puzzle_type && (
                              <>
                                <span>•</span>
                                <span className="text-cyan-400">{puzzle.puzzle_type}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        {statusInfo.configured ? (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-500/20 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Configured</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Incomplete</span>
                          </div>
                        )}
                      </div>

                      {puzzle.description && (
                        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                          {puzzle.description}
                        </p>
                      )}

                      {/* Puzzle Info */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {statusInfo.blockCount} blocks
                        </span>

                        {statusInfo.variableCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {statusInfo.variableCount} variables
                          </span>
                        )}

                        {statusInfo.hasWinCondition && (
                          <span className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Win condition
                          </span>
                        )}

                        {puzzle.difficulty_rating && (
                          <span className="flex items-center gap-1 text-orange-400">
                            <Target className="w-3 h-3" />
                            {puzzle.difficulty_rating}/5
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/puzzles/${puzzle.id}`);
                        }}
                        className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        title="Edit Puzzle"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Puzzle Modal */}
      <PuzzleCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        preselectedRoomId={selectedRoom !== 'all' ? selectedRoom : undefined}
      />
    </DashboardLayout>
  );
}
