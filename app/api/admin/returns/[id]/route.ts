import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail } from '@/lib/email';
import { returnStatusEmail } from '@/lib/email-templates';
import { getReturnAutomationMode, schedulePickupForReturn, processRefundForReturn } from '@/lib/return-automation';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, admin_notes, refund_amount } = body || {};

  if (!status && admin_notes === undefined && refund_amount === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const validStatuses = ['requested', 'approved', 'rejected', 'refunded', 'completed'];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    const updatePayload: Record<string, any> = {};
    if (status) updatePayload.status = status;
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
    if (refund_amount !== undefined) updatePayload.refund_amount = refund_amount;
    if (status && ['refunded', 'completed', 'rejected'].includes(status)) {
      updatePayload.resolved_at = new Date().toISOString();
    }

    let { data: updated, error } = await supabase
      .from('returns')
      .update(updatePayload)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) throw error;

    // Fetch full order context once — used for the status email below
    // and for any automation (pickup/refund) this status change kicks off.
    const { data: order } = await supabase
      .from('orders')
      .select(
        'id, customer_name, customer_email, customer_phone, shipping_address, items, total_amount, payment_method, razorpay_payment_id'
      )
      .eq('id', updated.order_id)
      .single();

    // Approving a return -> auto-schedule the Delhivery reverse pickup
    // when automation is on. Manual mode leaves it for the admin to
    // trigger via the "Schedule Pickup" button in the panel.
    if (status === 'approved' && order) {
      const mode = await getReturnAutomationMode(supabase);
      if (mode === 'automatic') {
        await schedulePickupForReturn(supabase, updated, order);
        const { data: refreshed } = await supabase
          .from('returns')
          .select('*')
          .eq('id', params.id)
          .single();
        if (refreshed) updated = refreshed;
      }
    }

    // Admin explicitly marking a return 'refunded' — this is always an
    // intentional manual trigger (regardless of the automation toggle,
    // same spirit as the self-cancellation flow), so fire the real
    // Razorpay refund now unless it's already been done.
    if (status === 'refunded' && order && updated.refund_status !== 'refunded') {
      await processRefundForReturn(supabase, updated, order);
      const { data: refreshed } = await supabase
        .from('returns')
        .select('*')
        .eq('id', params.id)
        .single();
      if (refreshed) updated = refreshed;
    }

    // Notify the customer whenever the status actually changed. (The
    // automation helpers above already send their own dedicated pickup/
    // refund emails, so this general one mainly covers approved-without-
    // pickup / rejected / manual admin-note updates.)
    if (status && updated && order?.customer_email) {
      const { subject, html } = returnStatusEmail({
        id: updated.id,
        order_id: updated.order_id,
        type: updated.type,
        status: updated.status,
        admin_notes: updated.admin_notes,
        refund_amount: updated.refund_amount,
      });
      sendEmail({ to: order.customer_email, subject, html }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update return request' }, { status: 500 });
  }
}
