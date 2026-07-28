import { NextResponse } from 'next/server';
import { fetchPublicCollectionsServer } from '@/lib/collections-api-server';

/**
 * GET /api/collections
 *
 * Public, unauthenticated list of admin-curated collections for the
 * storefront (Shop by Collection on the homepage). Unlike
 * /api/admin/collections (which requires an admin session and returns
 * every collection, active or not, empty or not), this only returns
 * collections that are:
 *   - is_active = true
 *   - have at least one *live* product in them
 * so the homepage never shows an empty or draft collection tile.
 *
 * The actual query now lives in lib/collections-api-server.ts so the
 * homepage's server-side data fetch can call it directly, without an
 * extra internal HTTP round-trip through this route.
 */
export async function GET() {
  try {
    const collections = await fetchPublicCollectionsServer();
    return NextResponse.json({ collections });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load collections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
