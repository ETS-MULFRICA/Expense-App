-- Quick check to see the user_id distribution in expenses
SELECT user_id, COUNT(*) as expense_count
FROM expenses 
GROUP BY user_id
ORDER BY user_id;