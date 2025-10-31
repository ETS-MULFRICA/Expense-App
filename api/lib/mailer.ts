import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromAddress = process.env.EMAIL_FROM || "no-reply@example.com";

export const mailer = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
});

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (!smtpHost || !smtpUser) {
    console.warn("SMTP not configured, skipping sending email to", to);
    return false;
  }
  await mailer.sendMail({
    from: fromAddress,
    to,
    subject,
    text: text || html.replace(/<[^>]*>/g, ""),
    html,
  });
  return true;
}