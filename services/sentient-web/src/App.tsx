import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

// Pages that work
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// Migrated pages - ready to test!
import RoomsList from './pages/RoomsList';
import RoomDetail from './pages/RoomDetail';
import ScenesList from './pages/ScenesList';
import TimelineEditor from './pages/TimelineEditor';
import DevicesList from './pages/DevicesList';
import DeviceDetail from './pages/DeviceDetail';
import ControllersList from './pages/ControllersList';
import ControllerDetail from './pages/ControllerDetail';
import PowerControl from './pages/PowerControl';
import Profile from './pages/Profile';
import UsersList from './pages/UsersList';
import ClientsList from './pages/ClientsList';
import TouchscreenLighting from './pages/TouchscreenLighting';
import PuzzlesList from './pages/PuzzlesList';
import PuzzleEditor from './pages/PuzzleEditor';

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
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(10, 10, 10, 0.95)',
            color: '#fff',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
          },
          success: {
            iconTheme: {
              primary: '#00ff00',
              secondary: '#000',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff0000',
              secondary: '#000',
            },
          },
        }}
      />

      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Touchscreen Interface - No auth required for immediate access */}
        <Route path="/touchscreen" element={<TouchscreenLighting />} />

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
          path="/dashboard/rooms/:roomId/scenes/:sceneId"
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
        <Route
          path="/dashboard/rooms/:roomId/devices/:deviceId"
          element={
            <ProtectedRoute>
              <DeviceDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/controllers"
          element={
            <ProtectedRoute>
              <ControllersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/controllers/:controllerId"
          element={
            <ProtectedRoute>
              <ControllerDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/controllers"
          element={
            <ProtectedRoute>
              <ControllersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/power-control"
          element={
            <ProtectedRoute>
              <PowerControl />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/users"
          element={
            <ProtectedRoute>
              <UsersList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/clients"
          element={
            <ProtectedRoute>
              <ClientsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/puzzles"
          element={
            <ProtectedRoute>
              <PuzzlesList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/puzzles/:puzzleId"
          element={
            <ProtectedRoute>
              <PuzzleEditor />
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
