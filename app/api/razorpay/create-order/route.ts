import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, internalOrderId } = body;

    if (!amount || amount < 1) {
      return NextResponse.json(
        { error: 'Amount must be a positive integer (in paise)' },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env' },
        { status: 500 }
      );
    }

    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: Math.round(amount), // amount in paise
      currency: 'INR',
      receipt: internalOrderId || `receipt_${Date.now()}`,
      notes: {
        internal_order_id: internalOrderId || '',
      },
    };

    const order = await rzp.orders.create(options);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      },
      keyId: keyId, // expose key ID to frontend for checkout.js
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create Razorpay order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
