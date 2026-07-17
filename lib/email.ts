// Multi-provider transactional email sender.
//
// Configuration is read from the `settings` table (key = 'email_provider'),
// which the admin can edit from Admin -> Settings -> Email Notifications --
// no redeploy needed to switch provider or rotate the API key.
//
// As a fallback (e.g. before the admin has configured anything), it also
// checks these env vars:
//   RESEND_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME        (Resend)
//   ZEPTOMAIL_API_KEY, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME, ZEPTOMAIL_REGION ('in' | 'com')

import { getServerSupabase } from './supabase-server';

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

type SendEmailResult =
  | { success: true; skipped?: false; data: any }
  | { success: false; skipped?: false; error: any }
  | { success: false; skipped: true; error: string };

interface ResolvedEmailConfig {
  provider: 'resend' | 'zeptomail' | '';
  apiKey: string;
  senderEmail: string;
  senderName: string;
  zeptomailRegion: 'in' | 'com';
}

async function resolveEmailConfig(): Promise<ResolvedEmailConfig> {
  let dbConfig: any = null;
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_provider')
      .maybeSingle();
    dbConfig = data?.value || null;
  } catch {
    // settings table not reachable -- fall through to env vars
  }

  const provider: ResolvedEmailConfig['provider'] =
    dbConfig?.provider ||
    (process.env.RESEND_API_KEY ? 'resend' : process.env.ZEPTOMAIL_API_KEY ? 'zeptomail' : '');

  if (provider === 'zeptomail') {
    return {
      provider,
      apiKey: dbConfig?.api_key || process.env.ZEPTOMAIL_API_KEY || '',
      senderEmail: dbConfig?.sender_email || process.env.EMAIL_FROM_ADDRESS || '',
      senderName: dbConfig?.sender_name || process.env.EMAIL_FROM_NAME || 'Saaj Boutique',
      zeptomailRegion:
        (dbConfig?.zeptomail_region || process.env.ZEPTOMAIL_REGION || 'in') === 'com' ? 'com' : 'in',
    };
  }

  // default / resend
  return {
    provider: provider === 'resend' ? 'resend' : provider,
    apiKey: dbConfig?.api_key || process.env.RESEND_API_KEY || '',
    senderEmail: dbConfig?.sender_email || process.env.EMAIL_FROM_ADDRESS || '',
    senderName: dbConfig?.sender_name || process.env.EMAIL_FROM_NAME || 'Saaj Boutique',
    zeptomailRegion: 'in',
  };
}

async function sendViaResend(cfg: ResolvedEmailConfig, args: SendEmailArgs) {
  const from = cfg.senderEmail
    ? `${cfg.senderName} <${cfg.senderEmail}>`
    : 'Saaj Boutique <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: args.to, subject: args.subject, html: args.html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[email/resend] API error:', data);
    return { success: false as const, error: data };
  }
  return { success: true as const, data };
}

async function sendViaZeptoMail(cfg: ResolvedEmailConfig, args: SendEmailArgs) {
  const base = cfg.zeptomailRegion === 'com' ? 'https://api.zeptomail.com' : 'https://api.zeptomail.in';

  const res = await fetch(`${base}/v1.1/email`, {
    method: 'POST',
    headers: {
      // ZeptoMail expects the raw token exactly as shown in their dashboard,
      // already prefixed -- e.g. "Zoho-enczapikey wSsVR60h...".
      Authorization: cfg.apiKey.startsWith('Zoho-enczapikey') ? cfg.apiKey : `Zoho-enczapikey ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { address: cfg.senderEmail, name: cfg.senderName },
      to: [{ email_address: { address: args.to } }],
      subject: args.subject,
      htmlbody: args.html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[email/zeptomail] API error:', data);
    return { success: false as const, error: data };
  }
  return { success: true as const, data };
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<SendEmailResult> {
  if (!to) {
    return { success: false, skipped: true, error: 'No recipient email address' };
  }

  const cfg = await resolveEmailConfig();

  if (!cfg.provider || !cfg.apiKey) {
    console.warn(
      `[email] No email provider configured -- skipping "${subject}" to ${to}. Set it up in Admin -> Settings -> Email Notifications.`
    );
    return { success: false, skipped: true, error: 'Email provider not configured' };
  }

  if (!cfg.senderEmail) {
    console.warn(`[email] No sender email configured -- skipping "${subject}" to ${to}.`);
    return { success: false, skipped: true, error: 'Sender email not configured' };
  }

  try {
    const result =
      cfg.provider === 'zeptomail'
        ? await sendViaZeptoMail(cfg, { to, subject, html })
        : await sendViaResend(cfg, { to, subject, html });
    return result;
  } catch (err) {
    console.error('[email] send failed:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
