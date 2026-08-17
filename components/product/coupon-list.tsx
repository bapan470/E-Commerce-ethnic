'use client';

import { useEffect, useState } from 'react';
import { Tag, Check } from 'lucide-react';
import { fetchProductPageCoupons, validateCoupon, Coupon } from '@/lib/coupons-api';
import { formatINR } from '@/lib/format';
import { toast } from 'sonner';

function describeDiscount(c: Coupon) {
  return c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `${formatINR(c.discount_value)} OFF`;
}

interface CouponListProps {
  productPrice: number;
  appliedCode: string | null;
  onApply: (coupon: Coupon, discount: number) => void;
  onRemove: () => void;
}

export default function CouponList({ productPrice, appliedCode, onApply, onRemove }: CouponListProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    fetchProductPageCoupons()
      .then(setCoupons)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClick = async (c: Coupon) => {
    if (appliedCode === c.code) {
      onRemove();
      return;
    }
    setApplying(c.code);
    try {
      const result = await validateCoupon(c.code, productPrice);
      if (!result.ok || !result.coupon) {
        toast.error(result.error || 'Could not apply this coupon');
        return;
      }
      onApply(result.coupon, result.discount || 0);
      toast.success(`Coupon "${c.code}" applied`);
    } finally {
      setApplying(null);
    }
  };

  if (loading || coupons.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
        Available Coupons
      </div>
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {coupons.map((c) => {
          const isApplied = appliedCode === c.code;
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold tracking-wide text-foreground">
                    {c.code}
                  </span>
                  <span className="text-xs text-muted-foreground">{describeDiscount(c)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.min_order_value > 0
                    ? `On orders above ${formatINR(c.min_order_value)}`
                    : 'No minimum order value'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleClick(c)}
                disabled={applying === c.code}
                className={`shrink-0 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  isApplied ? 'text-emerald-600' : 'text-primary hover:underline'
                }`}
              >
                {isApplied ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Applied
                  </span>
                ) : applying === c.code ? (
                  'Applying…'
                ) : (
                  'Apply'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
