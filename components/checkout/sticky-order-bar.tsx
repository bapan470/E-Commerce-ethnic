'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Loader2, ChevronRight, BadgePercent } from 'lucide-react';
import { toPublicMediaUrl } from '@/lib/media-url';
import { formatINR } from '@/lib/format';
import type { CartItem } from '@/lib/types';

interface StickyOrderBarProps {
  items: CartItem[];
  payableTotal: number;
  totalSavings: number;
  paymentMethod: 'online' | 'cod';
  onlineDiscountPercent: number;
  placing: boolean;
  formId: string;
}

// Sticky bar pinned just under the site header on the checkout page. Keeps
// the product the customer is buying, the price, and how much they're
// saving in view at all times — including while they're filling in the
// address/payment form further down — so nothing about "what am I even
// paying for" ever needs a scroll back up to check.
export default function StickyOrderBar({
  items,
  payableTotal,
  totalSavings,
  paymentMethod,
  onlineDiscountPercent,
  placing,
  formId,
}: StickyOrderBarProps) {
  if (items.length === 0) return null;

  const primaryItem = items[0];
  const extraCount = items.length - 1;
  const thumbnail =
    toPublicMediaUrl(primaryItem.product.images?.[0]) || 'https://placehold.co/64x64?text=No+Image';

  return (
    <div className="sticky top-12 z-30 -mx-4 mb-6 border-b border-border/60 bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur-md sm:mx-0 sm:rounded-lg sm:border sm:px-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/product/${primaryItem.product.slug}`}
          className="relative h-12 w-11 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border/60 transition-opacity hover:opacity-80"
          aria-label={`View ${primaryItem.product.name}`}
        >
          <Image
            src={thumbnail}
            alt={primaryItem.product.name}
            fill
            sizes="44px"
            className="object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            href={`/product/${primaryItem.product.slug}`}
            className="line-clamp-1 flex items-center gap-0.5 text-xs font-semibold text-foreground hover:text-primary sm:text-sm"
          >
            {primaryItem.product.name}
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {extraCount > 0 && (
              <span className="text-[11px] text-muted-foreground">
                + {extraCount} more item{extraCount > 1 ? 's' : ''}
              </span>
            )}
            {totalSavings > 0 && (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                You save {formatINR(totalSavings)}
              </span>
            )}
            {onlineDiscountPercent > 0 && (
              <span className="hidden items-center gap-0.5 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground sm:inline-flex">
                <BadgePercent className="h-3 w-3" />
                {paymentMethod === 'online'
                  ? `${onlineDiscountPercent}% off applied`
                  : `Extra ${onlineDiscountPercent}% off on online payment`}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="font-serif text-base font-bold text-primary sm:text-lg">
              {formatINR(payableTotal)}
            </p>
            <p className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
              <ShieldCheck className="h-3 w-3" />
              Secure checkout
            </p>
          </div>
          <button
            type="submit"
            form={formId}
            disabled={placing}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
          >
            {placing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                {paymentMethod === 'cod' ? 'Place Order' : 'Pay Now'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
