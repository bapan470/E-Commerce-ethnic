/**
 * Fires a GA4 / Google Ads gtag event, retrying for a few seconds if
 * `window.gtag` isn't defined yet.
 *
 * Google's gtag.js loads with Next's `afterInteractive` strategy, which
 * can finish loading slightly *after* the very first user interaction on
 * a page — e.g. someone tapping "Add to Cart" the instant a product page
 * renders, or the checkout page's mount effect firing before the script
 * tag has executed. A one-shot `typeof window.gtag === 'function'` check
 * at that moment fails, gtag is never called, and the event is silently
 * lost — even though the user genuinely did the thing.
 *
 * This mirrors the retry approach already used by `PurchaseTracker` for
 * the `purchase` event, so `add_to_cart` / `begin_checkout` (and any
 * other event fired via this helper) get the same reliability.
 */
export function fireGtagEvent(eventName: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  let attempts = 0;
  const maxAttempts = 20; // ~10s total at 500ms apart — matches PurchaseTracker.

  const tryFire = () => {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', eventName, params);
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      setTimeout(tryFire, 500);
    }
  };

  tryFire();
}

/**
 * Shape of the customer-provided data Google Ads uses for Enhanced
 * Conversions. Send plain values here — Google's gtag.js hashes them
 * (SHA256) client-side before anything leaves the browser, so we never
 * need to hash ourselves. See:
 * https://support.google.com/google-ads/answer/13258081
 */
export interface GtagUserData {
  email?: string | null;
  phone?: string | null; // any format — normalizeIndianPhoneE164() below cleans it up
  firstName?: string | null;
  lastName?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null; // state
  postalCode?: string | null;
  country?: string | null; // ISO 3166-1 alpha-2, defaults to 'IN'
}

/**
 * Converts a loosely-formatted Indian phone number ("98765 43210",
 * "09876543210", "+91-98765-43210"...) into the E.164 format
 * (+919876543210) that Google Ads Enhanced Conversions requires.
 * Returns null if it doesn't look like a valid 10-digit Indian number.
 */
export function normalizeIndianPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`;
  return null;
}

/**
 * Sets Enhanced Conversions customer data via gtag('set', 'user_data', ...)
 * so subsequent conversion events (fired right after, via fireGtagEvent)
 * carry it. Retries the same way fireGtagEvent does, in case gtag.js is
 * still loading. Silently no-ops for any field that isn't provided —
 * Google Ads only needs email OR phone at minimum, more improves match rate.
 */
export function setGtagUserData(data: GtagUserData): void {
  if (typeof window === 'undefined') return;

  const email = data.email?.trim().toLowerCase() || undefined;
  const phone = normalizeIndianPhoneE164(data.phone) || undefined;
  const hasAddress = data.firstName || data.lastName || data.street || data.city || data.region || data.postalCode;

  if (!email && !phone && !hasAddress) return; // nothing usable to send

  const userData: Record<string, unknown> = {};
  if (email) userData.email = email;
  if (phone) userData.phone_number = phone;
  if (hasAddress) {
    userData.address = {
      first_name: data.firstName || undefined,
      last_name: data.lastName || undefined,
      street: data.street || undefined,
      city: data.city || undefined,
      region: data.region || undefined,
      postal_code: data.postalCode || undefined,
      country: data.country || 'IN',
    };
  }

  let attempts = 0;
  const maxAttempts = 20;

  const trySet = () => {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('set', 'user_data', userData);
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      setTimeout(trySet, 500);
    }
  };

  trySet();
}
