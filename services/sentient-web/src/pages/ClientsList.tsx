/**
 * Clients List Page
 * Admin page for managing client organizations
 */

import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  Filter,
  Mail,
  Globe,
  Hash,
} from 'lucide-react';
import { clients, type Client } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import DashboardLayout from '../components/layout/DashboardLayout';
import ClientLogoUpload from '../components/ClientLogoUpload';
import toast from 'react-hot-toast';

interface ClientFormData {
  name: string;
  slug: string;
  description: string;
  mqtt_namespace: string;
  contact_email: string;
  contact_phone: string;
  status: string;
}

export default function ClientsList() {
  const { user: currentUser } = useAuthStore();
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>({
    name: '',
    slug: '',
    description: '',
    mqtt_namespace: '',
    contact_email: '',
    contact_phone: '',
    status: 'active',
  });

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;

      const response = await clients.getAll(params);
      setClientsList(response.clients || []);
    } catch (err: any) {
      console.error('Load clients error:', err);
      toast.error(err.response?.data?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      mqtt_namespace: '',
      contact_email: '',
      contact_phone: '',
      status: 'active',
    });
    setShowModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      slug: client.slug,
      description: client.description || '',
      mqtt_namespace: client.mqtt_namespace,
      contact_email: client.contact_email || '',
      contact_phone: client.contact_phone || '',
      status: client.status || 'active',
    });
    setShowModal(true);
  };

  const handleSaveClient = async () => {
    try {
      if (editingClient) {
        await clients.update(editingClient.id, formData);
        toast.success('Client updated successfully');
      } else {
        await clients.create(formData);
        toast.success('Client created successfully');
      }

      setShowModal(false);
      loadClients();
    } catch (err: any) {
      console.error('Save client error:', err);
      toast.error(err.response?.data?.message || 'Failed to save client');
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`))
      return;

    try {
      await clients.delete(id);
      toast.success('Client deleted successfully');
      loadClients();
    } catch (err: any) {
      console.error('Delete client error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete client');
    }
  };

  const filteredClients = clientsList.filter((client) => {
    // Hide system client from regular users
    if (client.slug === 'system' && currentUser?.role !== 'admin') {
      return false;
    }

    return (
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-500/10';
      case 'inactive':
        return 'text-gray-400 bg-gray-500/10';
      case 'suspended':
        return 'text-red-400 bg-red-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light text-gradient-cyan-magenta mb-2">Clients</h1>
            <p className="text-gray-500">Manage client organizations</p>
          </div>

          {currentUser?.role === 'admin' && (
            <button onClick={handleCreateClient} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span>New Client</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="card-neural">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-neural !pl-11"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-neural w-full md:w-48"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Clients List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin-slow">
              <div className="w-12 h-12 border-4 border-cyan-500 rounded-full border-t-transparent" />
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="card-neural text-center py-20">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No clients found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm ? 'Try adjusting your search' : 'Create your first client to get started'}
            </p>
            {!searchTerm && currentUser?.role === 'admin' && (
              <button
                onClick={handleCreateClient}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Client</span>
              </button>
            )}
          </div>
        ) : (
          <div className="card-neural overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Name</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Slug</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">
                      MQTT Namespace
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Contact</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-400">Status</th>
                    <th className="text-right p-4 text-sm font-medium text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-cyan-500/10">
                            <Building2 className="w-5 h-5 text-cyan-400" />
                          </div>
                          <div>
                            <div className="font-medium text-white">{client.name}</div>
                            {client.description && (
                              <div className="text-sm text-gray-500">{client.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Hash className="w-4 h-4" />
                          <span className="font-mono text-sm">{client.slug}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-sm text-gray-400">
                          {client.mqtt_namespace}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {client.contact_email && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Mail className="w-4 h-4" />
                              <span>{client.contact_email}</span>
                            </div>
                          )}
                          {client.contact_phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Globe className="w-4 h-4" />
                              <span>{client.contact_phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status || 'active')}`}
                        >
                          {client.status || 'active'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          {currentUser?.role === 'admin' && (
                            <>
                              <button
                                onClick={() => handleEditClient(client)}
                                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-cyan-400 transition-colors"
                                title="Edit client"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClient(client.id, client.name)}
                                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete client"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card-neural max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                <h2 className="text-2xl font-semibold text-white">
                  {editingClient ? 'Edit Client' : 'Create New Client'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Client Logo Upload - Only show when editing existing client */}
              {editingClient && (
                <div className="flex justify-center mb-6">
                  <ClientLogoUpload
                    clientId={editingClient.id}
                    currentLogoUrl={editingClient.logo_url}
                    onLogoUpdated={(logoUrl) => {
                      // Update the client in the list
                      loadClients();
                    }}
                    size="md"
                  />
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-neural"
                    required
                    placeholder="e.g., Paragon Escape"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-neural"
                    rows={3}
                    placeholder="Brief description of the organization..."
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    className="input-neural"
                    placeholder="contact@example.com"
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    className="input-neural"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="input-neural"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-6 mt-6 border-t border-gray-800">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSaveClient}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingClient ? 'Update' : 'Create'} Client</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
