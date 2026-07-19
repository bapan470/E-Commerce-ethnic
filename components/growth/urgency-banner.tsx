'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { fetchGrowthSettings, GrowthSettings } from '@/lib/growth-api';

const DISMISS_KEY = 'urgency_banner_dismissed_at';
const DISMISS_HOURS = 12;

export default function UrgencyBanner() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<GrowthSettings | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchGrowthSettings()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        const dismissedAt = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
        const hoursSince = (Date.now() - dismissedAt) / 3_600_000;
        setDismissed(hoursSince < DISMISS_HOURS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  if (pathname?.startsWith('/admin')) return null;
  if (!settings?.urgency_banner_enabled || !settings.urgency_banner_text?.trim() || dismissed) {
    return null;
  }

  return (
    <div className="relative z-50 flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
      <span>{settings.urgency_banner_text}</span>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-3 rounded p-0.5 hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
