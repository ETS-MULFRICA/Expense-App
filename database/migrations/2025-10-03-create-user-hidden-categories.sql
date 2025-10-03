-- Migration: Create user_hidden_categories table
-- This allows users to hide system categories from their personal view

BEGIN;

-- Create table to track which system categories each user has hidden
CREATE TABLE IF NOT EXISTS user_hidden_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  category_type TEXT NOT NULL CHECK (category_type IN ('expense', 'budget')), -- For future budget categories
  hidden_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id, category_type)
);

-- Add indexes for better performance
CREATE INDEX idx_user_hidden_categories_user_id ON user_hidden_categories(user_id);
CREATE INDEX idx_user_hidden_categories_category ON user_hidden_categories(category_id, category_type);

-- Add comments for documentation
COMMENT ON TABLE user_hidden_categories IS 'Tracks which system categories each user has chosen to hide from their interface';
COMMENT ON COLUMN user_hidden_categories.category_type IS 'Type of category: expense or budget (for future expansion)';

COMMIT;