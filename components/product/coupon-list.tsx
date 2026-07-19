'use client';

import { useEffect, useState } from 'react';
import { Tag, Copy, Check } from 'lucide-react';
import { fetchProductPageCoupons, Coupon } from '@/lib/coupons-api';
import { formatINR } from '@/lib/format';
import { toast } from 'sonner';

function describeDiscount(c: Coupon) {
  return c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `${formatINR(c.discount_value)} OFF`;
}

export default function CouponList() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchProductPageCoupons()
      .then(setCoupons)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard access can fail (e.g. insecure context); still show the code was picked.
    }
    setCopiedCode(code);
    toast.success(`Code "${code}" copied — paste it at checkout to apply`);
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
  };

  if (loading || coupons.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Tag className="h-4 w-4 text-secondary" />
        Available Coupons
      </div>
      <div className="flex flex-col gap-2">
        {coupons.map((c) => (
          <div
            key={c.id}
            className="relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-dashed border-secondary/60 bg-secondary/10 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wide text-primary">{c.code}</span>
                <span className="text-xs font-semibold text-secondary-foreground">
                  {describeDiscount(c)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {c.min_order_value > 0
                  ? `On orders above ${formatINR(c.min_order_value)}`
                  : 'No minimum order value'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleApply(c.code)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-primary bg-background px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {copiedCode === c.code ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Applied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Apply
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
