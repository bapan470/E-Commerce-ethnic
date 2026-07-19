'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchSiteBanner } from '@/lib/settings-api';

/**
 * Site-wide promotional banner (set from Admin > Store Settings).
 * Shows on every page EXCEPT checkout, so nothing distracts from
 * completing the order there. Renders nothing until an image is set.
 */
export default function SiteBanner() {
  const pathname = usePathname();
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    fetchSiteBanner()
      .then((b) => {
        setImageUrl(b.image_url || '');
        setLinkUrl(b.link_url || '');
      })
      .catch(() => {});
  }, []);

  const isCheckout = pathname?.startsWith('/checkout');

  if (!imageUrl || isCheckout) return null;

  const img = (
    <Image
      src={imageUrl}
      alt="Promotional banner"
      width={1600}
      height={400}
      sizes="100vw"
      priority
      className="h-auto w-full object-cover"
    />
  );

  return (
    <div className="w-full">
      {linkUrl ? (
        <Link href={linkUrl} className="block">
          {img}
        </Link>
      ) : (
        img
      )}
    </div>
  );
}
