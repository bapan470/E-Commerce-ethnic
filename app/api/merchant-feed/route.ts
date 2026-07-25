import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { fetchProductsServer } from '@/lib/products-api-server';
import { fetchFulfillmentSettings } from '@/lib/marketing-api';
import { fetchShippingSettings } from '@/lib/pincode-api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

// Without this, Next.js treats this route as static (no request params,
// no cookies/headers used) and bakes the response ONCE at build time --
// this was also *why* it originally failed to build (Next tries to
// prerender it). Forcing it dynamic means every request re-reads the
// live settings/products from Supabase, so changes made in Admin (GST &
// Shipping fee, Fulfillment Timing, product edits, etc.) show up on the
// very next fetch instead of only after the next deployment.
export const dynamic = 'force-dynamic';

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Google Merchant Center / Meta Catalog compatible RSS 2.0 product feed.
// Add this URL as a "Scheduled fetch" in Google Merchant Center:
//   https://<your-domain>/api/merchant-feed
export async function GET() {
  const supabase = getServerSupabase();
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'marketing_settings')
    .maybeSingle();

  const marketing = (settingsRow?.value as { merchant_feed_enabled?: boolean; merchant_feed_brand?: string }) || {};
  if (marketing.merchant_feed_enabled === false) {
    return new NextResponse('Merchant feed is disabled in Admin > Marketing.', { status: 404 });
  }

  const brand = marketing.merchant_feed_brand || 'Aruhi Handlooms';
  const products = await fetchProductsServer();

  // Same numbers as Admin > Marketing > Shipping & Returns Timing / GST &
  // Shipping — declaring them here too means the feed can never say
  // something different from what the site itself tells a shopper, which
  // is exactly what Google Merchant Center checks for when it flags
  // shipping/returns misrepresentation.
  const [fulfillment, shipping] = await Promise.all([fetchFulfillmentSettings(), fetchShippingSettings()]);
  const shippingBlock = `
      <g:shipping>
        <g:country>IN</g:country>
        <g:service>Standard</g:service>
        <g:price>${shipping.flat_rate.toFixed(2)} INR</g:price>
      </g:shipping>
      <g:min_handling_time>${fulfillment.dispatch_days_min}</g:min_handling_time>
      <g:max_handling_time>${fulfillment.dispatch_days_max}</g:max_handling_time>
      <g:min_transit_time>${fulfillment.delivery_metro_min}</g:min_transit_time>
      <g:max_transit_time>${fulfillment.delivery_remote_max}</g:max_transit_time>`;

  const items = products
    .map((p) => {
      const link = `${SITE_URL}/product/${p.slug}`;
      const image = p.images?.[0] || '';
      const extraImages = (p.images || [])
        .slice(1, 11)
        .map((img) => `<g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`)
        .join('');
      const availability = p.inStock && p.stock_quantity > 0 ? 'in stock' : 'out of stock';
      const price = `${p.price.toFixed(2)} INR`;
      const salePrice = p.mrp && p.mrp > p.price ? `<g:sale_price>${price}</g:sale_price>` : '';
      const listedPrice = p.mrp && p.mrp > p.price ? `${p.mrp.toFixed(2)} INR` : price;

      // Required for every Apparel & Accessories product on both free
      // listings and Shopping ads — Google disapproves items missing these.
      const color = (p.colors || []).slice(0, 3).join('/') || 'Multicolor';
      const size = (p.sizes || [])[0] || 'Free Size';
      const gender = p.gender || 'female';
      const ageGroup = p.age_group || 'adult';
      const material = p.material ? `<g:material>${escapeXml(p.material)}</g:material>` : '';
      const pattern = p.pattern ? `<g:pattern>${escapeXml(p.pattern)}</g:pattern>` : '';

      return `
    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${escapeXml((p.description || p.name).slice(0, 5000))}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      ${extraImages}
      <g:availability>${availability}</g:availability>
      <g:price>${listedPrice}</g:price>
      ${salePrice}
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:condition>new</g:condition>
      <g:product_type>${escapeXml(p.category)}</g:product_type>
      <g:google_product_category>Apparel &amp; Accessories &gt; Clothing</g:google_product_category>
      <g:identifier_exists>false</g:identifier_exists>
      <g:color>${escapeXml(color)}</g:color>
      <g:size>${escapeXml(size)}</g:size>
      <g:gender>${escapeXml(gender)}</g:gender>
      <g:age_group>${escapeXml(ageGroup)}</g:age_group>
      ${material}
      ${pattern}
      ${shippingBlock}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brand)} Product Feed</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Product feed for Google Merchant Center / Meta Catalog</description>${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    },
  });
}
