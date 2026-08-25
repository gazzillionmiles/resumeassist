import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporterInstance = null;

export function getMailTransporter() {
  if (!transporterInstance) {
    const { host, port, secure, user, password } = config.smtp;

    const transportOptions = {
      host: host || 'localhost',
      port,
      secure,
    };

    if (user && password) {
      transportOptions.auth = {
        user,
        pass: password,
      };
    }

    transporterInstance = nodemailer.createTransport(transportOptions);
  }
  return transporterInstance;
}

export async function verifySmtpConnection() {
  try {
    const transporter = getMailTransporter();
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    console.error('[email] SMTP connection verification failed:', error.message);
    return { ok: false, error: error.message };
  }
}

export async function sendVerificationEmail({ to, token }) {
  const transporter = getMailTransporter();
  const expiryMinutes = config.emailVerificationExpiryMinutes || 30;
  const verificationUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const mailOptions = {
    from: config.smtp.from,
    to,
    subject: 'Verify your Outreach email',
    text: `Hi,\n\nThanks for signing up for Outreach.\n\nPlease verify your email address by clicking the link below:\n${verificationUrl}\n\nThis link expires in ${expiryMinutes} minutes.\n\nIf you didn't create this account, you can ignore this email.`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your Outreach email</title>
</head>
<body style="margin: 0; padding: 40px 20px; background-color: #f7f6f2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1c1a;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e4de; padding: 32px;">
    <tr>
      <td>
        <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 20px; color: #1c1c1a; letter-spacing: -0.01em;">Outreach</h1>
        <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px; color: #2d2d2a;">Hi,</p>
        <p style="font-size: 15px; line-height: 24px; margin: 0 0 24px; color: #2d2d2a;">Thanks for signing up for Outreach.</p>
        <p style="font-size: 15px; line-height: 24px; margin: 0 0 28px; color: #2d2d2a;">Please verify your email address by clicking the button below.</p>
        <div style="margin: 28px 0;">
          <a href="${verificationUrl}" style="display: inline-block; background-color: #2e4a3d; color: #ffffff; padding: 12px 24px; font-size: 15px; font-weight: 500; text-decoration: none; border-radius: 6px;">Verify Email</a>
        </div>
        <p style="font-size: 13px; line-height: 20px; margin: 24px 0 16px; color: #6b6a65;">This link expires in ${expiryMinutes} minutes.</p>
        <p style="font-size: 13px; line-height: 20px; margin: 0 0 24px; color: #6b6a65;">If you didn't create this account, you can ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eeeeea; margin: 24px 0 16px;" />
        <p style="font-size: 12px; line-height: 18px; margin: 0; color: #9c9a93;">If the button above doesn't work, copy and paste this link into your browser:<br /><a href="${verificationUrl}" style="color: #2e4a3d; word-break: break-all;">${verificationUrl}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
