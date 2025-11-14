/**
 * Users List Page
 * Admin page for managing all user accounts
 */

import { useState, useEffect } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Trash2,
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  X,
  Save,
  Search,
  Filter
} from 'lucide-react';
import { users, clients, type User } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import DashboardLayout from '../components/layout/DashboardLayout';

interface UserFormData {
  email: string;
  password?: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string;
  client_id: string;
  is_active: boolean;
}

export default function UsersList() {
  const { user: currentUser } = useAuthStore();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    password: '',
    role: 'viewer',
    first_name: '',
    last_name: '',
    phone: '',
    client_id: '',
    is_active: true
  });

  const roles = ['admin', 'editor', 'viewer', 'game_master', 'creative_director', 'technician'];

  useEffect(() => {
    loadUsers();
    loadClients();
  }, [filterRole, filterActive]);

  const loadClients = async () => {
    try {
      const response = await clients.getAll();
      setClientsList(response.clients || []);
    } catch (err: any) {
      console.error('Load clients error:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {};
      if (filterRole) params.role = filterRole;
      if (filterActive !== 'all') params.active = filterActive === 'active';

      const response = await users.getAll(params);
      setUsersList(response.users || []);
    } catch (err: any) {
      console.error('Load users error:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      role: 'viewer',
      first_name: '',
      last_name: '',
      phone: '',
      client_id: '',
      is_active: true
    });
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.role,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      client_id: user.client_id || '',
      is_active: user.is_active !== false
    });
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          email: formData.email,
          role: formData.role,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          client_id: formData.client_id || null,
          is_active: formData.is_active
        };

        if (formData.password) {
          updateData.password = formData.password;
        }

        await users.update(editingUser.id, updateData);
        setSuccess('User updated successfully');
      } else {
        // Create new user
        if (!formData.password) {
          setError('Password is required for new users');
          return;
        }

        await users.create({
          email: formData.email,
          password: formData.password,
          role: formData.role,
          first_name: formData.first_name,
          last_name: formData.last_name,
          phone: formData.phone,
          is_active: formData.is_active
        });

        setSuccess('User created successfully');
      }

      setShowModal(false);
      loadUsers();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Save user error:', err);
      setError(err.response?.data?.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to deactivate user "${user.username}"?`)) return;

    try {
      setError('');
      await users.delete(user.id);
      setSuccess(`User "${user.username}" deactivated successfully`);
      loadUsers();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Delete user error:', err);
      setError(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const filteredUsers = usersList.filter((user) => {
    // Filter out system/internal users
    const isSystemUser =
      user.email?.endsWith('@sentient.internal') ||
      user.email?.endsWith('@mythrasentient.com') ||
      user.username === 'system-service' ||
      user.username === 'admin';

    if (isSystemUser) return false;

    // Apply search filter
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search)
    );
  });

  const getUserInitials = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.username?.substring(0, 2).toUpperCase() || '??';
  };

  const getPhotoUrl = (user: User) => {
    if (!user.profile_photo_url) return '';
    // Use relative URL since nginx serves both API and uploads from same domain
    return user.profile_photo_url;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-cyan-400 flex items-center gap-3">
          <UsersIcon className="w-8 h-8" />
          User Management
        </h1>
        <button
          onClick={handleCreateUser}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create User
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filter */}
          <div>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as any)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-gray-900/50 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6 hover:border-cyan-500 transition-all"
          >
            {/* User Avatar */}
            <div className="flex items-start gap-4 mb-4">
              <div className="relative">
                {getPhotoUrl(user) ? (
                  <img
                    src={getPhotoUrl(user)}
                    alt={user.username}
                    className="w-16 h-16 rounded-full object-cover border-2 border-cyan-500/30"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-cyan-900/30 border-2 border-cyan-500/30 flex items-center justify-center">
                    <span className="text-cyan-400 font-semibold text-lg">
                      {getUserInitials(user)}
                    </span>
                  </div>
                )}
                {user.is_active === false && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-900" />
                )}
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user.username}
                </h3>
                <div className="flex items-center gap-2 text-sm text-cyan-400 capitalize">
                  <Shield className="w-4 h-4" />
                  {user.role.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* User Details */}
            <div className="space-y-2 text-sm mb-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-4 h-4" />
                {user.email}
              </div>

              {user.phone && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Phone className="w-4 h-4" />
                  {user.phone}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleEditUser(user)}
                className="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>

              {user.id !== currentUser?.id && (
                <button
                  onClick={() => handleDeleteUser(user)}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  title="Deactivate user"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No users found matching your criteria
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-cyan-500/30 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-cyan-400">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Profile Photo Upload - Only show when editing existing user */}
              {editingUser && (
                <div className="flex justify-center mb-6">
                  <ProfilePhotoUpload
                    userId={editingUser.id}
                    currentPhotoUrl={editingUser.profile_photo_url}
                    onPhotoUpdated={(photoUrl) => {
                      // Update the user in the list
                      loadUsers();
                    }}
                    size="md"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Password {!editingUser && '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'Leave blank to keep current' : ''}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Client Assignment */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Client Organization
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">No Client</option>
                    {clientsList.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.is_active ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.value === 'active' })
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSaveUser}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
