import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { rooms, devices, users, audit } from '../lib/api';
import { motion } from 'framer-motion';
import {
  DoorOpen,
  Cpu,
  Users as UsersIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    rooms: { total: 0, active: 0, testing: 0 },
    devices: { total: 0, emergencyStop: 0 },
    users: { total: 0, active: 0 },
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load rooms
      const roomsData = await rooms.getAll({ client_id: user?.client_id });
      const roomsList = roomsData.rooms || [];

      // Load devices
      const devicesData = await devices.getAll();
      const devicesList = devicesData.devices || [];

      // Load users (if admin or editor)
      let usersData = { users: [] };
      if (['admin', 'editor'].includes(user?.role || '')) {
        usersData = await users.getAll({ client_id: user?.client_id });
      }
      const usersList = usersData.users || [];

      // Load recent activity
      const auditData = await audit.getRecent(10);
      const recentActivity = auditData.logs || [];

      setStats({
        rooms: {
          total: roomsList.length,
          active: roomsList.filter((r: any) => r.status === 'active').length,
          testing: roomsList.filter((r: any) => r.status === 'testing').length,
        },
        devices: {
          total: devicesList.length,
          emergencyStop: devicesList.filter((d: any) => d.emergency_stop_required).length,
        },
        users: {
          total: usersList.length,
          active: usersList.filter((u: any) => u.is_active).length,
        },
        recentActivity: recentActivity,
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Rooms',
      value: stats.rooms.total,
      subtitle: `${stats.rooms.active} active, ${stats.rooms.testing} testing`,
      icon: DoorOpen,
      color: 'cyan',
      trend: '+2 this month',
    },
    {
      title: 'Devices',
      value: stats.devices.total,
      subtitle: `${stats.devices.emergencyStop} with E-Stop`,
      icon: Cpu,
      color: 'magenta',
      trend: 'All systems nominal',
    },
    {
      title: 'Users',
      value: stats.users.total,
      subtitle: `${stats.users.active} active`,
      icon: UsersIcon,
      color: 'green',
      trend: '100% active',
    },
    {
      title: 'System Health',
      value: '98%',
      subtitle: 'All services operational',
      icon: Activity,
      color: 'yellow',
      trend: 'Excellent',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">
            Neural Command Center
          </h1>
          <p className="text-gray-500">
            Welcome back, <span className="text-cyan-400">{user?.username}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="card-neural"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold text-white">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-${card.color}-500/10`}>
                  <card.icon className={`w-6 h-6 text-${card.color}-400`} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-2">{card.subtitle}</p>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>{card.trend}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-neural"
        >
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionButton
              title="New Room"
              description="Create escape room"
              icon={DoorOpen}
              href="/dashboard/rooms/new"
            />
            <QuickActionButton
              title="Manage Rooms"
              description="Configure rooms & devices"
              icon={Cpu}
              href="/dashboard/rooms"
            />
            <QuickActionButton
              title="Manage Users"
              description="User accounts"
              icon={UsersIcon}
              href="/dashboard/users"
            />
            <QuickActionButton
              title="View Logs"
              description="Audit trail"
              icon={Activity}
              href="/dashboard/audit"
            />
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card-neural"
        >
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Recent Activity</h2>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin-slow">
                <div className="w-8 h-8 border-2 border-cyan-500 rounded-full border-t-transparent" />
              </div>
            </div>
          ) : stats.recentActivity.length === 0 ? (
            <p className="text-center text-gray-600 py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((activity: any, index: number) => (
                <div
                  key={activity.id || index}
                  className="flex items-center gap-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 hover:border-cyan-500/20 transition-colors"
                >
                  <div className={`p-2 rounded-lg ${getActivityColor(activity.action_type)}`}>
                    {getActivityIcon(activity.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">
                      <span className="font-medium">{activity.username}</span>
                      {' '}
                      {activity.action_type}
                      {' '}
                      <span className="text-cyan-400">{activity.resource_type}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(activity.created_at)}</span>
                    </div>
                  </div>
                  <div className={`status-badge ${activity.success ? 'status-active' : 'status-archived'}`}>
                    {activity.success ? 'Success' : 'Failed'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card-neural"
        >
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusIndicator
              label="API Service"
              status="operational"
              uptime="99.9%"
            />
            <StatusIndicator
              label="Database"
              status="operational"
              uptime="100%"
            />
            <StatusIndicator
              label="MQTT Broker"
              status="operational"
              uptime="99.8%"
            />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

function QuickActionButton({ title, description, icon: Icon, href }: any) {
  return (
    <button
      onClick={() => window.location.href = href}
      className="flex items-start gap-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all group"
    >
      <div className="p-2 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
        <Icon className="w-5 h-5 text-cyan-400" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </button>
  );
}

function StatusIndicator({ label, status, uptime }: any) {
  const isOperational = status === 'operational';
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500 mt-1">Uptime: {uptime}</p>
      </div>
      <div className={`flex items-center gap-2 ${isOperational ? 'text-green-400' : 'text-red-400'}`}>
        {isOperational ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <AlertTriangle className="w-5 h-5" />
        )}
      </div>
    </div>
  );
}

function getActivityColor(actionType: string) {
  switch (actionType) {
    case 'create':
      return 'bg-green-500/10 text-green-400';
    case 'update':
      return 'bg-blue-500/10 text-blue-400';
    case 'delete':
      return 'bg-red-500/10 text-red-400';
    case 'login':
      return 'bg-cyan-500/10 text-cyan-400';
    default:
      return 'bg-gray-500/10 text-gray-400';
  }
}

function getActivityIcon(actionType: string) {
  switch (actionType) {
    case 'create':
      return <CheckCircle className="w-4 h-4" />;
    case 'update':
      return <Activity className="w-4 h-4" />;
    case 'delete':
      return <AlertTriangle className="w-4 h-4" />;
    case 'login':
      return <UsersIcon className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

function formatTime(timestamp: string) {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}
