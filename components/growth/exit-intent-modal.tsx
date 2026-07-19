'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { X, Copy, Check } from 'lucide-react';
import { fetchGrowthSettings, GrowthSettings } from '@/lib/growth-api';

const SHOWN_KEY = 'exit_intent_shown_at';
const COOLDOWN_HOURS = 24;

export default function ExitIntentModal() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchGrowthSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const maybeShow = useCallback(() => {
    if (!settings?.exit_intent_enabled) return;
    const shownAt = Number(sessionStorage.getItem(SHOWN_KEY) || 0);
    const hoursSince = (Date.now() - shownAt) / 3_600_000;
    if (shownAt && hoursSince < COOLDOWN_HOURS) return;
    sessionStorage.setItem(SHOWN_KEY, String(Date.now()));
    setOpen(true);
  }, [settings]);

  useEffect(() => {
    if (!settings?.exit_intent_enabled || pathname?.startsWith('/admin')) return;

    const onMouseLeave = (e: MouseEvent) => {
      // Only trigger when the cursor exits toward the top of the viewport
      // (heading for the tab bar / address bar), the classic exit-intent signal.
      if (e.clientY <= 0) maybeShow();
    };

    // Small delay so it can't fire the instant the page loads.
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', onMouseLeave);
    }, 4000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [settings, pathname, maybeShow]);

  if (pathname?.startsWith('/admin') || !open || !settings) return null;

  const copyCode = () => {
    navigator.clipboard?.writeText(settings.exit_intent_coupon_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-sm rounded-lg bg-card p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-serif text-xl font-bold text-primary">{settings.exit_intent_headline}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{settings.exit_intent_message}</p>

        <button
          type="button"
          onClick={copyCode}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary bg-primary/5 px-4 py-3 font-mono text-base font-bold tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          {settings.exit_intent_coupon_code}
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {copied ? 'Copied! Paste it at checkout.' : 'Tap to copy, then apply it at checkout.'}
        </p>
      </div>
    </div>
  );
}
