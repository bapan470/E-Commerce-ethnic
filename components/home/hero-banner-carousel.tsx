'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { HeroBanner } from '@/lib/hero-banners-api';
import { toPublicMediaUrl } from '@/lib/media-url';

const AUTOPLAY_MS = 5000;

interface HeroBannerCarouselProps {
  banners: HeroBanner[];
}

/**
 * Homepage hero carousel — auto-rotates through admin-uploaded banner
 * images (Admin > Hero Banners). Each slide is a plain, full-width image;
 * if the banner has a link it's clickable, but the link itself is never
 * rendered as visible text/UI over the image — the whole slide is just
 * the click target. Falls back to a single static banner automatically
 * when there's only one image (no dots/arrows needed for one slide).
 */
export default function HeroBannerCarousel({ banners }: HeroBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setIndex((i) => (i + 1) % banners.length);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const go = (next: number) => {
    const len = banners.length;
    setIndex(((next % len) + len) % len);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      go(index + (delta < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  };

  return (
    <section
      className="group relative w-full overflow-hidden"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => {
          const slide = (
            <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden sm:aspect-[16/6]">
              {b.media_type === 'video' ? (
                // Muted + loop + playsInline is required for autoplay to
                // work at all on mobile Safari/Chrome (their autoplay
                // policies block unmuted video outright) -- this also
                // means the banner can never surprise someone with sound.
                // Same responsive box as the image case (aspect-[4/5] on
                // mobile, aspect-[16/6] from sm: up) via object-cover, so
                // video and image banners line up identically on both
                // desktop and mobile.
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={toPublicMediaUrl(b.image_url) ?? b.image_url}
                  poster={b.poster_url ? toPublicMediaUrl(b.poster_url) ?? b.poster_url : undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload={i === 0 ? 'auto' : 'metadata'}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={toPublicMediaUrl(b.image_url) ?? b.image_url}
                  alt=""
                  fill
                  priority={i === 0}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  sizes="100vw"
                  className="object-cover"
                />
              )}
            </div>
          );
          return b.link_url ? (
            <Link key={b.id} href={b.link_url} className="block w-full shrink-0">
              {slide}
            </Link>
          ) : (
            <div key={b.id} className="w-full shrink-0">
              {slide}
            </div>
          );
        })}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(index - 1)}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-background/30 sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(index + 1)}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/20 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-background/30 sm:flex"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
