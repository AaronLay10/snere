import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

// Pages that work
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Migrated pages - ready to test!
import RoomsList from './pages/RoomsList';
import RoomDetail from './pages/RoomDetail';
import ScenesList from './pages/ScenesList';
import TimelineEditor from './pages/TimelineEditor';
import DevicesList from './pages/DevicesList';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('sentient_auth_token');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('sentient_auth_token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neural-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-neural-primary-500/30 border-t-neural-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Initializing Neural Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes - Working */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* All migrated routes */}
        <Route
          path="/dashboard/rooms"
          element={
            <ProtectedRoute>
              <RoomsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/rooms/:roomId"
          element={
            <ProtectedRoute>
              <RoomDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/rooms/:roomId/scenes"
          element={
            <ProtectedRoute>
              <ScenesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/rooms/:roomId/scenes/:sceneId/timeline"
          element={
            <ProtectedRoute>
              <TimelineEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/devices"
          element={
            <ProtectedRoute>
              <DevicesList />
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
