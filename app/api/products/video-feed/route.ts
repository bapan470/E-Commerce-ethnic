import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { toPublicMediaUrl } from '@/lib/media-url';

// Public, read-only feed of every product that has a video attached —
// backs the full-screen Reels-style "video shopping" overlay. Ordered
// newest-first so freshly uploaded videos surface first, same as a real
// short-video feed. No pagination: catalogs with a video on every
// product are still small enough (dozens, not thousands) that a single
// query is simpler and fast enough; revisit with a `range()` cursor if
// the video catalog grows into the hundreds.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, price, mrp, images, video_url, video_like_count, video_share_count')
    .not('video_url', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? [])
    .filter((p) => !!p.video_url)
    .map((p) => ({
      id: p.id as string,
      slug: p.slug as string,
      name: p.name as string,
      price: p.price as number,
      mrp: (p.mrp as number | null) ?? null,
      image: toPublicMediaUrl((p.images as string[] | null)?.[0] ?? null),
      videoUrl: toPublicMediaUrl(p.video_url as string),
      likeCount: (p.video_like_count as number | null) ?? 0,
      shareCount: (p.video_share_count as number | null) ?? 0,
    }));

  return NextResponse.json({ items });
}
