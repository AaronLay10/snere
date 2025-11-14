/**
 * Type definitions for custom Express Request extensions
 */

import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  client_id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  isServiceAuth?: boolean;
  interface?: string;
}

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      isServiceAuth?: boolean;
      interface?: string;
    }
  }
}
