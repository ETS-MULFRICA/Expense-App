-- Fix the announcement stats function to use BIGINT instead of INTEGER
-- This resolves the "Returned type bigint does not match expected type integer" error

DROP FUNCTION IF EXISTS get_announcement_stats(INTEGER);

CREATE OR REPLACE FUNCTION get_announcement_stats(target_announcement_id INTEGER)
RETURNS TABLE(
    total_users BIGINT,
    total_viewed BIGINT, 
    total_read BIGINT,
    total_dismissed BIGINT,
    view_rate NUMERIC(5,2),
    read_rate NUMERIC(5,2),
    dismiss_rate NUMERIC(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            (SELECT COUNT(*) FROM users WHERE role != 'admin') as total_users,
            COUNT(CASE WHEN ua.viewed_at IS NOT NULL THEN 1 END) as total_viewed,
            COUNT(CASE WHEN ua.read_at IS NOT NULL THEN 1 END) as total_read,
            COUNT(CASE WHEN ua.dismissed_at IS NOT NULL THEN 1 END) as total_dismissed
        FROM users u
        LEFT JOIN user_announcements ua ON (u.id = ua.user_id AND ua.announcement_id = target_announcement_id)
        WHERE u.role != 'admin'
    )
    SELECT 
        s.total_users,
        s.total_viewed,
        s.total_read,
        s.total_dismissed,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_viewed::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as view_rate,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_read::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as read_rate,
        CASE WHEN s.total_users > 0 THEN ROUND((s.total_dismissed::DECIMAL / s.total_users) * 100, 2) ELSE 0 END as dismiss_rate
    FROM stats s;
END;
$$ LANGUAGE plpgsql;