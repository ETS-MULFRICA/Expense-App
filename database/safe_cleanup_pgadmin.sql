-- Safe cleanup script for pgAdmin - handles foreign key constraints
-- Run these commands step by step in pgAdmin

-- Step 1: Check current users and categories
SELECT 'Current users:' as info;
SELECT id, username, name, role FROM users ORDER BY id;

SELECT 'Current expense categories:' as info;
SELECT id, user_id, name, description, is_system, created_at FROM expense_categories ORDER BY id;

-- Step 2: Create admin user if it doesn't exist (ID = 1)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = 1) THEN
        -- Create admin user with ID = 1
        INSERT INTO users (id, username, password, name, email, currency, role, created_at)
        VALUES (1, 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'admin@system.com', 'XAF', 'admin', NOW());
        
        -- Reset the users sequence to continue from the highest ID
        PERFORM setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users), true);
        
        RAISE NOTICE 'Admin user created with ID = 1';
    ELSE
        RAISE NOTICE 'User with ID = 1 already exists';
    END IF;
END $$;

-- Step 3: Create a temporary mapping table for category consolidation
CREATE TEMP TABLE category_mapping AS
WITH category_cleanup AS (
  -- Get the first occurrence of each category name (keep lowest ID)
  SELECT 
    name,
    MIN(id) as keep_id,
    ARRAY_AGG(id ORDER BY id) as all_ids
  FROM expense_categories 
  GROUP BY UPPER(name)
),
standard_categories AS (
  -- Define our 15 standard categories with their target IDs
  SELECT * FROM (VALUES 
    ('CHILDREN', 1),
    ('DEBT', 2), 
    ('EDUCATION', 3),
    ('ENTERTAINMENT', 4),
    ('EVERYDAY', 5),
    ('FOOD', 6),
    ('GIFTS', 7),
    ('HEALTH', 8),
    ('HOME', 9),
    ('INSURANCE', 10),
    ('PETS', 11),
    ('TECHNOLOGY', 12),
    ('TRANSPORTATION', 13),
    ('TRAVEL', 14),
    ('UTILITIES', 15)
  ) AS t(standard_name, target_id)
)
SELECT 
  old_cat.id as old_id,
  old_cat.name as old_name,
  COALESCE(std.target_id, 6) as new_id  -- Default to Food (6) if not in standard list
FROM expense_categories old_cat
LEFT JOIN standard_categories std ON UPPER(old_cat.name) = std.standard_name;

-- Step 4: Show the mapping that will be applied
SELECT 'Category mapping (old_id -> new_id):' as info;
SELECT old_id, old_name, new_id FROM category_mapping ORDER BY old_id;

-- Step 5: Update all expenses to use the new category IDs
UPDATE expenses 
SET category_id = cm.new_id
FROM category_mapping cm
WHERE expenses.category_id = cm.old_id;

-- Step 6: Update budget allocations to use new category IDs
UPDATE budget_allocations 
SET category_id = cm.new_id  
FROM category_mapping cm
WHERE budget_allocations.category_id = cm.old_id;

-- Step 7: Now we can safely delete all existing categories
DELETE FROM expense_categories;

-- Step 8: Reset the sequence
ALTER SEQUENCE expense_categories_id_seq RESTART WITH 1;

-- Step 9: Insert the 15 standard categories with admin user_id = 1
INSERT INTO expense_categories (id, user_id, name, description, is_system, created_at)
VALUES
  (1, 1, 'Children', NULL, true, NOW()),
  (2, 1, 'Debt', NULL, true, NOW()),
  (3, 1, 'Education', NULL, true, NOW()),
  (4, 1, 'Entertainment', 'Movies, events, subscriptions', true, NOW()),
  (5, 1, 'Everyday', NULL, true, NOW()),
  (6, 1, 'Food', 'Groceries, restaurants, snacks', true, NOW()),
  (7, 1, 'Gifts', NULL, true, NOW()),
  (8, 1, 'Health', 'Medical, pharmacy, insurance', true, NOW()),
  (9, 1, 'Home', NULL, true, NOW()),
  (10, 1, 'Insurance', NULL, true, NOW()),
  (11, 1, 'Pets', NULL, true, NOW()),
  (12, 1, 'Technology', NULL, true, NOW()),
  (13, 1, 'Transportation', 'Bus, taxi, fuel, car maintenance', true, NOW()),
  (14, 1, 'Travel', NULL, true, NOW()),
  (15, 1, 'Utilities', 'Electricity, water, internet', true, NOW());

-- Step 10: Update the sequence to continue from 16
SELECT setval('expense_categories_id_seq', 15, true);

-- Step 11: Verify the final result
SELECT 'Final expense categories:' as info;
SELECT id, user_id, name, description, is_system, created_at 
FROM expense_categories 
ORDER BY id;

SELECT 'Total categories count:' as info;
SELECT COUNT(*) as total_categories FROM expense_categories;

SELECT 'Categories by user:' as info;
SELECT user_id, COUNT(*) as category_count 
FROM expense_categories 
GROUP BY user_id 
ORDER BY user_id;

SELECT 'Sample expenses with new categories:' as info;
SELECT e.id, e.description, e.amount, c.name as category_name
FROM expenses e
JOIN expense_categories c ON e.category_id = c.id
ORDER BY e.id
LIMIT 10;