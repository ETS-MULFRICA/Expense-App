import { Router } from "express";
import { pool } from "../db";
import { requireAuth } from "../auth";

const router = Router();

/** GET /api/messages/inbox */
router.get("/inbox", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = Number(req.query.offset) || 0;
    const q = await pool.query(
      `SELECT m.id, m.subject, m.body, m.from_admin_id, m.to_user_id, m.sent_at, m.is_read
       FROM messages m
       WHERE m.to_user_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.sent_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load inbox" });
  }
});

/** GET /api/messages/:id */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const id = Number(req.params.id);
    const q = await pool.query("SELECT * FROM messages WHERE id = $1 AND to_user_id = $2 AND deleted_at IS NULL", [id, userId]);
    if (q.rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch message" });
  }
});

/** PATCH /api/messages/:id/read */
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const id = Number(req.params.id);
    const isRead = !!req.body.is_read;
    const q = await pool.query(
      "UPDATE messages SET is_read = $1 WHERE id = $2 AND to_user_id = $3 RETURNING *",
      [isRead, id, userId]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "Message not found or unauthorized" });
    res.json(q.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update read status" });
  }
});

/** DELETE /api/messages/:id (soft-delete) */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const id = Number(req.params.id);
    const q = await pool.query("UPDATE messages SET deleted_at = now() WHERE id = $1 AND to_user_id = $2 RETURNING *", [id, userId]);
    if (q.rowCount === 0) return res.status(404).json({ error: "Message not found or unauthorized" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;