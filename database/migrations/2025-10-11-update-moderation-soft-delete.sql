-- Update moderation system to support soft delete and user feedback
-- Date: 2025-10-11

-- Add soft delete and feedback columns to content_reports
ALTER TABLE content_reports 
ADD COLUMN deleted_at TIMESTAMP,
ADD COLUMN moderator_feedback TEXT;

-- Add feedback columns to moderation_actions
ALTER TABLE moderation_actions 
ADD COLUMN user_feedback TEXT,
ADD COLUMN feedback_sent_at TIMESTAMP;

-- Create index for soft delete queries
CREATE INDEX idx_content_reports_deleted_at ON content_reports(deleted_at);
CREATE INDEX idx_content_reports_active ON content_reports(id) WHERE deleted_at IS NULL;

-- Update moderation queue view to exclude soft deleted reports
DROP VIEW IF EXISTS moderation_queue_view;
CREATE VIEW moderation_queue_view AS
SELECT 
    cr.id as report_id,
    cr.content_type,
    cr.content_id,
    cr.reporter_id,
    cr.reported_user_id,
    cr.reason,
    cr.description,
    cr.status,
    cr.priority,
    cr.created_at as reported_at,
    cr.moderator_feedback,
    reporter.username as reporter_username,
    reporter.name as reporter_name,
    reported_user.username as reported_username,
    reported_user.name as reported_name,
    CASE 
        WHEN cr.content_type = 'announcement' THEN a.title
        WHEN cr.content_type = 'expense' THEN e.description
        ELSE 'Unknown Content'
    END as content_title,
    CASE 
        WHEN cr.content_type = 'announcement' THEN a.content
        WHEN cr.content_type = 'expense' THEN CONCAT('Amount: ', e.amount, ', Merchant: ', COALESCE(e.merchant, 'N/A'))
        ELSE 'Content details unavailable'
    END as content_preview
FROM content_reports cr
JOIN users reporter ON cr.reporter_id = reporter.id
JOIN users reported_user ON cr.reported_user_id = reported_user.id
LEFT JOIN announcements a ON cr.content_type = 'announcement' AND cr.content_id = a.id
LEFT JOIN expenses e ON cr.content_type = 'expense' AND cr.content_id = e.id
WHERE cr.deleted_at IS NULL  -- Only show non-deleted reports
ORDER BY 
    CASE cr.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
    END,
    cr.created_at DESC;

-- Create user_notifications table for feedback system
CREATE TABLE IF NOT EXISTS user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
    related_report_id INTEGER REFERENCES content_reports(id),
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX idx_user_notifications_active ON user_notifications(id) WHERE deleted_at IS NULL;

-- Function to send notification to user when report is resolved
CREATE OR REPLACE FUNCTION send_report_resolution_notification(
    report_id INTEGER,
    feedback_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    report_record RECORD;
    notification_title VARCHAR(255);
    notification_message TEXT;
BEGIN
    -- Get report details
    SELECT 
        cr.*,
        reporter.username as reporter_username,
        reported_user.username as reported_username
    INTO report_record
    FROM content_reports cr
    JOIN users reporter ON cr.reporter_id = reporter.id
    JOIN users reported_user ON cr.reported_user_id = reported_user.id
    WHERE cr.id = report_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Report with ID % not found', report_id;
    END IF;
    
    -- Prepare notification content
    notification_title := 'Report Update: Issue Resolved';
    
    IF feedback_message IS NOT NULL AND feedback_message != '' THEN
        notification_message := format(
            'Your report about %s content has been reviewed and resolved. Moderator feedback: %s',
            report_record.content_type,
            feedback_message
        );
    ELSE
        notification_message := format(
            'Your report about %s content has been reviewed and resolved. Thank you for helping maintain our community standards.',
            report_record.content_type
        );
    END IF;
    
    -- Send notification to reporter
    INSERT INTO user_notifications (user_id, title, message, type, related_report_id)
    VALUES (report_record.reporter_id, notification_title, notification_message, 'success', report_id);
    
    -- If the reported user is different from reporter, optionally notify them too
    IF report_record.reported_user_id != report_record.reporter_id THEN
        INSERT INTO user_notifications (user_id, title, message, type, related_report_id)
        VALUES (
            report_record.reported_user_id, 
            'Content Report Resolution',
            format('A report about your %s content has been resolved. %s', 
                   report_record.content_type,
                   COALESCE('Moderator note: ' || feedback_message, 'Thank you for your cooperation.')),
            'info',
            report_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION send_report_resolution_notification IS 'Send notifications to users when a report is resolved with optional feedback';