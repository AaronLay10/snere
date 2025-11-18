/**
 * Authentication Type Definitions
 */

import type { Request } from 'express';

// JWT payload structure
export interface JwtPayload {
  id: string;
  email: string;
  username: string;
  role: string;
  clientId: string | null;
  permissions?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
}

// Authenticated user attached to request
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
  client_id: string | null;
  client_name?: string;
  client_slug?: string;
  is_active: boolean;
  last_login: Date | null;
}

// Extended Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  isServiceAuth?: boolean;
  interface?: 'sentient' | 'mythra';
}

// Role-based permissions
export type UserRole = 
  | 'admin' 
  | 'game_master' 
  | 'viewer' 
  | 'technician' 
  | 'creative_director' 
  | 'editor';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  game_master: [
    'session:start',
    'session:stop',
    'session:control',
    'device:read',
    'device:control',
    'puzzle:read',
    'puzzle:control',
    'room:read'
  ],
  creative_director: [
    'client:read',
    'client:write',
    'room:read',
    'room:write',
    'scene:read',
    'scene:write',
    'device:read',
    'device:write',
    'puzzle:read',
    'puzzle:write',
    'controller:read',
    'controller:write'
  ],
  editor: [
    'room:read',
    'room:write',
    'scene:read',
    'scene:write',
    'device:read',
    'device:write',
    'puzzle:read',
    'puzzle:write'
  ],
  technician: [
    'device:read',
    'device:control',
    'controller:read',
    'system:diagnostics'
  ],
  viewer: [
    'client:read',
    'room:read',
    'scene:read',
    'device:read',
    'puzzle:read',
    'session:read'
  ]
};

// Interface access control
export const INTERFACE_ROLES: Record<'sentient' | 'mythra', UserRole[]> = {
  sentient: ['admin', 'editor', 'viewer', 'technician', 'creative_director'],
  mythra: ['admin', 'game_master']
};
