import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Announcements delivery acceptance', () => {
  let adminAgent: request.SuperTest<request.Test>;
  let userAgent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    adminAgent = request.agent(app as any);
    userAgent = request.agent(app as any);
    // ensure tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_by INTEGER,
        created_at timestamptz DEFAULT now()
      )
    `);
    // cleanup possible test rows
    await pool.query("DELETE FROM announcements WHERE title LIKE 'announce-test-%'");
    await pool.query("DELETE FROM users WHERE username LIKE 'announceUser%'");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM announcements WHERE title LIKE 'announce-test-%'");
    await pool.query("DELETE FROM users WHERE username LIKE 'announceUser%'");
    await pool.end();
  });

  test('admin sends announcement and users see it; admin can view past announcements', async () => {
    // admin login
    const adminLogin = await adminAgent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(adminLogin.status).toBe(200);

    // create a regular user
    const uname = `announceUser${Date.now()}`;
    const createUser = await adminAgent.post('/api/admin/users').send({ username: uname, name: 'Ann User', email: `${uname}@test.local`, password: 'testpass', role: 'user' });
    expect([200,201]).toContain(createUser.status);

    // create an announcement
    const title = `announce-test-${Date.now()}`;
    const body = 'Hello all users — important update';
    const createAnn = await adminAgent.post('/api/admin/announcements').send({ title, body });
    expect([200,201]).toContain(createAnn.status);

    // admin can list past announcements and see our announcement
    const adminList = await adminAgent.get('/api/admin/announcements');
    expect(adminList.status).toBe(200);
    expect(Array.isArray(adminList.body)).toBeTruthy();
    expect(adminList.body.find((a: any) => a.title === title)).toBeTruthy();

    // login as the regular user
    const userLogin = await userAgent.post('/api/login').send({ username: uname, password: 'testpass' });
    expect(userLogin.status).toBe(200);

    // user fetches public announcements and should see the created announcement
    const pub = await userAgent.get('/api/announcements');
    expect(pub.status).toBe(200);
    const found = (pub.body || []).find((a: any) => a.title === title && a.body === body);
    expect(found).toBeTruthy();
  }, 20000);
});
