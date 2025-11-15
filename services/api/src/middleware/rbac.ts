/**
 * Mythra Sentient Engine - Role-Based Access Control (RBAC) Middleware
 * Implements authorization based on user roles and permissions
 */

import { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';

/**
 * Role hierarchy and capabilities
 */
export const ROLES = {
  admin: {
    level: 100,
    description: 'Full system access across all clients',
    canAccessAllClients: true,
    capabilities: [
      'read',
      'write',
      'delete',
      'manage_users',
      'manage_clients',
      'system_config',
      'manage_devices',
      'manage_scenes',
      'manage_puzzles',
      'control_room',
      'view_status',
      'emergency_stop',
      'add_comments',
      'view_analytics',
      'test_devices',
      'view_diagnostics',
    ],
  },
  editor: {
    level: 50,
    description: 'Can edit configurations within their client',
    canAccessAllClients: false,
    capabilities: ['read', 'write', 'manage_devices', 'manage_scenes', 'manage_puzzles'],
  },
  viewer: {
    level: 30,
    description: 'Read-only access to configurations',
    canAccessAllClients: false,
    capabilities: ['read'],
  },
  game_master: {
    level: 40,
    description: 'Operational control during game sessions',
    canAccessAllClients: false,
    capabilities: ['read', 'control_room', 'view_status', 'emergency_stop'],
  },
  creative_director: {
    level: 45,
    description: 'Can view and provide feedback on experiences',
    canAccessAllClients: false,
    capabilities: ['read', 'add_comments', 'view_analytics'],
  },
  technician: {
    level: 35,
    description: 'Hardware maintenance and device management',
    canAccessAllClients: false,
    capabilities: ['read', 'test_devices', 'view_diagnostics', 'manage_devices'],
  },
} as const;

type RoleKey = keyof typeof ROLES;

/**
 * Check if user has required role
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `Role '${userRole}' is not authorized for this action`,
        requiredRoles: allowedRoles,
      });
    }

    return next();
  };
}

/**
 * Check if user has required capability
 */
export function requireCapability(...capabilities: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    // Service authentication has all permissions
    if (req.isServiceAuth || req.user.role === 'system') {
      return next();
    }

    const userRole = ROLES[req.user.role as RoleKey];

    if (!userRole) {
      return res.status(403).json({
        error: 'Invalid role',
        message: `Role '${req.user.role}' is not recognized`,
      });
    }

    // Check if user has all required capabilities
    const hasAllCapabilities = capabilities.every((cap) =>
      userRole.capabilities.includes(cap as any)
    );

    if (!hasAllCapabilities) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions for this action',
        requiredCapabilities: capabilities,
        userCapabilities: userRole.capabilities,
      });
    }

    next();
  };
}

/**
 * Require minimum role level
 */
export function requireRoleLevel(minLevel: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userRole = ROLES[req.user.role as RoleKey];

    if (!userRole || userRole.level < minLevel) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient role level for this action',
        requiredLevel: minLevel,
        userLevel: userRole ? userRole.level : 0,
      });
    }

    return next();
  };
}

/**
 * Ensure user can only access resources within their client
 * Admins can access all clients
 */
export function requireClientAccess(paramName: string = 'client_id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userRole = ROLES[req.user.role as RoleKey];

    // Admins can access all clients
    if (userRole && userRole.canAccessAllClients) {
      return next();
    }

    // Extract client ID from route params, query, or body
    const requestedClientId = req.params[paramName] || req.query[paramName] || req.body[paramName];

    if (!requestedClientId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Client ID is required',
      });
    }

    // Check if user's client matches requested client
    if (req.user.client_id !== requestedClientId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access resources within your client',
        userClient: req.user.client_id,
        requestedClient: requestedClientId,
      });
    }

    next();
  };
}

/**
 * Check if user owns the resource or is admin
 */
export function requireOwnership(userIdField: string = 'userId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
    }

    const userRole = ROLES[req.user.role as RoleKey];

    // Admins can access all resources
    if (userRole && userRole.canAccessAllClients) {
      return next();
    }

    // Extract resource owner ID
    const resourceOwnerId =
      req.params[userIdField] || req.query[userIdField] || req.body[userIdField];

    if (!resourceOwnerId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Resource owner ID is required',
      });
    }

    // Check if user owns the resource
    if (req.user.id !== resourceOwnerId) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources',
      });
    }

    next();
  };
}

/**
 * Combine multiple authorization checks with OR logic
 * User only needs to pass ONE of the checks
 */
export function anyOf(...middlewares: any[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    for (const middleware of middlewares) {
      try {
        // Create mock response to capture authorization result
        let passed = false;
        const mockRes = {
          status: () => ({
            json: () => {
              passed = false;
            },
          }),
        };

        const mockNext = () => {
          passed = true;
        };

        await middleware(req, mockRes, mockNext);

        if (passed) {
          return next();
        }
      } catch (error) {
        // Continue to next middleware
      }
    }

    // None of the middlewares passed
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this resource',
    });
  };
}

/**
 * Check if request is for Sentient (admin) interface or Mythra (game master) interface
 * This can be determined by API path or explicit header
 */
export function requireInterface(interfaceType: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const requestedInterface =
      req.headers['x-interface'] || (req.path.startsWith('/api/sentient') ? 'sentient' : 'mythra');

    if (interfaceType === 'sentient') {
      // Sentient interface - only admins, editors, viewers
      if (
        !['admin', 'editor', 'viewer', 'technician', 'creative_director'].includes(
          req.user?.role || ''
        )
      ) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This interface is only accessible to Sentient users',
          interface: 'sentient',
          userRole: req.user?.role,
        });
      }
    } else if (interfaceType === 'mythra') {
      // Mythra interface - game masters and admins
      if (!['game_master', 'admin'].includes(req.user?.role || '')) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'This interface is only accessible to game masters',
          interface: 'mythra',
          userRole: req.user?.role,
        });
      }
    }

    req.interface = interfaceType;
    return next();
  };
}

/**
 * Get role information
 */
export function getRoleInfo(roleName: string) {
  return ROLES[roleName as RoleKey] || null;
}

/**
 * Check if one role can perform action on another role
 * e.g., can editor modify game_master accounts?
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  const actor = ROLES[actorRole as RoleKey];
  const target = ROLES[targetRole as RoleKey];

  if (!actor || !target) {
    return false;
  }

  // Admins can manage all roles
  if (actorRole === 'admin') {
    return true;
  }

  // Users can only manage roles with lower level than themselves
  return actor.level > target.level;
}
