-- Migration: Clean up and reset expense_categories with specified categories
-- This will consolidate duplicates and ensure all categories belong to admin user (id: 1)
-- Date: 2025-09-25

BEGIN;

-- Step 1: Create a mapping of duplicate categories to keep
-- We'll find categories with the same name and map them to the lowest ID

-- Create a temporary table to store category mappings
CREATE TEMP TABLE category_mapping AS
WITH category_groups AS (
  SELECT 
    LOWER(name) as normalized_name,
    MIN(id) as keep_id,
    array_agg(id ORDER BY id) as all_ids
  FROM expense_categories 
  GROUP BY LOWER(name)
)
SELECT 
  unnest(all_ids) as old_id,
  keep_id as new_id,
  normalized_name
FROM category_groups;

-- Step 2: Update all expense references to use the consolidated categories
UPDATE expenses 
SET category_id = cm.new_id
FROM category_mapping cm
WHERE expenses.category_id = cm.old_id AND cm.old_id != cm.new_id;

-- Step 3: Update all budget_allocations references to use the consolidated categories  
UPDATE budget_allocations 
SET category_id = cm.new_id
FROM category_mapping cm
WHERE budget_allocations.category_id = cm.old_id AND cm.old_id != cm.new_id;

-- Step 4: Delete duplicate categories (keep only the ones with lowest IDs)
DELETE FROM expense_categories 
WHERE id IN (
  SELECT old_id FROM category_mapping 
  WHERE old_id != new_id
);

-- Step 5: Mark consolidated categories as system-owned; set user_id = NULL for system categories
UPDATE expense_categories 
SET user_id = NULL, is_system = true
WHERE id IN (SELECT DISTINCT new_id FROM category_mapping);

-- Step 6: Update specific category names to match our standard list
UPDATE expense_categories SET name = 'Health' WHERE LOWER(name) IN ('health/medical', 'health', 'medical');
UPDATE expense_categories SET name = 'Food' WHERE LOWER(name) IN ('food', 'groceries');
UPDATE expense_categories SET name = 'Transportation' WHERE LOWER(name) IN ('transportation', 'transport');
UPDATE expense_categories SET name = 'Utilities' WHERE LOWER(name) IN ('utilities', 'utility');
UPDATE expense_categories SET name = 'Entertainment' WHERE LOWER(name) IN ('entertainment', 'movies', 'events');

-- Step 7: Insert any missing standard categories
INSERT INTO expense_categories (user_id, name, description, is_system, created_at)
SELECT NULL, category_name, NULL, true, NOW()
FROM (VALUES 
  ('Children'),
  ('Debt'), 
  ('Education'),
  ('Entertainment'),
  ('Everyday'),
  ('Food'),
  ('Gifts'),
  ('Health'),
  ('Home'),
  ('Insurance'),
  ('Pets'),
  ('Technology'),
  ('Transportation'),
  ('Travel'),
  ('Utilities')
) AS standard_categories(category_name)
WHERE NOT EXISTS (
  SELECT 1 FROM expense_categories 
  WHERE LOWER(name) = LOWER(category_name) AND is_system = true
);

-- Verify the final result
SELECT id, user_id, name, is_system, created_at 
FROM expense_categories 
WHERE user_id = 1 
ORDER BY name;

COMMIT;