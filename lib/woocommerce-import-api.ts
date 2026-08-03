// ---------------------------------------------------------------------
// WooCommerce customer import.
//
// Lets the admin connect to an *external* WooCommerce store's REST API
// and pull customer name / email / phone into this store's admin, so
// they can be targeted with email marketing campaigns from here.
//
// Client-side wrappers only -- the actual WooCommerce fetch + Supabase
// writes happen server-side in app/api/admin/woocommerce-import/route.ts
// (never expose the WooCommerce Consumer Secret to the browser bundle).
// ---------------------------------------------------------------------

export interface WooCommerceCredentials {
  storeUrl: string; // e.g. https://mystore.com (no trailing slash needed)
  consumerKey: string;
  consumerSecret: string;
}

export interface ImportedCustomer {
  id: string;
  wc_customer_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  imported_at: string;
}

export interface ImportResult {
  done: boolean;
  imported: number;
  ordersScanned: number;
  nextPage: number | null;
  totalScannedAllTime?: number;
  expectedTotal?: number | null;
  warning?: string | null;
}

export async function importWooCommerceCustomersChunk(
  creds: WooCommerceCredentials & { reset?: boolean }
): Promise<ImportResult> {
  const res = await fetch('/api/admin/woocommerce-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  let parseFailed = false;
  const json = await res.json().catch(() => {
    parseFailed = true;
    return {};
  });
  if (!res.ok) {
    // A non-JSON body on failure means the platform (not our route) cut the
    // request off -- almost always a function timeout -- rather than our
    // own try/catch, which always returns real JSON with an `error` field.
    if (parseFailed) {
      throw new Error(
        `Server ne time se pehle jawab nahi diya (status ${res.status}) — is se ye lagta hai ki request timeout ho gayi, ` +
          `galat credentials ka issue nahi hai. Kam pages-per-call try karo ya thodi der baad phir se try karo.`
      );
    }
    throw new Error(json.error || 'Import failed');
  }
  return json as ImportResult;
}

export async function fetchImportedCustomers(): Promise<ImportedCustomer[]> {
  const res = await fetch('/api/admin/woocommerce-import');
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to load imported customers');
  return json.customers as ImportedCustomer[];
}

export async function deleteImportedCustomer(id: string): Promise<void> {
  const res = await fetch(`/api/admin/woocommerce-import/${id}`, { method: 'DELETE' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to delete');
}

export interface SendCampaignArgs {
  customerIds: string[];
  subject: string;
  html: string;
}

export interface SendCampaignResult {
  sent: number;
  failed: number;
  skipped: number;
}

export async function sendWooCommerceCampaign(args: SendCampaignArgs): Promise<SendCampaignResult> {
  const res = await fetch('/api/admin/woocommerce-import/send-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Failed to send campaign');
  return json as SendCampaignResult;
}
