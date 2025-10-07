-- Debug queries to understand the current state of expenses and categories
-- Run these one by one in pgAdmin to see what's happening

-- 1. Check what's in the expenses table
SELECT id, user_id, category_id, category_name, description 
FROM expenses 
LIMIT 10;

-- 2. Check what categories exist
SELECT id, user_id, name, is_system 
FROM expense_categories 
ORDER BY id;

-- 3. Check which users exist
SELECT id, username, name 
FROM users 
ORDER BY id;

-- 4. Check expenses with their category joins
SELECT 
  e.id,
  e.user_id,
  e.category_id,
  e.category_name,
  e.description,
  ec.name as category_lookup_name,
  u.name as user_name
FROM expenses e
LEFT JOIN expense_categories ec ON e.category_id = ec.id
LEFT JOIN users u ON e.user_id = u.id
LIMIT 10;