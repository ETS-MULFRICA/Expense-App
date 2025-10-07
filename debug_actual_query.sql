-- Debug the exact query that's failing
-- Run this to see what the getAllExpenses query actually returns

SELECT 
  e.id,
  e.user_id,
  e.amount,
  e.description,
  e.date,
  e.category_id,
  COALESCE(u.name, 'Unknown User') as userName,
  COALESCE(u.username, 'unknown') as userUsername,
  COALESCE(ec.name, e.category_name, 'Uncategorized') as categoryName
FROM expenses e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN expense_categories ec ON e.category_id = ec.id
ORDER BY e.date DESC
LIMIT 5;