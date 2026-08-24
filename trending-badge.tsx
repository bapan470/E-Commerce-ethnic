/**
 * Trending Badge Component
 * Displays a visual indicator when a product is trending/popular
 * Shows on product cards when a product ranks in top 10 or has high engagement
 */

import { Flame } from 'lucide-react';

interface TrendingBadgeProps {
  /** Product's rank index from popularity ranking (0 = most popular) */
  rankIndex?: number;
  /** Whether product is in top 10 popular products */
  isTopPopular?: boolean;
  /** Show "TRENDING" text (true) or just flame icon (false) */
  showText?: boolean;
  /** Optional custom className for styling */
  className?: string;
}

export default function TrendingBadge({
  rankIndex,
  isTopPopular = false,
  showText = true,
  className = '',
}: TrendingBadgeProps) {
  // Show badge if explicitly marked OR if rank is in top 10
  const shouldShow = isTopPopular || (rankIndex !== undefined && rankIndex < 10);

  if (!shouldShow) return null;

  return (
    <div
      className={`absolute top-2 right-2 z-10 flex items-center gap-1 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse ${className}`}
    >
      <Flame size={14} />
      {showText && <span>TRENDING</span>}
    </div>
  );
}

/**
 * Badge for products with high engagement (many purchases/views)
 */
export function PopularBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute top-2 right-2 z-10 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${className}`}>
      POPULAR
    </div>
  );
}

/**
 * Badge for new/recently added products
 */
export function NewBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute top-2 right-2 z-10 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${className}`}>
      NEW
    </div>
  );
}

/**
 * Badge for products with high ratings/reviews
 */
export function BestsellerBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute top-2 right-2 z-10 bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ${className}`}>
      BESTSELLER
    </div>
  );
}
