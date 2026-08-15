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
 * images/videos (Admin > Hero Banners). Each slide is a plain, full-width
 * banner; if it has a link it's clickable, but the link itself is never
 * rendered as visible text/UI over the media — the whole slide is just
 * the click target. Falls back to a single static banner automatically
 * when there's only one image (no dots/arrows needed for one slide).
 *
 * Sizing: the slide box keeps its original on-site dimensions — 4:5 on
 * mobile, 16:6 from `sm:` up — unchanged. object-fit stays object-contain,
 * so the full video/image always shows inside that same box with nothing
 * cut off. If a banner's native ratio doesn't exactly match 4:5 / 16:6,
 * the leftover margin is now filled by a blurred, zoomed-in copy of the
 * same media (object-cover + blur, sitting behind the sharp contain
 * layer) instead of a flat bg-muted strip — same idea as Spotify/YouTube's
 * ambient backdrop. Videos reuse their poster frame for that backdrop (one
 * image, not a second video decode); a video slide with no poster set
 * just keeps the plain bg-muted margin as before — add a "Cover frame" for
 * it in Admin > Hero Banners to get the blurred backdrop there too.
 * Exporting media at exactly 4:5 (mobile) / 16:6 (desktop) still fills the
 * box edge-to-edge with no backdrop needed at all.
 *
 * Timing: image slides advance on the fixed AUTOPLAY_MS timer, same as
 * before. Video slides ignore that timer entirely and instead advance the
 * instant their own playback finishes, so a video is always shown start
 * to end before the carousel moves on.
 */
export default function HeroBannerCarousel({ banners }: HeroBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  // Tracks whether we're below the `sm` breakpoint so banners with a
  // mobile-specific image/video (set in Admin > Hero Banners) can swap
  // to it. Starts as `false` (desktop) to match the server-rendered
  // output, then corrects itself the instant the component mounts —
  // avoids the layout ever depending on a guess about the device.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Which media type is actually showing right now, factoring in the
  // mobile override — drives whether autoplay is timer-based (image) or
  // driven by the video's own "ended" event, below.
  const activeBanner = banners[index];
  const activeUsesMobileMedia =
    !!activeBanner && isMobile && activeBanner.mobile_media_type !== null && !!activeBanner.mobile_image_url;
  const activeMediaType: 'image' | 'video' = activeBanner
    ? activeUsesMobileMedia
      ? activeBanner.mobile_media_type!
      : activeBanner.media_type
    : 'image';

  // Image slides: unchanged 5s-per-slide timer (pauses on hover). Video
  // slides skip this timer entirely — they advance themselves via the
  // <video onEnded> handler below, once playback actually finishes.
  useEffect(() => {
    if (banners.length <= 1) return;
    if (activeMediaType === 'video') return;
    const id = setInterval(() => {
      if (!pausedRef.current) {
        setIndex((i) => (i + 1) % banners.length);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [banners.length, index, activeMediaType]);

  // Video slides: only the active slide plays. Every other video stays
  // paused (no point burning bandwidth/battery off-screen), and whenever
  // a video becomes the active slide it restarts from 0 — so the viewer
  // always sees the whole clip, start to finish, before it advances.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (el && Number(key) !== index) el.pause();
    });
    if (activeMediaType !== 'video') return;
    const el = videoRefs.current[index];
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {
      // Autoplay can still be blocked in rare cases even when muted;
      // the poster frame just stays put then — nothing to advance to.
    });
  }, [index, activeMediaType]);

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
          // Use the mobile-specific media only on phones and only when
          // the admin actually set one — otherwise every screen size
          // just uses the desktop fields, same as before this feature.
          const useMobileMedia = isMobile && b.mobile_media_type !== null && !!b.mobile_image_url;
          const mediaType = useMobileMedia ? b.mobile_media_type! : b.media_type;
          const mediaUrl = useMobileMedia ? b.mobile_image_url! : b.image_url;
          const posterSrc = useMobileMedia ? b.mobile_poster_url : b.poster_url;
          const isSoleBanner = banners.length <= 1;

          // Video backdrops reuse the poster frame (one small image) rather
          // than a second <video>, which would decode the same clip twice
          // just for a blurred background — not worth the CPU/battery cost.
          const backdropSrc = mediaType === 'video' ? posterSrc : mediaUrl;

          const slide = (
            <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-muted sm:aspect-[16/6]">
              {backdropSrc && (
                <Image
                  key={`${mediaUrl}-backdrop`}
                  src={toPublicMediaUrl(backdropSrc) ?? backdropSrc}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="100vw"
                  className="z-0 scale-110 object-cover object-center blur-2xl brightness-75"
                />
              )}
              {mediaType === 'video' ? (
                // Muted + playsInline is required for autoplay to work at
                // all on mobile Safari/Chrome (their autoplay policies
                // block unmuted video outright). Only the active slide
                // (i === index) actually plays — see the effect above —
                // and it only loops on its own when it's the sole banner;
                // otherwise it plays once and `onEnded` advances the
                // carousel, so a video is always shown in full before the
                // next slide appears. object-contain (not cover) means
                // the whole frame always shows inside the same 4:5 /
                // 16:6 box the image slides use — nothing gets cropped;
                // the blurred backdrop above fills whatever margin is left.
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  key={mediaUrl}
                  ref={(el) => {
                    videoRefs.current[i] = el;
                  }}
                  src={toPublicMediaUrl(mediaUrl) ?? mediaUrl}
                  poster={posterSrc ? toPublicMediaUrl(posterSrc) ?? posterSrc : undefined}
                  autoPlay={i === index}
                  muted
                  loop={isSoleBanner}
                  playsInline
                  preload={i === index ? 'auto' : 'metadata'}
                  onEnded={() => {
                    if (!isSoleBanner && i === index) go(index + 1);
                  }}
                  className="absolute inset-0 z-10 h-full w-full object-contain"
                />
              ) : (
                <Image
                  key={mediaUrl}
                  src={toPublicMediaUrl(mediaUrl) ?? mediaUrl}
                  alt=""
                  fill
                  priority={i === 0}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  sizes="100vw"
                  className="z-10 object-contain"
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
