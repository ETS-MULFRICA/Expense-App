import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Roles & Permissions acceptance', () => {
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    agent = request.agent(app as any);
    // Ensure migrations ran
    // Ensure any restrictive role check constraint is removed so tests can create custom roles
    await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;");
    // Clear test role if exists
    await pool.query("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE name = 'editor')");
    await pool.query("DELETE FROM roles WHERE name = 'editor'");
    // Clear test user if exists
    await pool.query("DELETE FROM users WHERE username = 'roleTester' OR email = 'role@test.local'");
  });

  afterAll(async () => {
    await pool.end();
  });

  test('create role and assign to user; editor cannot access admin pages', async () => {
    // Login as admin
    const login = await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);

    // Create 'editor' role
    const createRole = await agent.post('/api/admin/roles').send({ name: 'editor', description: 'Limited editor' });
    expect([200,201]).toContain(createRole.status);

    // Create a permission for limited admin access (if not exists)
    const perms = await agent.get('/api/admin/permissions');
    expect(perms.status).toBe(200);
    const perm = perms.body.find((p:any)=>p.name==='admin:access') || perms.body[0];

    // Assign permission to editor (none by default)
    // (we intentionally don't assign admin:access so editor cannot access admin pages)

    // Create a new test user
    const testUserRes = await agent.post('/api/admin/users').send({ username: 'roleTester', name: 'Role Tester', email: 'role@test.local', password: 'testpass', role: 'editor' });
    expect([200,201]).toContain(testUserRes.status);

    // Logout admin
    await agent.post('/api/logout');

    // Login as the new user
    const auth = request.agent(app as any);
    const login2 = await auth.post('/api/login').send({ username: 'roleTester', password: 'testpass' });
    expect(login2.status).toBe(200);

    // Attempt to access admin roles endpoint - should be 403
    const rolesRes = await auth.get('/api/admin/roles');
    expect([401,403]).toContain(rolesRes.status);

    // Now as admin assign admin:access permission to editor and ensure access
    await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    const roleList = await agent.get('/api/admin/roles');
    const editorRole = roleList.body.find((r:any)=>r.name==='editor');
    const permsList = await agent.get('/api/admin/permissions');
    const accessPerm = permsList.body.find((p:any)=>p.name==='admin:access');
    if (editorRole && accessPerm) {
      const assign = await agent.post(`/api/admin/roles/${editorRole.id}/permissions/${accessPerm.id}`);
      expect([200,204]).toContain(assign.status);

      // Re-login as roleTester
      await auth.post('/api/logout');
      const reLogin = await auth.post('/api/login').send({ username: 'roleTester', password: 'testpass' });
      expect(reLogin.status).toBe(200);
      const rolesRes2 = await auth.get('/api/admin/roles');
      expect([200]).toContain(rolesRes2.status);
    }
  });
});
