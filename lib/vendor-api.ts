// ---------------------------------------------------------------------
// Vendor sourcing (internal — never shown to customers). Phase 1:
// application, admin approve/reject, and the secure bank-detail-change
// request flow.
// ---------------------------------------------------------------------

export interface VendorProfile {
  id: string;
  user_id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  pan_number: string;
  gst_number: string | null;
  pickup_address: string;
  expected_category: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  pending_bank_update: { bank_account_number: string; bank_ifsc: string; requested_at: string } | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  admin_note: string | null;
  created_at: string;
}

export interface VendorApplicationInput {
  business_name: string;
  owner_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  pan_number: string;
  gst_number?: string;
  pickup_address: string;
  expected_category?: string;
}

// ---------------------------------------------------------------------
// Vendor-facing (logged-in customer applying / managing their own vendor account)
// ---------------------------------------------------------------------

/** Fetches the current user's vendor profile, or null if they haven't applied yet. */
export async function fetchMyVendorProfile(): Promise<VendorProfile | null> {
  const res = await fetch('/api/vendor');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load vendor profile');
  }
  const body = await res.json();
  return body.vendor as VendorProfile | null;
}

/** Submits a new /sell-with-us application for the logged-in user. */
export async function submitVendorApplication(input: VendorApplicationInput): Promise<VendorProfile> {
  const res = await fetch('/api/vendor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to submit application');
  }
  const body = await res.json();
  return body.vendor as VendorProfile;
}

/**
 * Requests a bank-detail change. This never updates bank_account_number
 * directly — it stages the request for admin approval (see the
 * request_vendor_bank_update() RPC in the Phase 1 migration).
 */
export async function requestVendorBankUpdate(newAccountNumber: string, newIfsc: string): Promise<void> {
  const res = await fetch('/api/vendor/bank-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bank_account_number: newAccountNumber, bank_ifsc: newIfsc }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to request bank detail update');
  }
}

// ---------------------------------------------------------------------
// Admin (Admin > Vendors tab)
// ---------------------------------------------------------------------

export interface AdminVendorRow extends VendorProfile {}

export async function fetchAdminVendors(): Promise<AdminVendorRow[]> {
  const res = await fetch('/api/admin/vendors');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load vendors');
  }
  const body = await res.json();
  return body.vendors as AdminVendorRow[];
}

export async function updateAdminVendorStatus(
  id: string,
  status: 'approved' | 'rejected' | 'suspended' | 'pending',
  admin_note?: string
): Promise<void> {
  const res = await fetch('/api/admin/vendors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, admin_note }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update vendor');
  }
}

/** Approve or reject a vendor's pending bank-detail change request. */
export async function reviewAdminVendorBankUpdate(id: string, action: 'approve' | 'reject'): Promise<void> {
  const res = await fetch('/api/admin/vendors/bank-update', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to review bank update request');
  }
}

// ---------------------------------------------------------------------
// Phase 2 — Vendor Product Listing (vendor-facing)
// ---------------------------------------------------------------------

export type VendorProductApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'awaiting_stock'
  | 'live'
  | 'rejected';

/** Shape of a product row as returned to the VENDOR who owns it. Only
 *  fields the vendor is allowed to see about their own submission —
 *  this is a distinct, deliberately narrower shape than the admin's
 *  view, and is never used for customer-facing product data. */
export interface VendorProductRow {
  id: string;
  name: string;
  slug: string;
  images: string[];
  fabric: string | null;
  category_name: string | null;
  available_quantity: number;
  vendor_expected_price: number | null;
  ai_suggested_price: number | null;
  final_price: number | null;
  is_dead_stock: boolean;
  approval_status: VendorProductApprovalStatus;
  barcode: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface VendorProductInput {
  name: string;
  images: string[];
  fabric: string;
  category_id?: string | null;
  category_name: string;
  available_quantity: number;
  vendor_expected_price?: number | null;
  is_dead_stock: boolean;
}

/** Submits a new product for review. Server sets approval_status =
 *  'pending_review' and auto-generates the barcode — the vendor never
 *  supplies either. */
export async function submitVendorProduct(input: VendorProductInput): Promise<VendorProductRow> {
  const res = await fetch('/api/vendor/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to submit product');
  }
  const body = await res.json();
  return body.product as VendorProductRow;
}

/** All products this vendor has ever submitted, newest first. */
export async function fetchMyVendorProducts(): Promise<VendorProductRow[]> {
  const res = await fetch('/api/vendor/products');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load your products');
  }
  const body = await res.json();
  return body.products as VendorProductRow[];
}
