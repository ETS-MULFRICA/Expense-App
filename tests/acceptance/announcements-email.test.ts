import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Announcements email send (simulated)', () => {
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    agent = request.agent(app as any);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        target_roles jsonb DEFAULT '[]'::jsonb,
        send_at timestamptz NULL,
        is_sent boolean DEFAULT false,
        created_by INTEGER,
        created_at timestamptz DEFAULT now()
      )
    `);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM announcements WHERE title LIKE 'email-test-%'");
    await pool.end();
  });

  test('admin creates announcement with sendEmail and it completes', async () => {
    const login = await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);

    const create = await agent.post('/api/admin/announcements').send({ title: 'email-test-1', body: 'email body', sendEmail: true });
    expect([200,201]).toContain(create.status);
  }, 20000);
});
