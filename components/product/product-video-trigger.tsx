'use client';

import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import VideoReels, { type ReelItem } from './video-reels';

/**
 * Replaces the old single-video modal (components/product/product-video.tsx)
 * with a trigger that opens the full Reels-style swipeable feed instead,
 * starting on this product's own video. Kept as its own component (same
 * reasoning as the old ProductVideo) so it can't affect the photo gallery.
 */
export default function ProductVideoTrigger({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReelItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (items) return; // already fetched this page-view
    setLoading(true);
    try {
      const res = await fetch('/api/products/video-feed');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <PlayCircle className="h-5 w-5" />
        Watch Product Video
      </button>

      {open && items && items.length > 0 && (
        <VideoReels
          items={items}
          startProductId={productId}
          returnSlug={productSlug}
          onClose={() => setOpen(false)}
        />
      )}

      {open && !loading && items && items.length === 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 text-center text-white"
          onClick={() => setOpen(false)}
        >
          <p>Couldn&apos;t load videos right now — tap anywhere to close.</p>
        </div>
      )}
    </>
  );
}
