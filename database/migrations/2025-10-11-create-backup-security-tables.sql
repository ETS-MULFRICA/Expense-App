-- Migration: Create backup and security tables
-- Date: 2025-10-11
-- Description: Add database backup management and security logging tables

BEGIN;

-- Database backups table
CREATE TABLE IF NOT EXISTS database_backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size BIGINT DEFAULT 0,
  type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'schema_only', 'data_only')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')) DEFAULT 'in_progress',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security logs table for authentication and admin actions
CREATE TABLE IF NOT EXISTS security_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'login_success', 'login_failure', 'logout', 'password_change', 
    'account_locked', 'admin_action', 'password_reset_requested',
    'password_reset_completed', 'account_suspended', 'account_reactivated'
  )),
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_database_backups_created_by ON database_backups(created_by);
CREATE INDEX IF NOT EXISTS idx_database_backups_status ON database_backups(status);
CREATE INDEX IF NOT EXISTS idx_database_backups_created_at ON database_backups(created_at);

CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);

-- Add permissions for backup management
INSERT INTO permissions (name, description, resource, action) VALUES 
  ('backup:create', 'Create database backups', 'backup', 'create'),
  ('backup:read', 'View database backups', 'backup', 'read'),
  ('backup:delete', 'Delete database backups', 'backup', 'delete'),
  ('backup:download', 'Download database backups', 'backup', 'download'),
  ('security:read', 'View security logs', 'security', 'read'),
  ('logs:read', 'View system logs', 'logs', 'read')
ON CONFLICT (name) DO NOTHING;

-- Assign backup and security permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  p.id
FROM permissions p
WHERE p.name IN (
  'backup:create', 'backup:read', 'backup:delete', 'backup:download',
  'security:read', 'logs:read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE database_backups IS 'Stores information about database backup files';
COMMENT ON TABLE security_logs IS 'Stores security-related events like login attempts and admin actions';

COMMENT ON COLUMN database_backups.type IS 'Type of backup: full, schema_only, or data_only';
COMMENT ON COLUMN database_backups.status IS 'Current status of the backup process';
COMMENT ON COLUMN security_logs.event_type IS 'Type of security event that occurred';
COMMENT ON COLUMN security_logs.details IS 'Additional details about the security event in JSON format';

COMMIT;