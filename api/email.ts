import nodemailer from 'nodemailer';
import { pool } from './db';

// Define the type for email options
type EmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

// Load SMTP credentials from environment variables
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

// Initialize Nodemailer transporter if all necessary environment variables are set
if (smtpHost && smtpPort && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    // Secure is true for port 465, false for all other ports
    secure: smtpPort === 465, 
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  // If configuration is missing, log a warning and use the console as a fallback
  console.warn('SMTP not fully configured. Emails will be logged to console (fallback mode).');
}

/**
 * Loads site-wide settings (like the site name) from the database for use in email templates.
 */
async function loadSiteSettings(): Promise<{ [key: string]: any }> {
  try {
    const r = await pool.query('SELECT value FROM system_settings WHERE key = $1', ['app_settings']);
    // Return the value (which is expected to be a JSON object) or an empty object
    return r.rows[0]?.value || {};
  } catch (err) {
    console.error('Failed to load system settings for email:', err);
    return {};
  }
}

/**
 * Sends an email using the configured transporter or falls back to console logging.
 * Handles template substitutions like {site_name}.
 * @param opts Email options including recipient, subject, and content.
 */
export async function sendEmail(opts: EmailOptions) {
  // Load site settings to allow substitutions like {site_name}
  const settings = await loadSiteSettings();
  const siteName = settings.site_name || process.env.SITE_NAME || 'Expense App';

  // Apply {site_name} substitution to both text and HTML content
  if (opts.text) {
    opts.text = opts.text.replace(/\{site_name\}/g, siteName);
  }
  if (opts.html) {
    opts.html = opts.html.replace(/\{site_name\}/g, siteName);
  }

  if (!transporter) {
    // Fallback: log to console when SMTP is not configured
    console.log('--- Email FALLBACK Log ---');
    console.log('To:', opts.to);
    console.log('Subject:', opts.subject);
    if (opts.text) console.log('Text:', opts.text);
    if (opts.html) console.log('HTML (preview):', opts.html?.substring(0, 100) + '...');
    console.log('--------------------------');
    return { accepted: [opts.to] }; // Mock success for fallback mode
  }

  // Send the email via Nodemailer
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || smtpUser,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return info;
}

/**
 * Sends a system-wide announcement email with basic HTML formatting.
 * @param to The recipient's email address.
 * @param subject The email subject line.
 * @param message The main body of the announcement.
 */
export async function sendAnnouncementEmail(to: string, subject: string, message: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{site_name} Announcement</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Announcement: ${subject}</h2>
            <div style="margin-top: 20px; line-height: 1.6; color: #555;">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <p style="margin-top: 30px; font-size: 0.9em; color: #777;">
                This is an automated announcement from {site_name}. Please do not reply to this email.
            </p>
        </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `[Announcement] ${subject}`,
    html: htmlContent,
  });
}

export default { 
    sendEmail, 
    sendAnnouncementEmail 
};
