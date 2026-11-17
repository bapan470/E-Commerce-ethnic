// Single source of truth for shipping & returns labels used by checkout.
// Values mirror AruhiHandlooms' existing defaults (see lib/pincode-api.ts and lib/marketing-api.ts).
// No imports, safe in client and server code.
export const STORE_POLICY = {
  country: 'IN',
  currency: 'INR',
  handlingMinDays: 2,
  handlingMaxDays: 3,
  transitMinDays: 3,
  transitMaxDays: 5,
  totalMinDays: 5,
  totalMaxDays: 8,
  flatShippingRate: 99,
  freeShippingThreshold: 2000,
  returnWindowDays: 7,
} as const;

export const TOTAL_DELIVERY_LABEL = `${STORE_POLICY.totalMinDays}–${STORE_POLICY.totalMaxDays} business days`;
export const HANDLING_LABEL = `${STORE_POLICY.handlingMinDays}–${STORE_POLICY.handlingMaxDays} business days`;
export const TRANSIT_LABEL = `${STORE_POLICY.transitMinDays}–${STORE_POLICY.transitMaxDays} business days`;
export const RETURN_WINDOW_LABEL = `${STORE_POLICY.returnWindowDays} days`;
