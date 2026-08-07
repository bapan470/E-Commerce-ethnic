import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Same GA4 client setup as app/api/admin/traffic/route.ts — reuses the
// existing GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_JSON env vars, nothing new
// to configure if Traffic tab already works.
function getGa4Client() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error('GA4_PROPERTY_ID environment variable is not set');

  let credentials: object | undefined;
  if (process.env.GA4_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GA4_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('GA4_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }

  const client = new BetaAnalyticsDataClient(credentials ? { credentials } : {});
  return { client, propertyId };
}

// Strips a GA4 pagePath like "/blog/handloom-tant-jamdani..." down to just
// the slug, so it can be matched against blog_posts.slug from Supabase.
function slugFromPath(path: string): string {
  return path.replace(/^\/blog\//, '').replace(/\/$/, '').split('?')[0];
}

export interface BlogPostPerformance {
  slug: string;
  views: number;
  users: number;
  clicks: number; // clicks on the in-post CTA / product cards (blog_cta_click event)
  conversions: number; // purchases where this post's URL was the session's landing page
  revenue: number;
}

export async function GET(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 30);
  const startDate = `${days}daysAgo`;

  try {
    const { client, propertyId } = getGa4Client();
    const property = `properties/${propertyId}`;

    const [viewsRes, clicksRes, convRes] = await Promise.all([
      // Page views per blog post
      client.runReport({
        property,
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
        dimensionFilter: {
          filter: { fieldName: 'pagePath', stringFilter: { value: '/blog/', matchType: 'BEGINS_WITH' } },
        },
        limit: 1000,
      }),

      // Clicks on the CTA / product cards inside each post. Requires the
      // `blog_cta_click` custom event (see components/blog/blog-cta-button.tsx
      // and the patched blog-product-card.tsx) to actually be firing —
      // until that ships, this report will just come back empty (0s), not
      // an error, so the rest of the dashboard still works.
      client.runReport({
        property,
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: 'eventName', stringFilter: { value: 'blog_cta_click', matchType: 'EXACT' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { value: '/blog/', matchType: 'BEGINS_WITH' } } },
            ],
          },
        },
        limit: 1000,
      }),

      // Conversions/revenue attributed to sessions that *entered* the site
      // on a given blog post (landing page). This is session-level
      // attribution — GA4's standard way of tying a purchase back to the
      // page that first brought the visitor in.
      client.runReport({
        property,
        dateRanges: [{ startDate, endDate: 'today' }],
        dimensions: [{ name: 'landingPage' }],
        metrics: [{ name: 'conversions' }, { name: 'totalRevenue' }],
        dimensionFilter: {
          filter: { fieldName: 'landingPage', stringFilter: { value: '/blog/', matchType: 'BEGINS_WITH' } },
        },
        limit: 1000,
      }),
    ]);

    const bySlug = new Map<string, BlogPostPerformance>();
    const ensure = (slug: string): BlogPostPerformance => {
      let row = bySlug.get(slug);
      if (!row) {
        row = { slug, views: 0, users: 0, clicks: 0, conversions: 0, revenue: 0 };
        bySlug.set(slug, row);
      }
      return row;
    };

    for (const r of viewsRes[0]?.rows ?? []) {
      const slug = slugFromPath(r.dimensionValues?.[0]?.value ?? '');
      if (!slug) continue;
      const row = ensure(slug);
      row.views += Number(r.metricValues?.[0]?.value ?? 0);
      row.users += Number(r.metricValues?.[1]?.value ?? 0);
    }

    for (const r of clicksRes[0]?.rows ?? []) {
      const slug = slugFromPath(r.dimensionValues?.[0]?.value ?? '');
      if (!slug) continue;
      ensure(slug).clicks += Number(r.metricValues?.[0]?.value ?? 0);
    }

    for (const r of convRes[0]?.rows ?? []) {
      const slug = slugFromPath(r.dimensionValues?.[0]?.value ?? '');
      if (!slug) continue;
      const row = ensure(slug);
      row.conversions += Number(r.metricValues?.[0]?.value ?? 0);
      row.revenue += Number(r.metricValues?.[1]?.value ?? 0);
    }

    return NextResponse.json({ days, posts: Array.from(bySlug.values()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load blog performance data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
