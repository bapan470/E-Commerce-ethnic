import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';

// The admin blog editor (components/admin/blog-panel.tsx) writes posts
// straight to Supabase from the browser -- there's no server route in the
// create/update/delete path to hang a revalidation off. app/blog/page.tsx
// and app/blog/[slug]/page.tsx have no dynamic/revalidate config, so
// Next.js serves the statically-cached version from the last deploy until
// something explicitly busts that cache. `export const revalidate = 60` on
// those pages is the safety net (self-heals within a minute either way);
// this route is what makes a save show up on the live site immediately
// instead of the admin having to wait or redeploy.
export async function POST(req: Request) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = (body?.slug as string | undefined)?.trim() || '';
  const previousSlug = (body?.previous_slug as string | undefined)?.trim() || '';

  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);
  // Editing a post can change its slug -- bust the old URL too, or it'd
  // keep serving stale cached content (or a stale 200) at the old address.
  if (previousSlug && previousSlug !== slug) revalidatePath(`/blog/${previousSlug}`);

  return NextResponse.json({ revalidated: true });
}
