import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('Announcements API', () => {
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    agent = request.agent(app as any);
    // ensure announcements table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_by INTEGER,
        created_at timestamptz DEFAULT now()
      )
    `);
    await pool.query('DELETE FROM announcements WHERE title LIKE $1', ['test-ann-%']);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM announcements WHERE title LIKE $1', ['test-ann-%']);
    await pool.end();
  });

  test('admin can create and list announcements', async () => {
    const login = await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);

    const create = await agent.post('/api/admin/announcements').send({ title: 'test-ann-1', body: 'hello world' });
    expect([200,201]).toContain(create.status);
    const list = await agent.get('/api/admin/announcements');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.find((a: any) => a.title === 'test-ann-1')).toBeTruthy();
  }, 20000);
});
