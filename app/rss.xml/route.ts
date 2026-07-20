// app/rss.xml/route.ts
//
// Pinterest-compatible RSS/product feed for auto-publish + shopping (price) tags.
// Feed URL: https://www.aruhihandlooms.com/rss.xml
//
// Uses the project's existing fetchProductsServer() (lib/products-api-server.ts),
// the same helper sitemap.ts uses, so this stays in sync with your real Supabase
// "products" table automatically — no manual edits needed when products change.

import { fetchProductsServer } from "@/lib/products-api-server";

export const dynamic = "force-dynamic"; // always fetch fresh data on each request

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.aruhihandlooms.com";

function escapeXml(unsafe: string = ""): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const products = await fetchProductsServer();

  const items = products
    .map((p) => {
      const link = `${SITE_URL}/product/${p.slug}`;
      const image = p.images?.[0] || "";

      return `
    <item>
      <title>${escapeXml(p.name)}</title>
      <link>${link}</link>
      <description>${escapeXml(p.description || "")}</description>
      <guid isPermaLink="false">${p.id}</guid>
      <g:id>${p.id}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(p.description || "")}</g:description>
      <g:link>${link}</g:link>
      <g:image_link>${image}</g:image_link>
      <g:price>${p.price} INR</g:price>
      <g:availability>${p.inStock ? "in stock" : "out of stock"}</g:availability>
      <g:condition>new</g:condition>
    </item>`;
    })
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Aruhi Handlooms</title>
    <link>${SITE_URL}</link>
    <description>Latest products from Aruhi Handlooms</description>${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
