import { Request, Response } from "express";
import { pool } from "./db";

// Authentication middleware
const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  next();
};

const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
    return res.sendStatus(403);
  }
  next();
};

export interface ContentReport {
  id?: number;
  reporter_id: number;
  reported_user_id: number;
  content_type: 'expense' | 'income' | 'budget' | 'announcement' | 'user_profile' | 'category';
  content_id: number;
  reason: 'spam' | 'inappropriate' | 'harassment' | 'fraud' | 'offensive' | 'other';
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at?: string;
  updated_at?: string;
}

export interface ModerationAction {
  id?: number;
  report_id?: number;
  moderator_id: number;
  action_type: 'warn_user' | 'hide_content' | 'suspend_user' | 'delete_content' | 'escalate' | 'dismiss' | 'restore_content';
  reason: string;
  details?: string;
  auto_action?: boolean;
  created_at?: string;
}

export interface UserWarning {
  id?: number;
  user_id: number;
  moderator_id: number;
  warning_type: 'content_violation' | 'spam' | 'harassment' | 'fraud' | 'general';
  message: string;
  severity: 'low' | 'medium' | 'high';
  is_active?: boolean;
  expires_at?: string;
  created_at?: string;
}

export interface FlaggedContent {
  id?: number;
  content_type: 'expense' | 'income' | 'budget' | 'announcement' | 'user_profile' | 'category';
  content_id: number;
  user_id: number;
  moderator_id?: number;
  reason: string;
  is_hidden?: boolean;
  hide_reason?: string;
  flagged_at?: string;
  resolved_at?: string;
}

export interface UserSuspension {
  id?: number;
  user_id: number;
  moderator_id: number;
  reason: string;
  suspension_type: 'temporary' | 'permanent';
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  created_at?: string;
}

// Moderation routes
export async function moderationRoutes(app: any) {

  // Get moderation queue
  app.get("/api/admin/moderation/queue", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user;

      const { status = 'pending', priority, page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          cr.id,
          cr.content_type,
          cr.content_id,
          cr.reason,
          cr.description,
          cr.status,
          cr.priority,
          cr.created_at,
          cr.updated_at,
          reporter.username as reporter_username,
          reporter.name as reporter_name,
          reported.username as reported_username,
          reported.name as reported_name,
          reported.id as reported_user_id,
          reported.email as reported_user_email,
          (SELECT COUNT(*) FROM content_reports cr2 WHERE cr2.reported_user_id = cr.reported_user_id AND cr2.id < cr.id) as previous_reports,
          EXISTS(SELECT 1 FROM flagged_content fc WHERE fc.content_type = cr.content_type AND fc.content_id = cr.content_id AND fc.is_hidden = true) as is_hidden,
          EXISTS(SELECT 1 FROM user_warnings uw WHERE uw.user_id = cr.reported_user_id AND uw.is_active = true) as has_active_warnings
        FROM content_reports cr
        JOIN users reporter ON cr.reporter_id = reporter.id
        JOIN users reported ON cr.reported_user_id = reported.id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        query += ` AND cr.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (priority && priority !== 'all') {
        query += ` AND cr.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      query += `
        ORDER BY 
          CASE cr.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          cr.created_at ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM content_reports cr
        WHERE 1=1
        ${status && status !== 'all' ? `AND cr.status = '${status}'` : ''}
        ${priority && priority !== 'all' ? `AND cr.priority = '${priority}'` : ''}
      `;
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        reports: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching user warnings:", error);
      res.status(500).json({ error: "Failed to fetch user warnings" });
    }
  });

  // Get user notifications (for feedback from moderators)
  app.get("/api/user/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { page = 1, limit = 20, unread_only = false } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          id,
          title,
          message,
          type,
          related_report_id,
          read_at,
          created_at
        FROM user_notifications 
        WHERE user_id = $1 AND deleted_at IS NULL
      `;

      const params: any[] = [user!.id];
      let paramIndex = 2;

      if (unread_only === 'true') {
        query += ` AND read_at IS NULL`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      // Get unread count
      const unreadResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL',
        [user!.id]
      );

      res.json({
        notifications: result.rows,
        unreadCount: parseInt(unreadResult.rows[0].count),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.rows.length
        }
      });
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.post("/api/user/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { id } = req.params;

      await pool.query(
        'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
        [id, user!.id]
      );

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/user/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;

      await pool.query(
        'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL',
        [user!.id]
      );

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Create content report
  app.post("/api/moderation/report", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { content_type, content_id, reported_user_id, reason, description } = req.body;

      if (!content_type || !content_id || !reported_user_id || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if user is trying to report themselves
      if (user!.id === reported_user_id) {
        return res.status(400).json({ error: "Cannot report your own content" });
      }

      // Check if report already exists
      const existingReport = await pool.query(
        `SELECT id FROM content_reports 
         WHERE reporter_id = $1 AND content_type = $2 AND content_id = $3 AND status IN ('pending', 'reviewing')`,
        [user!.id, content_type, content_id]
      );

      if (existingReport.rows.length > 0) {
        return res.status(400).json({ error: "You have already reported this content" });
      }

      const query = `
        INSERT INTO content_reports (reporter_id, reported_user_id, content_type, content_id, reason, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await pool.query(query, [
        user!.id,
        reported_user_id,
        content_type,
        content_id,
        reason,
        description || null
      ]);

      res.status(201).json({ 
        message: "Report submitted successfully",
        report: result.rows[0] 
      });
    } catch (error) {
      console.error("Error creating content report:", error);
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  // Take moderation action
  app.post("/api/admin/moderation/action", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { report_id, action_type, reason, details, content_type, content_id, target_user_id, user_feedback } = req.body;

      if (!action_type || !reason) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Start transaction
      await pool.query('BEGIN');

      try {
        // For resolve action, implement soft delete
        if (action_type === 'resolve') {
          if (report_id) {
            // Soft delete the report
            await pool.query(
              `UPDATE content_reports 
               SET status = 'resolved', moderator_feedback = $1, deleted_at = CURRENT_TIMESTAMP, updated_at = NOW() 
               WHERE id = $2`,
              [user_feedback || null, report_id]
            );

            // Send notification to user if feedback provided
            if (user_feedback && user_feedback.trim()) {
              await pool.query(
                'SELECT send_report_resolution_notification($1, $2)',
                [report_id, user_feedback]
              );
            } else {
              await pool.query(
                'SELECT send_report_resolution_notification($1)',
                [report_id]
              );
            }
          }

          // Record the moderation action with feedback
          const actionQuery = `
            INSERT INTO moderation_actions (report_id, moderator_id, action_type, reason, details, user_feedback, feedback_sent_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `;

          await pool.query(actionQuery, [
            report_id || null,
            user!.id,
            action_type,
            reason,
            details || null,
            user_feedback || null,
            user_feedback ? new Date() : null
          ]);

          await pool.query('COMMIT');

          return res.json({
            message: "Report resolved successfully",
            action: action_type,
            reportId: report_id,
            feedbackSent: !!user_feedback
          });
        }

        // Record the moderation action (for non-resolve actions)
        const actionQuery = `
          INSERT INTO moderation_actions (report_id, moderator_id, action_type, reason, details, user_feedback, feedback_sent_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

        const actionResult = await pool.query(actionQuery, [
          report_id || null,
          user!.id,
          action_type,
          reason,
          details || null,
          user_feedback || null,
          user_feedback ? new Date() : null
        ]);

        // Perform the specific action
        switch (action_type) {
          case 'hide_content':
            if (content_type && content_id && target_user_id) {
              await pool.query(
                `INSERT INTO flagged_content (content_type, content_id, user_id, moderator_id, reason, hide_reason)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (content_type, content_id) 
                 DO UPDATE SET is_hidden = true, moderator_id = $4, reason = $5, hide_reason = $6`,
                [content_type, content_id, target_user_id, user!.id, reason, details]
              );
            }
            break;

          case 'warn_user':
            if (target_user_id) {
              const warningMessage = details || `Warning issued for: ${reason}`;
              await pool.query(
                `INSERT INTO user_warnings (user_id, moderator_id, warning_type, message, severity)
                 VALUES ($1, $2, $3, $4, $5)`,
                [target_user_id, user!.id, 'content_violation', warningMessage, 'medium']
              );

              // Send notification to user
              await pool.query(
                `INSERT INTO user_notifications (user_id, title, message, type, related_report_id) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  target_user_id,
                  'Content Warning',
                  user_feedback || warningMessage,
                  'warning',
                  report_id
                ]
              );
            }
            break;

          case 'suspend_user':
            if (target_user_id) {
              const endDate = new Date();
              endDate.setDate(endDate.getDate() + 7); // 7-day suspension
              
              await pool.query(
                `INSERT INTO user_suspensions (user_id, moderator_id, reason, suspension_type, end_date)
                 VALUES ($1, $2, $3, $4, $5)`,
                [target_user_id, user!.id, reason, 'temporary', endDate.toISOString()]
              );

              // Update user status
              await pool.query(
                `UPDATE users SET status = 'suspended' WHERE id = $1`,
                [target_user_id]
              );

              // Send suspension notification
              await pool.query(
                `INSERT INTO user_notifications (user_id, title, message, type, related_report_id) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  target_user_id,
                  'Account Suspended',
                  user_feedback || `Your account has been suspended for 7 days. Reason: ${reason}`,
                  'error',
                  report_id
                ]
              );
            }
            break;

          case 'restore_content':
            if (content_type && content_id) {
              await pool.query(
                `UPDATE flagged_content 
                 SET is_hidden = false, resolved_at = NOW() 
                 WHERE content_type = $1 AND content_id = $2`,
                [content_type, content_id]
              );
            }
            break;
        }

        // Update report status if provided (for non-resolve actions)
        if (report_id) {
          const newStatus = action_type === 'dismiss' ? 'dismissed' : 'resolved';
          await pool.query(
            `UPDATE content_reports SET status = $1, moderator_feedback = $2, updated_at = NOW() WHERE id = $3`,
            [newStatus, user_feedback, report_id]
          );
        }

        await pool.query('COMMIT');

        res.json({
          message: "Moderation action completed successfully",
          action: actionResult.rows[0]
        });
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error("Error taking moderation action:", error);
      res.status(500).json({ error: "Failed to complete moderation action" });
    }
  });

  // Get user moderation history
  app.get("/api/admin/moderation/user/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const query = `
        SELECT 
          u.id,
          u.username,
          u.name,
          u.email,
          u.status,
          u.created_at as user_created_at,
          -- Warning counts
          (SELECT COUNT(*) FROM user_warnings uw WHERE uw.user_id = u.id AND uw.is_active = true) as active_warnings,
          (SELECT COUNT(*) FROM user_warnings uw WHERE uw.user_id = u.id) as total_warnings,
          -- Suspension info
          (SELECT COUNT(*) FROM user_suspensions us WHERE us.user_id = u.id AND us.is_active = true) as active_suspensions,
          (SELECT COUNT(*) FROM user_suspensions us WHERE us.user_id = u.id) as total_suspensions,
          -- Report counts
          (SELECT COUNT(*) FROM content_reports cr WHERE cr.reported_user_id = u.id) as reports_against,
          (SELECT COUNT(*) FROM content_reports cr WHERE cr.reporter_id = u.id) as reports_made,
          -- Flagged content count
          (SELECT COUNT(*) FROM flagged_content fc WHERE fc.user_id = u.id AND fc.is_hidden = true) as hidden_content_count
        FROM users u
        WHERE u.id = $1
      `;

      const result = await pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get recent warnings
      const warningsQuery = `
        SELECT uw.*, m.username as moderator_username, m.name as moderator_name
        FROM user_warnings uw
        JOIN users m ON uw.moderator_id = m.id
        WHERE uw.user_id = $1
        ORDER BY uw.created_at DESC
        LIMIT 10
      `;
      const warnings = await pool.query(warningsQuery, [userId]);

      // Get recent reports
      const reportsQuery = `
        SELECT cr.*, 
               reporter.username as reporter_username,
               reporter.name as reporter_name
        FROM content_reports cr
        JOIN users reporter ON cr.reporter_id = reporter.id
        WHERE cr.reported_user_id = $1
        ORDER BY cr.created_at DESC
        LIMIT 10
      `;
      const reports = await pool.query(reportsQuery, [userId]);

      // Get recent moderation actions
      const actionsQuery = `
        SELECT ma.*, m.username as moderator_username, m.name as moderator_name
        FROM moderation_actions ma
        JOIN users m ON ma.moderator_id = m.id
        JOIN content_reports cr ON ma.report_id = cr.id
        WHERE cr.reported_user_id = $1
        ORDER BY ma.created_at DESC
        LIMIT 10
      `;
      const actions = await pool.query(actionsQuery, [userId]);

      res.json({
        user: result.rows[0],
        warnings: warnings.rows,
        reports: reports.rows,
        actions: actions.rows
      });
    } catch (error) {
      console.error("Error fetching user moderation history:", error);
      res.status(500).json({ error: "Failed to fetch user moderation history" });
    }
  });

  // Get moderation statistics
  app.get("/api/admin/moderation/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM content_reports WHERE status = 'pending') as pending_reports,
          (SELECT COUNT(*) FROM content_reports WHERE status = 'reviewing') as reviewing_reports,
          (SELECT COUNT(*) FROM content_reports WHERE created_at > NOW() - INTERVAL '24 hours') as reports_today,
          (SELECT COUNT(*) FROM content_reports WHERE created_at > NOW() - INTERVAL '7 days') as reports_this_week,
          (SELECT COUNT(*) FROM flagged_content WHERE is_hidden = true) as hidden_content,
          (SELECT COUNT(*) FROM user_warnings WHERE is_active = true) as active_warnings,
          (SELECT COUNT(*) FROM user_suspensions WHERE is_active = true) as active_suspensions,
          (SELECT COUNT(DISTINCT reported_user_id) FROM content_reports WHERE created_at > NOW() - INTERVAL '30 days') as flagged_users_this_month
      `);

      res.json(stats.rows[0]);
    } catch (error) {
      console.error("Error fetching moderation stats:", error);
      res.status(500).json({ error: "Failed to fetch moderation statistics" });
    }
  });

  // Get moderation templates
  app.get("/api/admin/moderation/templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type } = req.query;

      let query = "SELECT * FROM moderation_templates WHERE is_active = true";
      const params: any[] = [];

      if (type) {
        query += " AND template_type = $1";
        params.push(type);
      }

      query += " ORDER BY category, title";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching moderation templates:", error);
      res.status(500).json({ error: "Failed to fetch moderation templates" });
    }
  });

  // Check if content is hidden (for frontend to hide content from regular users)
  app.get("/api/moderation/content/:contentType/:contentId/hidden", async (req: Request, res: Response) => {
    try {
      const { contentType, contentId } = req.params;

      const result = await pool.query(
        "SELECT is_content_hidden($1, $2) as is_hidden",
        [contentType, contentId]
      );

      res.json({ isHidden: result.rows[0].is_hidden });
    } catch (error) {
      console.error("Error checking content visibility:", error);
      res.status(500).json({ error: "Failed to check content visibility" });
    }
  });

  // Get user notifications (for feedback from moderators)
  app.get("/api/user/notifications", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { page = 1, limit = 20, unread_only = false } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      let query = `
        SELECT 
          id,
          title,
          message,
          type,
          related_report_id,
          read_at,
          created_at
        FROM user_notifications 
        WHERE user_id = $1 AND deleted_at IS NULL
      `;

      const params: any[] = [user!.id];
      let paramIndex = 2;

      if (unread_only === 'true') {
        query += ` AND read_at IS NULL`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(Number(limit), offset);

      const result = await pool.query(query, params);

      // Get unread count
      const unreadResult = await pool.query(
        'SELECT COUNT(*) as count FROM user_notifications WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL',
        [user!.id]
      );

      res.json({
        notifications: result.rows,
        unreadCount: parseInt(unreadResult.rows[0].count),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.rows.length
        }
      });
    } catch (error) {
      console.error("Error fetching user notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.post("/api/user/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;
      const { id } = req.params;

      await pool.query(
        'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
        [id, user!.id]
      );

      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/user/notifications/read-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user;

      await pool.query(
        'UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL',
        [user!.id]
      );

      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
}