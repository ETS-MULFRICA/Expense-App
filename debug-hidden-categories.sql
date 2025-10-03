-- Query to check for duplicate hidden categories for debugging
-- Run this in your database to see if there are duplicates

SELECT 
  user_id,
  category_id,
  category_type,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as ids
FROM user_hidden_categories 
GROUP BY user_id, category_id, category_type
HAVING COUNT(*) > 1;

-- Also check all hidden categories with their names
SELECT 
  uhc.id,
  uhc.user_id,
  uhc.category_id,
  uhc.category_type,
  uhc.hidden_at,
  ec.name as category_name
FROM user_hidden_categories uhc
JOIN expense_categories ec ON uhc.category_id = ec.id
ORDER BY uhc.user_id, uhc.hidden_at DESC;