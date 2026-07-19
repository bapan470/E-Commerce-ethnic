'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, ZoomIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  discount: number;
}

const PLACEHOLDER = 'https://placehold.co/800x1000?text=No+Image';

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
export default function ProductGallery({ images, alt, discount }: ProductGalleryProps) {
  const valid = images.length > 0 ? images : [PLACEHOLDER];

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
                    alt={`${alt} thumbnail ${idx + 1}`}
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
          <div
            ref={stageRef}
            className="group/stage no-scrollbar relative aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth border border-border/60 bg-muted sm:rounded-xl"
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
                    alt={`${alt} - image ${idx + 1}`}
                    fill
                    priority={idx === 0}
                    draggable={false}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    quality={80}
                    className={cn(
                      'select-none object-cover transition-opacity duration-150',
                      idx === active && zooming ? 'sm:opacity-0' : 'opacity-100'
                    )}
                  />
                </div>
              ))}
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
 *   swipe left/right at 1x to move between photos.
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
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const lastTapRef = useRef(0);
  const swipeRef = useRef<{ startX: number } | null>(null);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goTo = (idx: number) => {
    resetZoom();
    onActiveChange((idx + images.length) % images.length);
  };

  const toggleZoom = (clientX: number, clientY: number, rect: DOMRect) => {
    if (scale > 1) {
      resetZoom();
      return;
    }
    setScale(2.5);
    setOffset({
      x: (rect.width / 2 - (clientX - rect.left)) * 1.5,
      y: (rect.height / 2 - (clientY - rect.top)) * 1.5,
    });
  };

  const distance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: distance(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        toggleZoom(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget.getBoundingClientRect());
      }
      lastTapRef.current = now;
      if (scale > 1) {
        dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, offX: offset.x, offY: offset.y };
      } else {
        swipeRef.current = { startX: e.touches[0].clientX };
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const next = (distance(e.touches) / pinchRef.current.startDist) * pinchRef.current.startScale;
      setScale(Math.min(4, Math.max(1, next)));
    } else if (e.touches.length === 1 && dragRef.current) {
      setOffset({
        x: dragRef.current.offX + (e.touches[0].clientX - dragRef.current.startX),
        y: dragRef.current.offY + (e.touches[0].clientY - dragRef.current.startY),
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    pinchRef.current = null;
    if (dragRef.current) {
      dragRef.current = null;
      if (scale < 1.05) resetZoom();
      return;
    }
    if (swipeRef.current) {
      const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
      swipeRef.current = null;
      if (dx <= -60) goTo(active + 1);
      else if (dx >= 60) goTo(active - 1);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setScale((s) => Math.min(4, Math.max(1, s - e.deltaY * 0.01)));
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: offset.x, offY: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.offX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.offY + (e.clientY - dragRef.current.startY),
    });
  };
  const onMouseUp = () => {
    dragRef.current = null;
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

      <div
        className="relative flex-1 touch-none select-none overflow-hidden"
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
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
        >
          <Image
            src={images[active]}
            alt={`${alt} - full view ${active + 1}`}
            fill
            draggable={false}
            sizes="100vw"
            quality={90}
            priority
            className="select-none object-contain"
          />
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
              <Image src={img} alt="" fill draggable={false} sizes="56px" quality={50} className="select-none object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
