import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-fulfillment-shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_BLUR_PLACEHOLDER_SETTINGS, type BlurPlaceholderSettings } from '@/lib/blur-placeholder-flag';

// ---------------------------------------------------------------------
// GET  /api/admin/blur-placeholder  -> current { enabled }
// POST /api/admin/blur-placeholder  -> { enabled: boolean } saves it
//
// ON (default) = product gallery photos show a soft animated shimmer
// while loading, instead of a blank/white box. This is a generic
// placeholder (not a preview of the actual photo), so — unlike
// Responsive Images — it needs no backfill and applies to every image,
// old or new, immediately.
// OFF = no placeholder shown, exactly like before this feature existed.
// ---------------------------------------------------------------------

const SETTINGS_KEY = 'blur_placeholder';

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  const value = { ...DEFAULT_BLUR_PLACEHOLDER_SETTINGS, ...((data?.value as Partial<BlurPlaceholderSettings>) || {}) };
  return NextResponse.json(value);
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: '"enabled" must be a boolean' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('settings')
    .upsert({ key: SETTINGS_KEY, value: { enabled: body.enabled } }, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, enabled: body.enabled });
}
