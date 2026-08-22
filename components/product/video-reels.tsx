'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Heart, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { hasLikedReel, toggleLikedReel } from '@/lib/video-reels-likes';
import { guessVideoMime } from '@/lib/video-mime';

export type ReelItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  mrp?: number | null;
  image: string | null;
  videoUrl: string;
  likeCount: number;
  shareCount: number;
};

/**
 * Full-screen, swipe-through video shopping feed — every product on the
 * site that has a video, one per screen, Reels/Shorts-style. Opened from
 * a product page's "Watch Video" trigger, starting on that product's own
 * video; swiping up/down moves through every other videoed product.
 * Closing (X) always returns to the exact product page the shopper was
 * on when they opened it — not necessarily the currently-showing reel —
 * so a shopper who swiped through five other products and closes still
 * lands back where they started.
 */
export default function VideoReels({
  items,
  startProductId,
  returnSlug,
  onClose,
}: {
  items: ReelItem[];
  startProductId: string;
  returnSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const startIndex = Math.max(
    0,
    items.findIndex((i) => i.id === startProductId)
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [muted, setMuted] = useState(true);

  // Lock body scroll while the overlay is open, restore on close, and let
  // Escape close it the same as the X button (desktop convenience).
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Jump straight to the product's own video on open — no scroll animation,
  // so it doesn't look like the shopper accidentally swiped.
  useEffect(() => {
    const el = slideRefs.current[startIndex];
    if (el) el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which slide is on-screen via scroll position, so only the
  // visible video plays — every other <video> stays paused, keeping
  // bandwidth/decode cost limited to exactly one active video at a time.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 }
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const activeItem = items[activeIndex];

  const goToProduct = useCallback(
    (slug: string) => {
      onClose();
      router.push(`/product/${slug}`);
    },
    [onClose, router]
  );

  const handleClose = useCallback(() => {
    onClose();
    router.push(`/product/${returnSlug}`);
  }, [onClose, returnSlug, router]);

  if (items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true" aria-label="Product video feed">
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close video feed"
        className="absolute right-3 top-3 z-20 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-5 sm:top-5"
      >
        <X className="h-6 w-6" />
      </button>

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, idx) => (
          <ReelSlide
            key={item.id}
            item={item}
            isActive={idx === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onShopNow={() => goToProduct(item.slug)}
            ref={(el) => {
              slideRefs.current[idx] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ReelSlide({
  item,
  isActive,
  muted,
  onToggleMute,
  onShopNow,
  ref,
}: {
  item: ReelItem;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onShopNow: () => void;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [shareCount, setShareCount] = useState(item.shareCount);

  useEffect(() => {
    setLiked(hasLikedReel(item.id));
  }, [item.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      // Belt-and-suspenders: some mobile browsers don't start fetching a
      // <source> child until load() is explicitly called, especially
      // when preload was previously 'none' on the inactive slide.
      video.currentTime = 0;
      video.load();
      video.play().catch(() => {
        // Autoplay with sound can be blocked — the muted-by-default state
        // handles that; nothing else to do if even muted autoplay fails.
      });
    } else {
      video.pause();
    }
  }, [isActive]);

  const handleLike = async () => {
    const next = toggleLikedReel(item.id);
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await fetch(`/api/products/${item.id}/video-like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: next }),
      });
    } catch {
      // Best-effort — the local heart state already updated, and a failed
      // network call here isn't worth surfacing an error over a like tap.
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/product/${item.slug}` : '';
    setShareCount((c) => c + 1);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // User cancelled the native share sheet — not an error.
    }
    try {
      await fetch(`/api/products/${item.id}/video-share`, { method: 'POST' });
    } catch {
      // Best-effort, same reasoning as handleLike.
    }
  };

  const discountPct = useMemo(() => {
    if (!item.mrp || item.mrp <= item.price) return null;
    return Math.round(((item.mrp - item.price) / item.mrp) * 100);
  }, [item.mrp, item.price]);

  return (
    <div ref={ref} className="relative flex h-full w-full snap-start snap-always items-center justify-center">
      <video
        ref={videoRef}
        muted={muted}
        loop
        playsInline
        // eslint-disable-next-line react/no-unknown-property
        webkit-playsinline="true"
        preload={isActive ? 'auto' : 'none'}
        className="h-full w-full object-contain sm:object-cover"
        aria-label={`${item.name} — product video`}
        onClick={onToggleMute}
      >
        {/* Explicit type= tag: on mobile Safari/Chrome, if the upstream
            Content-Type header is ever wrong/missing, the browser falls
            back to this instead of silently refusing to play. Guessed
            from the file extension in the URL. */}
        <source src={item.videoUrl} type={guessVideoMime(item.videoUrl)} />
      </video>

      {/* Bottom gradient keeps the product card and icons legible over any video */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Right-side action rail */}
      <div className="absolute bottom-28 right-3 z-10 flex flex-col items-center gap-5 sm:right-5">
        <button
          type="button"
          onClick={handleLike}
          aria-label={liked ? 'Unlike this video' : 'Like this video'}
          aria-pressed={liked}
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Heart className={`h-6 w-6 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </span>
          <span className="text-xs font-medium drop-shadow">{likeCount}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          aria-label="Share this video"
          className="flex flex-col items-center gap-1 text-white"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <Share2 className="h-6 w-6" />
          </span>
          <span className="text-xs font-medium drop-shadow">{shareCount}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Bottom-left product card */}
      <div className="absolute inset-x-3 bottom-4 z-10 sm:inset-x-5">
        <div className="flex items-center gap-3 rounded-2xl bg-black/50 p-2.5 pr-3 backdrop-blur-md">
          {item.image && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image src={item.image} alt={item.name} fill sizes="48px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{item.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-white/90">
              ₹{item.price.toLocaleString('en-IN')}
              {discountPct !== null && <span className="text-xs text-white/60 line-through">₹{item.mrp!.toLocaleString('en-IN')}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onShopNow}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Shop Now
          </button>
        </div>
      </div>
    </div>
  );
}
