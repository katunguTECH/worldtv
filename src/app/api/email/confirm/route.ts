import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createPendingEmail } from '@/lib/email-store';

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL || 'https://worldtvchannel.online';
const EMAIL_FROM = process.env.EMAIL_FROM || 'WorldTV <noreply@worldtvchannel.online>';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// very small in-memory rate limiter keyed by IP — resets on server restart.
// Good enough to slow down casual bot spam; swap for a real store (Redis,
// your DB) if you need it to survive deploys/restarts.
const recentByIp = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 1000; // 1 request per IP per minute

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.toString().trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const last = recentByIp.get(ip);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  recentByIp.set(ip, Date.now());

  const record = createPendingEmail(email);
  const confirmUrl = `${APP_URL}/?confirm=${record.token}`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: record.email,
      subject: 'Confirm your email for WorldTV',
      html: `
        <p>Thanks for visiting WorldTV.</p>
        <p>Please confirm your email to continue — this is a one-time step to keep the site free of bots and fake accounts.</p>
        <p><a href="${confirmUrl}">Confirm my email</a></p>
        <p>This link expires in 24 hours. If you didn't request this, you can ignore it.</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send confirmation email', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
