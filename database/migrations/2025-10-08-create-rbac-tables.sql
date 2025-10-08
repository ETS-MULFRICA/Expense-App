-- Role-Based Access Control (RBAC) Database Schema
-- Migration: 2025-10-08-create-rbac-tables.sql

BEGIN;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- System roles like 'admin', 'user' cannot be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource VARCHAR(50) NOT NULL, -- e.g., 'users', 'expenses', 'budgets', 'admin'
  action VARCHAR(50) NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete', 'manage'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions junction table (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);

-- Insert default system roles
INSERT INTO roles (name, description, is_system) VALUES 
  ('admin', 'Full system administrator with all permissions', true),
  ('user', 'Regular user with basic permissions', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES 
  -- User management permissions
  ('users:create', 'Create new users', 'users', 'create'),
  ('users:read', 'View user information', 'users', 'read'),
  ('users:update', 'Update user information', 'users', 'update'),
  ('users:delete', 'Delete users', 'users', 'delete'),
  ('users:suspend', 'Suspend/reactivate users', 'users', 'suspend'),
  ('users:reset_password', 'Reset user passwords', 'users', 'reset_password'),
  
  -- Expense management permissions
  ('expenses:create', 'Create new expenses', 'expenses', 'create'),
  ('expenses:read', 'View expenses', 'expenses', 'read'),
  ('expenses:update', 'Update expenses', 'expenses', 'update'),
  ('expenses:delete', 'Delete expenses', 'expenses', 'delete'),
  ('expenses:read_all', 'View all users expenses (admin)', 'expenses', 'read_all'),
  
  -- Budget management permissions
  ('budgets:create', 'Create new budgets', 'budgets', 'create'),
  ('budgets:read', 'View budgets', 'budgets', 'read'),
  ('budgets:update', 'Update budgets', 'budgets', 'update'),
  ('budgets:delete', 'Delete budgets', 'budgets', 'delete'),
  ('budgets:read_all', 'View all users budgets (admin)', 'budgets', 'read_all'),
  
  -- Category management permissions
  ('categories:create', 'Create new categories', 'categories', 'create'),
  ('categories:read', 'View categories', 'categories', 'read'),
  ('categories:update', 'Update categories', 'categories', 'update'),
  ('categories:delete', 'Delete categories', 'categories', 'delete'),
  
  -- Admin dashboard permissions
  ('admin:dashboard', 'Access admin dashboard', 'admin', 'dashboard'),
  ('admin:stats', 'View system statistics', 'admin', 'stats'),
  ('admin:roles', 'Manage roles and permissions', 'admin', 'roles'),
  ('admin:system', 'System administration', 'admin', 'system')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'admin'),
  p.id
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign basic permissions to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'user'),
  p.id
FROM permissions p
WHERE p.name IN (
  'expenses:create', 'expenses:read', 'expenses:update', 'expenses:delete',
  'budgets:create', 'budgets:read', 'budgets:update', 'budgets:delete',
  'categories:create', 'categories:read', 'categories:update', 'categories:delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Migrate existing users to the new role system
-- Assign admin role to existing admin users
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  (SELECT id FROM roles WHERE name = 'admin')
FROM users u
WHERE u.role = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Assign user role to existing regular users
INSERT INTO user_roles (user_id, role_id)
SELECT 
  u.id,
  (SELECT id FROM roles WHERE name = 'user')
FROM users u
WHERE u.role = 'user' OR u.role IS NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Create trigger function for updating updated_at timestamp on roles
CREATE OR REPLACE FUNCTION update_roles_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for roles table
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_roles_updated_at_column();

COMMIT;