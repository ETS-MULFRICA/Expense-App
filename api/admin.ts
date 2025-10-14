import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { storage } from './storage';
import { requireAdmin } from './middleware';
import { requirePermission } from './permission-middleware';
import crypto from 'crypto';

const router = Router();

// List users with optional filters
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  const { role, status, email, q } = req.query as any;
  try {
    let base = 'SELECT u.* FROM users u';
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (role) {
      base += ' JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id';
      clauses.push(`r.name = $${idx++}`);
      params.push(role);
    }

    if (status === 'suspended') {
      clauses.push(`u.is_suspended = $${idx++}`);
      params.push(true);
    } else if (status === 'active') {
      clauses.push(`u.is_suspended = $${idx++}`);
      params.push(false);
    }

    if (email) {
      clauses.push(`LOWER(u.email) = LOWER($${idx++})`);
      params.push(email);
    }

    if (q) {
      clauses.push(`(LOWER(u.username) LIKE LOWER($${idx++}) OR LOWER(u.name) LIKE LOWER($${idx++}) OR LOWER(u.email) LIKE LOWER($${idx++}))`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
    const sql = `${base} ${where} ORDER BY u.created_at DESC LIMIT 100`;
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to list users', err);
    res.status(500).json({ message: 'Failed to list users' });
  }
});

// Create user (admin)
router.post('/users', requirePermission('users:write'), async (req: Request, res: Response) => {
  try {
    const { username, password, name, email, role } = req.body;
    if (!username || !password || !email) return res.status(400).json({ message: 'username, password and email are required' });
    const hashed = await (await import('./password')).hashPassword(password);
    const insert = await pool.query('INSERT INTO users (username, password, name, email) VALUES ($1,$2,$3,$4) RETURNING *', [username, hashed, name, email]);
    const user = insert.rows[0];
    if (role) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) SELECT $1, r.id FROM roles r WHERE r.name = $2 ON CONFLICT DO NOTHING', [user.id, role]);
    }
    res.status(201).json(user);
  } catch (err) {
    console.error('Failed to create user', err);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

// Suspend user
router.post('/users/:id/suspend', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('UPDATE users SET is_suspended = true WHERE id = $1', [id]);
    res.json({ message: 'User suspended' });
  } catch (err) {
    console.error('Failed to suspend user', err);
    res.status(500).json({ message: 'Failed to suspend user' });
  }
});

// Also support PATCH for suspend (frontend expects PATCH)
router.patch('/users/:id/suspend', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('UPDATE users SET is_suspended = true WHERE id = $1', [id]);
    res.json({ message: 'User suspended' });
  } catch (err) {
    console.error('Failed to suspend user', err);
    res.status(500).json({ message: 'Failed to suspend user' });
  }
});

// Unsuspend user
router.post('/users/:id/unsuspend', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('UPDATE users SET is_suspended = false WHERE id = $1', [id]);
    res.json({ message: 'User unsuspended' });
  } catch (err) {
    console.error('Failed to unsuspend user', err);
    res.status(500).json({ message: 'Failed to unsuspend user' });
  }
});

// Also support PATCH for unsuspend/reactivate
router.patch('/users/:id/reactivate', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('UPDATE users SET is_suspended = false WHERE id = $1', [id]);
    res.json({ message: 'User reactivated' });
  } catch (err) {
    console.error('Failed to reactivate user', err);
    res.status(500).json({ message: 'Failed to reactivate user' });
  }
});

// Soft-delete user
router.delete('/users/:id', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query('UPDATE users SET is_deleted = true, deleted_at = now() WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Failed to soft-delete user', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Reset password: generate temporary token and set expiry
router.patch('/users/:id/reset-password', requirePermission('users:write'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  try {
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await pool.query('UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3', [token, expires.toISOString(), id]);
    // In production you'd email the link. Here we return token for admin to use for testing
    // Optionally generate a temporary password when requested via body.generateTemporary
    const { generateTemporary } = req.body || {};
    if (generateTemporary) {
      const temp = crypto.randomBytes(6).toString('base64url');
      const { hashPassword } = await import('./password');
      const hashed = await hashPassword(temp);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, id]);
      res.json({ message: 'Temporary password generated', temporaryPassword: temp, expires });
      return;
    }

    res.json({ message: 'Password reset token generated', token, expires });
  } catch (err) {
    console.error('Failed to generate reset token', err);
    res.status(500).json({ message: 'Failed to generate reset token' });
  }
});

// Search users for admin UI
router.get('/users/search', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { q, role, status } = req.query as any;
    const params: any[] = [];
    const clauses: string[] = [];
    let idx = 1;

    if (q) {
      clauses.push(`(LOWER(username) LIKE LOWER($${idx}) OR LOWER(name) LIKE LOWER($${idx}) OR LOWER(email) LIKE LOWER($${idx}))`);
      params.push(`%${q}%`);
      idx++;
    }
    if (role && role !== 'all') {
      clauses.push(`EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id AND r.name = $${idx})`);
      params.push(role);
      idx++;
    }
    if (status === 'suspended') {
      clauses.push(`u.is_suspended = true`);
    } else if (status === 'active') {
      clauses.push(`u.is_suspended = false`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT u.id, u.username, u.name, u.email, u.is_suspended as status, u.created_at FROM users u ${where} ORDER BY u.created_at DESC LIMIT 200`;
    const result = await pool.query(sql, params);
    res.json(result.rows.map((r: any) => ({ ...r, status: r.status ? 'suspended' : 'active' })));
  } catch (err) {
    console.error('Failed to search users', err);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

// Admin stats for dashboard
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const total = await pool.query('SELECT COUNT(*) FROM users WHERE is_deleted = false');
    const suspended = await pool.query('SELECT COUNT(*) FROM users WHERE is_suspended = true');
    const admins = await pool.query("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name = 'admin'");
    const active = Number(total.rows[0].count) - Number(suspended.rows[0].count);
    res.json({ totalUsers: Number(total.rows[0].count), suspendedUsers: Number(suspended.rows[0].count), adminUsers: Number(admins.rows[0].count), activeUsers: Number(active) });
  } catch (err) {
    console.error('Failed to fetch admin stats', err);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
});

// Roles & permissions endpoints
router.get('/roles', requireAdmin, async (_req, res) => {
  try {
    const roles = await pool.query('SELECT * FROM roles ORDER BY name');
    res.json(roles.rows);
  } catch (err) {
    console.error('Failed to list roles', err);
    res.status(500).json({ message: 'Failed to list roles' });
  }
});

router.post('/roles', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  try {
    const insert = await pool.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING *', [name, description]);
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('Failed to create role', err);
    res.status(500).json({ message: 'Failed to create role' });
  }
});

router.post('/roles/:role/assign', requireAdmin, async (req, res) => {
  const { userId } = req.body;
  const roleName = req.params.role;
  try {
    await pool.query('INSERT INTO user_roles (user_id, role_id) SELECT $1, r.id FROM roles r WHERE r.name = $2 ON CONFLICT DO NOTHING', [userId, roleName]);
    res.json({ message: 'Role assigned' });
  } catch (err) {
    console.error('Failed to assign role', err);
    res.status(500).json({ message: 'Failed to assign role' });
  }
});

export default router;
