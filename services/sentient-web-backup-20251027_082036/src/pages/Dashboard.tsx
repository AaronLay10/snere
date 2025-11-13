import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rooms, type Room } from '../lib/api';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function Dashboard() {
  const navigate = useNavigate();
  const [roomList, setRoomList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch rooms
    const fetchRooms = async () => {
      try {
        const response = await rooms.getAll();
        setRoomList(response.rooms || []);
      } catch (error) {
        console.error('[Dashboard] Error fetching rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  return (
    <DashboardLayout>
      {/* Welcome Section */}
      <div className="mb-8 animate-slide-up">
        <h2 className="text-3xl font-bold mb-2">
          Welcome back
        </h2>
        <p className="text-gray-400">Manage your escape room experiences from this neural control center</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
        <div className="card-neural group cursor-pointer" onClick={() => navigate('/dashboard/rooms')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Total Rooms</p>
              <p className="text-3xl font-bold text-neural-glow">{roomList.length}</p>
            </div>
            <div className="w-12 h-12 bg-neural-primary-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-neural-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-neural group cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Active Sessions</p>
              <p className="text-3xl font-bold text-neural-success-500">0</p>
            </div>
            <div className="w-12 h-12 bg-neural-success-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-neural-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-neural group cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">System Status</p>
              <p className="text-3xl font-bold text-neural-success-500">Online</p>
            </div>
            <div className="w-12 h-12 bg-neural-success-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <div className="relative">
                <div className="w-3 h-3 bg-neural-success-500 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-neural-success-500 rounded-full animate-ping opacity-75" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 className="text-xl font-bold mb-4 text-gray-300">Your Rooms</h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-neural-primary-500/30 border-t-neural-primary-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading neural data...</p>
            </div>
          </div>
        ) : roomList.length === 0 ? (
          <div className="card-neural text-center py-12">
            <p className="text-gray-400">No rooms found. Create your first escape room experience!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomList.map((room, index) => (
              <div
                key={room.id}
                className="card-neural group cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/dashboard/rooms/${room.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-100 mb-1 group-hover:text-neural-primary-500 transition-colors">
                      {room.name}
                    </h4>
                    <p className="text-sm text-gray-400">{room.description || 'No description'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    room.status === 'active' ? 'bg-neural-success-500/20 text-neural-success-500' :
                    room.status === 'testing' ? 'bg-neural-warning-500/20 text-neural-warning-500' :
                    'bg-neural-border text-gray-400'
                  }`}>
                    {room.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>{room.scene_count || 0} scenes</span>
                    <span>{room.device_count || 0} devices</span>
                  </div>
                  <svg className="w-5 h-5 text-neural-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
