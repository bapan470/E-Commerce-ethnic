'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, ZoomIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { blurDataURL, cn } from '@/lib/utils';

interface ProductGalleryProps {
  images: string[];
  alt: string;
  discount: number;
}

const PLACEHOLDER = 'https://placehold.co/800x1000?text=No+Image';

export default function ProductGallery({ images, alt, discount }: ProductGalleryProps) {
  const valid = images.length > 0 ? images : [PLACEHOLDER];

  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbColRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Reset to the first image whenever the image set changes (e.g. colour swap).
  useEffect(() => {
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [images]);

  // Track which slide is active as the user swipes through the strip (mobile).
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const goTo = useCallback(
    (idx: number) => {
      const next = (idx + valid.length) % valid.length;
      setActive(next);
      trackRef.current?.scrollTo({ left: next * (trackRef.current?.clientWidth ?? 0), behavior: 'smooth' });
    },
    [valid.length]
  );

  const scrollThumbCol = (dir: 1 | -1) => {
    thumbColRef.current?.scrollBy({ top: dir * 96, behavior: 'smooth' });
  };

  // --- Desktop hover-zoom (magnifier) -------------------------------------
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  // --- Lightbox (shared by mobile + desktop) ------------------------------
  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') goTo(active + 1);
      if (e.key === 'ArrowLeft') goTo(active - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [lightboxOpen, active, goTo]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/* Desktop: vertical thumbnail rail on the left with up/down paging */}
        {valid.length > 1 && (
          <div className="relative hidden w-16 shrink-0 flex-col sm:flex lg:w-[72px]">
            <div
              ref={thumbColRef}
              className="no-scrollbar flex max-h-[500px] w-full flex-col gap-3 overflow-y-auto"
            >
              {valid.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => goTo(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={cn(
                    'relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200',
                    active === idx
                      ? 'border-primary shadow-sm'
                      : 'border-border/60 opacity-70 hover:border-primary/40 hover:opacity-100'
                  )}
                >
                  <Image
                    src={img}
                    alt={`${alt} thumbnail ${idx + 1}`}
                    fill
                    draggable={false}
                    sizes="72px"
                    quality={55}
                    placeholder="blur"
                    blurDataURL={blurDataURL(72, 72)}
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
          {/*
            Mobile-scroll fix:
            - No touchAction override here. Leaving it at the default `auto`
              lets the browser's native gesture disambiguation do its job:
              this track only overflows HORIZONTALLY, so a horizontal drag
              slides the carousel while a vertical drag has nothing to
              scroll locally and correctly falls through to the page.
            - IMPORTANT: `touch-action: pan-x` looks like the right fix but
              is actually the opposite - once a touch starts on an element
              restricted to pan-x, the browser disables vertical-scroll
              gesture recognition for that whole touch, and it does NOT
              hand off to the parent for the Y axis. That's what caused
              swipes over the image to trap the page and refuse to scroll
              down. Do not re-add touchAction: 'pan-x' here.
            - 100% native CSS scroll-snap, reliable across iOS Safari/Android Chrome.
          */}
          <div
            ref={stageRef}
            className="group/stage relative border border-border/60 bg-muted sm:overflow-hidden sm:rounded-xl"
            onMouseEnter={() => setZooming(true)}
            onMouseLeave={() => setZooming(false)}
            onMouseMove={handleMouseMove}
          >
            <div
              ref={trackRef}
              onScroll={handleScroll}
              onClick={() => setLightboxOpen(true)}
              className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto scroll-smooth cursor-zoom-in"
            >
              {valid.map((img, idx) => {
                const isNear = Math.abs(idx - active) <= 1;
                const isActive = idx === active;
                return (
                  <div
                    key={idx}
                    className="relative h-full w-full flex-none snap-center overflow-hidden bg-muted"
                  >
                    {isNear && (
                      <Image
                        src={img}
                        alt={`${alt} - image ${idx + 1}`}
                        fill
                        // Only the very first paint is `priority` (preloaded,
                        // no lazy delay). Neighbours are fetched lazily and at
                        // a much lower quality — they're pre-warming the cache
                        // for a swipe that may not even happen, so they
                        // shouldn't steal bandwidth from the image the user
                        // is actually looking at right now.
                        priority={idx === 0}
                        loading={idx === 0 ? undefined : 'lazy'}
                        draggable={false}
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        quality={isActive ? 82 : 35}
                        placeholder="blur"
                        blurDataURL={blurDataURL(32, 40)}
                        className={cn(
                          'select-none object-cover transition-opacity duration-300',
                          isActive && zooming ? 'sm:opacity-0' : 'opacity-100'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop hover-zoom magnifier: swaps in a scaled background image that
                tracks the cursor, giving Shopify-style "inspect the fabric" zoom
                without opening a modal. Only mounted on hover, so it costs nothing
                until the user actually shows intent to zoom. */}
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

            {/* Desktop prev/next arrows, revealed on hover */}
            {valid.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(active - 1);
                  }}
                  className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 opacity-0 shadow-md transition-opacity duration-200 group-hover/stage:opacity-100 hover:bg-background sm:flex"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(active + 1);
                  }}
                  className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 opacity-0 shadow-md transition-opacity duration-200 group-hover/stage:opacity-100 hover:bg-background sm:flex"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {discount > 0 && (
              <Badge className="absolute left-4 top-4 bg-secondary text-secondary-foreground">
                {discount}% OFF
              </Badge>
            )}

            {/* Image counter, Shopify-style "2 / 6" pill */}
            {valid.length > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm sm:hidden">
                {active + 1} / {valid.length}
              </span>
            )}

            {/* Desktop-only zoom hint */}
            <span className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground opacity-0 shadow-sm transition-opacity duration-200 group-hover/stage:opacity-100 sm:flex">
              <ZoomIn className="h-3 w-3" /> Click to zoom
            </span>

            {/* Mobile: dots only, no thumbnail strip - tap the image for the full-screen viewer */}
            {valid.length > 1 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 sm:hidden">
                {valid.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
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
 * Full-screen viewer used on both mobile and desktop.
 * - Swipe / arrow keys / on-screen arrows to move between images.
 * - Double-tap (mobile) or double-click (desktop) to toggle 1x <-> 2.5x zoom.
 * - Pinch (two-finger) to zoom smoothly on touch devices.
 * - Drag to pan while zoomed in.
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
    const x = ((rect.width / 2 - (clientX - rect.left)) * 1.5) / 1;
    const y = ((rect.height / 2 - (clientY - rect.top)) * 1.5) / 1;
    setScale(2.5);
    setOffset({ x, y });
  };

  const distance = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: distance(e.touches), startScale: scale };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        const rect = e.currentTarget.getBoundingClientRect();
        toggleZoom(e.touches[0].clientX, e.touches[0].clientY, rect);
      }
      lastTapRef.current = now;
      // Track the touch regardless of zoom level: when zoomed in this pans
      // the image; when at 1x the same delta is used below to swipe to the
      // next/previous photo, so a plain left/right finger drag now moves
      // through the gallery instead of doing nothing.
      dragRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        offX: offset.x,
        offY: offset.y,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const next = (distance(e.touches) / pinchRef.current.startDist) * pinchRef.current.startScale;
      setScale(Math.min(4, Math.max(1, next)));
    } else if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      if (scale > 1) {
        setOffset({ x: dragRef.current.offX + dx, y: dragRef.current.offY + dy });
      } else {
        // Not zoomed: follow the finger horizontally only, so the current
        // image visibly slides with the swipe before we decide whether to
        // commit to the next/previous photo on release.
        setOffset({ x: dx, y: 0 });
      }
    }
  };

  const onTouchEnd = () => {
    const wasSwiping = !!dragRef.current && scale <= 1;
    const finalDx = offset.x;
    pinchRef.current = null;
    dragRef.current = null;
    if (wasSwiping) {
      if (finalDx <= -60) {
        goTo(active + 1);
      } else if (finalDx >= 60) {
        goTo(active - 1);
      } else {
        setOffset({ x: 0, y: 0 });
      }
    }
    if (scale < 1.05) resetZoom();
  };

  // Desktop: wheel to zoom, drag to pan, double-click to toggle
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
    const rect = e.currentTarget.getBoundingClientRect();
    toggleZoom(e.clientX, e.clientY, rect);
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
        className="relative flex-1 touch-none overflow-hidden select-none"
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
            transition: dragRef.current ? 'none' : 'transform 0.2s ease-out',
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
              key={idx}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
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
