-- Create activity_logs table and test current user activity
-- Run this first to ensure the table exists

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Check if the table was created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'activity_logs' 
ORDER BY ordinal_position;

-- Insert a login activity for the current admin user (assuming username 'cynthia')
INSERT INTO activity_logs (user_id, action_type, resource_type, description, created_at) VALUES
((SELECT id FROM users WHERE username = 'cynthia' OR email = 'acha.cynthiakeza@gmail.com' LIMIT 1), 'LOGIN', 'USER', 'User logged in', NOW()),
((SELECT id FROM users WHERE username = 'cynthia' OR email = 'acha.cynthiakeza@gmail.com' LIMIT 1), 'VIEW', 'DASHBOARD', 'Viewed admin dashboard', NOW());

-- Check current daily active users
SELECT 
    'Today Active Users' as metric,
    COUNT(DISTINCT user_id) as count
FROM activity_logs 
WHERE DATE(created_at) = CURRENT_DATE;

-- Check all activity logs to debug
SELECT 
    al.id,
    u.username,
    al.action_type,
    al.description,
    al.created_at
FROM activity_logs al
JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 10;