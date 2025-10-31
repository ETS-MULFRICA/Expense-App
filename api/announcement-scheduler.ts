import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db';
import { 
  insertAnnouncementSchema,
  updateAnnouncementSchema,
  type UserAnnouncementFeed
} from '../shared/schema';
import type { Request, Response } from "express";

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
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  
  const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.user!.id]);
  const userRole = userResult.rows[0]?.role;
  
  if (userRole !== 'admin') {
    return res.status(403).json({ message: "Access denied" });
  }
  
  next();
};

// ===== ADMIN ENDPOINTS =====

// GET /api/announcements - Admin: Get all announcements with stats
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.announcement_type,
        a.priority,
        a.created_by,
        u.name as creator_name,
        u.username as creator_username,
        a.target_audience,
        a.is_active,
        a.expires_at,
        a.created_at,
        a.updated_at,
        COUNT(ua.user_id) as total_interactions,
        COUNT(CASE WHEN ua.viewed_at IS NOT NULL THEN 1 END) as total_views,
        COUNT(CASE WHEN ua.read_at IS NOT NULL THEN 1 END) as total_reads,
        COUNT(CASE WHEN ua.dismissed_at IS NOT NULL THEN 1 END) as total_dismissals
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN user_announcements ua ON a.id = ua.announcement_id
      GROUP BY a.id, u.name, u.username
      ORDER BY a.created_at DESC
    `;

    const announcementsList = await pool.query(query);

    // Calculate rates for each announcement
    const totalUsersResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE role != 'admin'");
    const totalUserCount = parseInt(totalUsersResult.rows[0]?.count || '0');

    const announcementsWithStats = announcementsList.rows.map(announcement => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      announcementType: announcement.announcement_type,
      priority: announcement.priority,
      createdBy: announcement.created_by,
      creatorName: announcement.creator_name,
      creatorUsername: announcement.creator_username,
      targetAudience: announcement.target_audience,
      isActive: announcement.is_active,
      expiresAt: announcement.expires_at,
      createdAt: announcement.created_at,
      updatedAt: announcement.updated_at,
      totalInteractions: parseInt(announcement.total_interactions || '0'),
      totalViews: parseInt(announcement.total_views || '0'),
      totalReads: parseInt(announcement.total_reads || '0'),
      totalDismissals: parseInt(announcement.total_dismissals || '0'),
      viewRate: totalUserCount > 0 ? Number(((parseInt(announcement.total_views || '0') / totalUserCount) * 100).toFixed(2)) : 0,
      readRate: totalUserCount > 0 ? Number(((parseInt(announcement.total_reads || '0') / totalUserCount) * 100).toFixed(2)) : 0,
      dismissRate: totalUserCount > 0 ? Number(((parseInt(announcement.total_dismissals || '0') / totalUserCount) * 100).toFixed(2)) : 0,
    }));

    res.json(announcementsWithStats);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/:id - Admin: Get specific announcement with detailed stats
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Get announcement with creator info
    const announcementQuery = `
      SELECT 
        a.id,
        a.title,
        a.content,
        a.announcement_type,
        a.priority,
        a.created_by,
        u.name as creator_name,
        u.username as creator_username,
        a.target_audience,
        a.is_active,
        a.expires_at,
        a.created_at,
        a.updated_at
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `;

    const announcementResult = await pool.query(announcementQuery, [announcementId]);

    if (announcementResult.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Get detailed stats using the database function
    const statsResult = await pool.query('SELECT * FROM get_announcement_stats($1)', [announcementId]);

    const announcement = announcementResult.rows[0];
    const stats = statsResult.rows[0];

    const announcementWithStats = {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      announcementType: announcement.announcement_type,
      priority: announcement.priority,
      createdBy: announcement.created_by,
      creatorName: announcement.creator_name,
      creatorUsername: announcement.creator_username,
      targetAudience: announcement.target_audience,
      isActive: announcement.is_active,
      expiresAt: announcement.expires_at,
      createdAt: announcement.created_at,
      updatedAt: announcement.updated_at,
      totalUsers: parseInt(stats?.total_users || '0'),
      totalInteractions: parseInt(stats?.total_viewed || '0'),
      totalViews: parseInt(stats?.total_viewed || '0'),
      totalReads: parseInt(stats?.total_read || '0'),
      totalDismissals: parseInt(stats?.total_dismissed || '0'),
      viewRate: Number(stats?.view_rate || 0),
      readRate: Number(stats?.read_rate || 0),
      dismissRate: Number(stats?.dismiss_rate || 0),
    };

    res.json(announcementWithStats);
  } catch (error) {
    console.error('Error fetching announcement:', error);
    res.status(500).json({ error: 'Failed to fetch announcement' });
  }
});

// POST /api/announcements - Admin: Create new announcement
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const validatedData = insertAnnouncementSchema.parse(req.body);
    
    const result = await pool.query(`
      INSERT INTO announcements (title, content, announcement_type, priority, created_by, target_audience, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      validatedData.title,
      validatedData.content,
      validatedData.announcementType,
      validatedData.priority,
      req.user!.id,
      validatedData.targetAudience,
      validatedData.expiresAt
    ]);

    const newAnnouncement = result.rows[0];

    res.status(201).json({
      id: newAnnouncement.id,
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      announcementType: newAnnouncement.announcement_type,
      priority: newAnnouncement.priority,
      createdBy: newAnnouncement.created_by,
      targetAudience: newAnnouncement.target_audience,
      isActive: newAnnouncement.is_active,
      expiresAt: newAnnouncement.expires_at,
      createdAt: newAnnouncement.created_at,
      updatedAt: newAnnouncement.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// PUT /api/announcements/:id - Admin: Update announcement
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const validatedData = updateAnnouncementSchema.parse(req.body);
    
    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (validatedData.title !== undefined) {
      fields.push(`title = $${paramCount++}`);
      values.push(validatedData.title);
    }
    if (validatedData.content !== undefined) {
      fields.push(`content = $${paramCount++}`);
      values.push(validatedData.content);
    }
    if (validatedData.announcementType !== undefined) {
      fields.push(`announcement_type = $${paramCount++}`);
      values.push(validatedData.announcementType);
    }
    if (validatedData.priority !== undefined) {
      fields.push(`priority = $${paramCount++}`);
      values.push(validatedData.priority);
    }
    if (validatedData.targetAudience !== undefined) {
      fields.push(`target_audience = $${paramCount++}`);
      values.push(validatedData.targetAudience);
    }
    if (validatedData.isActive !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(validatedData.isActive);
    }
    if (validatedData.expiresAt !== undefined) {
      fields.push(`expires_at = $${paramCount++}`);
      values.push(validatedData.expiresAt);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(announcementId);

    const updateQuery = `
      UPDATE announcements 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const updatedAnnouncement = result.rows[0];

    res.json({
      id: updatedAnnouncement.id,
      title: updatedAnnouncement.title,
      content: updatedAnnouncement.content,
      announcementType: updatedAnnouncement.announcement_type,
      priority: updatedAnnouncement.priority,
      createdBy: updatedAnnouncement.created_by,
      targetAudience: updatedAnnouncement.target_audience,
      isActive: updatedAnnouncement.is_active,
      expiresAt: updatedAnnouncement.expires_at,
      createdAt: updatedAnnouncement.created_at,
      updatedAt: updatedAnnouncement.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/:id - Admin: Delete announcement
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [announcementId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// GET /api/announcements/:id/stats - Admin: Get detailed analytics for specific announcement
router.get('/:id/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Use the database function for detailed stats
    const statsResult = await pool.query('SELECT * FROM get_announcement_stats($1)', [announcementId]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const stats = statsResult.rows[0];

    res.json({
      totalUsers: parseInt(stats.total_users || '0'),
      totalViewed: parseInt(stats.total_viewed || '0'),
      totalRead: parseInt(stats.total_read || '0'),
      totalDismissed: parseInt(stats.total_dismissed || '0'),
      viewRate: Number(stats.view_rate || 0),
      readRate: Number(stats.read_rate || 0),
      dismissRate: Number(stats.dismiss_rate || 0),
    });
  } catch (error) {
    console.error('Error fetching announcement stats:', error);
    res.status(500).json({ error: 'Failed to fetch announcement statistics' });
  }
});

// ===== USER ENDPOINTS =====

// GET /api/announcements/user/feed - User: Get user's active announcements
router.get('/user/feed', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Use the database function to get user's announcements
    const userFeedResult = await pool.query('SELECT * FROM get_user_active_announcements($1)', [userId]);

    const feed: UserAnnouncementFeed[] = userFeedResult.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      announcementType: row.announcement_type,
      priority: row.priority,
      createdBy: row.created_by,
      creatorName: row.creator_name,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
      viewedAt: row.viewed_at ? row.viewed_at.toISOString() : null,
      readAt: row.read_at ? row.read_at.toISOString() : null,
      dismissedAt: row.dismissed_at ? row.dismissed_at.toISOString() : null,
      isNew: row.is_new,
    }));

    res.json(feed);
  } catch (error) {
    console.error('Error fetching user announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/announcements/user/:id/view - User: Mark announcement as viewed
router.post('/user/:id/view', requireAuth, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Use the database function to mark as viewed
    await pool.query('SELECT mark_announcement_viewed($1, $2)', [userId, announcementId]);

    res.json({ message: 'Announcement marked as viewed' });
  } catch (error) {
    console.error('Error marking announcement as viewed:', error);
    res.status(500).json({ error: 'Failed to mark announcement as viewed' });
  }
});

// POST /api/announcements/user/:id/read - User: Mark announcement as read
router.post('/user/:id/read', requireAuth, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Use the database function to mark as read
    await pool.query('SELECT mark_announcement_read($1, $2)', [userId, announcementId]);

    res.json({ message: 'Announcement marked as read' });
  } catch (error) {
    console.error('Error marking announcement as read:', error);
    res.status(500).json({ error: 'Failed to mark announcement as read' });
  }
});

// POST /api/announcements/user/:id/dismiss - User: Dismiss announcement
router.post('/user/:id/dismiss', requireAuth, async (req, res) => {
  try {
    const announcementId = parseInt(req.params.id);
    const userId = req.user!.id;
    
    if (isNaN(announcementId)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    // Use the database function to dismiss announcement
    await pool.query('SELECT dismiss_announcement($1, $2)', [userId, announcementId]);

    res.json({ message: 'Announcement dismissed' });
  } catch (error) {
    console.error('Error dismissing announcement:', error);
    res.status(500).json({ error: 'Failed to dismiss announcement' });
  }
});

// ===== UTILITY ENDPOINTS =====

// POST /api/announcements/cleanup - Admin: Clean up expired announcements
router.post('/cleanup', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT cleanup_expired_announcements()');

    const cleanedCount = result.rows[0]?.cleanup_expired_announcements || 0;
    res.json({ 
      message: `Cleaned up ${cleanedCount} expired announcements`,
      cleanedCount 
    });
  } catch (error) {
    console.error('Error cleaning up expired announcements:', error);
    res.status(500).json({ error: 'Failed to clean up expired announcements' });
  }
});

export default router;