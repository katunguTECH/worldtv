const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ADDRESS = process.env.MAIL_FROM || 'WorldTV <no-reply@worldtvchannel.online>';
const SITE_URL = process.env.SITE_URL || 'https://worldtvchannel.online';

async function sendConfirmationEmail(email, token) {
  const confirmUrl = `${SITE_URL}/api/confirm/${token}`;

  await transporter.sendMail({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Confirm your email to watch WorldTV',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Confirm your email</h2>
        <p>Click below to confirm your email and start watching:</p>
        <p style="margin: 24px 0;">
          <a href="${confirmUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
            Confirm and watch
          </a>
        </p>
        <p style="color:#666;font-size:13px;">If the button doesn't work, copy and paste this link:<br>${confirmUrl}</p>
        <p style="color:#999;font-size:12px;">This link expires in 3 days.</p>
      </div>
    `,
    text: `Confirm your email to watch WorldTV: ${confirmUrl} (expires in 3 days)`,
  });
}

module.exports = { sendConfirmationEmail };
