// Simple smoke test for admin CRUD endpoints
// Usage: ADMIN_USERNAME=admin ADMIN_PASSWORD=password BASE_URL=http://localhost:5000 node scripts/test-admin-endpoints.js

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';

async function request(path, opts = {}, cookie) {
  const headers = opts.headers || {};
  if (cookie) headers['Cookie'] = cookie;
  if (opts.json) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.json);
    delete opts.json;
  }
  const res = await fetch(BASE + path, { ...opts, headers, redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie') || res.headers.get('Set-Cookie');
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) { body = text; }
  return { res, body, setCookie };
}

(async () => {
  try {
    console.log('Logging in as', ADMIN_USERNAME);
    const login = await request('/api/login', { method: 'POST', json: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD } });
    if (!login.res.ok) {
      console.error('Login failed', login.res.status, login.body);
      process.exit(1);
    }
    const cookie = login.setCookie;
    if (!cookie) {
      console.error('No session cookie received; cannot proceed');
      process.exit(1);
    }
    console.log('Logged in, cookie:', cookie.split(';')[0]);

    // Create budget
    console.log('\nCreating test budget...');
    const createBudget = await request('/api/admin/budgets', { method: 'POST', json: { userId: 1, name: 'SmokeTest Budget', amount: 1234, period: 'monthly' } }, cookie);
    console.log('Create budget status:', createBudget.res.status, createBudget.body);
    const budget = createBudget.body;
    if (!budget || !budget.id) {
      console.error('Failed to create budget');
      process.exit(1);
    }

    // Update budget
    console.log('\nUpdating test budget...');
    const updateBudget = await request(`/api/admin/budgets/${budget.id}`, { method: 'PATCH', json: { name: 'SmokeTest Budget Updated', amount: 2345, period: 'monthly' } }, cookie);
    console.log('Update budget status:', updateBudget.res.status, updateBudget.body);

    // List budgets
    console.log('\nListing budgets (first 5)...');
    const listBudgets = await request('/api/admin/budgets', { method: 'GET' }, cookie);
    console.log('List budgets status:', listBudgets.res.status);
    console.log(Array.isArray(listBudgets.body) ? listBudgets.body.slice(0,5) : listBudgets.body);

    // Delete budget
    console.log('\nDeleting test budget...');
    const deleteBudget = await request(`/api/admin/budgets/${budget.id}`, { method: 'DELETE' }, cookie);
    console.log('Delete budget status:', deleteBudget.res.status);

    // Create expense
    console.log('\nCreating test expense...');
    const createExpense = await request('/api/admin/expenses', { method: 'POST', json: { userId: 1, description: 'SmokeTest Expense', amount: 50 } }, cookie);
    console.log('Create expense status:', createExpense.res.status, createExpense.body);
    const expense = createExpense.body;
    if (!expense || !expense.id) {
      console.error('Failed to create expense');
      process.exit(1);
    }

    // Update expense
    console.log('\nUpdating test expense...');
    const updateExpense = await request(`/api/admin/expenses/${expense.id}`, { method: 'PATCH', json: { description: 'SmokeTest Expense Updated', amount: 75 } }, cookie);
    console.log('Update expense status:', updateExpense.res.status, updateExpense.body);

    // List expenses
    console.log('\nListing expenses (first 5)...');
    const listExpenses = await request('/api/admin/expenses', { method: 'GET' }, cookie);
    console.log('List expenses status:', listExpenses.res.status);
    console.log(listExpenses.body && listExpenses.body.expenses ? listExpenses.body.expenses.slice(0,5) : listExpenses.body);

    // Delete expense
    console.log('\nDeleting test expense...');
    const deleteExpense = await request(`/api/admin/expenses/${expense.id}`, { method: 'DELETE' }, cookie);
    console.log('Delete expense status:', deleteExpense.res.status);

    console.log('\nSmoke test finished');
  } catch (err) {
    console.error('Smoke test failed', err);
    process.exit(1);
  }
})();
