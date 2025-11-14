/**
 * API Request and Response Type Definitions
 */

import type { User, Client, Room, Scene, Device, Controller, Puzzle, Session } from './database.js';

// Authentication
export interface LoginRequest {
  email: string;
  password: string;
  interface?: 'sentient' | 'mythra';
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    client_id: string | null;
    client_name?: string;
    client_slug?: string;
  };
  expiresIn: string;
}

export interface PasswordResetRequest {
  currentPassword: string;
  newPassword: string;
}

// Generic API response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Client operations
export interface CreateClientRequest {
  name: string;
  slug: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active?: boolean;
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {
  id: string;
}

// Room operations
export interface CreateRoomRequest {
  client_id: string;
  name: string;
  slug: string;
  description?: string;
  capacity: number;
  duration_minutes: number;
  difficulty_level?: number;
  is_active?: boolean;
  mqtt_topic_prefix?: string;
}

export interface UpdateRoomRequest extends Partial<CreateRoomRequest> {
  id: string;
}

// Scene operations
export interface CreateSceneRequest {
  room_id: string;
  scene_number: number;
  name: string;
  description?: string;
  entry_condition?: Record<string, any>;
  exit_condition?: Record<string, any>;
  timeout_seconds?: number;
}

export interface UpdateSceneRequest extends Partial<CreateSceneRequest> {
  id: string;
}

// Device operations
export interface CreateDeviceRequest {
  room_id: string;
  controller_id?: string;
  device_id: string;
  friendly_name: string;
  device_type: string;
  description?: string;
  mqtt_topic?: string;
  state?: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateDeviceRequest extends Partial<CreateDeviceRequest> {
  id: string;
}

// MQTT command request
export interface MqttCommandRequest {
  device_id: string;
  command: string;
  payload?: Record<string, any>;
  qos?: 0 | 1 | 2;
}

// Session operations
export interface CreateSessionRequest {
  room_id: string;
  game_master_id: string;
  player_count?: number;
  notes?: string;
}

export interface UpdateSessionRequest {
  id: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'emergency_stopped';
  current_scene_id?: string;
  start_time?: Date;
  end_time?: Date;
  player_count?: number;
  notes?: string;
}

// User operations
export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  role: 'admin' | 'game_master' | 'viewer' | 'technician' | 'creative_director' | 'editor';
  client_id?: string;
  is_active?: boolean;
}

export interface UpdateUserRequest {
  id: string;
  email?: string;
  username?: string;
  password?: string;
  role?: string;
  client_id?: string;
  is_active?: boolean;
}

// Query filters
export interface AuditLogFilters {
  userId?: string;
  client_id?: string;
  actionType?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface DeviceFilters {
  room_id?: string;
  controller_id?: string;
  device_type?: string;
  is_active?: boolean;
}

export interface SessionFilters {
  room_id?: string;
  status?: string;
  game_master_id?: string;
  start_date?: Date;
  end_date?: Date;
}

// Health check response
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptime?: number;
  database?: {
    healthy: boolean;
    timestamp?: string;
    version?: string;
    pool?: {
      total: number;
      idle: number;
      waiting: number;
    };
    error?: string;
  };
}
