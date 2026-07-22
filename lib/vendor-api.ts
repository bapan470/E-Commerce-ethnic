// ---------------------------------------------------------------------
// Vendor sourcing (internal — never shown to customers). Phase 1:
// application, admin approve/reject, and the secure bank-detail-change
// request flow.
// ---------------------------------------------------------------------

import { getSupabaseBrowser } from './supabase-browser';

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

// ---------------------------------------------------------------------
// Phase 2, Part 5 — Admin "Vendor Submissions" (Admin > Products tab)
// ---------------------------------------------------------------------

/** Full admin-side shape of a vendor-sourced product row — includes the
 *  vendor's own business name (joined server-side) plus every field the
 *  admin is allowed to see/edit. Never reused for customer-facing data. */
export interface AdminVendorProductRow {
  id: string;
  name: string;
  slug: string;
  images: string[];
  fabric: string | null;
  category_name: string | null;
  available_quantity: number;
  quantity_last_updated_at: string;
  vendor_expected_price: number | null;
  ai_suggested_price: number | null;
  final_price: number | null;
  price: number;
  is_dead_stock: boolean;
  approval_status: VendorProductApprovalStatus;
  barcode: string | null;
  rejection_reason: string | null;
  vendor_id: string;
  created_at: string;
  vendors: { business_name: string; email: string | null; whatsapp: string | null; phone: string } | null;
}

/** All vendor-sourced products, optionally filtered by approval_status. */
export async function fetchAdminVendorProducts(
  status?: VendorProductApprovalStatus
): Promise<AdminVendorProductRow[]> {
  const url = status ? `/api/admin/vendor-products?status=${status}` : '/api/admin/vendor-products';
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load vendor submissions');
  }
  const body = await res.json();
  return body.products as AdminVendorProductRow[];
}

/** Edits/confirms the final price without changing approval_status. */
export async function updateAdminVendorProductPrice(
  id: string,
  final_price: number
): Promise<AdminVendorProductRow> {
  const res = await fetch('/api/admin/vendor-products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'update_price', final_price }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update price');
  }
  const body = await res.json();
  return body.product as AdminVendorProductRow;
}

/** Approves a submission -> approval_status = 'awaiting_stock'. Pass
 *  final_price to save any last edit and approve in the same call. */
export async function approveAdminVendorProduct(
  id: string,
  final_price?: number
): Promise<AdminVendorProductRow> {
  const res = await fetch('/api/admin/vendor-products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'approve', final_price }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to approve product');
  }
  const body = await res.json();
  return body.product as AdminVendorProductRow;
}

/** Rejects a submission. reason is mandatory. */
export async function rejectAdminVendorProduct(
  id: string,
  rejection_reason: string
): Promise<AdminVendorProductRow> {
  const res = await fetch('/api/admin/vendor-products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'reject', rejection_reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to reject product');
  }
  const body = await res.json();
  return body.product as AdminVendorProductRow;
}

// ---------------------------------------------------------------------
// Phase 3B — Vendor "My Orders" dashboard (vendor-facing)
//
// NOTE ON CUSTOMER-DATA MASKING: every field below comes from
// `order_items` only — no customer name/phone/address column exists on
// this table at all, and the /api/vendor/orders route explicitly lists
// which columns it selects (never `select('*')`) and filters by this
// vendor's own vendor_id server-side, on top of whatever RLS is in
// place. See that route's comments for the full reasoning.
// ---------------------------------------------------------------------

export type VendorOrderItemStage =
  | 'placed'
  | 'vendor_accepted'
  | 'picked_from_vendor'
  | 'received_at_warehouse'
  | 'packed'
  | 'shipped_to_customer'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'quality_hold';

export interface VendorOrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  product_image: string | null;
  barcode: string | null;
  quantity: number;
  price: number;
  stage: VendorOrderItemStage;
  vendor_accept_deadline: string | null;
  vendor_accepted_at: string | null;
  pickup_requested_at: string | null;
  pickup_photo_url: string | null;
  created_at: string;
}

/** Every order item ever placed against this vendor's products — never
 *  includes the customer's name, phone, or address. */
export async function fetchMyVendorOrders(): Promise<VendorOrderItemRow[]> {
  const res = await fetch('/api/vendor/orders');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load your orders');
  }
  const body = await res.json();
  return body.orders as VendorOrderItemRow[];
}

/** Vendor accepts an order item -> stage 'vendor_accepted'. */
export async function acceptVendorOrderItem(orderItemId: string): Promise<VendorOrderItemRow> {
  return vendorOrderAction(orderItemId, { action: 'accept' });
}

/** Vendor rejects an order item -> stage 'cancelled', stock restocked, customer notified. */
export async function rejectVendorOrderItem(orderItemId: string): Promise<VendorOrderItemRow> {
  return vendorOrderAction(orderItemId, { action: 'reject' });
}

/** Vendor requests pickup — only creates an admin-visible task, no live courier call yet. */
export async function requestVendorPickup(orderItemId: string): Promise<VendorOrderItemRow> {
  return vendorOrderAction(orderItemId, { action: 'request_pickup' });
}

/** Vendor marks the item handed off to courier + attaches the handoff photo -> stage 'picked_from_vendor'. */
export async function markVendorPickedUp(
  orderItemId: string,
  pickup_photo_url: string
): Promise<VendorOrderItemRow> {
  return vendorOrderAction(orderItemId, { action: 'mark_picked_up', pickup_photo_url });
}

async function vendorOrderAction(
  orderItemId: string,
  payload: Record<string, unknown>
): Promise<VendorOrderItemRow> {
  const res = await fetch(`/api/vendor/orders/${orderItemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update order');
  }
  const body = await res.json();
  return body.order as VendorOrderItemRow;
}

/** Uploads the pickup-handoff photo to the public `order-fulfillment-photos`
 *  bucket (same simple pattern as uploadReviewPhoto/uploadProductImage) and
 *  returns its public URL. Does NOT save it against the order item — call
 *  markVendorPickedUp() with the returned URL to do that. */
export async function uploadPickupProofPhoto(file: File): Promise<string> {
  const supabase = getSupabaseBrowser();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage
    .from('order-fulfillment-photos')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('order-fulfillment-photos').getPublicUrl(path);
  return data.publicUrl;
}
