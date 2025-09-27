-- Test script to verify the expense categories are properly set up
-- Run this in pgAdmin after running the cleanup script

-- 1. Check that admin user exists
SELECT 'ADMIN USER CHECK:' as check_type;
SELECT id, username, name, role FROM users WHERE id = 1;

-- 2. Check the 15 expense categories
SELECT 'EXPENSE CATEGORIES CHECK:' as check_type;
SELECT 
    id, 
    user_id, 
    name, 
    description,
    is_system, 
    created_at 
FROM expense_categories 
ORDER BY id;

-- 3. Verify category count
SELECT 'CATEGORY COUNT:' as check_type;
SELECT COUNT(*) as total_categories FROM expense_categories;

-- 4. Check categories with descriptions
SELECT 'CATEGORIES WITH DESCRIPTIONS:' as check_type;
SELECT id, name, description 
FROM expense_categories 
WHERE description IS NOT NULL
ORDER BY id;

-- 5. Verify all categories belong to admin user (user_id = 1)
SELECT 'USER OWNERSHIP CHECK:' as check_type;
SELECT 
    user_id, 
    COUNT(*) as category_count,
    ARRAY_AGG(name ORDER BY id) as category_names
FROM expense_categories 
GROUP BY user_id 
ORDER BY user_id;

-- 6. Test category names match expected list
SELECT 'EXPECTED CATEGORIES CHECK:' as check_type;
WITH expected_categories AS (
    SELECT unnest(ARRAY[
        'Children', 'Debt', 'Education', 'Entertainment', 'Everyday',
        'Food', 'Gifts', 'Health', 'Home', 'Insurance', 
        'Pets', 'Technology', 'Transportation', 'Travel', 'Utilities'
    ]) as expected_name
),
actual_categories AS (
    SELECT name as actual_name FROM expense_categories ORDER BY id
)
SELECT 
    e.expected_name,
    CASE 
        WHEN a.actual_name IS NOT NULL THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status
FROM expected_categories e
LEFT JOIN actual_categories a ON e.expected_name = a.actual_name
ORDER BY e.expected_name;