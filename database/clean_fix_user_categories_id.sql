-- Clean fix for user_income_categories ID conflict
-- This ensures user category IDs start from 4 to avoid conflicts with system categories (1,2,3)

-- Step 1: Check current state
SELECT 'Current user_income_categories:' as info;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

-- Step 2: Create temporary table with new IDs starting from 4
CREATE TEMP TABLE temp_user_categories AS
SELECT 
    row_number() OVER (ORDER BY id) + 3 as new_id,  -- This will give 4, 5, 6...
    user_id,
    name,
    created_at
FROM user_income_categories 
ORDER BY id;

-- Step 3: Clear the table and reset sequence
DELETE FROM user_income_categories;
ALTER SEQUENCE user_income_categories_id_seq RESTART WITH 4;

-- Step 4: Insert categories back with new IDs
INSERT INTO user_income_categories (user_id, name, created_at)
SELECT user_id, name, created_at 
FROM temp_user_categories 
ORDER BY new_id;

-- Step 5: Verify the fix
SELECT 'Fixed user_income_categories (IDs now start from 4):' as result;
SELECT id, user_id, name FROM user_income_categories ORDER BY id;

-- Step 6: Clean up
DROP TABLE temp_user_categories;

SELECT 'ID conflict fixed! User categories now start from ID 4.' as status;