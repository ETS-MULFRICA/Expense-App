-- Create activity_log table to track user actions
-- This helps with security, accountability, and auditing

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,  -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', etc.
    resource_type VARCHAR(50) NOT NULL,  -- 'EXPENSE', 'INCOME', 'BUDGET', 'CATEGORY', 'USER', etc.
    resource_id INTEGER,  -- ID of the affected resource (nullable for LOGIN/LOGOUT)
    description TEXT NOT NULL,  -- Human readable description
    ip_address INET,  -- User's IP address
    user_agent TEXT,  -- Browser/device info
    metadata JSONB,  -- Additional data (old/new values, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX idx_activity_log_resource_type ON activity_log(resource_type);

-- Add some sample data for testing (replace USER_ID with actual user ID)
-- INSERT INTO activity_log (user_id, action_type, resource_type, resource_id, description, ip_address, user_agent) 
-- VALUES 
-- (1, 'LOGIN', 'USER', 1, 'User admin logged in successfully', '127.0.0.1', 'Mozilla/5.0 (Chrome)'),
-- (2, 'CREATE', 'EXPENSE', 1, 'Created expense "Groceries" for 50.00 in Food category', '127.0.0.1', 'Mozilla/5.0 (Chrome)'),
-- (3, 'CREATE', 'INCOME', 1, 'Created income "Salary" for 3000.00 in Wages category', '127.0.0.1', 'Mozilla/5.0 (Chrome)');

COMMENT ON TABLE activity_log IS 'Tracks all user actions for security and accountability';
COMMENT ON COLUMN activity_log.action_type IS 'Type of action performed (CREATE, UPDATE, DELETE, LOGIN, etc.)';
COMMENT ON COLUMN activity_log.resource_type IS 'Type of resource affected (EXPENSE, INCOME, BUDGET, etc.)';
COMMENT ON COLUMN activity_log.description IS 'Human-readable description of the action';
COMMENT ON COLUMN activity_log.metadata IS 'JSON data with additional context (old values, new values, etc.)';