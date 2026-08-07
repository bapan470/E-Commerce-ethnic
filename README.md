# Blog Performance Dashboard — setup instructions

## Naye files (seedha copy karo)
- `app/api/admin/blog-performance/route.ts` — GA4 se per-post views/clicks/conversions/revenue nikalta hai
- `lib/blog-performance-api.ts` — client-side fetch helper
- `components/blog/blog-cta-button.tsx` — naya client component (click-tracked CTA)
- `components/blog/blog-product-card.tsx` — REPLACE karo (ab 'use client' hai, click tracking ke saath)

Yeh sab existing `GA4_PROPERTY_ID` / `GA4_SERVICE_ACCOUNT_JSON` env vars hi
use karte hain (jo Traffic tab already use kar raha hai) — koi naya
GA4 setup nahi chahiye.

---

## Patch 1: `app/blog/[slug]/page.tsx`

Top mein import add karo:
```tsx
import BlogCtaButton from '@/components/blog/blog-cta-button';
```

**Product card render karte waqt** (jahan `<BlogProductCard key={i} product={product} />`
hai), `blogSlug` prop add karo:
```tsx
return product ? <BlogProductCard key={i} product={product} blogSlug={post.slug} /> : null;
```

**Bottom CTA block** (`{relatedCategorySlug && (...)}`) ko poora replace karo:
```tsx
{relatedCategorySlug && (
  <BlogCtaButton
    categorySlug={relatedCategorySlug}
    categoryName={post.related_category_name!}
    blogSlug={post.slug}
  />
)}
```

---

## Patch 2: `components/admin/blog-panel.tsx`

Top mein imports add karo:
```tsx
import { useState, useEffect } from 'react'; // already imported — just add fetchBlogPerformance below
import { fetchBlogPerformance, BlogPostPerformance } from '@/lib/blog-performance-api';
```

Component ke andar, existing `useState` declarations ke paas naya state add karo:
```tsx
const [perf, setPerf] = useState<Map<string, BlogPostPerformance>>(new Map());
const [perfLoading, setPerfLoading] = useState(true);

useEffect(() => {
  fetchBlogPerformance(30)
    .then((data) => {
      const map = new Map(data.posts.map((p) => [p.slug, p]));
      setPerf(map);
    })
    .catch(() => {})
    .finally(() => setPerfLoading(false));
}, []);
```

Table header mein 2 column add karo (Status ke baad):
```tsx
<th className="px-4 py-3">Status</th>
<th className="px-4 py-3">Views (30d)</th>
<th className="px-4 py-3">Clicks</th>
<th className="px-4 py-3">Conversions</th>
<th className="px-4 py-3">Published</th>
```

Table row mein (Status `<td>` ke baad, Published `<td>` se pehle) yeh add karo:
```tsx
<td className="px-4 py-3 text-sm">
  {perfLoading ? '…' : (perf.get(p.slug)?.views ?? 0).toLocaleString('en-IN')}
</td>
<td className="px-4 py-3 text-sm">
  {perfLoading ? '…' : (perf.get(p.slug)?.clicks ?? 0).toLocaleString('en-IN')}
</td>
<td className="px-4 py-3 text-sm">
  {perfLoading ? '…' : (perf.get(p.slug)?.conversions ?? 0).toLocaleString('en-IN')}
</td>
```

Aur `colSpan={5}` jahan bhi hai (empty-state rows), use `colSpan={8}` karo
(kyunki 3 naye columns add ho gaye).

---

## Important notes

1. **Views/Clicks turant nahi dikhenge naye posts ke liye** — GA4 data collect
   hone mein aam taur pe 24-48 hours lagte hain. Purane posts (jo 25/7, 28/7
   ko publish hue) ke liye already data hoga.
2. **"Clicks" tabhi dikhega jab Patch 1 (CTA/product card tracking) bhi live
   ho** — sirf Patch 2 (admin table) karne se clicks 0 rahenge.
3. **"Conversions" ke liye GA4 mein 'purchase' event ko "key event" mark hona
   chahiye** — Admin > Events > Mark as key event (GA4 console mein, code mein
   nahi). Agar already ecommerce tracking chalu hai, yeh usually default hota
   hai.
4. Yeh "Views/Clicks/Conversions" hai — **true Google Search "impressions"**
   (jaise "aapka post kitni baar Google results mein dikha") is se alag hoti
   hai, woh Search Console API se aati hai, GA4 se nahi. Agar woh bhi chahiye,
   bata dena — Search Console property verify karke ek aur report add kar
   denge.
