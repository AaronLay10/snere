import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap,
} from 'lucide-react';
import packageJson from '../../../package.json';
import NeuralEyeLogo from '../NeuralEyeLogo';
import { system } from '../../lib/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface ServiceStatus {
  service: string;
  name: string;
  version: string;
  status: string;
  uptime?: number;
  error?: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { user, logout, refreshUser } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [serviceVersions, setServiceVersions] = useState<ServiceStatus[]>([]);

  // Refresh user data on mount to get latest client info including logo
  useEffect(() => {
    refreshUser().catch((err) => {
      console.error('Failed to refresh user data:', err);
    });
  }, [refreshUser]);

  // Fetch service versions
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await system.getStatus();
        setServiceVersions(response.services || []);
      } catch (error) {
        console.error('Failed to fetch service versions:', error);
      }
    };
    fetchVersions();
    // Refresh every 30 seconds
    const interval = setInterval(fetchVersions, 30000);
    return () => clearInterval(interval);
  }, []);

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
    { name: 'Power Control', href: '/dashboard/power-control', icon: Zap, roles: ['admin', 'technician'] },
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
                  <NeuralEyeLogo size="small" eyeState="idle" />
                </div>
                <div>
                  <h1 className="text-xl font-light tracking-[0.3em] text-gradient-cyan-magenta">
                    SENTIENT
                  </h1>
                  <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">
                    Neural Engine
                  </p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {/* Always show Web UI version first */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <p className="text-[9px] text-gray-400">
                        Web UI: <span className="text-cyan-400/70">v{packageJson.version}</span>
                      </p>
                    </div>

                    {/* Show backend services */}
                    {serviceVersions.length > 0 ? (
                      serviceVersions.map((svc) => (
                        <div key={svc.service} className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${svc.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <p className="text-[9px] text-gray-400">
                            {svc.name}: <span className={svc.status === 'ok' ? 'text-cyan-400/70' : 'text-red-400/70'}>v{svc.version}</span>
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                        <p className="text-[9px] text-gray-500">Loading...</p>
                      </div>
                    )}
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

            {/* Client Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/20 bg-black/50">
              {user?.client_name ? (
                <div className="flex items-center gap-3">
                  {user?.client_logo_url ? (
                    <img
                      src={user.client_logo_url}
                      alt={user.client_name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-cyan-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-600 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.client_name}</p>
                    <p className="text-xs text-gray-500">Client Organization</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-400">No Client</p>
                    <p className="text-xs text-gray-600">Not assigned</p>
                  </div>
                </div>
              )}
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
              {/* Notifications */}
              <button className="relative p-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-magenta-500 rounded-full animate-pulse" />
              </button>

              {/* User Menu with Profile Photo */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                >
                  {user?.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url}
                      alt={user.first_name || user.username || 'User'}
                      className="w-8 h-8 rounded-full object-cover border-2 border-cyan-500/30"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-black">
                        {user?.first_name ? user.first_name.charAt(0).toUpperCase() : user?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium text-white">
                      {user?.first_name && user?.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user?.username || 'User'}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{user?.role || 'guest'}</span>
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
                        <div className="flex items-center gap-3 mb-3">
                          {user?.profile_photo_url ? (
                            <img
                              src={user.profile_photo_url}
                              alt={user.first_name || user.username || 'User'}
                              className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500/30"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                              <span className="text-lg font-bold text-black">
                                {user?.first_name ? user.first_name.charAt(0).toUpperCase() : user?.username?.charAt(0).toUpperCase() || 'U'}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-white">
                              {user?.first_name && user?.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user?.username || 'User'}
                            </p>
                            <p className="text-xs text-gray-500">{user?.email || ''}</p>
                          </div>
                        </div>
                        <div className="inline-flex px-2 py-1 bg-cyan-500/20 rounded text-[10px] text-cyan-400 capitalize">
                          {user?.role?.replace('_', ' ') || 'guest'}
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
