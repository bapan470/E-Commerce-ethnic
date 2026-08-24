import { useCallback } from 'react';
import { trackProductView } from '@/lib/track-views';

export function useProductTracking() {
  const trackView = useCallback(
    async (productId: string, source = 'direct') => {
      // Track immediately
      await trackProductView(productId, source);
    },
    []
  );

  const handleProductClick = useCallback(
    async (productId: string, callback?: () => void) => {
      // Track the click
      await trackView(productId, 'click');

      // Execute callback if provided (e.g., navigate to product)
      if (callback) {
        callback();
      }
    },
    [trackView]
  );

  return {
    trackView,
    handleProductClick,
  };
}
