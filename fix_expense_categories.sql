-- Fix existing expenses with missing category assignments
-- Run this SQL in pgAdmin to fix the "Uncategorized" issue

BEGIN;

-- Update existing expenses that have category_name but no category_id
UPDATE expenses 
SET category_id = ec.id
FROM expense_categories ec
WHERE expenses.category_name = ec.name 
  AND expenses.category_id IS NULL
  AND ec.is_system = true;

-- For expenses that still don't have categories, assign them to a default category
-- First, make sure we have a default "Everyday" category
INSERT INTO expense_categories (id, user_id, name, description, is_system, created_at)
VALUES (5, 14, 'Everyday', 'General everyday expenses', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Update remaining uncategorized expenses to use "Everyday" category
UPDATE expenses 
SET category_id = 5, category_name = 'Everyday'
WHERE category_id IS NULL;

COMMIT;