#!/usr/bin/env node
import { pool } from '../api/db';

async function hasColumn(column: string) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = $1`,
    [column]
  );
  return res.rowCount > 0;
}

async function main() {
  const confirm = process.argv.includes('--confirm');

  console.log('Checking for legacy activity_log columns...');
  const legacy = ['action', 'entity', 'entity_id', 'details'];
  const present: string[] = [];
  for (const c of legacy) {
    if (await hasColumn(c)) present.push(c);
  }

  if (present.length === 0) {
    console.log('No legacy columns found. Nothing to do.');
    process.exit(0);
  }

  console.log('Legacy columns present:', present.join(', '));

  // Copy data into new columns (non-destructive)
  console.log('Copying legacy values into new columns (action_type, resource_type, resource_id, description)...');
  await pool.query(`UPDATE activity_log SET action_type = COALESCE(action_type, action)`);
  await pool.query(`UPDATE activity_log SET resource_type = COALESCE(resource_type, entity)`);
  await pool.query(`UPDATE activity_log SET resource_id = COALESCE(resource_id, entity_id)`);
  await pool.query(`UPDATE activity_log SET description = COALESCE(description, details)`);

  if (!confirm) {
    console.log('\nData copy complete. Legacy columns remain in place to avoid accidental data loss.');
    console.log('If you want to drop the legacy columns now, re-run with --confirm (this is destructive).');
    process.exit(0);
  }

  // Drop columns
  console.log('Dropping legacy columns:', present.join(', '));
  for (const c of present) {
    await pool.query(`ALTER TABLE activity_log DROP COLUMN IF EXISTS ${c}`);
  }

  console.log('Legacy columns dropped.');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
