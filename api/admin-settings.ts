import { Router, type Request, type Response } from 'express';
import { pool } from './db';
import { requireAdmin } from './middleware';
import fs from 'fs/promises';

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
router.post('/settings/logo', requireAdmin, async (req: Request, res: Response) => {
  res.status(501).json({ error: 'File upload not yet implemented' });
});

export default router;