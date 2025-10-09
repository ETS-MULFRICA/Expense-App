-- Create announcements and user_announcements tables for admin-to-user communication
-- Migration: 2025-10-09-create-announcements-system.sql

-- ===== ANNOUNCEMENTS TABLE =====
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type VARCHAR(20) DEFAULT 'general', -- general, urgent, maintenance, update, welcome
  priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_audience VARCHAR(20) DEFAULT 'all', -- all, new_users, active_users, specific_roles
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP, -- nullable - no expiry if null
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===== USER ANNOUNCEMENTS TRACKING TABLE =====
CREATE TABLE IF NOT EXISTS user_announcements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP, -- when user first saw the announcement
  read_at TIMESTAMP, -- when user fully read/clicked the announcement
  dismissed_at TIMESTAMP, -- when user dismissed/closed the announcement
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one record per user per announcement
  UNIQUE(user_id, announcement_id)
);

-- ===== PERFORMANCE INDEXES =====
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(announcement_type);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);

CREATE INDEX IF NOT EXISTS idx_user_announcements_user ON user_announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_announcements_announcement ON user_announcements(announcement_id);
CREATE INDEX IF NOT EXISTS idx_user_announcements_viewed ON user_announcements(viewed_at);
CREATE INDEX IF NOT EXISTS idx_user_announcements_read ON user_announcements(read_at);

-- ===== AUTO-UPDATE TRIGGERS =====
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- ===== HELPER FUNCTIONS =====

-- Function to get active announcements for a specific user
CREATE OR REPLACE FUNCTION get_user_active_announcements(target_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    title TEXT,
    content TEXT,
    announcement_type VARCHAR(20),
    priority VARCHAR(10),
    created_by INTEGER,
    creator_name TEXT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    viewed_at TIMESTAMP,
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    is_new BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.content,
        a.announcement_type,
        a.priority,
        a.created_by,
        u.name as creator_name,
        a.created_at,
        a.expires_at,
        ua.viewed_at,
        ua.read_at,
        ua.dismissed_at,
        (ua.viewed_at IS NULL) as is_new
    FROM announcements a
    JOIN users u ON a.created_by = u.id
    LEFT JOIN user_announcements ua ON (a.id = ua.announcement_id AND ua.user_id = target_user_id)
    WHERE a.is_active = TRUE 
      AND (a.expires_at IS NULL OR a.expires_at > NOW())
      AND ua.dismissed_at IS NULL
    ORDER BY 
        CASE a.priority 
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3
            WHEN 'low' THEN 4
        END,
        a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark announcement as viewed
CREATE OR REPLACE FUNCTION mark_announcement_viewed(target_user_id INTEGER, target_announcement_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO user_announcements (user_id, announcement_id, viewed_at)
    VALUES (target_user_id, target_announcement_id, NOW())
    ON CONFLICT (user_id, announcement_id) 
    DO UPDATE SET viewed_at = COALESCE(user_announcements.viewed_at, NOW());
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to mark announcement as read
CREATE OR REPLACE FUNCTION mark_announcement_read(target_user_id INTEGER, target_announcement_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO user_announcements (user_id, announcement_id, viewed_at, read_at)
    VALUES (target_user_id, target_announcement_id, NOW(), NOW())
    ON CONFLICT (user_id, announcement_id) 
    DO UPDATE SET 
        viewed_at = COALESCE(user_announcements.viewed_at, NOW()),
        read_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to dismiss announcement
CREATE OR REPLACE FUNCTION dismiss_announcement(target_user_id INTEGER, target_announcement_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO user_announcements (user_id, announcement_id, viewed_at, dismissed_at)
    VALUES (target_user_id, target_announcement_id, NOW(), NOW())
    ON CONFLICT (user_id, announcement_id) 
    DO UPDATE SET 
        viewed_at = COALESCE(user_announcements.viewed_at, NOW()),
        dismissed_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get announcement statistics
CREATE OR REPLACE FUNCTION get_announcement_stats(target_announcement_id INTEGER)
RETURNS TABLE (
    total_users INTEGER,
    total_viewed INTEGER,
    total_read INTEGER,
    total_dismissed INTEGER,
    view_rate DECIMAL,
    read_rate DECIMAL,
    dismiss_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role != 'admin') as total_users,
            COUNT(CASE WHEN ua.viewed_at IS NOT NULL THEN 1 END) as total_viewed,
            COUNT(CASE WHEN ua.read_at IS NOT NULL THEN 1 END) as total_read,
            COUNT(CASE WHEN ua.dismissed_at IS NOT NULL THEN 1 END) as total_dismissed
        FROM users u
        LEFT JOIN user_announcements ua ON (u.id = ua.user_id AND ua.announcement_id = target_announcement_id)
        WHERE u.role != 'admin'
    )
    SELECT 
        s.total_users,
        s.total_viewed,
        s.total_read,
        s.total_dismissed,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_viewed::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as view_rate,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_read::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as read_rate,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_dismissed::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as dismiss_rate
    FROM stats s;
END;
$$ LANGUAGE plpgsql;

-- ===== ADMIN PERMISSIONS =====
-- Add announcement management permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('admin:announcements:create', 'Create new announcements', 'announcements', 'create'),
('admin:announcements:read', 'View all announcements and analytics', 'announcements', 'read'),
('admin:announcements:update', 'Edit existing announcements', 'announcements', 'update'),
('admin:announcements:delete', 'Delete announcements', 'announcements', 'delete'),
('admin:announcements:stats', 'View announcement statistics and analytics', 'announcements', 'stats')
ON CONFLICT (name) DO NOTHING;

-- Assign all announcement permissions to admin role
DO $$
DECLARE
    admin_role_id INTEGER;
    perm RECORD;
BEGIN
    -- Get admin role ID
    SELECT id INTO admin_role_id FROM roles WHERE name = 'admin';
    
    -- Assign all announcement permissions to admin role
    IF admin_role_id IS NOT NULL THEN
        FOR perm IN (SELECT id FROM permissions WHERE name LIKE 'admin:announcements:%')
        LOOP
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- ===== SAMPLE DATA FOR TESTING =====
-- Create a welcome announcement from the first admin user
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    -- Get first admin user
    SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    -- Create welcome announcement if admin exists
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO announcements (
            title, 
            content, 
            announcement_type, 
            priority, 
            created_by,
            target_audience
        ) VALUES (
            'Welcome to Expense Tracker!',
            'Welcome to our expense tracking application! We''re excited to help you manage your finances better. 

Features available to you:
• Track expenses and income
• Create and manage budgets  
• View detailed analytics and reports
• Export your financial data

If you have any questions or need assistance, please don''t hesitate to reach out to our support team.

Happy expense tracking!',
            'welcome',
            'normal',
            admin_user_id,
            'all'
        );
        
        INSERT INTO announcements (
            title, 
            content, 
            announcement_type, 
            priority, 
            created_by,
            target_audience
        ) VALUES (
            'System Maintenance Notice',
            'Please note that we will be performing scheduled maintenance on Sunday, October 15th from 2:00 AM to 4:00 AM UTC.

During this time:
• The application may be temporarily unavailable
• Data synchronization might be delayed
• Some features may have limited functionality

We apologize for any inconvenience and appreciate your patience as we work to improve our services.',
            'maintenance',
            'high',
            admin_user_id,
            'all'
        );
    END IF;
END $$;

-- ===== CLEANUP FUNCTION =====
-- Function to automatically clean up expired announcements (can be called by cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_announcements()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    -- Mark expired announcements as inactive instead of deleting them
    UPDATE announcements 
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active = TRUE 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW();
      
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- ===== VIEWS FOR EASY QUERYING =====
-- View for announcement overview with statistics
CREATE OR REPLACE VIEW announcement_overview AS
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
JOIN users u ON a.created_by = u.id
LEFT JOIN user_announcements ua ON a.id = ua.announcement_id
GROUP BY a.id, u.name, u.username
ORDER BY a.created_at DESC;