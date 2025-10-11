import { pool } from './db';

/**
 * Log security events like login attempts, admin actions, etc.
 * This is separate from activity logging to avoid circular dependencies
 */
export async function logSecurityEvent(
  event_type: 'login_success' | 'login_failure' | 'logout' | 'password_change' | 'account_locked' | 'admin_action',
  user_id: number | null,
  ip_address: string,
  user_agent: string,
  details: any = {}
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO security_logs (user_id, event_type, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, event_type, ip_address, user_agent, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw error to avoid breaking the main functionality
  }
}