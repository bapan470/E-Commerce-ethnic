// Affiliate program — customer-facing types + client helpers.
//
// Different from the reseller program (lib/reseller-api.ts, which lets a
// customer mark up the store's price and resell under their own account).
// Here, a customer applies to become an "affiliate", gets approved by the
// admin, and is given a unique referral code/link. When someone else places
// an order after landing on the site via that link, the affiliate earns a
// cash commission — they never touch pricing themselves.
//
// Payout lifecycle (see supabase/migrations/20260913000000_affiliate_program.sql):
//   pending_delivery -> in_return_window -> eligible -> paid
//                                         \-> void

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export type AffiliateStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type AffiliatePayoutStatus =
  | 'pending_delivery'
  | 'in_return_window'
  | 'eligible'
  | 'paid'
  | 'void';

export interface AffiliateProfile {
  id: string;
  user_id: string;
  code: string;
  status: AffiliateStatus;
  commission_percent: number;
  payout_upi_id: string | null;
  payout_account_holder: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateEarningsSummary {
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  pendingOrders: number;
  pendingDeliveryCommission: number;
  inReturnWindowCommission: number;
  eligibleCommission: number;
  paidCommission: number;
}

export interface AffiliateOverviewResponse {
  profile: AffiliateProfile | null;
  earnings: AffiliateEarningsSummary;
}

export interface AffiliateOrderRow {
  id: string;
  createdAt: string;
  totalAmount: number;
  status: string;
  commissionAmount: number | null;
  commissionStatus: AffiliatePayoutStatus | null;
}

// ---------------------------------------------------------------------
// Storefront (customer-facing) API calls — go through /api/affiliate so
// the request is checked against the logged-in Supabase auth session
// server-side (same pattern used by /api/reseller).
// ---------------------------------------------------------------------

/** Fetches the current customer's affiliate profile (null if they
 *  haven't applied yet) plus an earnings summary. Requires login. */
export async function fetchMyAffiliateOverview(): Promise<AffiliateOverviewResponse> {
  const res = await fetch('/api/affiliate');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load affiliate data');
  }
  return res.json();
}

/** Applies to join the affiliate program using the current logged-in
 *  account. Starts out in 'pending' status until an admin approves it. */
export async function applyForAffiliate(): Promise<{ profile: AffiliateProfile }> {
  const res = await fetch('/api/affiliate', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to apply for the affiliate program');
  }
  return res.json();
}

/** Updates payout details (UPI ID + account holder name) — where the
 *  admin should send commission once orders are marked eligible. */
export async function updateAffiliatePayoutDetails(details: {
  payout_upi_id?: string;
  payout_account_holder?: string;
}): Promise<void> {
  const res = await fetch('/api/affiliate', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update payout details');
  }
}

/** Fetches the logged-in affiliate's own referred orders. */
export async function fetchMyAffiliateOrders(): Promise<AffiliateOrderRow[]> {
  const res = await fetch('/api/affiliate/orders');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load referred orders');
  }
  const data = await res.json();
  return data.orders ?? [];
}

/** Builds the shareable referral link for an affiliate's code. Works
 *  on both server and client since it doesn't touch window/location. */
export function buildAffiliateReferralLink(code: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    '';
  return `${base}/?aff=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------
// localStorage referral-code capture (guest + logged-in browsers) —
// mirrors the pattern in lib/recently-viewed.ts: client-only, fails
// silently if storage is unavailable (private browsing / disabled).
// ---------------------------------------------------------------------

const STORAGE_KEY = 'saaj_affiliate_ref';
const CODE_EXPIRY_DAYS = 30;

interface StoredAffiliateRef {
  code: string;
  capturedAt: number; // epoch ms
}

/** Captures an affiliate code from a ?aff=CODE URL param into
 *  localStorage with a 30-day expiry. Overwrites any previously
 *  captured code — the most recent link a visitor clicked wins. */
export function captureAffiliateCode(code: string) {
  if (typeof window === 'undefined' || !code) return;
  try {
    const entry: StoredAffiliateRef = { code, capturedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable — fail silently, same as recently-viewed.ts
  }
}

/** Returns the currently captured affiliate code, or null if none is
 *  stored or it has expired past CODE_EXPIRY_DAYS. */
export function getStoredAffiliateCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAffiliateRef>;
    if (!parsed || typeof parsed.code !== 'string' || typeof parsed.capturedAt !== 'number') {
      return null;
    }
    const ageMs = Date.now() - parsed.capturedAt;
    const maxAgeMs = CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (ageMs > maxAgeMs) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearStoredAffiliateCode() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
