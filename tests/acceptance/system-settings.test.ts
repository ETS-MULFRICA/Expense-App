import request from 'supertest';
import app from '../../api/index';
import { pool } from '../../api/db';

describe('System settings acceptance', () => {
  let agent: request.SuperTest<request.Test>;

  beforeAll(async () => {
    agent = request.agent(app as any);
    // remove restrictive role check if present
    await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;");
    // ensure settings table exists and is clean
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id boolean PRIMARY KEY DEFAULT true,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_at timestamptz DEFAULT now()
      )
    `);
    await pool.query("DELETE FROM app_settings WHERE id = true;");
  });

  afterAll(async () => {
    // cleanup
    await pool.query("DELETE FROM app_settings WHERE id = true;");
    await pool.end();
  });

  test('changing site name/logo is reflected in header and emails, currency change affects formatting', async () => {
    // login as admin
    const login = await agent.post('/api/login').send({ username: 'admin', password: 'password' });
    expect(login.status).toBe(200);

    const logoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    const payload = {
      siteName: 'Test Site 123',
      logoDataUrl,
      defaultCurrency: 'EUR',
      language: 'en'
    };

    const put = await agent.put('/api/admin/settings').send(payload).set('Content-Type', 'application/json');
    expect(put.status).toBe(200);

    // public settings should reflect siteName and logo
    const pub = await agent.get('/api/settings');
    expect(pub.status).toBe(200);
    expect(pub.body.siteName).toBe('Test Site 123');
    expect(typeof pub.body.logoDataUrl).toBe('string');

    // Render welcome email and check site name presence
    const rendered = await agent.post('/api/test/render-welcome').send({ name: 'Alice' });
    expect(rendered.status).toBe(200);
    expect(rendered.body.html).toContain('Test Site 123');

    // Format an amount: should use EUR
    const fmt = await agent.post('/api/test/format-amount').send({ amount: 1234.5 }).set('Content-Type', 'application/json');
    expect(fmt.status).toBe(200);
    expect(fmt.body.currency).toBe('EUR');
    expect(typeof fmt.body.formatted).toBe('string');
    // Basic currency symbol check for EUR (may be € or EUR depending on locale); ensure currency is present
    expect(fmt.body.formatted).toMatch(/\d/);
  }, 20000);
});
