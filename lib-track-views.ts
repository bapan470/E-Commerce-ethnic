// lib/track-views.ts
export async function trackProductView(
  productId: string,
  source: string = 'direct',
  referrer?: string
) {
  try {
    await fetch('/api/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        source,
        referrer: referrer || document.referrer,
      }),
    });
  } catch (error) {
    console.error('Failed to track view:', error);
  }
}

export async function getPopularProducts(limit = 10) {
  try {
    const response = await fetch(
      `/api/products/popular?limit=${limit}`
    );
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  } catch (error) {
    console.error('Failed to get popular products:', error);
    return [];
  }
}
