-- Fix ID conflict between income_categories and user_income_categories tables
-- This script ensures user_income_categories IDs start from 4 to avoid conflicts

-- Step 1: Check current state
SELECT 'Before fix - System categories:' as info;
SELECT id, name FROM income_categories WHERE name IN ('Wages', 'Other', 'Deals') ORDER BY id;

SELECT 'Before fix - User categories:' as info;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

SELECT 'Before fix - Income records with conflicting category_id:' as info;
SELECT id, description, category_id, category_name FROM incomes WHERE category_id IN (1,2,3) ORDER BY id;

-- Step 2: Update existing user category IDs and related income records
-- Update the 'projects' category from ID 3 to ID 1000 (temporary ID to avoid conflicts)
UPDATE user_income_categories SET id = 1000 WHERE id = 3 AND name = 'projects';

-- Update any income records that reference the old user category ID 3
UPDATE incomes SET category_id = 1000 WHERE category_id = 3 AND category_name = 'projects';

-- Step 3: Reset the sequence for user_income_categories to start from 4
-- First, find the current maximum ID in the table
SELECT setval('user_income_categories_id_seq', GREATEST(4, (SELECT COALESCE(MAX(id), 3) FROM user_income_categories)) + 1);

-- Step 4: Update the temporary ID to a proper ID >= 4
UPDATE user_income_categories SET id = nextval('user_income_categories_id_seq') WHERE id = 1000;

-- Get the new ID that was assigned
SELECT 'New user category ID for projects:' as info;
SELECT id, name FROM user_income_categories WHERE name = 'projects';
-- Use an UPDATE...FROM query for clarity and robustness
UPDATE incomes i
SET category_id = uic.id
FROM user_income_categories uic
WHERE i.category_id = 1000 -- Matches the income records linked to the temporary ID
  AND uic.name = 'projects' -- Ensures we update with the ID of the 'projects' category
  AND i.category_name = 'projects'; -- Optional: Safety check to match the name
  
-- Step 5: Verify the fix
SELECT 'After fix - System categories (should be 1,2,3):' as info;
SELECT id, name FROM income_categories WHERE name IN ('Wages', 'Other', 'Deals') ORDER BY id;

SELECT 'After fix - User categories (should start from >= 4):' as info;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

SELECT 'After fix - Income records:' as info;
SELECT id, description, category_id, category_name FROM incomes ORDER BY id;

SELECT 'Verification - No ID conflicts should exist:' as info;
SELECT 
  i.id as income_id,
  i.description,
  i.category_id,
  i.category_name,
  CASE 
    WHEN i.category_id IN (SELECT id FROM income_categories WHERE name IN ('Wages', 'Other', 'Deals')) THEN 'SYSTEM'
    WHEN i.category_id IN (SELECT id FROM user_income_categories) THEN 'USER'
    WHEN i.category_id IS NULL THEN 'CUSTOM_NAME_ONLY'
    ELSE 'UNKNOWN'
  END as category_type
FROM incomes i 
ORDER BY i.id;