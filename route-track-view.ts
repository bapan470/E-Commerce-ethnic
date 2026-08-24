import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, referrer = 'direct', source = 'google-ads' } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Increment views count
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        views: supabase.rpc('increment', { x: 1 }),
        clicks: supabase.rpc('increment', { x: 1 }),
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .select();

    // Log the view
    const { error: logError } = await supabase
      .from('product_views_log')
      .insert({
        product_id: productId,
        referrer,
        source,
      });

    if (updateError) {
      console.error('Update error:', updateError);
    }

    if (logError) {
      console.error('Log error:', logError);
    }

    return NextResponse.json({
      success: true,
      message: 'View tracked successfully',
    });
  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track view' },
      { status: 500 }
    );
  }
}
