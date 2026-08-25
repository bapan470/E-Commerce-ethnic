'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Real mobile browsers (iOS Safari, and some Android WebViews/Chrome
 * builds) can cache the painted layer of an element that uses
 * `position: sticky` together with `backdrop-filter` — once that element is
 * "stuck" to the viewport, the browser only repaints its contents on the
 * next scroll or touch event, not on a normal React re-render. Desktop
 * browsers (and desktop DevTools' mobile *emulation*, which still runs the
 * desktop rendering/compositing pipeline) don't reproduce this, which is
 * why the exact same code can look perfectly instant in an inspector's
 * mobile view and still visibly lag on a real iPhone/Android until the
 * user happens to tap or scroll.
 *
 * This hook nudges the element's transform by a fraction of a pixel and
 * back on the very next animation frame whenever any value in `deps`
 * changes. That forces the browser to recomposite the layer immediately —
 * with no visible movement, since translateZ(0) and translateZ(0.01px)
 * render identically — instead of waiting for the user to scroll or tap.
 */
export function useForceMobileRepaint<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: unknown[]
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translateZ(0.01px)';
    const raf = requestAnimationFrame(() => {
      el.style.transform = 'translateZ(0)';
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
