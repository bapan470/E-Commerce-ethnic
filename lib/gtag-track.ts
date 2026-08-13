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
