-- Add deleted status option for soft delete functionality
-- Migration: 2025-10-08-add-deleted-status.sql

BEGIN;

-- Update the status constraint to include 'deleted'
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'suspended', 'deleted'));

COMMIT;