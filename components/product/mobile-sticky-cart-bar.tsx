'use client';

import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/format';

interface MobileStickyCartBarProps {
  name: string;
  price: number;
  mrp?: number | null;
  inStock: boolean;
  onAdd: () => void;
}

// Fixed bottom bar shown only on small screens on the product detail page,
// so shoppers can add to cart without scrolling back up to the buy box.
export default function MobileStickyCartBar({
  name,
  price,
  mrp,
  inStock,
  onAdd,
}: MobileStickyCartBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{name}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-bold text-primary">{formatINR(price)}</span>
          {mrp && mrp > price && (
            <span className="text-xs text-muted-foreground line-through">{formatINR(mrp)}</span>
          )}
        </div>
      </div>
      <Button
        onClick={onAdd}
        disabled={!inStock}
        className="shrink-0 gap-2 bg-primary text-primary-foreground disabled:opacity-50"
      >
        <ShoppingBag className="h-4 w-4" />
        {inStock ? 'Add to Cart' : 'Out of Stock'}
      </Button>
    </div>
  );
}
