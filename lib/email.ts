// Thin wrapper around the Resend HTTP API (https://resend.com).
// No extra npm package needed — just a fetch call with an API key.
//
// Required env vars (set in .env locally and in Vercel project settings):
//   RESEND_API_KEY   — from https://resend.com/api-keys
//   EMAIL_FROM       — e.g. "Saaj Boutique <orders@yourdomain.com>"
//                       (until you verify a domain on Resend, you can use
//                       the sandbox sender "onboarding@resend.dev", which
//                       only delivers to the email you signed up with)

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
};

type SendEmailResult =
  | { success: true; skipped?: false; data: any }
  | { success: false; skipped?: false; error: any }
  | { success: false; skipped: true; error: string };

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Don't throw — a missing key shouldn't break checkout/admin flows.
    console.warn(`[email] RESEND_API_KEY not set — skipping email "${subject}" to ${to}`);
    return { success: false, skipped: true, error: 'RESEND_API_KEY not configured' };
  }

  if (!to) {
    return { success: false, skipped: true, error: 'No recipient email address' };
  }

  const from = process.env.EMAIL_FROM || 'Saaj Boutique <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[email] Resend API error:', data);
      return { success: false, error: data };
    }

    return { success: true, data };
  } catch (err) {
    console.error('[email] send failed:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
