// app/rss.xml/route.ts
//
// Pinterest-compatible RSS/product feed for auto-publish + shopping (price) tags.
// After deploying, your feed URL will be:
//   https://e-commerce-ethnic.vercel.app/rss.xml
//
// ⚠️ IMPORTANT: Replace the `getProducts()` function below with however
// YOUR project actually fetches products (Supabase query, API call, etc).
// This file only assumes each product has: id, name/title, slug, description,
// price, currency, image, and stock status. Rename fields to match your schema.

export const dynamic = "force-dynamic"; // always fetch fresh data (remove if you prefer caching)

// --- Product type — adjust fields to match your actual data ---
interface Product {
  id: string | number;
  name: string;
  slug: string;
  description?: string;
  price: number;          // e.g. 1499
  currency?: string;      // e.g. "INR"
  imageUrl: string;
  inStock?: boolean;
}

// --- Replace this with your real data source ---
// Example using Supabase (uncomment and adjust if you use supabase-js):
//
// import { createClient } from "@supabase/supabase-js";
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// );
//
// async function getProducts(): Promise<Product[]> {
//   const { data, error } = await supabase.from("products").select("*");
//   if (error) throw error;
//   return data as Product[];
// }

// TEMP placeholder — swap this out for your real fetch logic
async function getProducts(): Promise<Product[]> {
  return [
    {
      id: 1,
      name: "Sample Ethnic Kurta",
      slug: "sample-ethnic-kurta",
      description: "Handloom cotton kurta with traditional print.",
      price: 1499,
      currency: "INR",
      imageUrl: "https://e-commerce-ethnic.vercel.app/images/sample.jpg",
      inStock: true,
    },
  ];
}

function escapeXml(unsafe: string = ""): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const siteUrl = "https://e-commerce-ethnic.vercel.app";
  const products = await getProducts();

  const items = products
    .map((p) => {
      const link = `${siteUrl}/products/${p.slug}`;
      const currency = p.currency || "INR";

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
      <g:image_link>${p.imageUrl}</g:image_link>
      <g:price>${p.price} ${currency}</g:price>
      <g:availability>${p.inStock ? "in stock" : "out of stock"}</g:availability>
      <g:condition>new</g:condition>
    </item>`;
    })
    .join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Aruhi Handlooms</title>
    <link>${siteUrl}</link>
    <description>Latest products from Aruhi Handlooms</description>${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
