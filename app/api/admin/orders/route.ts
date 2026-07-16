import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken, ADMIN_SESSION_COOKIE } from '@/lib/admin-auth';
import { fetchOrders } from '@/lib/orders-api';

export async function GET() {
  const cookie = cookies().get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const verified = await verifyAdminToken(cookie);
  if (!verified.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const orders = await fetchOrders();
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}
