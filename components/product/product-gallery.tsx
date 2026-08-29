'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, ZoomIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { preloadImages } from '@/lib/preload-image';
import ProductVideoPeek from './product-video-peek';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  discount: number;
  /** This product's own video (already resolved via toPublicMediaUrl) —
   *  when present, shows the floating "peek" preview bubble described in
   *  product-video-peek.tsx. Needs productId/productSlug too so a tap can
   *  open the same full-screen Reels feed as the button below the gallery. */
  videoUrl?: string | null;
  productId?: string;
  /** The base product's own id, even when `productId` above points at a
   *  colour variant's row — see the matching note in video-reels.tsx. */
  baseProductId?: string;
  productSlug?: string;
  /** Passed straight through to ProductVideoPeek so it can build a
   *  guaranteed-correct `startItem` for VideoReels — see the doc comment
   *  on ProductVideoPeek's own `name`/`price`/`mrp` props. */
  productName?: string;
  productPrice?: number;
  productMrp?: number | null;
}

const PLACEHOLDER = 'https://placehold.co/800x1000?text=No+Image';

// Product photo sets are typically shot in a rough front/back/detail/style
// rotation, so cycling through these labels gives each image its own
// distinct alt text (front view, back view, close-up, ...) instead of every
// photo repeating the exact same string with only a number appended -- more
// useful for screen readers and much better for image-search SEO than
// "Product name - image 1", "Product name - image 2", etc.
const ANGLE_LABELS = [
  'front view',
  'back view',
  'close-up detail',
  'styled look',
  'side view',
  'draping detail',
  'fabric texture close-up',
  'full outfit view',
];

function angleLabel(idx: number): string {
  return ANGLE_LABELS[idx % ANGLE_LABELS.length];
}

/**
 * Product image gallery — main stage + thumbnail rail + full-screen zoom.
 *
 * Deliberately simple:
 * - No carousel library (Swiper etc.) — those ship as ESM-only packages
 *   that Next 13's default webpack config won't transpile, which is what
 *   silently broke the main image before (blank box, no visible error).
 * - The main stage is a real native horizontal scroller (overflow-x-auto +
 *   scroll-snap), not a JS-driven translateX "slide". Every image sits
 *   side by side and the browser handles the swipe/scroll physics itself
 *   (momentum, direction-locking against vertical page scroll, etc.),
 *   snapping to the nearest photo automatically — the same feel as
 *   scrolling a normal horizontal image strip, instead of a canned
 *   right-to-left slide animation.
 * - Vertical scrolling is 100% native. Touch-action is left at its default
 *   so the browser itself decides, per-gesture, whether a diagonal drag
 *   pans the page vertically or scrolls the strip horizontally.
 */
export default function ProductGallery({
  images,
  alt,
  discount,
  videoUrl,
  productId,
  baseProductId,
  productSlug,
  productName,
  productPrice,
  productMrp,
}: ProductGalleryProps) {
  // Memoized so this array is referentially stable across renders (it's a
  // dependency of the preload effect below) -- without this, a brand new
  // array would be created every render and defeat that effect's guard.
  const valid = useMemo(() => (images.length > 0 ? images : [PLACEHOLDER]), [images]);

  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const thumbColRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Reset to the first image whenever the image set changes (e.g. colour swap).
  useEffect(() => {
    setActive(0);
  }, [images]);

  const clamp = useCallback((idx: number) => (idx + valid.length) % valid.length, [valid.length]);

  // Fixes the "blank/white frame while swiping" issue: every image except
  // the very first one was purely lazy-loaded, so the browser only started
  // fetching it once it scrolled into view -- exactly when the shopper was
  // already looking at it. Here we preload the photo on either side of the
  // current one the moment `active` changes (and on first mount), so by the
  // time a swipe finishes the next photo is already sitting in the browser
  // cache and just paints instantly instead of popping in late.
  useEffect(() => {
    preloadImages([valid[clamp(active + 1)], valid[clamp(active - 1)]]);
  }, [active, valid, clamp]);

  // `goTo` now drives the native scroller instead of a JS transform — it
  // scrolls the stage to the target photo and lets the browser animate it,
  // exactly like scrolling any normal horizontal strip. `active` itself is
  // kept in sync by the onScroll handler below, so clicking a thumbnail,
  // using arrow keys in the lightbox, etc. all funnel through one path.
  const goTo = useCallback(
    (idx: number) => {
      const next = clamp(idx);
      const el = stageRef.current;
      if (el) {
        el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
      }
      setActive(next);
    },
    [clamp]
  );

  // Keep `active` (thumbnail highlight, dots, badge, etc.) in sync while the
  // user free-scrolls the strip by hand — no scroll-snap "jump", just a
  // normal scroll that we read the nearest-photo index back out of.
  const onScrollStage = () => {
    const el = stageRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (prev === idx ? prev : clamp(idx)));
  };

  // Whenever the active image changes from outside a hand-scroll (e.g. a
  // thumbnail click already calls goTo(), which scrolls directly — this
  // effect only matters for the very first mount / image-set changes so
  // the strip starts lined up with `active`).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    el.scrollTo({ left: active * el.clientWidth, behavior: 'instant' as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const scrollThumbCol = (dir: 1 | -1) => {
    thumbColRef.current?.scrollBy({ top: dir * 96, behavior: 'smooth' });
  };

  // Desktop hover-zoom magnifier still tracks the cursor over the stage —
  // this has nothing to do with sliding between photos, so it's unchanged.
  const onMouseMoveStage = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
    }
  };
  const onMouseEnterStage = () => setZooming(true);
  const onMouseLeaveStage = () => setZooming(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') goTo(active + 1);
      if (e.key === 'ArrowLeft') goTo(active - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, active, goTo]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Desktop: vertical thumbnail rail */}
        {valid.length > 1 && (
          <div className="relative hidden w-16 shrink-0 flex-col sm:flex lg:w-[72px]">
            <div
              ref={thumbColRef}
              className="no-scrollbar flex max-h-[500px] w-full flex-col gap-3 overflow-y-auto"
            >
              {valid.map((img, idx) => (
                <button
                  key={`${idx}-${img}`}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`View image ${idx + 1}`}
                  aria-current={active === idx}
                  className={cn(
                    'relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2',
                    active === idx ? 'border-primary' : 'border-border/60 hover:border-primary/40'
                  )}
                >
                  <Image
                    src={img}
                    alt={`${alt} - ${angleLabel(idx)} thumbnail`}
                    fill
                    draggable={false}
                    sizes="72px"
                    quality={50}
                    className="select-none object-cover"
                  />
                </button>
              ))}
            </div>
            {valid.length > 5 && (
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  aria-label="Scroll thumbnails up"
                  onClick={() => scrollThumbCol(-1)}
                  className="rounded-full border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Scroll thumbnails down"
                  onClick={() => scrollThumbCol(1)}
                  className="rounded-full border border-border p-1 text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative flex-1">
          <div className="group/stage relative aspect-[4/4.2] w-full overflow-hidden border border-border/60 bg-muted sm:aspect-[4/4.6] sm:rounded-xl">
            {/* This inner div is the ONLY thing that scrolls. Badges, the
                zoom button, the counter and the dots live outside it (as
                siblings below) so they stay fixed on screen instead of
                sliding off with the photo strip. */}
            <div
              ref={stageRef}
              className="no-scrollbar h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
              onScroll={onScrollStage}
              onMouseMove={onMouseMoveStage}
              onMouseEnter={onMouseEnterStage}
              onMouseLeave={onMouseLeaveStage}
            >
              {/* Every image sits side by side in one strip and the browser's
                  own native horizontal scrolling moves between them — this is
                  a real scroll (swipe momentum, scroll-snap settling on the
                  nearest photo, mouse-wheel/trackpad support) rather than a
                  JS-driven slide animation. */}
              <div className="flex h-full">
                {valid.map((img, idx) => (
                  <div
                    key={`${idx}-${img}`}
                    className="relative h-full w-full shrink-0 snap-start snap-always"
                  >
                    <Image
                      src={img}
                      alt={`${alt} - ${angleLabel(idx)}`}
                      fill
                      priority={Math.abs(idx - active) <= 1}
                      draggable={false}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      quality={80}
                      className={cn(
                        'select-none object-contain transition-opacity duration-150',
                        idx === active && zooming ? 'sm:opacity-0' : 'opacity-100'
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop hover-zoom magnifier: swaps in a scaled background image
                that tracks the cursor — the "inspect the fabric" zoom. Only
                mounted while actually hovering, so it costs nothing until the
                user shows intent to zoom. */}
            {zooming && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 hidden bg-no-repeat sm:block"
                style={{
                  backgroundImage: `url(${valid[active]})`,
                  backgroundSize: '220%',
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                }}
              />
            )}

            {discount > 0 && (
              <Badge className="absolute left-4 top-4 bg-secondary text-secondary-foreground">
                {discount}% OFF
              </Badge>
            )}

            {valid.length > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm sm:hidden">
                {active + 1} / {valid.length}
              </span>
            )}

            <button
              type="button"
              aria-label="Zoom image"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              className="absolute right-3 top-12 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-md hover:bg-background sm:top-3 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover/stage:opacity-100"
            >
              <ZoomIn className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Click to zoom</span>
            </button>

            {videoUrl && productId && productSlug && (
              <ProductVideoPeek
                videoUrl={videoUrl}
                posterUrl={valid[0]}
                productId={productId}
                baseProductId={baseProductId}
                productSlug={productSlug}
                alt={alt}
                name={productName}
                price={productPrice}
                mrp={productMrp}
              />
            )}

            {valid.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 sm:hidden">
                {valid.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full',
                      active === idx ? 'w-4 bg-primary' : 'w-1.5 bg-white/80'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          images={valid}
          alt={alt}
          active={active}
          onActiveChange={setActive}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Full-screen zoom viewer — the one place actual "zoom" happens, on both
 * desktop and mobile, so the two platforms behave consistently:
 * - Mobile: pinch with two fingers, or double-tap, to zoom; drag to pan;
 *   swipe left/right at 1x to move between photos — same native scroll
 *   strip as the main product-page gallery, not a separate swipe gesture.
 * - Desktop: scroll the mouse wheel, or double-click, to zoom; drag to pan
 *   while zoomed; on-screen arrows or arrow keys to move between photos.
 */
function Lightbox({
  images,
  alt,
  active,
  onActiveChange,
  onClose,
}: {
  images: string[];
  alt: string;
  active: number;
  onActiveChange: (idx: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // True only while a finger/mouse is actively pinching or dragging the
  // photo. Drives whether the snap-back CSS transition is on: off during a
  // live gesture (so the photo tracks the finger with zero added lag), on
  // the instant the gesture ends (so letting go eases back/settles instead
  // of a hard jump). This is purely visual — it doesn't gate any logic.
  const [isGesturing, setIsGesturing] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const lastTapRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  // --- Smooth transform pipeline -------------------------------------
  // Pinching/dragging fires touchmove far faster than React can usefully
  // re-render (a full re-render walks the whole lightbox tree: thumbnail
  // strip, arrows, every slide). That mismatch is what made zoom feel
  // laggy/stuttery on mobile. Instead, every move writes the transform
  // straight onto the active slide's DOM node (zero-lag, exactly what the
  // finger is doing right now), and only mirrors that into React state
  // once per animation frame — capped at the screen's own refresh rate, so
  // React work never falls behind the gesture or does redundant renders.
  const activeImgRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ scale: number; x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Reads the most current transform even mid-gesture (pendingRef), falling
  // back to committed React state between gestures — avoids ever computing
  // the next frame from a value that's already one frame stale.
  const getCurrent = useCallback(
    () => pendingRef.current ?? { scale, x: offset.x, y: offset.y },
    [scale, offset]
  );

  // Keeps a zoomed-in photo from being dragged completely off screen.
  const clampOffset = useCallback((x: number, y: number, s: number) => {
    const el = scrollRef.current;
    if (!el || s <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (s - 1)) / 2;
    const maxY = (el.clientHeight * (s - 1)) / 2;
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  const applyTransform = useCallback(
    (next: { scale: number; x: number; y: number }) => {
      const clamped = clampOffset(next.x, next.y, next.scale);
      const final = { scale: next.scale, ...clamped };
      pendingRef.current = final;
      if (activeImgRef.current) {
        activeImgRef.current.style.transform = `translate(${final.x}px, ${final.y}px) scale(${final.scale})`;
      }
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const p = pendingRef.current;
          if (p) {
            setScale(p.scale);
            setOffset({ x: p.x, y: p.y });
          }
        });
      }
    },
    [clampOffset]
  );

  const resetZoom = () => {
    setIsGesturing(false);
    pendingRef.current = null;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    if (activeImgRef.current) activeImgRef.current.style.transform = '';
  };

  // Same fix as the main stage: preload the photo on either side so
  // swiping inside the full-screen viewer doesn't show a blank frame either.
  useEffect(() => {
    const next = images[(active + 1 + images.length) % images.length];
    const prev = images[(active - 1 + images.length) % images.length];
    preloadImages([next, prev]);
  }, [active, images]);

  // Jumps (arrow buttons / thumbnail row / keyboard) just update `active`;
  // the effect below notices the strip's scroll position doesn't match
  // and glides the same native scroller to it — the exact same navigation
  // as the main product-page gallery, just inside the full-screen viewer.
  const goTo = (idx: number) => {
    resetZoom();
    onActiveChange((idx + images.length) % images.length);
  };

  // Keeps the strip lined up with `active` for any *external* change
  // (arrow keys, thumbnail row, prev/next buttons). When the change instead
  // came from the user hand-scrolling the strip themselves, the scroll
  // position already matches `active` (set by onScrollStrip below) by the
  // time this runs, so it's a no-op — the user's own scroll is never
  // fought or interrupted.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) {
      el.scrollTo({ left: active * el.clientWidth, behavior: mountedRef.current ? 'smooth' : ('instant' as ScrollBehavior) });
    }
    mountedRef.current = true;
  }, [active]);

  const onScrollStrip = () => {
    if (scale > 1) return; // locked while zoomed in on a photo
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) onActiveChange((idx + images.length) % images.length);
  };

  const toggleZoom = (clientX: number, clientY: number, rect: DOMRect) => {
    if (scale > 1) {
      resetZoom();
      return;
    }
    // Not part of a live drag/pinch, so leave isGesturing false — the
    // snap-to-2.5x below eases in via the CSS transition instead of
    // popping straight to full zoom.
    applyTransform({
      scale: 2.5,
      x: (rect.width / 2 - (clientX - rect.left)) * 1.5,
      y: (rect.height / 2 - (clientY - rect.top)) * 1.5,
    });
  };

  const distance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      setIsGesturing(true);
      pinchRef.current = { startDist: distance(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        toggleZoom(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect());
      }
      lastTapRef.current = now;
      if (scale > 1) {
        setIsGesturing(true);
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, offX: offset.x, offY: offset.y };
      }
      // At scale 1 a single finger is left alone entirely — the browser's
      // native scroll (touch-action: pan-x below) handles it, same as the
      // main gallery stage.
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const cur = getCurrent();
      const next = Math.min(4, Math.max(1, (distance(e.touches) / pinchRef.current.startDist) * pinchRef.current.startScale));
      applyTransform({ scale: next, x: cur.x, y: cur.y });
    } else if (e.touches.length === 1 && dragRef.current) {
      applyTransform({
        scale: getCurrent().scale,
        x: dragRef.current.offX + (e.touches[0].clientX - dragRef.current.startX),
        y: dragRef.current.offY + (e.touches[0].clientY - dragRef.current.startY),
      });
    }
  };

  const onTouchEnd = () => {
    const wasGesture = pinchRef.current != null || dragRef.current != null;
    pinchRef.current = null;
    dragRef.current = null;
    if (wasGesture) {
      setIsGesturing(false);
      if (getCurrent().scale < 1.05) resetZoom();
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const cur = getCurrent();
    const next = Math.min(4, Math.max(1, cur.scale - e.deltaY * 0.01));
    applyTransform({ scale: next, x: cur.x, y: cur.y });
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    setIsGesturing(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: offset.x, offY: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    applyTransform({
      scale: getCurrent().scale,
      x: dragRef.current.offX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.offY + (e.clientY - dragRef.current.startY),
    });
  };
  const onMouseUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setIsGesturing(false);
    }
  };
  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    toggleZoom(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-medium">
          {active + 1} / {images.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {/* Same native horizontal scroller as the product-page gallery —
            every photo sits side by side and a swipe/scroll moves between
            them for real, instead of a separate swipe-threshold gesture.
            It only locks (scale > 1) while actively zoomed into a photo,
            so panning that photo doesn't also drag the strip underneath it. */}
        <div
          ref={scrollRef}
          className={cn(
            'no-scrollbar h-full w-full select-none scroll-smooth',
            scale > 1 ? 'touch-none overflow-hidden' : 'touch-pan-x snap-x snap-mandatory overflow-x-auto overflow-y-hidden'
          )}
          onScroll={onScrollStrip}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
        >
          <div className="flex h-full">
            {images.map((img, idx) => (
              <div key={`${idx}-${img}`} className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden">
                <div
                  ref={idx === active ? activeImgRef : undefined}
                  className={cn(
                    'absolute inset-0',
                    // No transition while actively pinching/dragging — the
                    // photo must track the finger with zero added lag. The
                    // moment the gesture ends (double-tap zoom-in, release,
                    // snap-back-to-1x), this eases it instead of a hard cut.
                    idx === active && !isGesturing && 'transition-transform duration-200 ease-out'
                  )}
                  style={
                    idx === active
                      ? {
                          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                          cursor: scale > 1 ? 'grab' : 'zoom-in',
                          willChange: 'transform',
                        }
                      : undefined
                  }
                >
                  <Image
                    src={img}
                    alt={`${alt} - ${angleLabel(idx)}, full view`}
                    fill
                    draggable={false}
                    sizes="100vw"
                    quality={90}
                    priority={Math.abs(idx - active) <= 1}
                    className="select-none object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {images.length > 1 && scale === 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => goTo(active - 1)}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => goTo(active + 1)}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-white/10 p-3">
          {images.map((img, idx) => (
            <button
              key={`${idx}-${img}`}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2',
                active === idx ? 'border-white' : 'border-transparent opacity-60'
              )}
            >
              <Image
                src={img}
                alt={`${alt} - ${angleLabel(idx)} thumbnail`}
                fill
                draggable={false}
                sizes="56px"
                quality={50}
                className="select-none object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
