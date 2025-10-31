import { Router } from "express";
import { pool } from "../../db";
import { requireAdmin } from "../../auth";
import { sendEmail } from "../../lib/mailer";

const router = Router();

/**
 * POST /api/admin/messages
 * { toUserId, subject, body, emailUser }
 */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const { toUserId, subject, body, emailUser } = req.body;
    const fromAdminId = (req as any).user?.id || null;

    if (!toUserId || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const userRes = await pool.query("SELECT id, email, username FROM users WHERE id = $1", [toUserId]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "Recipient not found" });
    const recipient = userRes.rows[0];

    const insert = await pool.query(
      "INSERT INTO messages (from_admin_id, to_user_id, subject, body) VALUES ($1, $2, $3, $4) RETURNING *",
      [fromAdminId, toUserId, subject, body]
    );

    if (emailUser && recipient.email) {
      try {
        await sendEmail(
          recipient.email,
          subject,
          `<p>Hi ${recipient.username},</p><div>${body}</div><p>-- Admin</p>`
        );
      } catch (err) {
        console.error("Failed to send email notice:", err);
      }
    }

    res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;