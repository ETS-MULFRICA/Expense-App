import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import path, { dirname } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { hashPassword } from './password';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);



export const config = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
};

export const pool = new Pool(config);

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
    // Execute schema.sql in its own session
    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sqlContent = fs.readFileSync(schemaPath, 'utf8');
      try {
        const c = await getClient();
        try {
          await c.query(sqlContent);
          console.log(`Executed schema file: ${schemaPath}`);
        } catch (err) {
          console.error(`Failed executing schema.sql:`, err);
        } finally {
          c.release();
        }
      } catch (err) {
        console.error('Failed to obtain DB client for schema execution:', err);
      }
    } else {
      console.warn('No schema.sql found at', schemaPath);
    }

    // Then execute each migration in its own client/session so a failing migration
    // does not leave a connection in an aborted transaction state and block the rest.
    const migrationsDir = path.resolve(__dirname, '../database/migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const f of files) {
        const p = path.join(migrationsDir, f);
        const sql = fs.readFileSync(p, 'utf8');
        let c: PoolClient | null = null;
        try {
          c = await getClient();
          await c.query(sql);
          console.log(`Applied migration: ${f}`);
        } catch (migErr) {
          console.error(`Failed applying migration ${f}:`, migErr);
          // Continue to next migration — we don't want one bad migration to block the rest.
        } finally {
          if (c) c.release();
        }
      }
    } else {
      console.warn('Migrations directory not found:', migrationsDir);
    }

    // After migrations, create admin user if needed using a fresh client
    try {
      const adminClient = await getClient();
      try {
        await dbAdmin(adminClient);
      } catch (err) {
        console.error('Error during admin user setup:', err);
      } finally {
        adminClient.release();
      }
    } catch (err) {
      console.error('Failed to obtain DB client for admin setup:', err);
    }
}