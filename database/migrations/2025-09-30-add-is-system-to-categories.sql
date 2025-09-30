-- Add is_system column to expense_categories table
ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Add is_system column to income_categories table if it doesn't exist
ALTER TABLE income_categories ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- Update existing categories to mark them as system categories
-- This will mark all existing categories as system categories
UPDATE expense_categories SET is_system = TRUE WHERE is_system IS NULL OR is_system = FALSE;
UPDATE income_categories SET is_system = TRUE WHERE is_system IS NULL OR is_system = FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_expense_categories_is_system ON expense_categories(is_system);
CREATE INDEX IF NOT EXISTS idx_income_categories_is_system ON income_categories(is_system);