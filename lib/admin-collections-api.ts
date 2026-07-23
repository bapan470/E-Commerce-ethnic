import { AdminCollectionRow } from './types';

/** One vendor's automatic "<Vendor>'s Collection" page -- read-only here;
 *  managed by approving/suspending the vendor on Admin > Vendors instead. */
export interface AdminVendorCollectionRow {
  id: string;
  name: string;
  slug: string;
  product_count: number;
  created_at: string;
}

/** Every approved vendor's auto-generated storefront collection, with a
 *  live product count each. */
export async function fetchAdminVendorCollections(): Promise<AdminVendorCollectionRow[]> {
  const res = await fetch('/api/admin/vendor-collections', { cache: 'no-store' });
  if (!res.ok) return parseError(res, 'Failed to load vendor collections');
  const body = await res.json();
  return body.collections as AdminVendorCollectionRow[];
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw new Error(body?.error || fallback);
}

/** Every admin-managed collection, with a live product count each. */
export async function fetchAdminCollections(): Promise<AdminCollectionRow[]> {
  const res = await fetch('/api/admin/collections', { cache: 'no-store' });
  if (!res.ok) return parseError(res, 'Failed to load collections');
  const body = await res.json();
  return body.collections as AdminCollectionRow[];
}

/** One collection plus the ids of the products currently in it. */
export async function fetchAdminCollection(
  id: string
): Promise<{ collection: AdminCollectionRow; product_ids: string[] }> {
  const res = await fetch(`/api/admin/collections/${id}`, { cache: 'no-store' });
  if (!res.ok) return parseError(res, 'Failed to load collection');
  return res.json();
}

export async function createAdminCollection(input: {
  name: string;
  slug?: string;
  description?: string | null;
  is_active?: boolean;
  product_ids?: string[];
}): Promise<AdminCollectionRow> {
  const res = await fetch('/api/admin/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseError(res, 'Failed to create collection');
  const body = await res.json();
  return body.collection as AdminCollectionRow;
}

export async function updateAdminCollection(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string | null;
    is_active: boolean;
    product_ids: string[];
  }>
): Promise<AdminCollectionRow> {
  const res = await fetch(`/api/admin/collections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return parseError(res, 'Failed to update collection');
  const body = await res.json();
  return body.collection as AdminCollectionRow;
}

export async function deleteAdminCollection(id: string): Promise<void> {
  const res = await fetch(`/api/admin/collections/${id}`, { method: 'DELETE' });
  if (!res.ok) return parseError(res, 'Failed to delete collection');
}
