/**
 * Database Entity Type Definitions
 * All properties use snake_case to match PostgreSQL schema
 */

export interface Client {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Room {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  description: string | null;
  capacity: number;
  duration_minutes: number;
  difficulty_level: number | null;
  is_active: boolean;
  mqtt_topic_prefix: string | null;
  created_at: Date;
  updated_at: Date;
  client_name?: string;
  client_slug?: string;
}

export interface Scene {
  id: string;
  room_id: string;
  scene_number: number;
  name: string;
  description: string | null;
  entry_condition: Record<string, any> | null;
  exit_condition: Record<string, any> | null;
  timeout_seconds: number | null;
  created_at: Date;
  updated_at: Date;
  room_name?: string;
}

export interface SceneStep {
  id: string;
  scene_id: string;
  step_number: number;
  name: string;
  description: string | null;
  action_type: 'mqtt_command' | 'wait' | 'check_condition' | 'parallel' | 'sequence';
  action_config: Record<string, any>;
  requires_confirmation: boolean;
  timeout_seconds: number | null;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
  scene_name?: string;
  scene_number?: number;
}

export interface Device {
  id: string;
  room_id: string;
  controller_id: string | null;
  device_id: string;
  friendly_name: string;
  device_type: string;
  description: string | null;
  mqtt_topic: string | null;
  state: Record<string, any> | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  room_name?: string;
  controller_name?: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_name: string;
  friendly_name: string;
  description: string | null;
  mqtt_payload: Record<string, any>;
  requires_confirmation: boolean;
  confirmation_message: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  device_friendly_name?: string;
}

export interface Controller {
  id: string;
  room_id: string;
  controller_id: string;
  friendly_name: string;
  controller_type: string;
  description: string | null;
  ip_address: string | null;
  mqtt_topic_prefix: string | null;
  firmware_version: string | null;
  last_seen: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  room_name?: string;
}

export interface Puzzle {
  id: string;
  room_id: string;
  scene_id: string | null;
  puzzle_id: string;
  friendly_name: string;
  description: string | null;
  puzzle_type: string;
  solution: Record<string, any> | null;
  hints: string[] | null;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  room_name?: string;
  scene_name?: string;
}

export interface PuzzleState {
  id: string;
  session_id: string;
  puzzle_id: string;
  current_state: Record<string, any>;
  attempts: number;
  is_solved: boolean;
  solved_at: Date | null;
  hint_count: number;
  last_attempt_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'game_master' | 'viewer' | 'technician' | 'creative_director' | 'editor';
  client_id: string | null;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  client_name?: string;
  client_slug?: string;
}

export interface Session {
  id: string;
  room_id: string;
  session_number: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'emergency_stopped';
  current_scene_id: string | null;
  start_time: Date | null;
  end_time: Date | null;
  game_master_id: string | null;
  player_count: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  room_name?: string;
  current_scene_name?: string;
  game_master_username?: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  reason: string | null;
  changes: Record<string, any> | null;
  created_at: Date;
}

export interface EmergencyStop {
  id: string;
  session_id: string;
  triggered_by: string;
  reason: string | null;
  actions_taken: Record<string, any> | null;
  resolved: boolean;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

// Database query result wrapper
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  command: string;
}

// Pool client for transactions
export interface PoolClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  release(): void;
}
