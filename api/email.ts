import nodemailer from 'nodemailer';

type EmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: any = null;

if (smtpHost && smtpPort && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
} else {
  console.warn('SMTP not fully configured. Emails will be logged to console.');
}

export async function sendEmail(opts: EmailOptions) {
  if (!transporter) {
    // Fallback: log to console
    console.log('Email fallback - To:', opts.to);
    console.log('Subject:', opts.subject);
    if (opts.text) console.log('Text:', opts.text);
    if (opts.html) console.log('HTML:', opts.html);
    return { accepted: [opts.to] };
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || smtpUser,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });

  return info;
}

export default { sendEmail };
