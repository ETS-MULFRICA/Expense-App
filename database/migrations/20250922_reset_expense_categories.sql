-- Migration: Reset and seed expense_categories with specified categories
-- WARNING: This will delete all existing expense categories and reset IDs

-- Ensure system categories exist; do not delete existing categories to avoid FK violations
DO $$
BEGIN
  -- Make sure user_id can be NULL for system categories (if column exists and is NOT NULL)
  BEGIN
    EXECUTE 'ALTER TABLE expense_categories ALTER COLUMN user_id DROP NOT NULL';
  EXCEPTION WHEN undefined_column THEN
    -- If column doesn't exist yet, ignore (schema will be applied elsewhere)
    NULL;
  END;
  -- Insert categories if they don't already exist (by name)
  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Children', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Children' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Debt', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Debt' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Education', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Education' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Entertainment', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Entertainment' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Everyday', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Everyday' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Gifts', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Gifts' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Health/medical', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Health/medical' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Home', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Home' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Insurance', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Insurance' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Pets', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Pets' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Technology', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Technology' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Transportation', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Transportation' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Travel', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Travel' AND is_system = true);

  INSERT INTO expense_categories (user_id, name, description, is_system)
  SELECT NULL, 'Utilities', NULL, true
  WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Utilities' AND is_system = true);
END $$;
