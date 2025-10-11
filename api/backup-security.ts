import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db';
import { logActivity, ActivityDescriptions } from './activity-logger';
import { logSecurityEvent } from './security-logger';
import type { Request, Response } from "express";
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);
const router = Router();

/**
 * Authentication Middleware
 * Checks if user is logged in before allowing access to protected routes
 */
const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  try {
    // Check user existence in DB on every request
    const userId = req.user.id;
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      // User not found in DB
      req.logout?.(() => {});
      return res.sendStatus(401);
    }
    next();
  } catch (err) {
    // DB error (e.g., DB is down)
    return res.status(503).json({ message: "Authentication unavailable: database error" });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user is authenticated AND has admin role
 */
const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  
  const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user!.id]);
  const userRole = userResult.rows[0]?.role;
  
  if (userRole !== 'admin') {
    return res.status(403).json({ message: "Access denied" });
  }
  
  next();
};

interface BackupEntry {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  type: 'full' | 'schema_only' | 'data_only';
  status: 'in_progress' | 'completed' | 'failed';
  created_by: number;
  error_message?: string;
}

interface SecurityLogEntry {
  id: number;
  user_id?: number;
  event_type: 'login_success' | 'login_failure' | 'logout' | 'password_change' | 'account_locked' | 'admin_action';
  ip_address: string;
  user_agent: string;
  details: any;
  created_at: string;
}

// ===== BACKUP ENDPOINTS =====

/**
 * GET /api/admin/backups
 * Get list of available backups
 */
router.get('/backups', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const query = `
      SELECT 
        b.id,
        b.filename,
        b.size,
        b.created_at,
        b.type,
        b.status,
        b.error_message,
        u.username as created_by_username,
        u.name as created_by_name
      FROM database_backups b
      LEFT JOIN users u ON b.created_by = u.id
      ORDER BY b.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [Number(limit), offset]);

    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM database_backups');
    const total = parseInt(countResult.rows[0].total);

    // Log admin activity
    await logActivity({
      userId: req.user!.id,
      actionType: 'VIEW',
      resourceType: 'SETTINGS',
      description: 'Viewed backup list',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      backups: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching backups:", error);
    res.status(500).json({ error: "Failed to fetch backups" });
  }
});

/**
 * POST /api/admin/backups/create
 * Create a new database backup
 */
router.post('/backups/create', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type = 'full', description = '' } = req.body;

    // Validate backup type
    if (!['full', 'schema_only', 'data_only'].includes(type)) {
      return res.status(400).json({ error: 'Invalid backup type' });
    }

    // Create backup directory if it doesn't exist
    const backupDir = process.env.BACKUP_DIR || '/tmp/backups';
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `expense_tracker_${type}_${timestamp}.sql`;
    const filepath = join(backupDir, filename);

    // Insert backup record as in_progress
    const insertQuery = `
      INSERT INTO database_backups (filename, type, status, created_by, description)
      VALUES ($1, $2, 'in_progress', $3, $4)
      RETURNING id
    `;
    
    const insertResult = await pool.query(insertQuery, [filename, type, req.user!.id, description]);
    const backupId = insertResult.rows[0].id;

    // Log backup initiation
    await logActivity({
      userId: req.user!.id,
      actionType: 'CREATE',
      resourceType: 'SETTINGS',
      resourceId: backupId,
      description: `Initiated ${type} database backup: ${filename}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Start backup process asynchronously
    setImmediate(async () => {
      try {
        const dbConfig = {
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || '5432',
          database: process.env.DB_NAME || 'expense_tracker',
          username: process.env.DB_USER || 'postgres'
        };

        let pgDumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`;
        
        // Add options based on backup type
        switch (type) {
          case 'schema_only':
            pgDumpCommand += ' --schema-only';
            break;
          case 'data_only':
            pgDumpCommand += ' --data-only';
            break;
          case 'full':
          default:
            // No additional flags for full backup
            break;
        }

        pgDumpCommand += ` --file="${filepath}" --no-password --clean --if-exists`;

        // Set PGPASSWORD environment variable
        const env = { ...process.env };
        if (process.env.DB_PASSWORD) {
          env.PGPASSWORD = process.env.DB_PASSWORD;
        }

        // Execute backup
        await execAsync(pgDumpCommand, { env });

        // Get file size
        const { size } = await import('fs').then(fs => fs.promises.stat(filepath));

        // Update backup record as completed
        await pool.query(
          'UPDATE database_backups SET status = $1, size = $2, updated_at = NOW() WHERE id = $3',
          ['completed', size, backupId]
        );

        console.log(`Backup completed successfully: ${filename}`);

        // Log successful backup
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'SETTINGS',
          resourceId: backupId,
          description: `Completed ${type} database backup: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });

      } catch (error) {
        console.error(`Backup failed: ${error}`);
        
        // Update backup record as failed
        await pool.query(
          'UPDATE database_backups SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
          ['failed', error instanceof Error ? error.message : String(error), backupId]
        );

        // Log failed backup
        await logActivity({
          userId: req.user!.id,
          actionType: 'CREATE',
          resourceType: 'SETTINGS',
          resourceId: backupId,
          description: `Failed to create ${type} database backup: ${error instanceof Error ? error.message : String(error)}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent']
        });
      }
    });

    res.status(202).json({
      message: 'Backup initiated successfully',
      backupId,
      filename,
      status: 'in_progress'
    });

  } catch (error) {
    console.error("Error creating backup:", error);
    res.status(500).json({ error: "Failed to initiate backup" });
  }
});

/**
 * GET /api/admin/backups/:id/download
 * Download a backup file
 */
router.get('/backups/:id/download', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get backup info
    const backupQuery = 'SELECT * FROM database_backups WHERE id = $1';
    const backupResult = await pool.query(backupQuery, [id]);

    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = backupResult.rows[0];

    if (backup.status !== 'completed') {
      return res.status(400).json({ error: 'Backup is not ready for download' });
    }

    const backupDir = process.env.BACKUP_DIR || '/tmp/backups';
    const filepath = join(backupDir, backup.filename);

    // Check if file exists
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found on disk' });
    }

    // Log download activity
    await logActivity({
      userId: req.user!.id,
      actionType: 'VIEW',
      resourceType: 'SETTINGS',
      resourceId: parseInt(id),
      description: `Downloaded backup file: ${backup.filename}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Set response headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    res.setHeader('Content-Type', 'application/sql');

    // Stream the file
    const fs = await import('fs');
    const readStream = fs.createReadStream(filepath);
    readStream.pipe(res);

  } catch (error) {
    console.error("Error downloading backup:", error);
    res.status(500).json({ error: "Failed to download backup" });
  }
});

/**
 * DELETE /api/admin/backups/:id
 * Delete a backup
 */
router.delete('/backups/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get backup info
    const backupQuery = 'SELECT * FROM database_backups WHERE id = $1';
    const backupResult = await pool.query(backupQuery, [id]);

    if (backupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backup = backupResult.rows[0];

    // Delete file from disk if it exists
    const backupDir = process.env.BACKUP_DIR || '/tmp/backups';
    const filepath = join(backupDir, backup.filename);
    
    try {
      const fs = await import('fs');
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
      }
    } catch (fileError) {
      console.warn(`Failed to delete backup file from disk: ${fileError}`);
    }

    // Delete backup record
    await pool.query('DELETE FROM database_backups WHERE id = $1', [id]);

    // Log deletion
    await logActivity({
      userId: req.user!.id,
      actionType: 'DELETE',
      resourceType: 'SETTINGS',
      resourceId: parseInt(id),
      description: `Deleted backup: ${backup.filename}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Backup deleted successfully' });

  } catch (error) {
    console.error("Error deleting backup:", error);
    res.status(500).json({ error: "Failed to delete backup" });
  }
});

// ===== SECURITY LOGS ENDPOINTS =====

/**
 * GET /api/admin/security/logs
 * Get security logs (login attempts, failed logins, etc.)
 */
router.get('/security/logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      event_type, 
      user_id, 
      ip_address,
      from_date,
      to_date 
    } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT 
        sl.id,
        sl.user_id,
        sl.event_type,
        sl.ip_address,
        sl.user_agent,
        sl.details,
        sl.created_at,
        u.username,
        u.name as user_name
      FROM security_logs sl
      LEFT JOIN users u ON sl.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Add filters
    if (event_type && event_type !== 'all') {
      query += ` AND sl.event_type = $${paramIndex}`;
      params.push(event_type);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND sl.user_id = $${paramIndex}`;
      params.push(Number(user_id));
      paramIndex++;
    }

    if (ip_address) {
      query += ` AND sl.ip_address ILIKE $${paramIndex}`;
      params.push(`%${ip_address}%`);
      paramIndex++;
    }

    if (from_date) {
      query += ` AND sl.created_at >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      query += ` AND sl.created_at <= $${paramIndex}`;
      params.push(to_date + ' 23:59:59');
      paramIndex++;
    }

    query += ` ORDER BY sl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);

    // Get total count with same filters
    let countQuery = 'SELECT COUNT(*) as total FROM security_logs sl WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (event_type && event_type !== 'all') {
      countQuery += ` AND sl.event_type = $${countParamIndex}`;
      countParams.push(event_type);
      countParamIndex++;
    }

    if (user_id) {
      countQuery += ` AND sl.user_id = $${countParamIndex}`;
      countParams.push(Number(user_id));
      countParamIndex++;
    }

    if (ip_address) {
      countQuery += ` AND sl.ip_address ILIKE $${countParamIndex}`;
      countParams.push(`%${ip_address}%`);
      countParamIndex++;
    }

    if (from_date) {
      countQuery += ` AND sl.created_at >= $${countParamIndex}`;
      countParams.push(from_date);
      countParamIndex++;
    }

    if (to_date) {
      countQuery += ` AND sl.created_at <= $${countParamIndex}`;
      countParams.push(to_date + ' 23:59:59');
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Log admin activity
    await logActivity({
      userId: req.user!.id,
      actionType: 'VIEW',
      resourceType: 'SETTINGS',
      description: 'Viewed security logs',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({
      logs: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error("Error fetching security logs:", error);
    res.status(500).json({ error: "Failed to fetch security logs" });
  }
});

/**
 * GET /api/admin/security/stats
 * Get security statistics
 */
router.get('/security/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') as successful_logins_24h,
        COUNT(*) FILTER (WHERE event_type = 'login_failure' AND created_at > NOW() - INTERVAL '24 hours') as failed_logins_24h,
        COUNT(*) FILTER (WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '7 days') as successful_logins_7d,
        COUNT(*) FILTER (WHERE event_type = 'login_failure' AND created_at > NOW() - INTERVAL '7 days') as failed_logins_7d,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'login_success' AND created_at > NOW() - INTERVAL '24 hours') as unique_users_24h,
        COUNT(DISTINCT ip_address) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as unique_ips_24h,
        COUNT(*) FILTER (WHERE event_type = 'account_locked') as locked_accounts,
        COUNT(*) FILTER (WHERE event_type = 'admin_action' AND created_at > NOW() - INTERVAL '24 hours') as admin_actions_24h
      FROM security_logs
    `;

    const result = await pool.query(statsQuery);

    // Get top failure IP addresses
    const topFailureIpsQuery = `
      SELECT 
        ip_address,
        COUNT(*) as failure_count,
        MAX(created_at) as last_attempt
      FROM security_logs 
      WHERE event_type = 'login_failure' 
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY ip_address
      ORDER BY failure_count DESC
      LIMIT 10
    `;

    const topFailureIpsResult = await pool.query(topFailureIpsQuery);

    res.json({
      stats: result.rows[0],
      topFailureIps: topFailureIpsResult.rows
    });

  } catch (error) {
    console.error("Error fetching security stats:", error);
    res.status(500).json({ error: "Failed to fetch security statistics" });
  }
});

export default router;