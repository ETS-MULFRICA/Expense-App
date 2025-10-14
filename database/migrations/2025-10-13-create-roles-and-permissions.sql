-- Create permissions table
CREATE TABLE permissions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    scope VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Insert default permissions
INSERT INTO permissions (id, name, description, scope) VALUES
    ('users:read', 'View Users', 'View user list and profiles', 'users'),
    ('users:write', 'Manage Users', 'Create, edit, and delete users', 'users'),
    ('roles:read', 'View Roles', 'View roles and permissions', 'roles'),
    ('roles:write', 'Manage Roles', 'Create, edit, and delete roles', 'roles'),
    ('expenses:read', 'View Expenses', 'View all user expenses', 'expenses'),
    ('expenses:write', 'Manage Expenses', 'Create, edit, and delete expenses', 'expenses'),
    ('settings:read', 'View Settings', 'View system settings', 'settings'),
    ('settings:write', 'Manage Settings', 'Modify system settings', 'settings'),
    ('reports:read', 'View Reports', 'Access analytics and reports', 'reports'),
    ('reports:write', 'Manage Reports', 'Create and modify reports', 'reports')
ON CONFLICT (id) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name, description, is_system) VALUES
    ('Admin', 'Full system access', TRUE),
    ('Manager', 'Can manage users and view reports', TRUE),
    ('Editor', 'Can manage content and expenses', TRUE),
    ('Viewer', 'Read-only access to reports and expenses', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Admin'),
    id
FROM permissions
ON CONFLICT DO NOTHING;

-- Assign specific permissions to Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Manager'),
    id
FROM permissions
WHERE id IN ('users:read', 'users:write', 'expenses:read', 'reports:read')
ON CONFLICT DO NOTHING;

-- Assign specific permissions to Editor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Editor'),
    id
FROM permissions
WHERE id IN ('expenses:read', 'expenses:write', 'reports:read')
ON CONFLICT DO NOTHING;

-- Assign specific permissions to Viewer role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Viewer'),
    id
FROM permissions
WHERE id IN ('expenses:read', 'reports:read')
ON CONFLICT DO NOTHING;