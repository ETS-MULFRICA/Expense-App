import { pool } from './db';
import { sendAnnouncementEmail } from './email';

/**
 * Run one scheduler pass: find announcements with send_at <= now() and is_sent = false,
 * and send emails (if send_email true) then mark them is_sent = true.
 */
export async function runAnnouncementSchedulerOnce() {
  const pending = await pool.query('SELECT id, title, body, target_roles, send_email FROM announcements WHERE is_sent = false AND send_at IS NOT NULL AND send_at <= now()');
  for (const a of pending.rows) {
    try {
      if (a.send_email) {
        // fetch users matching target_roles (if any)
        let emailsRes;
        if (a.target_roles && a.target_roles.length) {
          emailsRes = await pool.query('SELECT email FROM users WHERE role = ANY($1)', [a.target_roles]);
        } else {
          emailsRes = await pool.query('SELECT email FROM users');
        }
        const emails = (emailsRes.rows || []).map((r: any) => r.email).filter(Boolean);
        if (emails.length) {
          await sendAnnouncementEmail(emails, a.title, `<h1>${a.title}</h1><div>${a.body}</div>`);
        }
      }
      await pool.query('UPDATE announcements SET is_sent = true WHERE id = $1', [a.id]);
    } catch (e) {
      console.error('scheduler failed for announcement', a.id, e);
    }
  }
}

// optional exported background runner
export function startAnnouncementScheduler(intervalMs = 60000) {
  const id = setInterval(() => {
    runAnnouncementSchedulerOnce().catch(e => console.error('announcement scheduler error', e));
  }, intervalMs);
  return () => clearInterval(id);
}
