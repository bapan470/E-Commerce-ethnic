'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Heart, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { hasLikedReel, toggleLikedReel } from '@/lib/video-reels-likes';
import { guessVideoMime } from '@/lib/video-mime';
import { fetchVariantsForProduct, ProductVariant } from '@/lib/variants-api';

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
  /** The base product's own id — always present, even when `id` above is a
   *  colour variant's own id. Used to look up every colour this product
   *  comes in (VariantSwatches uses the same field) so the reel can show
   *  a colour-picker strip under each video, same as the product page. */
  productId: string;
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
  baseProductId,
  returnSlug,
  onClose,
}: {
  items: ReelItem[];
  startProductId: string;
  /** The BASE product's own id — always the same value regardless of which
   *  colour variant is being viewed, and always present on every feed item
   *  (see ReelItem.productId). This is the most reliable thing to match on:
   *  `startProductId` can point at either a base product row or a specific
   *  variant row depending on which one actually owns the video, so an id
   *  mismatch there doesn't necessarily mean "wrong product" — it can just
   *  mean the video lives one level up/down from where this prop expected.
   *  Matching on baseProductId as a second pass catches that case without
   *  ever needing to guess. */
  baseProductId?: string;
  returnSlug: string;
  onClose: () => void;
}) {
  const router = useRouter();
  // Three-pass match, id -> baseProductId -> slug, and if NONE of them find
  // anything we now refuse to guess. Previously a failed match fell back to
  // `Math.max(0, -1) === 0` -- silently opening whatever product happened to
  // sit at index 0 (the most-recently-created item, since the feed is
  // ordered newest-first) instead of the shopper's own product. That's a
  // strictly worse outcome than not opening at all: it looks like a totally
  // unrelated product's video "randomly" plays, with no error and no way to
  // tell why. `startIndex` is now `-1` (nothing found) instead of `0`, and
  // the render below treats that as "can't confidently start here" rather
  // than pretending index 0 was the right answer.
  const startIndex = useMemo(() => {
    const byId = items.findIndex((i) => i.id === startProductId);
    if (byId !== -1) return byId;
    if (baseProductId) {
      const byBaseProductId = items.findIndex((i) => i.productId === baseProductId);
      if (byBaseProductId !== -1) return byBaseProductId;
    }
    const bySlug = items.findIndex((i) => i.slug === returnSlug);
    return bySlug;
  }, [items, startProductId, baseProductId, returnSlug]);

  // startIndex is -1 when none of the three passes above (id, baseProductId,
  // slug) found the shopper's own product in this feed. That should be rare
  // -- it means the feed response genuinely doesn't contain this product's
  // video at all -- but it used to be silently treated as "start at 0",
  // which opened a random unrelated product's video with no indication
  // anything had gone wrong. notFound tracks that state explicitly so the
  // render below can show a real error instead.
  const notFound = startIndex === -1;

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(notFound ? 0 : startIndex);
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
    if (notFound) return;
    const el = slideRefs.current[startIndex];
    if (el) el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track which slide is on-screen so only the visible video plays — every
  // other <video> stays paused, keeping bandwidth/decode cost limited to
  // exactly one active video at a time.
  //
  // Deliberately scroll-position math instead of IntersectionObserver here.
  // IntersectionObserver (threshold-based) turned out unreliable in some
  // zoomed/scaled mobile viewports (e.g. Chrome DevTools device emulation
  // at non-100% zoom) — the browser's own intersection ratio calculations
  // get thrown off by the zoom transform, so entries never crossed the
  // 0.6 threshold and activeIndex silently got stuck on whichever slide
  // opened first, even while the user kept scrolling past it. Computing
  // the index directly from scrollTop / slide height doesn't depend on
  // intersection-ratio math at all, so it isn't affected by that.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slideHeight = container.clientHeight || 1;
        const idx = Math.round(container.scrollTop / slideHeight);
        const clamped = Math.min(Math.max(idx, 0), items.length - 1);
        setActiveIndex((prev) => (prev === clamped ? prev : clamped));
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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

  // Never fall through to showing an unrelated product's video. This is the
  // deliberate replacement for the old `Math.max(0, -1) -> 0` fallback: if
  // the shopper's own product truly isn't in this feed response, say so and
  // let them close, instead of silently opening whatever product happens to
  // be newest.
  if (notFound) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 text-center text-white"
        role="dialog"
        aria-modal="true"
        onClick={handleClose}
      >
        <p>Couldn&apos;t load this product&apos;s video right now — tap anywhere to close.</p>
      </div>
    );
  }

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
            onSelectColour={goToProduct}
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
  onSelectColour,
  ref,
}: {
  item: ReelItem;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onShopNow: () => void;
  /** Navigates straight to the clicked colour's own product page. */
  onSelectColour: (slug: string) => void;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [shareCount, setShareCount] = useState(item.shareCount);
  const [colours, setColours] = useState<ProductVariant[] | null>(null);

  useEffect(() => {
    setLiked(hasLikedReel(item.id));
  }, [item.id]);

  // Colour swatches, same data source as the product page's own picker
  // (fetchVariantsForProduct). Loaded lazily once a slide is actually
  // seen, not for all 20+ slides up front, and cached per productId for
  // the life of the overlay so swiping back to a slide doesn't re-fetch.
  const coloursCacheRef = useRef<Map<string, ProductVariant[]>>(new Map());
  useEffect(() => {
    if (!isActive) return;
    const cached = coloursCacheRef.current.get(item.productId);
    if (cached) {
      setColours(cached);
      return;
    }
    let cancelled = false;
    fetchVariantsForProduct(item.productId)
      .then((v) => {
        coloursCacheRef.current.set(item.productId, v);
        if (!cancelled) setColours(v);
      })
      .catch(() => {
        if (!cancelled) setColours([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, item.productId]);

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
        // Falls back to the product's own cover photo the instant this slide
        // becomes active, instead of the bare black background. Without this,
        // a video whose codec the browser can't decode (very common for
        // iPhone-recorded HEVC/H.265 clips on non-Safari browsers — the AAC
        // audio track still decodes fine, only the video track silently
        // fails to paint) looked exactly like "audio playing, no video" —
        // there was nothing on screen to distinguish that from a real bug.
        // ProductVideoPeek already does this (poster={posterUrl}); this
        // brings the full-screen Reels view in line with it.
        poster={item.image ?? undefined}
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

      {/* Colour swatches — same colours as the product page's own picker.
          Tapping one navigates straight to that colour's product page,
          same behaviour as "Shop Now" but for a specific variant. Only
          rendered once fetched and only when there's more than one colour
          to choose from (a single-colour product has nothing to switch to). */}
      {colours && colours.length > 1 && (
        <div className="absolute bottom-[5.75rem] left-3 right-16 z-10 flex gap-2 overflow-x-auto pb-1 sm:left-5 sm:right-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {colours.map((v) => {
            const isCurrentColour = v.slug === item.slug || v.id === item.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectColour(v.slug)}
                title={v.color}
                aria-label={`View in ${v.color}`}
                className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-muted shadow-sm ${
                  isCurrentColour ? 'border-white' : 'border-white/40'
                }`}
              >
                {v.images[0] ? (
                  <Image src={v.images[0]} alt={v.color} fill sizes="44px" className="object-cover" />
                ) : v.color_hex ? (
                  <span className="block h-full w-full" style={{ backgroundColor: v.color_hex }} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-black/60 text-[9px] font-semibold uppercase text-white">
                    {v.color.slice(0, 2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
