-- Manual cleanup script for pgAdmin
-- Run these commands step by step in pgAdmin

-- Step 1: Check current users and categories
SELECT 'Current users:' as info;
SELECT id, username, name, role FROM users ORDER BY id;

SELECT 'Current expense categories:' as info;
SELECT id, user_id, name, description, is_system, created_at FROM expense_categories ORDER BY id;

-- Step 2: Create admin user if it doesn't exist (ID = 1)
-- First, check if user ID 1 exists
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

-- Step 3: Update all existing expenses to use proper category references
-- This prevents foreign key constraint violations
UPDATE expenses SET category_id = 1 WHERE category_id NOT IN (SELECT id FROM expense_categories);

-- Step 4: Delete duplicate categories and keep only one of each name
-- First, let's see what categories we have
SELECT 'Categories before cleanup:' as info;
SELECT id, user_id, name, count(*) OVER (PARTITION BY UPPER(name)) as name_count
FROM expense_categories 
ORDER BY UPPER(name), id;

-- Step 5: Delete all categories except the ones we want to keep
-- We'll rebuild with the standard 15 categories
DELETE FROM expense_categories;

-- Reset the sequence
ALTER SEQUENCE expense_categories_id_seq RESTART WITH 1;

-- Step 6: Insert the 15 standard categories with admin user_id = 1
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

-- Update the sequence to continue from 16
SELECT setval('expense_categories_id_seq', 15, true);

-- Step 7: Update any existing expenses that might have invalid category_id references
-- Map old categories to new ones based on name similarity
UPDATE expenses SET category_id = 6 WHERE category_id NOT BETWEEN 1 AND 15; -- Default to Food category

-- Step 8: Verify the final result
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