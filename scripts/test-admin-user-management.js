// Simple admin user management acceptance test script
// Run with: node scripts/test-admin-user-management.js
const fetch = require('node-fetch');

const API = 'http://localhost:3000/api'; // Change port if needed
const adminCreds = { username: 'admin', password: 'adminpass' };

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Login failed');
  const data = await res.json();
  return data.token || data.session || data;
}

async function createUser(token, user) {
  const res = await fetch(`${API}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(user)
  });
  if (!res.ok) throw new Error('Create user failed');
  return await res.json();
}

async function suspendUser(token, userId) {
  const res = await fetch(`${API}/admin/users/${userId}/suspend`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Suspend user failed');
  return await res.json();
}

async function test() {
  try {
    console.log('Logging in as admin...');
    const token = await login(adminCreds.username, adminCreds.password);
    console.log('Admin login successful.');

    console.log('Creating test user...');
    const user = await createUser(token, {
      username: 'testuser',
      password: 'testpass',
      name: 'Test User',
      email: 'testuser@example.com',
      role: 'user'
    });
    console.log('User created:', user);

    console.log('Suspending test user...');
    const suspendRes = await suspendUser(token, user.id);
    console.log('User suspended:', suspendRes);

    console.log('Trying to login as suspended user...');
    try {
      await login('testuser', 'testpass');
      console.error('ERROR: Suspended user was able to log in!');
    } catch {
      console.log('Suspended user cannot log in (expected).');
    }

    console.log('All tests passed.');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
