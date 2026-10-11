import type { Metadata } from 'next';
import { buildProductMetadata, ProductPageBody } from './product-page-body';

// ISR: cached page, regenerated at most every 30 min on a visit. Admin
// edits/deletes purge instantly via revalidatePath (app/api/admin/products/
// [id]/route.ts); live stock/size data is refreshed client-side. 30 min
// matches the root layout's revalidate -- Next uses the LOWEST value across
// layout + page, so a smaller number here would only add Vercel ISR writes
// (Hobby plan: 200k/month).
// NOTE: do NOT read `searchParams` in this file -- it turns the page dynamic.
export const revalidate = 1800;

type Params = { params: { slug: string } };

// Empty on purpose: pre-renders nothing at build time, but tells Next.js this
// route is cacheable. Each product page is then rendered on its first visit
// and served from the ISR cache afterwards. WITHOUT this export, a dynamic
// [slug] route is treated as fully dynamic (one function run per view) even
// with `revalidate` set.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return buildProductMetadata(params.slug);
}

export default async function ProductPage({ params }: Params) {
  return ProductPageBody({ slug: params.slug });
}
