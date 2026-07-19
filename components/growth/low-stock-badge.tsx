'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { fetchGrowthSettings } from '@/lib/growth-api';

export default function LowStockBadge({ stockQuantity }: { stockQuantity: number }) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    fetchGrowthSettings()
      .then((s) => {
        setEnabled(s.low_stock_enabled);
        setThreshold(s.low_stock_threshold);
      })
      .catch(() => {});
  }, []);

  if (!enabled || stockQuantity <= 0 || stockQuantity > threshold) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
      <Flame className="h-3.5 w-3.5" />
      Only {stockQuantity} left in stock — order soon
    </span>
  );
}
