import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { requireAdmin } from './middleware';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

const router = Router();

// Schema for role creation/update
const roleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.array(z.string())
});

// Get all roles
router.get('/roles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT r.*, array_agg(rp.permission_id) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Create new role
router.post('/roles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = roleSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create role
      const roleResult = await client.query(
        'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
        [name, description]
      );
      const roleId = roleResult.rows[0].id;

      // Assign permissions
      if (permissions.length > 0) {
        const permissionValues = permissions
          .map((_, i) => `($1, $${i + 2})`)
          .join(',');
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${permissionValues}`,
          [roleId, ...permissions]
        );
      }

      await client.query('COMMIT');
      res.json({ id: roleId, name, description, permissions });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating role:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: fromZodError(error).message });
    } else {
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
});

// Update role
router.put('/roles/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = roleSchema.parse(req.body);
    const roleId = parseInt(req.params.id);

    // Check if role is system role
    const systemCheck = await pool.query(
      'SELECT is_system FROM roles WHERE id = $1',
      [roleId]
    );
    if (systemCheck.rows[0]?.is_system) {
      return res.status(403).json({ error: 'Cannot modify system roles' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update role
      await client.query(
        'UPDATE roles SET name = $1, description = $2 WHERE id = $3',
        [name, description, roleId]
      );

      // Update permissions
      await client.query(
        'DELETE FROM role_permissions WHERE role_id = $1',
        [roleId]
      );
      if (permissions.length > 0) {
        const permissionValues = permissions
          .map((_, i) => `($1, $${i + 2})`)
          .join(',');
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ${permissionValues}`,
          [roleId, ...permissions]
        );
      }

      await client.query('COMMIT');
      res.json({ id: roleId, name, description, permissions });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating role:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: fromZodError(error).message });
    } else {
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
});

// Delete role
router.delete('/roles/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);

    // Check if role is system role
    const systemCheck = await pool.query(
      'SELECT is_system FROM roles WHERE id = $1',
      [roleId]
    );
    if (systemCheck.rows[0]?.is_system) {
      return res.status(403).json({ error: 'Cannot delete system roles' });
    }

    await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

export default router;