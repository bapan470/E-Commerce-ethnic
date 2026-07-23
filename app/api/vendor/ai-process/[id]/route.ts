import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateVendorListing, ensureUniqueVendorTitle } from '@/lib/vendor-ai-listing';
import { buildSlug } from '@/lib/slug-utils';
import { sendEmail } from '@/lib/email';
import { vendorProductLiveEmail, vendorProductEditLiveEmail } from '@/lib/email-templates';

// Allow up to 60 seconds (Vercel Hobby's max) — this app is hosted on
// Vercel, and the NVIDIA vision-language model call this route makes
// (see lib/vendor-ai-listing.ts) routinely needs 20-55s to respond on
// the free tier. The try/catch + fallback below, and the DB-level
// stuck-listing safety net (lib/cron-jobs.ts::runStuckVendorListingsJob,
// now also run inline whenever the vendor/admin products page loads —
// see app/api/vendor/products/route.ts and
// app/api/admin/vendor-products/route.ts), make sure the product still
// gets published even if this function is ever killed mid-flight for
// any reason (cold start, network blip, etc).
export const maxDuration = 60;

/**
 * POST /api/vendor/ai-process/[id]
 *
 * Background AI processor for a vendor-submitted product.
 * Called fire-and-forget (keepalive:true) from the browser after a vendor
 * publishes or edits a product — the vendor does NOT wait for this response.
 *
 * Also accepts an internal server-to-server call authenticated with the
 * x-internal-secret header (value = process.env.SESSION_SECRET). This
 * bypasses the user-session auth, enabling the server-side POST/PATCH
 * product routes to trigger AI directly without depending on the browser.
 *
 * Steps:
 *  1. Verify the caller (user session OR internal secret).
 *  2. Verify the vendor owns the product.
 *  3. Call NVIDIA NIM to generate full listing fields from vendor's basics.
 *  4. Update the product row with AI-generated fields + approval_status='live'.
 *  5. Email the vendor.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const isEdit = searchParams.get('edit') === 'true';
  const productId = params.id;

  const admin = getSupabaseAdmin();

  try {
    return await handleAiProcess({ req, admin, productId, isEdit });
  } catch (err) {
    // Last-resort fallback: if ANYTHING above threw unexpectedly (auth,
    // DB, AI call, whatever) the product must not stay stuck in
    // pending_review forever. Force-publish it with whatever basic
    // fields it already has, then report the failure.
    console.error('[vendor/ai-process] unhandled error, force-publishing product', productId, err);
    try {
      await admin.from('products').update({ approval_status: 'live' }).eq('id', productId);
    } catch (fallbackErr) {
      console.error('[vendor/ai-process] fallback force-publish also failed', productId, fallbackErr);
    }
    return NextResponse.json({ error: 'Internal error, product force-published as fallback' }, { status: 500 });
  }
}

async function handleAiProcess({
  req,
  admin,
  productId,
  isEdit,
}: {
  req: Request;
  admin: ReturnType<typeof getSupabaseAdmin>;
  productId: string;
  isEdit: boolean;
}) {
  // ── Auth: internal secret OR user session ──────────────────────────────
  const internalSecret = req.headers.get('x-internal-secret');
  const sessionSecret = process.env.SESSION_SECRET;
  const isInternalCall =
    internalSecret && sessionSecret && internalSecret === sessionSecret;

  let vendorId: string;
  let vendorEmail: string;
  let vendorDisplayName: string;

  if (isInternalCall) {
    // Server-to-server call: the product row already has vendor_id set;
    // look the vendor up directly from there (no user session needed).
    const { data: product, error: productErr } = await admin
      .from('products')
      .select('vendor_id')
      .eq('id', productId)
      .maybeSingle();

    if (productErr || !product?.vendor_id) {
      console.error('[vendor/ai-process] internal call: product not found', productId, productErr);
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { data: vendor, error: vendorErr } = await admin
      .from('vendors')
      .select('id, email, business_name, owner_name, status')
      .eq('id', product.vendor_id)
      .maybeSingle();

    if (vendorErr || !vendor) {
      console.error('[vendor/ai-process] internal call: vendor not found', product.vendor_id);
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    vendorId = vendor.id;
    vendorEmail = (vendor.email || '').trim();
    vendorDisplayName = vendor.owner_name || vendor.business_name || 'Vendor';
  } else {
    // Browser call: authenticate via user session cookie.
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = await getSupabaseServer();
    const { data: vendor, error: vendorErr } = await supabase
      .from('vendors')
      .select('id, email, business_name, owner_name, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendorErr || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 403 });
    }
    if (vendor.status !== 'approved') {
      return NextResponse.json({ error: 'Vendor not approved' }, { status: 403 });
    }

    vendorId = vendor.id;
    vendorEmail = (vendor.email || user.email || '').trim();
    vendorDisplayName = vendor.owner_name || vendor.business_name || 'Vendor';
  }

  // ── Fetch the product — must belong to this vendor ─────────────────────
  const { data: product, error: productErr } = await admin
    .from('products')
    .select('id, name, fabric, category_name, images, vendor_id, slug')
    .eq('id', productId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (productErr || !product) {
    console.error('[vendor/ai-process] product not found or wrong vendor', productId, vendorId);
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // ── Run AI generation ──────────────────────────────────────────────────
  const listing = await generateVendorListing({
    name: product.name,
    fabric: product.fabric ?? '',
    category: product.category_name ?? '',
    images: Array.isArray(product.images) ? product.images : [],
  });

  // Hoisted so the vendor-notification email below (sent regardless of
  // which branch runs) can reference the actual final title.
  let finalName: string | undefined;

  // ── Update product to live ─────────────────────────────────────────────
  if (listing) {
    // Guarantee no two products end up with an identical title text — see
    // ensureUniqueVendorTitle's own comment for why this is a DB check +
    // deterministic tweak rather than a second AI call. Only done on first
    // publish; edits keep whatever title the vendor/AI produced this time
    // (same reasoning as slug below — an edit re-running this check could
    // needlessly rename an already-live, possibly-shared product title).
    finalName = isEdit ? listing.name : await ensureUniqueVendorTitle(admin, listing, productId);

    // The vendor's original submission got a placeholder slug (derived from
    // whatever raw name they typed, e.g. "Cotton Blend") back in
    // POST /api/vendor/products, purely so the row could exist before AI
    // ran. Now that the AI has generated the real, SEO title, the slug
    // (and therefore the live product URL) should be derived from THAT
    // title instead — otherwise the URL and the on-page title never match,
    // and near-duplicate AI titles across products all end up looking the
    // same in the address bar too (only the trailing random suffix
    // differs). Only do this on first publish (`!isEdit`) — edits
    // deliberately never change the slug, to avoid breaking a URL that may
    // already be shared/indexed (see the [id]/route.ts PATCH comment).
    const nextSlug = isEdit ? product.slug : buildSlug(finalName);

    const { error: updateErr } = await admin
      .from('products')
      .update({
        name: finalName,
        slug: nextSlug,
        description: listing.description,
        fabric: listing.fabric,
        origin: listing.origin,
        occasion: listing.occasion,
        material: listing.material,
        pattern: listing.pattern,
        gender: listing.gender,
        meta_description: listing.meta_description,
        colors: Array.isArray(listing.colors) ? listing.colors : [],
        highlights: listing.highlights ?? {},
        approval_status: 'live',
      })
      .eq('id', productId);

    // Extremely unlikely slug collision (two vendors' AI titles slugifying
    // to the same base + same 5-char random suffix) — retry once with a
    // fresh suffix, same pattern as the initial-insert retry in
    // app/api/vendor/products/route.ts.
    if (updateErr?.code === '23505' && updateErr.message?.includes('slug')) {
      const { error: retryErr } = await admin
        .from('products')
        .update({
          name: finalName,
          slug: isEdit ? product.slug : buildSlug(finalName),
          description: listing.description,
          fabric: listing.fabric,
          origin: listing.origin,
          occasion: listing.occasion,
          material: listing.material,
          pattern: listing.pattern,
          gender: listing.gender,
          meta_description: listing.meta_description,
          colors: Array.isArray(listing.colors) ? listing.colors : [],
          highlights: listing.highlights ?? {},
          approval_status: 'live',
        })
        .eq('id', productId);

      if (retryErr) {
        console.error('[vendor/ai-process] failed to update product to live (with AI, after slug retry)', productId, retryErr);
        await admin.from('products').update({ approval_status: 'live' }).eq('id', productId);
      }
    } else if (updateErr) {
      console.error('[vendor/ai-process] failed to update product to live (with AI)', productId, updateErr);
      // Fall back: at minimum set status to live without AI fields
      await admin.from('products').update({ approval_status: 'live' }).eq('id', productId);
    }
  } else {
    // AI unavailable or failed — publish anyway with the vendor's basic fields
    console.error('[vendor/ai-process] generateVendorListing returned null — publishing product', productId, 'with basic fields only (name/slug/description/highlights will NOT be AI-generated). Check NVIDIA_API_KEY and the [vendor-ai-listing] logs above for the actual cause.');
    const { error: updateErr } = await admin
      .from('products')
      .update({ approval_status: 'live' })
      .eq('id', productId);

    if (updateErr) {
      console.error('[vendor/ai-process] failed to update product to live (no AI)', productId, updateErr);
      return NextResponse.json({ error: 'Failed to publish product' }, { status: 500 });
    }
  }

  // ── Send email notification to the vendor ─────────────────────────────
  if (vendorEmail) {
    const emailInput = {
      vendorName: vendorDisplayName,
      productName: finalName || product.name,
    };
    const { subject, html } = isEdit
      ? vendorProductEditLiveEmail(emailInput)
      : vendorProductLiveEmail(emailInput);
    await sendEmail({ to: vendorEmail, subject, html }).catch((err) => {
      // Non-fatal — product is already live; just log the failure
      console.error('[vendor/ai-process] email send failed for', vendorEmail, err);
    });
  }

  return NextResponse.json({ ok: true });
}
