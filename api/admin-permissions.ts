import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { requireAdmin } from './middleware';

const router = Router();

// Get all permissions
router.get('/permissions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM permissions ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get permissions for a specific role
router.get('/roles/:id/permissions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT p.* 
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.id`,
      [roleId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({ error: 'Failed to fetch role permissions' });
  }
});

// Get permissions for the current user
router.get('/user/permissions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT DISTINCT p.* 
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY p.id`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

export default router;