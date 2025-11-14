import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import packageJson from '../../../package.json';
import {
  LayoutGrid,
  Building2,
  DoorOpen,
  Cpu,
  Puzzle,
  Users,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  Eye,
  Bell,
  Search,
  ChevronDown,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Don't check auth here - App.tsx ProtectedRoute already handles it

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid, roles: ['admin', 'editor', 'viewer', 'technician', 'creative_director'] },
    { name: 'Clients', href: '/dashboard/clients', icon: Building2, roles: ['admin'] },
    { name: 'Rooms', href: '/dashboard/rooms', icon: DoorOpen, roles: ['admin', 'editor', 'viewer', 'technician', 'creative_director'] },
    { name: 'Controllers', href: '/dashboard/controllers', icon: Cpu, roles: ['admin', 'technician'] },
    { name: 'Devices', href: '/dashboard/devices', icon: Cpu, roles: ['admin', 'editor', 'technician'] },
    { name: 'Puzzles', href: '/dashboard/puzzles', icon: Puzzle, roles: ['admin', 'editor', 'creative_director'] },
    { name: 'Users', href: '/dashboard/users', icon: Users, roles: ['admin', 'editor'] },
    { name: 'Audit Logs', href: '/dashboard/audit', icon: FileText, roles: ['admin', 'editor', 'viewer'] },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['admin', 'editor'] },
  ];

  const filteredNavigation = navigation.filter((item) =>
    user?.role ? item.roles.includes(user.role) : false
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/5 via-transparent to-magenta-900/5 animate-gradient-shift" />
        <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent animate-scan-line" />
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed top-0 left-0 h-full w-64 bg-neural-bg backdrop-blur-2xl border-r border-cyan-500/20 z-40 overflow-y-auto"
          >
            {/* Logo */}
            <div className="p-6 border-b border-cyan-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 relative">
                  <NeuralEyeIcon />
                </div>
                <div>
                  <h1 className="text-xl font-light tracking-[0.3em] text-gradient-cyan-magenta">
                    SENTIENT
                  </h1>
                  <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">
                    Neural Engine
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[9px] text-cyan-400/70">
                      UI: v{packageJson.version}
                    </p>
                    <span className="text-[9px] text-gray-600">•</span>
                    <p className="text-[9px] text-green-400/90 font-bold">
                      VITE ⚡
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.href)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400 shadow-neural'
                        : 'text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* User Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/20 bg-black/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-black">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.username || 'User'}</p>
                  <p className="text-xs text-gray-500 uppercase">{user?.role || 'guest'}</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-cyan-500/20">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 pl-10 pr-4 py-2 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/40 focus:bg-cyan-500/10 transition-all"
                />
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Client Badge */}
              {user?.clientName && (
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-cyan-400">{user.clientName}</span>
                </div>
              )}

              {/* Notifications */}
              <button className="relative p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-magenta-500 rounded-full animate-pulse" />
              </button>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-black">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-56 bg-neural-bg backdrop-blur-2xl border border-cyan-500/20 rounded-2xl shadow-neural-strong overflow-hidden"
                    >
                      <div className="p-4 border-b border-cyan-500/20">
                        <p className="text-sm font-medium text-white">{user?.username || 'User'}</p>
                        <p className="text-xs text-gray-500">{user?.email || ''}</p>
                        <div className="mt-2 inline-flex px-2 py-1 bg-cyan-500/20 rounded text-[10px] text-cyan-400 uppercase">
                          {user?.role || 'guest'}
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => navigate('/dashboard/profile')}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          <span className="text-sm">Profile Settings</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Disconnect</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
}

// Mini Neural Eye Icon
function NeuralEyeIcon() {
  return (
    <div className="w-full h-full relative" style={{ width: '40px', height: '40px' }}>
      {/* Neural Network Connection Lines */}
      <div className="absolute w-full h-full">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <div
            key={i}
            className="absolute h-[1px] top-1/2 left-1/2 origin-left"
            style={{
              width: '25px',
              background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(0,255,255,1) 30%, transparent 80%)',
              transform: `translateY(-50%) rotate(${angle}deg)`,
              opacity: 0,
              animation: 'pulse-line 8s infinite',
              animationDelay: `${[0.4, 2.8, 1.2, 4.4, 2.0, 5.6, 3.6, 6.8][i]}s`,
              zIndex: 2
            }}
          />
        ))}
      </div>

      {/* Rotating Rainbow Iris */}
      <div
        className="absolute rounded-full"
        style={{
          width: '40px',
          height: '40px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #00ff00, #ff00ff)',
          animation: 'rotate 6s linear infinite',
          filter: 'brightness(1.2)',
          zIndex: 1
        }}
      >
        {/* Inner dark circle */}
        <div
          className="absolute rounded-full"
          style={{
            width: '36px',
            height: '36px',
            top: '2px',
            left: '2px',
            background: 'linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)'
          }}
        />
      </div>

      {/* Cyan Pulsing Pupil */}
      <div
        className="absolute rounded-full"
        style={{
          width: '20px',
          height: '20px',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(0,255,255,1) 0%, rgba(0,180,180,1) 70%, rgba(0,100,100,1) 100%)',
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.8), inset 0 0 10px rgba(0, 255, 255, 0.5)',
          animation: 'neural-pulse 2s ease-in-out infinite',
          zIndex: 3
        }}
      >
        {/* Dark Center Pupil */}
        <div
          className="absolute rounded-full"
          style={{
            width: '8px',
            height: '8px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.9) 100%)',
            zIndex: 4
          }}
        />
      </div>
    </div>
  );
}
