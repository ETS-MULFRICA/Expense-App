-- Analytics Dashboard Test Data Creation
-- Run these commands in pgAdmin to populate test data for the analytics dashboard

-- 1. First, let's check what users exist
SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC;

-- 2. Create some test users if needed (only run if you need more users)
INSERT INTO users (username, email, password_hash, role, status, created_at) VALUES
('test_user_1', 'test1@example.com', '$2b$10$dummy.hash.for.testing', 'user', 'active', NOW() - INTERVAL '5 days'),
('test_user_2', 'test2@example.com', '$2b$10$dummy.hash.for.testing', 'user', 'active', NOW() - INTERVAL '3 days'),
('test_user_3', 'test3@example.com', '$2b$10$dummy.hash.for.testing', 'user', 'active', NOW() - INTERVAL '1 day')
ON CONFLICT (email) DO NOTHING;

-- 3. Check if activity_logs table exists, if not create it
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

-- 4. Create test activity logs for daily active users analytics
INSERT INTO activity_logs (user_id, action_type, resource_type, description, created_at) VALUES
-- Today's activity
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'login', 'auth', 'User logged in', NOW()),
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'view', 'dashboard', 'Viewed admin dashboard', NOW()),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 'login', 'auth', 'User logged in', NOW()),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 'create', 'expense', 'Created new expense', NOW()),

-- Yesterday's activity
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'login', 'auth', 'User logged in', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 'login', 'auth', 'User logged in', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 'login', 'auth', 'User logged in', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 'create', 'expense', 'Created new expense', NOW() - INTERVAL '1 day'),

-- 2 days ago
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'login', 'auth', 'User logged in', NOW() - INTERVAL '2 days'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 'update', 'profile', 'Updated profile', NOW() - INTERVAL '2 days'),

-- 3 days ago
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'login', 'auth', 'User logged in', NOW() - INTERVAL '3 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 'create', 'budget', 'Created new budget', NOW() - INTERVAL '3 days'),

-- Random activity over the past 30 days
((SELECT id FROM users WHERE username = 'admin' LIMIT 1), 'export', 'report', 'Exported users report', NOW() - INTERVAL '5 days'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 'delete', 'expense', 'Deleted expense', NOW() - INTERVAL '7 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 'view', 'analytics', 'Viewed analytics', NOW() - INTERVAL '10 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 'update', 'budget', 'Updated budget', NOW() - INTERVAL '15 days');

-- 5. Create test expenses for expense trends analytics
INSERT INTO expenses (user_id, amount, description, category_id, merchant, created_at) VALUES
-- Recent expenses (last 7 days)
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 45.50, 'Grocery shopping', (SELECT id FROM expense_categories WHERE name = 'Food' LIMIT 1), 'SuperMart', NOW()),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 25.00, 'Gas fill up', (SELECT id FROM expense_categories WHERE name = 'Transportation' LIMIT 1), 'Shell Station', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 120.00, 'Utility bill', (SELECT id FROM expense_categories WHERE name = 'Utilities' LIMIT 1), 'Electric Company', NOW() - INTERVAL '2 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 15.99, 'Netflix subscription', (SELECT id FROM expense_categories WHERE name = 'Entertainment' LIMIT 1), 'Netflix', NOW() - INTERVAL '3 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 67.80, 'Restaurant dinner', (SELECT id FROM expense_categories WHERE name = 'Food' LIMIT 1), 'Italian Bistro', NOW() - INTERVAL '4 days'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 200.00, 'Car maintenance', (SELECT id FROM expense_categories WHERE name = 'Transportation' LIMIT 1), 'Auto Shop', NOW() - INTERVAL '5 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 89.99, 'Clothing purchase', (SELECT id FROM expense_categories WHERE name = 'Shopping' LIMIT 1), 'Fashion Store', NOW() - INTERVAL '6 days'),

-- Older expenses (1-4 weeks ago)
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 150.00, 'Groceries', (SELECT id FROM expense_categories WHERE name = 'Food' LIMIT 1), 'Whole Foods', NOW() - INTERVAL '10 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 75.50, 'Medical checkup', (SELECT id FROM expense_categories WHERE name = 'Healthcare' LIMIT 1), 'City Clinic', NOW() - INTERVAL '12 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 300.00, 'Insurance payment', (SELECT id FROM expense_categories WHERE name = 'Insurance' LIMIT 1), 'State Farm', NOW() - INTERVAL '15 days'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 45.00, 'Phone bill', (SELECT id FROM expense_categories WHERE name = 'Utilities' LIMIT 1), 'Verizon', NOW() - INTERVAL '18 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 125.99, 'Online shopping', (SELECT id FROM expense_categories WHERE name = 'Shopping' LIMIT 1), 'Amazon', NOW() - INTERVAL '20 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 85.00, 'Gym membership', (SELECT id FROM expense_categories WHERE name = 'Health & Fitness' LIMIT 1), 'Planet Fitness', NOW() - INTERVAL '25 days'),
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 60.00, 'Internet bill', (SELECT id FROM expense_categories WHERE name = 'Utilities' LIMIT 1), 'Comcast', NOW() - INTERVAL '28 days');

-- 6. Create some test budgets
INSERT INTO budgets (user_id, name, total_amount, period_start, period_end, created_at) VALUES
((SELECT id FROM users WHERE email LIKE 'test1@%' LIMIT 1), 'Monthly Budget Oct 2025', 2000.00, '2025-10-01', '2025-10-31', NOW() - INTERVAL '8 days'),
((SELECT id FROM users WHERE email LIKE 'test2@%' LIMIT 1), 'Travel Budget', 1500.00, '2025-10-01', '2025-12-31', NOW() - INTERVAL '5 days'),
((SELECT id FROM users WHERE email LIKE 'test3@%' LIMIT 1), 'Emergency Fund', 5000.00, '2025-10-01', '2025-12-31', NOW() - INTERVAL '3 days');

-- 7. Verify the test data was created
SELECT 'Users Count' as metric, COUNT(*) as value FROM users
UNION ALL
SELECT 'Expenses Count', COUNT(*) FROM expenses
UNION ALL
SELECT 'Activity Logs Count', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'Budgets Count', COUNT(*) FROM budgets;

-- 8. Test the analytics queries
-- Daily active users for last 7 days
SELECT 
    DATE(created_at) as date,
    COUNT(DISTINCT user_id) as active_users
FROM activity_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Expense trends for last 7 days
SELECT 
    DATE(created_at) as date,
    COALESCE(SUM(amount), 0) as total_amount,
    COUNT(*) as transaction_count
FROM expenses 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Top expense categories
SELECT 
    ec.name as category_name,
    COUNT(e.id) as transaction_count,
    COALESCE(SUM(e.amount), 0) as total_amount,
    COALESCE(AVG(e.amount), 0) as avg_amount
FROM expense_categories ec
LEFT JOIN expenses e ON e.category_id = ec.id
WHERE ec.is_system = true
GROUP BY ec.id, ec.name
ORDER BY total_amount DESC
LIMIT 10;

-- Recent activity
SELECT 
    al.action_type,
    al.resource_type, 
    al.description,
    u.username,
    al.created_at
FROM activity_logs al
JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 10;