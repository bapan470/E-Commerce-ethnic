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
 * Called fire-and-forget from the browser after a vendor publishes or edits
 * a product — the vendor does NOT wait for this response.
 *
 * Steps:
 *  1. Verify the logged-in user is an approved vendor who owns this product.
 *  2. Call NVIDIA NIM to generate a full listing (name, description, fabric,
 *     origin, occasion, highlights, etc.) from the vendor's basic inputs.
 *  3. Update the product row with AI-generated fields.
 *  4. Set approval_status = 'live' so the product appears on the storefront.
 *  5. Email the vendor to let them know their product is live.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const isEdit = searchParams.get('edit') === 'true';
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();
  const productId = params.id;

  // Verify the calling user is an approved vendor
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

  // Fetch the product — must belong to this vendor
  const { data: product, error: productErr } = await admin
    .from('products')
    .select('id, name, fabric, category_name, images, vendor_id, slug')
    .eq('id', productId)
    .eq('vendor_id', vendor.id)
    .maybeSingle();

  if (productErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Run AI generation (may return null if NVIDIA_API_KEY is not set or AI fails)
  const listing = await generateVendorListing({
    name: product.name,
    fabric: product.fabric ?? '',
    category: product.category_name ?? '',
    images: Array.isArray(product.images) ? product.images : [],
  });

  if (listing) {
    // Update product with AI-generated fields; slug stays unchanged (URL preserved)
    await admin
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
  } else {
    // AI unavailable or failed — publish anyway with the vendor's basic fields
    await admin
      .from('products')
      .update({ approval_status: 'live' })
      .eq('id', productId);
  }

  // Send email notification to the vendor
  const vendorEmail = (vendor.email || user.email || '').trim();
  if (vendorEmail) {
    const emailInput = {
      vendorName: vendor.owner_name || vendor.business_name || 'Vendor',
      productName: listing?.name || product.name,
    };
    const { subject, html } = isEdit
      ? vendorProductEditLiveEmail(emailInput)
      : vendorProductLiveEmail(emailInput);
    await sendEmail({ to: vendorEmail, subject, html }).catch(() => {
      // Non-fatal — product is already live; just log the failure
      console.error('[vendor/ai-process] email send failed for', vendorEmail);
    });
  }

  return NextResponse.json({ ok: true });
}
