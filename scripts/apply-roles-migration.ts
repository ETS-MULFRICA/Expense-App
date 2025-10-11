import { pool } from '../api/db';
import fs from 'fs';
import path from 'path';

async function run() {
  const filePath = path.resolve(process.cwd(), 'database', 'migrations', '2025-10-10-create-roles-and-permissions.sql');
  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Roles/permissions migration applied successfully');
  } catch (err) {
    console.error('Failed to apply roles migration:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
