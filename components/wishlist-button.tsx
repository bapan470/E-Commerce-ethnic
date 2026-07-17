'use client';

import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { addToWishlist, removeFromWishlist, fetchWishlistProductIds } from '@/lib/wishlist-api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function WishlistButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      return;
    }
    fetchWishlistProductIds()
      .then((ids) => setSaved(ids.includes(productId)))
      .catch(() => {});
  }, [user, productId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.info('Login to save items to your wishlist');
      router.push('/login?next=/account/wishlist');
      return;
    }

    setBusy(true);
    try {
      if (saved) {
        await removeFromWishlist(productId);
        setSaved(false);
      } else {
        await addToWishlist(productId);
        setSaved(true);
        toast.success('Saved to wishlist');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full bg-background/90 shadow-sm transition-colors hover:bg-background',
        className
      )}
    >
      <Heart className={cn('h-4 w-4', saved ? 'fill-primary text-primary' : 'text-foreground')} />
    </button>
  );
}
