-- Add user management fields to users table
-- Migration: 2025-10-07-add-user-management-fields.sql

BEGIN;

-- Add status column for user account status (active, suspended)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add updated_at column for tracking user updates
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on user updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add check constraint for status values
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended'));

-- Add check constraint for role values
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('user', 'admin'));

-- Create index on status for better performance when filtering users
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Create index on role for better performance when filtering users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

COMMIT;