import { Request, Response, NextFunction } from 'express';
import { pool } from './db';

/**
 * Middleware to check if a user has a specific permission
 * @param permission The permission to check for
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has the required permission through their roles
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND p.id = $2`,
        [userId, permission]
      );

      if (result.rows[0].count > 0) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if a user has any of the specified permissions
 * @param permissions Array of permissions to check for
 */
export function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has any of the required permissions through their roles
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND p.id = ANY($2)`,
        [userId, permissions]
      );

      if (result.rows[0].count > 0) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware to check if a user has all of the specified permissions
 * @param permissions Array of permissions to check for
 */
export function requireAllPermissions(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has all of the required permissions through their roles
      const result = await pool.query(
        `SELECT COUNT(DISTINCT p.id) as count
         FROM permissions p
         INNER JOIN role_permissions rp ON p.id = rp.permission_id
         INNER JOIN user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = $1 AND p.id = ANY($2)`,
        [userId, permissions]
      );

      if (result.rows[0].count === permissions.length) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}