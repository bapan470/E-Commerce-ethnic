import { NextResponse } from 'next/server';
import { getCurrentUser, getSupabaseServer } from '@/lib/supabase-server-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { generateVendorListing } from '@/lib/vendor-ai-listing';
import { sendEmail } from '@/lib/email';
import { vendorProductLiveEmail, vendorProductEditLiveEmail } from '@/lib/email-templates';

// Allow up to 60 seconds — NVIDIA NIM free tier can be slow.
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

  // ── Update product to live ─────────────────────────────────────────────
  if (listing) {
    const { error: updateErr } = await admin
      .from('products')
      .update({
        name: listing.name,
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

    if (updateErr) {
      console.error('[vendor/ai-process] failed to update product to live (with AI)', productId, updateErr);
      // Fall back: at minimum set status to live without AI fields
      await admin.from('products').update({ approval_status: 'live' }).eq('id', productId);
    }
  } else {
    // AI unavailable or failed — publish anyway with the vendor's basic fields
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
      productName: listing?.name || product.name,
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
