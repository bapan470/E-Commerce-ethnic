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
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Tag className="h-4 w-4 text-secondary" />
        Available Coupons
      </div>
      <div className="flex flex-col gap-2">
        {coupons.map((c) => {
          const isApplied = appliedCode === c.code;
          return (
            <div
              key={c.id}
              className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-lg border border-dashed px-3 py-2.5 transition-colors ${
                isApplied ? 'border-green-600 bg-green-50' : 'border-secondary/60 bg-secondary/10'
              }`}
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
                onClick={() => handleClick(c)}
                disabled={applying === c.code}
                className={`flex shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  isApplied
                    ? 'border-green-600 bg-green-600 text-white hover:bg-green-700'
                    : 'border-primary bg-background text-primary hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                {isApplied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Applied
                  </>
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
