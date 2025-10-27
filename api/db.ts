import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { hashPassword } from './password';
const _filename_local = (() => {
  try {
    // Access import.meta.url dynamically to avoid TS compile-time errors under CommonJS test runner
    // @ts-ignore
    const meta = eval("typeof import !== 'undefined' ? import.meta : undefined");
    if (meta && meta.url) {
      return fileURLToPath(meta.url);
    }
  } catch (e) {
    // ignore
  }
  return path.join(process.cwd(), 'index.js');
})();

const _dirname_local = (() => path.dirname(_filename_local))();


// Refactored to use DATABASE_URL and conditional SSL, replacing the individual config object.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export async function getClient() {
  const client = await pool.connect();
  return client;
}
async function dbAdmin(client: PoolClient) {
   // Validate input
      
        const { username, password, name, email } = { username: 'admin', password: 'password', name: 'Admin', email: 'admin@example.com' };
    
        // Check for existing user
        const existingUserResult = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUserResult.rows.length > 0) {
          return;
        }
        console.log("No existing user found, proceeding to create user",password);
  
  
        // Hash password and insert user
        const hashedPassword = await hashPassword(password);
        console.log(hashedPassword);
        console.log("Inserting user into database:", { username, name, email });
        const insertResult = await client.query(
          'INSERT INTO users (username, password, name, email, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, email, role',
          [username, hashedPassword, name, email, 'admin']
        );
        const user = insertResult.rows[0];
        console.log("Created new user:", user);
  
        
}

export async function runMigrationScript() {
    const client = await getClient();
    try {
  // Use project root to locate schema.sql reliably regardless of module resolution
  const filePath = path.resolve(process.cwd(), 'database', 'schema.sql');
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      await client.query(sqlContent);
      // Ensure activity_log has expected columns used by the app.
      // If the project was previously using a different activity_log schema
      // (action, entity, entity_id, details), copy values into the new columns
      try {
        await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS action_type VARCHAR(50)`);
        await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS resource_type VARCHAR(100)`);
        await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS resource_id INTEGER`);
        await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS description TEXT`);
        await client.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS metadata JSONB`);

        // If legacy columns exist, copy their data into the new columns
        const legacyCols = await client.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'activity_log' AND column_name IN ('action', 'entity', 'entity_id', 'details')
        `);
        if ((legacyCols?.rowCount ?? 0) > 0) {
          // Map legacy columns into new ones where possible
          await client.query(`UPDATE activity_log SET action_type = COALESCE(action_type, action)`);
          await client.query(`UPDATE activity_log SET resource_type = COALESCE(resource_type, entity)`);
          await client.query(`UPDATE activity_log SET resource_id = COALESCE(resource_id, entity_id)`);
          await client.query(`UPDATE activity_log SET description = COALESCE(description, details)`);
          // We keep legacy columns in place to avoid destructive changes during migration
        }
        // Ensure incomes table has category_name column used by the code
        try {
          await client.query(`ALTER TABLE incomes ADD COLUMN IF NOT EXISTS category_name TEXT`);        
        } catch (err) {
          console.error('Error ensuring incomes.category_name column exists:', err);
        }

        // Ensure incomes.category_id is nullable (some code paths allow null and rely on category_name)
        try {
          const colRes = await client.query(`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'incomes' AND column_name = 'category_id'
          `);
          if ((colRes?.rowCount ?? 0) > 0 && colRes.rows[0].is_nullable === 'NO') {
            console.log('Making incomes.category_id nullable (DROP NOT NULL)');
            await client.query(`ALTER TABLE incomes ALTER COLUMN category_id DROP NOT NULL`);
          }
        } catch (err) {
          console.error('Error ensuring incomes.category_id is nullable:', err);
        }
      } catch (migrationErr) {
        console.error('Error ensuring activity_log schema:', migrationErr);
      }
      await dbAdmin(client);
      console.log(`SQL file '${filePath}' executed successfully.`);
    } catch (err) {
        console.error('Error executing SQL file:', err);
    } finally {
        client.release();
    }
}
