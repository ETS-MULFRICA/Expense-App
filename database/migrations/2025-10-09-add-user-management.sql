-- Migration: Add roles, permissions, user_roles and user flags for management
-- Run this as part of application startup migrations

BEGIN;

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Join table: role -> permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Join table: user -> roles
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Add suspend/soft-delete and password reset fields to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Seed some default roles and permissions (idempotent)
INSERT INTO roles (name, description)
  SELECT 'admin', 'Full administrative access' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='admin');
INSERT INTO roles (name, description)
  SELECT 'user', 'Standard application user' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='user');

-- Common permissions
INSERT INTO permissions (name, description)
  SELECT 'manage_users', 'Create, update, suspend and delete users' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='manage_users');
INSERT INTO permissions (name, description)
  SELECT 'manage_roles', 'Create and manage roles and permissions' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='manage_roles');
INSERT INTO permissions (name, description)
  SELECT 'view_audit_logs', 'View audit and activity logs' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='view_audit_logs');
INSERT INTO permissions (name, description)
  SELECT 'manage_content', 'Create/Update/Delete content modules' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='manage_content');

-- Grant all permissions to admin role (idempotent)
WITH admin_role AS (
  SELECT id FROM roles WHERE name='admin'
), perms AS (
  SELECT id FROM permissions
)
INSERT INTO role_permissions (role_id, permission_id)
  SELECT ar.id, p.id
  FROM admin_role ar, perms p
  ON CONFLICT DO NOTHING;

-- If an admin user exists, assign admin role (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    INSERT INTO user_roles (user_id, role_id)
      SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'admin' WHERE u.username = 'admin'
      ON CONFLICT DO NOTHING;
  END IF;
END$$;

COMMIT;
