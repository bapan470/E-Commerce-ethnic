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
 * - The main stage is a real drag-strip: every image sits side by side and
 *   the whole strip translates with the finger in real time — drag a
 *   little for a slow nudge, drag far/fast to fly past several photos at
 *   once. On release it snaps to the nearest photo with a smooth 400ms
 *   ease. Because every image is already mounted, there's no swap/remount
 *   moment — so no blank/white flash either.
 * - Vertical scrolling is 100% native. The gallery only ever calls
 *   preventDefault() once a touch has clearly moved more horizontally
 *   than vertically, so a finger dragging up/down always scrolls the
 *   page like anywhere else on the site — only a clearly sideways swipe
 *   drags the strip.
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
  const goTo = useCallback((idx: number) => setActive((_) => clamp(idx)), [clamp]);

  const scrollThumbCol = (dir: 1 | -1) => {
    thumbColRef.current?.scrollBy({ top: dir * 96, behavior: 'smooth' });
  };

  // --- Drag-strip on the main stage ---------------------------------------
  // `dragOffset` is a live pixel offset added on top of the resting
  // position while a finger/mouse is down, so the strip tracks the pointer
  // 1:1 every frame — this is what makes the slide feel "slow" when you
  // drag slow and lets you fly past several photos when you drag far/fast.
  //
  // Uses the Pointer Events API (not separate touch/mouse handlers) with
  // setPointerCapture on press. That capture is what fixes the drag
  // "getting stuck": without it, if your finger/mouse moves outside the
  // image box mid-swipe (very easy to do — the box isn't full-screen), the
  // browser can stop sending move/up events to this element entirely, so
  // the slide would freeze mid-drag with no "release" ever registering.
  // Capturing the pointer guarantees every move/up for this gesture keeps
  // arriving here no matter where the pointer travels.
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    horizontal: boolean | null;
  } | null>(null);

  const onPointerDownStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // left click only
    pointerRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, horizontal: null };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMoveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    // Magnifier follows the cursor whenever a mouse hovers the stage,
    // whether or not a drag is in progress.
    if (e.pointerType === 'mouse') {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setZoomPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
      }
    }

    const p = pointerRef.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (p.horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      // Mouse drags are always treated as horizontal (there's no page
      // scroll to protect); touch only commits once the gesture is
      // clearly more horizontal than vertical, so a finger scrolling the
      // page down is never hijacked.
      p.horizontal = e.pointerType === 'mouse' ? true : Math.abs(dx) > Math.abs(dy);
      if (p.horizontal) setIsDragging(true);
    }
    if (p.horizontal) {
      e.preventDefault();
      setDragOffset(dx);
    }
  };

  const endDragStage = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (!p || p.id !== e.pointerId) return;
    pointerRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const dx = e.clientX - p.startX;
    setIsDragging(false);
    setDragOffset(0);
    if (p.horizontal) {
      const width = stageRef.current?.offsetWidth || 1;
      // How far (in whole photos) the drag traveled — a small drag snaps
      // right back, a drag past ~half a photo-width commits to the next
      // one, and a big fast flick can jump straight past several photos.
      const movedSlides = Math.round(-dx / width);
      if (movedSlides !== 0) goTo(active + movedSlides);
    }
    // A plain tap/click no longer opens the zoom viewer — only the
    // magnifier button does.
  };

  const onPointerEnterStage = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setZooming(true);
  };
  const onPointerLeaveStage = (e: React.PointerEvent<HTMLDivElement>) => {
    setZooming(false);
    // Note: with pointer capture in place, a drag that started here keeps
    // receiving move/up events even after the pointer visually leaves this
    // element, so we deliberately do NOT end the drag on leave.
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
            ref={stageRef}
            className="group/stage relative aspect-[4/5] w-full cursor-grab overflow-hidden border border-border/60 bg-muted active:cursor-grabbing sm:rounded-xl"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onPointerDownStage}
            onPointerMove={onPointerMoveStage}
            onPointerUp={endDragStage}
            onPointerCancel={endDragStage}
            onPointerEnter={onPointerEnterStage}
            onPointerLeave={onPointerLeaveStage}
          >
            {/* Every image sits side by side in one strip; only the transform
                moves. Nothing swaps or remounts as you slide, so there's
                never a blank/white flash — and the strip tracks your finger
                in real time, whether you nudge it slowly or flick past
                several photos at once. */}
            <div
              className="flex h-full"
              style={{
                width: `${valid.length * 100}%`,
                transform: `translateX(calc(${-(active * 100) / valid.length}% + ${dragOffset}px))`,
                transition: isDragging ? 'none' : 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {valid.map((img, idx) => (
                <div key={`${idx}-${img}`} className="relative h-full shrink-0" style={{ width: `${100 / valid.length}%` }}>
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
                      idx === active && zooming && !isDragging ? 'sm:opacity-0' : 'opacity-100'
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Desktop hover-zoom magnifier: swaps in a scaled background image
                that tracks the cursor — the "inspect the fabric" zoom. Only
                mounted while actually hovering (and not mid-drag), so it costs
                nothing until the user shows intent to zoom. */}
            {zooming && !isDragging && (
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
