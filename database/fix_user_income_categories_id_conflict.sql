-- Fix ID conflict between income_categories and user_income_categories
-- This script ensures user_income_categories IDs start from 4 to avoid conflicts

-- Step 1: Check current data
SELECT 'Current user_income_categories:' as info;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

SELECT 'Current incomes with their categories:' as info;
SELECT id, description, category_id, category_name FROM incomes WHERE user_id = 15 ORDER BY id;

-- Step 2: Update any existing incomes that reference the conflicting user category ID
-- (The income with id=21 has category_id=3 which should reference the user category 'projects')
UPDATE incomes 
SET category_id = NULL, category_name = 'projects'
WHERE id = 21 AND category_id = 3 AND category_name = 'projects';

-- Step 3: Create a temporary table to store user categories with new IDs
CREATE TEMP TABLE temp_user_categories AS
SELECT 
    row_number() OVER (ORDER BY id) + 3 as new_id,  -- Start from 4, 5, 6...
    id as old_id,
    user_id,
    name,
    created_at
FROM user_income_categories 
ORDER BY id;

-- Step 4: Clear the user_income_categories table
DELETE FROM user_income_categories;

-- Step 5: Reset the sequence to start from 4
ALTER SEQUENCE user_income_categories_id_seq RESTART WITH 4;

-- Step 6: Insert the categories back with new IDs starting from 4
INSERT INTO user_income_categories (user_id, name, created_at)
SELECT user_id, name, created_at 
FROM temp_user_categories 
ORDER BY old_id;

-- Step 7: Verify the changes
SELECT 'Updated user_income_categories:' as info;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

SELECT 'Updated incomes:' as info;
SELECT id, description, category_id, category_name FROM incomes WHERE user_id = 15 ORDER BY id;

-- Step 8: Drop the temporary table
DROP TABLE temp_user_categories;

SELECT 'Fix completed successfully!' as result;