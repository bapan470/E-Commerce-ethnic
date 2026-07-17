import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email';
import { returnStatusEmail } from '@/lib/email-templates';

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

  const supabase = getServerSupabase();

  try {
    const updatePayload: Record<string, any> = {};
    if (status) updatePayload.status = status;
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;
    if (refund_amount !== undefined) updatePayload.refund_amount = refund_amount;
    if (status && ['refunded', 'completed', 'rejected'].includes(status)) {
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from('returns')
      .update(updatePayload)
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) throw error;

    // Notify the customer whenever the status actually changed.
    if (status && updated) {
      const { data: order } = await supabase
        .from('orders')
        .select('customer_email')
        .eq('id', updated.order_id)
        .single();

      if (order?.customer_email) {
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
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update return request' }, { status: 500 });
  }
}
