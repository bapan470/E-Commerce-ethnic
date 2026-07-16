// Prefer the global TextEncoder when available (Edge/runtime-friendly)
const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string) {
  // restore padding
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString();
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  // Use Web Crypto Subtle when available, fall back to Node crypto
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(msg));
    const arr = Array.from(new Uint8Array(sig));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

export async function createAdminToken() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  const maxAge = ADMIN_SESSION_MAX_AGE;
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + maxAge };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadJson);
  const sig = await hmacHex(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyAdminToken(token: string | undefined | null) {
  if (!token) return { valid: false };
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };
    const [payloadB64, sig] = parts;
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
    const expected = await hmacHex(secret, payloadB64);

    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return { valid: false };
    // timing-safe comparison
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    if (!crypto.timingSafeEqual(a, b)) return { valid: false };

    const payloadJson = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadJson);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp > now) {
      return { valid: true, payload };
    }
    return { valid: false };
  } catch (err) {
    return { valid: false };
  }
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE };
