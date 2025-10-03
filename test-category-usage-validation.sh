#!/bin/bash

# Test script for category usage validation
echo "Testing Category Usage Validation..."

# Note: These endpoints require authentication, so they will return 401 when run directly
# This script is for documentation and testing once authenticated in the browser

echo "
## Test Cases for Category Hiding with Usage Validation

### Test Case 1: Try to hide a category that is NOT in use
1. Go to expense form
2. Select a system category that has no expenses/budgets using it
3. Click the delete/hide button
4. Should successfully hide the category
5. Check settings page to see it listed as hidden

### Test Case 2: Try to hide a category that IS in use
1. Create an expense with a system category (e.g., 'Food')
2. Go to expense form  
3. Try to delete/hide the 'Food' category
4. Should show error: 'Cannot hide this category because it is currently in use. Found in X expenses.'

### Test Case 3: Check category usage via API
curl -X GET 'http://localhost:5000/api/expense-categories/1/usage' \\
  -H 'Content-Type: application/json'

### Test Case 4: Try to hide category used in budget
1. Create a budget with allocations for a system category
2. Try to hide that category
3. Should show error about budget allocations

### Expected Error Messages:
- 'Cannot hide this category because it is currently in use. Found in 3 expenses.'
- 'Cannot hide this category because it is currently in use. Found in 1 budget allocation.'
- 'Cannot hide this category because it is currently in use. Found in 2 expenses and 1 budget allocation.'

### Frontend Error Display:
- Toast notification with title 'Cannot hide category'
- Detailed message explaining why (shows usage count)
- Error toast duration: 6 seconds (longer for important info)
- Confirmation dialog warns about usage check before attempting

### Settings Page:
- Shows list of hidden categories
- Each category shows when it was hidden
- 'Restore' button to unhide categories
- Debug information in development mode
"

echo "Manual testing required due to authentication requirements."
echo "Use the browser interface to test the functionality."