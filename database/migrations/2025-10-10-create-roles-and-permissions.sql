-- Create roles, permissions and mapping tables
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Seed some default roles and permissions (idempotent)
INSERT INTO roles (name, description)
SELECT 'admin', 'Administrator with full access'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'admin');

INSERT INTO roles (name, description)
SELECT 'user', 'Default user role' 
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'user');

-- Example permissions
INSERT INTO permissions (name, description)
SELECT 'admin:access', 'Access admin dashboard' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='admin:access');
INSERT INTO permissions (name, description)
SELECT 'admin:users', 'Manage users' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='admin:users');
INSERT INTO permissions (name, description)
SELECT 'admin:roles', 'Manage roles & permissions' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='admin:roles');
INSERT INTO permissions (name, description)
SELECT 'admin:expenses', 'View/manage all expenses' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='admin:expenses');

-- Grant all existing permissions to admin role
WITH admin_role AS (SELECT id FROM roles WHERE name = 'admin')
INSERT INTO role_permissions (role_id, permission_id)
SELECT admin_role.id, p.id FROM admin_role, permissions p
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = admin_role.id AND rp.permission_id = p.id
);
