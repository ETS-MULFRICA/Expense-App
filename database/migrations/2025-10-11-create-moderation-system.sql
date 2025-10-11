-- Moderation and Reports System Database Schema
-- This SQL creates tables for managing flagged content and user reports

-- Content Reports table - for users to report inappropriate content
CREATE TABLE IF NOT EXISTS content_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('expense', 'income', 'budget', 'announcement', 'user_profile', 'category')),
  content_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'fraud', 'offensive', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation Actions table - tracks actions taken by moderators
CREATE TABLE IF NOT EXISTS moderation_actions (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES content_reports(id) ON DELETE CASCADE,
  moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('warn_user', 'hide_content', 'suspend_user', 'delete_content', 'escalate', 'dismiss', 'restore_content')),
  reason TEXT NOT NULL,
  details TEXT,
  auto_action BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Warnings table - tracks warnings issued to users
CREATE TABLE IF NOT EXISTS user_warnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warning_type TEXT NOT NULL CHECK (warning_type IN ('content_violation', 'spam', 'harassment', 'fraud', 'general')),
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flagged Content table - content that has been flagged/hidden
CREATE TABLE IF NOT EXISTS flagged_content (
  id SERIAL PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('expense', 'income', 'budget', 'announcement', 'user_profile', 'category')),
  content_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT true,
  hide_reason TEXT,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure unique constraint on content
  UNIQUE(content_type, content_id)
);

-- User Suspensions table - tracks user suspensions
CREATE TABLE IF NOT EXISTS user_suspensions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  suspension_type TEXT DEFAULT 'temporary' CHECK (suspension_type IN ('temporary', 'permanent')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation Notes table - internal notes for moderators
CREATE TABLE IF NOT EXISTS moderation_notes (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'report', 'content')),
  target_id INTEGER NOT NULL,
  moderator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_priority ON content_reports(priority);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_user ON content_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_lookup ON flagged_content(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_flagged_content_user ON flagged_content(user_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_active ON user_warnings(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_active ON user_suspensions(user_id, is_active);

-- Create views for easy querying

-- Active moderation queue view
CREATE OR REPLACE VIEW moderation_queue AS
SELECT 
  cr.id,
  cr.content_type,
  cr.content_id,
  cr.reason,
  cr.description,
  cr.status,
  cr.priority,
  cr.created_at,
  reporter.username as reporter_username,
  reporter.name as reporter_name,
  reported.username as reported_username,
  reported.name as reported_name,
  reported.id as reported_user_id,
  CASE 
    WHEN cr.status = 'pending' THEN 'new'
    WHEN cr.status = 'reviewing' THEN 'in_progress'
    ELSE 'completed'
  END as queue_status,
  -- Count of previous reports for this user
  (SELECT COUNT(*) FROM content_reports cr2 WHERE cr2.reported_user_id = cr.reported_user_id AND cr2.id < cr.id) as previous_reports,
  -- Check if content is currently hidden
  EXISTS(SELECT 1 FROM flagged_content fc WHERE fc.content_type = cr.content_type AND fc.content_id = cr.content_id AND fc.is_hidden = true) as is_hidden
FROM content_reports cr
JOIN users reporter ON cr.reporter_id = reporter.id
JOIN users reported ON cr.reported_user_id = reported.id
WHERE cr.status IN ('pending', 'reviewing')
ORDER BY 
  CASE cr.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  cr.created_at ASC;

-- User moderation history view
CREATE OR REPLACE VIEW user_moderation_history AS
SELECT 
  u.id as user_id,
  u.username,
  u.name,
  u.email,
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
  (SELECT COUNT(*) FROM flagged_content fc WHERE fc.user_id = u.id AND fc.is_hidden = true) as hidden_content_count,
  -- Last moderation action
  (SELECT ma.created_at FROM moderation_actions ma 
   JOIN content_reports cr ON ma.report_id = cr.id 
   WHERE cr.reported_user_id = u.id 
   ORDER BY ma.created_at DESC LIMIT 1) as last_moderation_action
FROM users u
WHERE u.role != 'admin' -- Exclude admins from moderation history
ORDER BY reports_against DESC, active_warnings DESC;

-- Content visibility function - check if content should be hidden
CREATE OR REPLACE FUNCTION is_content_hidden(content_type_param TEXT, content_id_param INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM flagged_content 
    WHERE content_type = content_type_param 
    AND content_id = content_id_param 
    AND is_hidden = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to automatically escalate reports
CREATE OR REPLACE FUNCTION auto_escalate_reports()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-escalate if user has 3+ reports in last 30 days
  IF (SELECT COUNT(*) FROM content_reports 
      WHERE reported_user_id = NEW.reported_user_id 
      AND created_at > NOW() - INTERVAL '30 days') >= 3 THEN
    
    NEW.priority = 'high';
  END IF;
  
  -- Auto-escalate if user has active warnings
  IF EXISTS(SELECT 1 FROM user_warnings 
           WHERE user_id = NEW.reported_user_id 
           AND is_active = true) THEN
    
    NEW.priority = CASE 
      WHEN NEW.priority = 'low' THEN 'medium'
      WHEN NEW.priority = 'medium' THEN 'high'
      ELSE NEW.priority
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-escalation
CREATE TRIGGER trigger_auto_escalate_reports
  BEFORE INSERT ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_escalate_reports();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_moderation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE TRIGGER trigger_update_content_reports_timestamp
  BEFORE UPDATE ON content_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_moderation_timestamp();

-- Insert some sample moderation reasons and templates
CREATE TABLE IF NOT EXISTS moderation_templates (
  id SERIAL PRIMARY KEY,
  template_type TEXT NOT NULL CHECK (template_type IN ('warning_message', 'suspension_reason', 'escalation_note')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default warning templates
INSERT INTO moderation_templates (template_type, category, title, content) VALUES
('warning_message', 'content_violation', 'Inappropriate Content Warning', 'Your recent content has been flagged as inappropriate. Please review our community guidelines and ensure future posts comply with our standards.'),
('warning_message', 'spam', 'Spam Activity Warning', 'We have detected spam-like behavior in your account. Please refrain from posting repetitive or irrelevant content.'),
('warning_message', 'harassment', 'Harassment Warning', 'Your behavior has been reported as harassment. This is not acceptable in our community. Please treat all users with respect.'),
('suspension_reason', 'repeated_violations', 'Multiple Violations', 'Account suspended due to repeated violations of community guidelines despite previous warnings.'),
('suspension_reason', 'severe_violation', 'Severe Policy Violation', 'Account suspended for severe violation of our terms of service and community guidelines.'),
('escalation_note', 'pattern_behavior', 'Pattern of Problematic Behavior', 'User shows a consistent pattern of problematic behavior requiring administrative review.');

COMMENT ON TABLE content_reports IS 'User reports of inappropriate content or behavior';
COMMENT ON TABLE moderation_actions IS 'Actions taken by moderators in response to reports';
COMMENT ON TABLE user_warnings IS 'Warnings issued to users for policy violations';
COMMENT ON TABLE flagged_content IS 'Content that has been flagged or hidden by moderators';
COMMENT ON TABLE user_suspensions IS 'User account suspensions and bans';
COMMENT ON TABLE moderation_notes IS 'Internal notes for moderators about users or content';
COMMENT ON VIEW moderation_queue IS 'Active moderation queue for admins to review';
COMMENT ON VIEW user_moderation_history IS 'Comprehensive moderation history for each user';