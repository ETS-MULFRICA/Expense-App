const fetch = require('node-fetch');

const base = 'http://localhost:5000';

async function run() {
  // Create two users via admin endpoint if available; otherwise assume users 1 and 2 exist.
  // We'll try to create user A via /api/admin/users if endpoint exists.
  try {
    console.log('Attempting to create test users via /api/admin/users...');
    const adminResp = await fetch(base + '/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test-a@example.com', password: 'Password123!', name: 'Test A' }) });
    const adminJson = await adminResp.text();
    console.log('/api/admin/users response:', adminResp.status, adminJson);
  } catch (e) {
    console.log('Could not create users via admin endpoint, proceeding with assumption that user ids exist:', e.message);
  }

  // Try to create a category as user A via /api/income-categories. This endpoint likely requires session auth; we'll try unauthenticated POST which may fail.
  try {
    console.log('Attempting to create category as unauthenticated request (will likely fail if auth required)...');
    const createResp = await fetch(base + '/api/income-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'MyPrivateCategory' }) });
    console.log('/api/income-categories POST status:', createResp.status);
    console.log('Body:', await createResp.text());
  } catch (e) {
    console.log('Create category request failed:', e.message);
  }

  // Fetch categories (unauthenticated)
  try {
    console.log('Fetching categories unauthenticated...');
    const getResp = await fetch(base + '/api/income-categories');
    console.log('/api/income-categories GET status:', getResp.status);
    console.log('Body:', await getResp.text());
  } catch (e) {
    console.log('Get categories failed:', e.message);
  }
}

run().catch(err => console.error(err));
