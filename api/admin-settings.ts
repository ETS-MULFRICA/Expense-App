import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { requireAdmin } from './middleware';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';

const router = Router();

// Get all settings
router.get('/settings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['app_settings']
    );
    res.json(result.rows[0]?.value || {});
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.post('/settings', requireAdmin, async (req: Request, res: Response) => {
  const { site_name, default_currency, default_language, email_templates } = req.body;
  
  try {
    // Get current settings
    const current = await pool.query(
      'SELECT value FROM system_settings WHERE key = $1',
      ['app_settings']
    );
    
    const currentSettings = current.rows[0]?.value || {};
    const newSettings = {
      ...currentSettings,
      ...(site_name && { site_name }),
      ...(default_currency && { default_currency }),
      ...(default_language && { default_language }),
      ...(email_templates && { email_templates })
    };

    // Update settings
    await pool.query(
      'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['app_settings', newSettings]
    );

    res.json(newSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Upload logo - temporarily disabled until multer is installed
// Multer storage for logos
const logosStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads', 'logos'));
  },
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage: logosStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/settings/logo', requireAdmin, upload.single('logo'), async (req: Request, res: Response) => {
  try {
    // multer attaches file to req.file
    // @ts-ignore
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const logoUrl = `/uploads/logos/${file.filename}`;

    // Read current system settings
    const current = await pool.query('SELECT value FROM system_settings WHERE key = $1', ['app_settings']);
    const currentSettings = current.rows[0]?.value || {};
    const newSettings = {
      ...currentSettings,
      logo_url: logoUrl
    };

    // Persist updated settings (JSONB)
    await pool.query(
      'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['app_settings', newSettings]
    );

    res.json({ logo_url: logoUrl });
  } catch (err) {
    console.error('Logo upload failed', err);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

export default router;