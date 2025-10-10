-- Migration: Add announcements and settings tables
BEGIN;

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed common settings
INSERT INTO settings (key, value)
  SELECT 'site_name', 'Expense Navigator' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='site_name');
INSERT INTO settings (key, value)
  SELECT 'default_currency', 'USD' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='default_currency');

COMMIT;
