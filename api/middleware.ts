import { type Request, type Response } from "express";
import { pool } from "./db";
import { storage } from "./storage";

/**
 * Authentication Middleware
 * Checks if user is logged in before allowing access to protected routes
 * Returns 401 Unauthorized if user is not authenticated
 */
export const requireAuth = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.sendStatus(401);
  }
  try {
    // Check user existence in DB on every request
    const userId = req.user.id;
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (result.rowCount === 0) {
      // User not found in DB
      req.logout?.(() => {});
      return res.sendStatus(401);
    }
    next();
  } catch (err) {
    // DB error (e.g., DB is down)
    return res.status(503).json({ message: "Authentication unavailable: database error" });
  }
};

/**
 * Admin Authorization Middleware
 * Checks if user is authenticated AND has admin role
 * Returns 401 if not authenticated, 403 if not admin
 */
export const requireAdmin = async (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.sendStatus(401);
  }
  try {
    // Also block suspended or deleted users even if they have an admin session
    const check = await pool.query('SELECT is_suspended, is_deleted FROM users WHERE id = $1', [req.user!.id]);
    const row = check.rows[0];
    if (!row) return res.sendStatus(401);
    if (row.is_deleted) return res.status(403).json({ message: 'Account deleted' });
    if (row.is_suspended) return res.status(403).json({ message: 'Account suspended' });

    const userRole = await storage.getUserRole(req.user!.id);
    if (userRole !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  } catch (err) {
    console.error('requireAdmin error', err);
    return res.status(500).json({ message: 'Authorization failure' });
  }
};