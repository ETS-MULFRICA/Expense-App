-- Migration: Add moderation queue table
BEGIN;

CREATE TABLE IF NOT EXISTS moderation_queue (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  action_taken VARCHAR(50) DEFAULT NULL,
  action_notes TEXT DEFAULT NULL,
  acted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

COMMIT;
