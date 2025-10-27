import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { requireAdmin } from './middleware';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

// Schema for user role assignments
const userRolesSchema = z.object({
  userId: z.number(),
  roleIds: z.array(z.number())
});

// Get roles for a specific user
router.get('/users/:id/roles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await pool.query(
      `SELECT r.* 
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1
       ORDER BY r.name`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch user roles' });
  }
});

// Assign roles to a user
router.post('/users/:id/roles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { roleIds } = userRolesSchema.parse({ userId, ...req.body });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing role assignments
      await client.query(
        'DELETE FROM user_roles WHERE user_id = $1',
        [userId]
      );

      // Assign new roles
      if (roleIds.length > 0) {
        const roleValues = roleIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(',');
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ${roleValues}`,
          [userId, ...roleIds]
        );
      }

      await client.query('COMMIT');
      res.json({ userId, roleIds });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error assigning user roles:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: fromZodError(error).message });
    } else {
      res.status(500).json({ error: 'Failed to assign user roles' });
    }
  }
});

export default router;