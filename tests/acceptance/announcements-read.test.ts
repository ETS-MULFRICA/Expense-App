import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Announcements read tracking', () => {
  let adminAgent: request.SuperTest<request.Test>;
  let userAgent: request.SuperTest<request.Test>;
  let annId: number;

  beforeAll(async () => {
    adminAgent = request.agent(app as any);
    userAgent = request.agent(app as any);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_by INTEGER,
        created_at timestamptz DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        user_id integer NOT NULL,
        announcement_id integer NOT NULL,
        read_at timestamptz DEFAULT now(),
        PRIMARY KEY (user_id, announcement_id)
      )
    `);
    await pool.query("DELETE FROM announcements WHERE title LIKE 'read-test-%'");
    await pool.query("DELETE FROM users WHERE username LIKE 'readUser%'");
  });

  afterAll(async () => {
    await pool.query("DELETE FROM announcements WHERE title LIKE 'read-test-%'");
    await pool.query("DELETE FROM users WHERE username LIKE 'readUser%'");
    await pool.end();
  });

  test('user marks announcement read', async () => {
    // admin create user
    const uname = `readUser${Date.now()}`;
    const loginAdmin = await adminAgent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(loginAdmin.status).toBe(200);
    const createUser = await adminAgent.post('/api/admin/users').send({ username: uname, name: 'Read User', email: `${uname}@test.local`, password: 'testpass', role: 'user' });
    expect([200,201]).toContain(createUser.status);

    const createAnn = await adminAgent.post('/api/admin/announcements').send({ title: 'read-test-1', body: 'please read' });
    expect([200,201]).toContain(createAnn.status);
    annId = createAnn.body.id;

    const userLogin = await userAgent.post('/api/login').send({ username: uname, password: 'testpass' });
    expect(userLogin.status).toBe(200);

    // fetch public announcements
    const pub = await userAgent.get('/api/announcements');
    expect(pub.status).toBe(200);
    const found = (pub.body || []).find((a: any) => a.title === 'read-test-1');
    expect(found).toBeTruthy();
    expect(found.readAt).toBeUndefined();

    // mark read
    const mark = await userAgent.post(`/api/announcements/${annId}/read`).send();
    expect(mark.status).toBe(200);

    const pub2 = await userAgent.get('/api/announcements');
    const found2 = (pub2.body || []).find((a: any) => a.title === 'read-test-1');
    expect(found2).toBeTruthy();
    expect(found2.readAt).toBeTruthy();
  }, 20000);
});
