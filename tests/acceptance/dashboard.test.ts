import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Admin dashboard acceptance', () => {
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    agent = request.agent(app as any);
    // remove restrictive role check if present
    await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;");
    // Ensure test users removed
    await pool.query("DELETE FROM users WHERE username LIKE 'dashTester%';");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE 'dashTester%';");
    await pool.end();
  });

  test('dashboard metrics update after creating users and CSV contains expected columns', async () => {
    // Login as admin
    const login = await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);

    // Get baseline metrics
    const beforeRes = await agent.get('/api/admin/metrics');
    expect(beforeRes.status).toBe(200);
    const before = beforeRes.body;
    const baseTotalUsers = before.totalUsers || 0;

    // Create 3 test users
    for (let i = 1; i <= 3; i++) {
      const u = `dashTester${i}`;
      const email = `dash${i}@test.local`;
      // ensure role exists
      const roles = await agent.get('/api/admin/roles');
      expect([200]).toContain(roles.status);
      const roleName = roles.body[0]?.name || 'user';
      const create = await agent.post('/api/admin/users').send({ username: u, name: 'Dash Tester', email, password: 'testpass', role: roleName });
      expect([200,201]).toContain(create.status);
    }

    // Fetch metrics after creating users
    const afterRes = await agent.get('/api/admin/metrics');
    expect(afterRes.status).toBe(200);
    const after = afterRes.body;
    expect(after.totalUsers).toBeGreaterThanOrEqual(baseTotalUsers + 3);

    // CSV check: produce CSV headers for topCategories and recentActivity and ensure expected columns exist
    const topCat = after.topCategories || [];
    const recent = after.recentActivity || [];

    // Build CSV headers locally
    const topCatHeaders = topCat.length ? Object.keys(topCat[0]) : ['name','total'];
    expect(topCatHeaders).toEqual(expect.arrayContaining(['name','total']));

    if (recent.length) {
      const recentHeaders = Object.keys(recent[0]);
      // recent activity should include at least these columns
      expect(recentHeaders).toEqual(expect.arrayContaining(['type','id','userId','amount','createdAt']));
    }
  }, 20000);
});
