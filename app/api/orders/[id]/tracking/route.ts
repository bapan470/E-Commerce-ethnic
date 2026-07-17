import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { trackDelhiveryShipment } from '@/lib/delhivery-api';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = getServerSupabase();

  const { data: order, error } = await supabase
    .from('orders')
    .select('tracking_number, courier_name, status')
    .eq('id', params.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (!order.tracking_number) {
    return NextResponse.json({ tracked: false, status: order.status, scans: [] });
  }

  try {
    const result = await trackDelhiveryShipment(order.tracking_number);
    return NextResponse.json({ ...result, orderStatus: order.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch tracking info';
    return NextResponse.json({ tracked: false, scans: [], error: message }, { status: 500 });
  }
}
