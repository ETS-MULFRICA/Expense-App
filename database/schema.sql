-- ExpenseNavigator Database Schema for Supabase
-- Run this SQL in your Supabase SQL editor

-- Enable Row Level Security (RLS) for all tables
-- This ensures users can only access their own data

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  currency TEXT DEFAULT 'XAF',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense Categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expense Subcategories table
CREATE TABLE IF NOT EXISTS expense_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Income Categories table
CREATE TABLE IF NOT EXISTS income_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Income Subcategories table
CREATE TABLE IF NOT EXISTS income_subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  category_name TEXT,
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  merchant TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Incomes table
CREATE TABLE IF NOT EXISTS incomes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category_id INTEGER NOT NULL REFERENCES income_categories(id),
  subcategory_id INTEGER REFERENCES income_subcategories(id),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget Allocations table
CREATE TABLE IF NOT EXISTS budget_allocations (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id),
  subcategory_id INTEGER REFERENCES expense_subcategories(id),
  amount DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- Insert default demo user (optional)
-- Password is 'password' hashed with bcrypt
-- INSERT INTO users (username, password, name, email, role) VALUES 
-- ('demo', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', 'demo@example.com', 'user');

-- Note: You'll need to create the demo user through your app's registration flow
-- or modify the hash above to match your password hashing method
-- ===========================
-- Default Income Categories
-- ===========================
-- System categories (shared defaults)
INSERT INTO income_categories (user_id, name, description, is_system)
VALUES
  (1, 'Salary', 'Monthly salary, wages, or allowances', TRUE),
  (1, 'Bonus', 'Performance or incentive bonuses', TRUE),
  (1, 'Freelance', 'Income from freelance work or side gigs', TRUE),
  (1, 'Investment', 'Earnings from stocks, savings, or interest', TRUE),
  (1, 'Rental', 'Income from property rentals', TRUE),
  (1, 'Gift', 'Cash gifts, donations, or transfers', TRUE)
ON CONFLICT DO NOTHING;

-- ===========================
-- Default Income Subcategories
-- ===========================
-- Link each subcategory to its parent income category using subselects
INSERT INTO income_subcategories (user_id, category_id, name, description)
VALUES
  (1, (SELECT id FROM income_categories WHERE name = 'Salary' LIMIT 1), 'Monthly Pay', 'Standard monthly income'),
  (1, (SELECT id FROM income_categories WHERE name = 'Salary' LIMIT 1), 'Overtime Pay', 'Extra pay for overtime work'),
  
  (1, (SELECT id FROM income_categories WHERE name = 'Bonus' LIMIT 1), 'Annual Bonus', 'Year-end or annual performance bonus'),
  (1, (SELECT id FROM income_categories WHERE name = 'Bonus' LIMIT 1), 'Referral Bonus', 'Referral or recruitment bonuses'),

  (1, (SELECT id FROM income_categories WHERE name = 'Freelance' LIMIT 1), 'Web Development', 'Freelance web or app projects'),
  (1, (SELECT id FROM income_categories WHERE name = 'Freelance' LIMIT 1), 'Design Projects', 'Freelance design or graphics gigs'),

  (1, (SELECT id FROM income_categories WHERE name = 'Investment' LIMIT 1), 'Dividends', 'Dividends from shares or funds'),
  (1, (SELECT id FROM income_categories WHERE name = 'Investment' LIMIT 1), 'Interest', 'Bank interest or yield'),

  (1, (SELECT id FROM income_categories WHERE name = 'Rental' LIMIT 1), 'House Rent', 'Rental from houses or rooms'),
  (1, (SELECT id FROM income_categories WHERE name = 'Rental' LIMIT 1), 'Car Lease', 'Income from leasing cars or property'),

  (1, (SELECT id FROM income_categories WHERE name = 'Gift' LIMIT 1), 'Family Gift', 'Gifts from friends or family'),
  (1, (SELECT id FROM income_categories WHERE name = 'Gift' LIMIT 1), 'Donation Received', 'Cash or material donations')
ON CONFLICT DO NOTHING;


INSERT INTO income_categories (user_id, name, description, is_system)
VALUES
  (1, 'Salary', 'Monthly salary and wages', TRUE),
  (1, 'Bonus', 'Work or performance bonuses', TRUE),
  (1, 'Freelance', 'Side jobs and gigs', TRUE),
  (1, 'Investments', 'Interest, dividends, etc.', TRUE);


CREATE TABLE IF NOT EXISTS user_income_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, name)
);


-- Activity log table aligned with code expectations
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  description TEXT,
  metadata JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
