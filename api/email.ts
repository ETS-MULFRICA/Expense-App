import dotenv from 'dotenv';
dotenv.config();

let transporter: any = null;

async function initTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      // require at runtime to avoid forcing a dependency in test environments
      // @ts-ignore
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } catch (e) {
      console.warn('nodemailer not available, email will be simulated');
      transporter = null;
    }
  }
  return transporter;
}

export async function sendAnnouncementEmail(to: string[], subject: string, html: string) {
  const t = await initTransporter();
  if (!t) {
    console.log('SMTP not configured - simulated send', { to, subject });
    return { accepted: to, simulated: true } as any;
  }

  const info = await t.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@example.com',
    to: to.join(','),
    subject,
    html
  });
  return info;
}
