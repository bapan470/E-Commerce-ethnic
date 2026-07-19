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
const SWIPE_THRESHOLD = 40; // px of horizontal drag needed to change image
const TAP_THRESHOLD = 8; // px of total movement still counted as a "tap"

/**
 * Product image gallery — main stage + thumbnail rail + full-screen zoom.
 *
 * Deliberately simple:
 * - No carousel library (Swiper etc.) — those ship as ESM-only packages
 *   that Next 13's default webpack config won't transpile, which is what
 *   silently broke the main image before (blank box, no visible error).
 * - Only ONE image is mounted in the main stage at a time — nothing pre-
 *   loads in the background, so there's nothing competing for bandwidth
 *   with the photo the person is actually looking at.
 * - No blur placeholder, no fade/opacity transitions, no hover magnifier
 *   layer — the image just appears the moment it's decoded.
 * - Vertical scrolling is 100% native. The gallery only ever calls
 *   preventDefault() once a touch has clearly moved more horizontally
 *   than vertically, so a finger dragging up/down always scrolls the
 *   page like anywhere else on the site — only a clearly sideways swipe
 *   changes the photo.
 */
export default function ProductGallery({ images, alt, discount }: ProductGalleryProps) {
  const valid = images.length > 0 ? images : [PLACEHOLDER];

  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const thumbColRef = useRef<HTMLDivElement | null>(null);

  // Reset to the first image whenever the image set changes (e.g. colour swap).
  useEffect(() => {
    setActive(0);
  }, [images]);

  const clamp = useCallback((idx: number) => (idx + valid.length) % valid.length, [valid.length]);
  const goTo = useCallback((idx: number) => setActive((_) => clamp(idx)), [clamp]);

  const scrollThumbCol = (dir: 1 | -1) => {
    thumbColRef.current?.scrollBy({ top: dir * 96, behavior: 'smooth' });
  };

  // --- Swipe / tap on the main stage --------------------------------------
  // touch-action: pan-y on the wrapper tells the browser "vertical page
  // scroll is always native and yours" up front, so a vertical drag never
  // gets intercepted even for a single frame. We only decide, on the first
  // touchmove, whether THIS particular gesture is horizontal enough to
  // treat as a swipe; if it isn't, we do nothing and the browser scrolls
  // the page exactly as if the gallery weren't there.
  const touchRef = useRef<{ startX: number; startY: number; horizontal: boolean | null } | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, horizontal: null };
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = touchRef.current;
    if (!t) return;
    const dx = e.touches[0].clientX - t.startX;
    const dy = e.touches[0].clientY - t.startY;
    if (t.horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      t.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (t.horizontal) {
      // Only prevent default once we know it's a horizontal swipe, so the
      // page never loses its native vertical scroll for this touch.
      e.preventDefault();
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = touchRef.current;
    touchRef.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.startX;
    if (t.horizontal) {
      if (dx <= -SWIPE_THRESHOLD) goTo(active + 1);
      else if (dx >= SWIPE_THRESHOLD) goTo(active - 1);
    } else if (Math.abs(dx) < TAP_THRESHOLD) {
      setLightboxOpen(true);
    }
  };

  // Desktop: a plain click (no drag) opens the zoom view.
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
  };
  const onClickStage = (e: React.MouseEvent<HTMLDivElement>) => {
    const dx = e.clientX - mouseDownPos.current.x;
    const dy = e.clientY - mouseDownPos.current.y;
    if (Math.hypot(dx, dy) < TAP_THRESHOLD) setLightboxOpen(true);
  };

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
            className="group/stage relative aspect-[4/5] w-full cursor-zoom-in overflow-hidden border border-border/60 bg-muted sm:rounded-xl"
            style={{ touchAction: 'pan-y' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
            onClick={onClickStage}
          >
            {/* Only the active image is ever mounted — nothing preloads
                silently in the background competing for bandwidth. */}
            <Image
              key={active}
              src={valid[active]}
              alt={`${alt} - image ${active + 1}`}
              fill
              priority={active === 0}
              draggable={false}
              sizes="(max-width: 1024px) 100vw, 50vw"
              quality={80}
              className="select-none object-cover"
            />

            {/* Prev/next arrows */}
            {valid.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(active - 1);
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md hover:bg-background sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover/stage:opacity-100"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-md hover:bg-background sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover/stage:opacity-100"
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

            {valid.length > 1 && (
              <span className="absolute right-3 top-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm sm:hidden">
                {active + 1} / {valid.length}
              </span>
            )}

            {/* Magnifier glass icon — always visible (mobile + desktop),
                tap/click it directly to open the zoom lightbox. */}
            <button
              type="button"
              aria-label="Zoom image"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md ring-1 ring-border/60 transition-transform hover:scale-110 hover:bg-background sm:h-10 sm:w-10"
            >
              <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
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
