import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { passwordResetEmail } from '@/lib/email-templates';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_OK = NextResponse.json({ ok: true });

// Generates a password-reset link ourselves (via the admin API) and emails
// it with our own sender, instead of supabase.auth.resetPasswordForEmail(),
// which sends through Supabase's own built-in mailer and hits its very low
// rate limit unless Custom SMTP is set up in the dashboard.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const next = (body?.next as string | undefined) || '/reset-password';

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  }

  const { origin } = new URL(req.url);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  // Don't reveal whether the email exists -- always respond ok, but only
  // actually send when we successfully generated a link for a real user.
  if (error || !data?.properties?.hashed_token) {
    console.warn('[forgot-password] generateLink skipped/failed:', error?.message);
    return GENERIC_OK;
  }

  const resetUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties.hashed_token
  )}&type=recovery&next=${encodeURIComponent(next)}`;

  const fullName = (data.user?.user_metadata as any)?.full_name as string | undefined;
  const { subject, html } = passwordResetEmail({ full_name: fullName, reset_url: resetUrl });
  const result = await sendEmail({ to: email, subject, html });

  if (!result.success) {
    console.error('[forgot-password] email failed:', result.error);
  }

  return GENERIC_OK;
}
