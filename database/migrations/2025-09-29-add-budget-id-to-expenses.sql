-- Add budget_id column to expenses table for budget-specific tracking
-- Migration: 2025-09-29-add-budget-id-to-expenses.sql

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS budget_id INTEGER REFERENCES budgets(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_budget_id ON expenses(budget_id);

-- Add composite index for user + budget queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_budget ON expenses(user_id, budget_id);