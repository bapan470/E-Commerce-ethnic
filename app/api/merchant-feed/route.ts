import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { fetchProductsServer } from '@/lib/products-api-server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

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
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
