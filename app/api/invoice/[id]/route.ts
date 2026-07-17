import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase();

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: storeSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'store_info')
      .maybeSingle();

    const store = (storeSetting?.value as Record<string, string>) || {};

    const pdfBytes = await generateInvoicePdf(
      {
        id: order.id,
        created_at: order.created_at,
        items: Array.isArray(order.items) ? order.items : [],
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        shipping_address: order.shipping_address,
        subtotal: order.subtotal,
        coupon_code: order.coupon_code,
        coupon_discount: order.coupon_discount,
        shipping_charge: order.shipping_charge,
        gst_amount: order.gst_amount,
        total_amount: order.total_amount,
      },
      store
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${order.id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
