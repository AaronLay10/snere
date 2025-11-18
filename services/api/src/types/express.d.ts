/**
 * Type definitions for custom Express Request extensions
 * Re-export from auth.ts for compatibility
 */

export type { AuthenticatedRequest, AuthenticatedUser } from './auth.js';

// Extend Express Request type globally
import type { AuthenticatedUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      isServiceAuth?: boolean;
      interface?: string;
    }
  }
}
