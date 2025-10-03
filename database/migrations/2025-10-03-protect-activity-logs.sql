-- Migration: Add database-level protection for activity logs
-- This ensures activity logs cannot be deleted even through direct database access

BEGIN;

-- Create a function that prevents deletion of activity logs
CREATE OR REPLACE FUNCTION prevent_activity_log_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Activity logs cannot be deleted for security and audit purposes. Table: %, Operation: %', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'P0001';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to prevent DELETE operations on activity_log table
DROP TRIGGER IF EXISTS prevent_activity_log_delete ON activity_log;
CREATE TRIGGER prevent_activity_log_delete
    BEFORE DELETE ON activity_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_activity_log_deletion();

-- Also prevent TRUNCATE operations
DROP TRIGGER IF EXISTS prevent_activity_log_truncate ON activity_log;
CREATE TRIGGER prevent_activity_log_truncate
    BEFORE TRUNCATE ON activity_log
    EXECUTE FUNCTION prevent_activity_log_deletion();

-- Add comments for documentation
COMMENT ON FUNCTION prevent_activity_log_deletion() IS 'Prevents deletion of activity logs for audit and security compliance';
COMMENT ON TRIGGER prevent_activity_log_delete ON activity_log IS 'Ensures activity logs cannot be deleted via DELETE statements';
COMMENT ON TRIGGER prevent_activity_log_truncate ON activity_log IS 'Ensures activity logs cannot be deleted via TRUNCATE statements';

-- Create a view for read-only access to activity logs (optional, for added security)
CREATE OR REPLACE VIEW activity_log_readonly AS
SELECT 
    id,
    user_id,
    action_type,
    resource_type,
    resource_id,
    description,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM activity_log;

COMMENT ON VIEW activity_log_readonly IS 'Read-only view of activity logs for reporting purposes';

COMMIT;