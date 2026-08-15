'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchSiteBanner } from '@/lib/settings-api';

/**
 * Promotional banner (set from Admin > Store Settings). Only ever shows
 * on the home page and/or individual product pages, and only on whichever
 * of those two the admin has explicitly switched on (Admin > Settings >
 * Site Banner > "Show on home page" / "Show on product page") — it no
 * longer shows storewide by default. Renders nothing until an image is
 * set and at least one of those toggles is on for the current page.
 */
export default function SiteBanner() {
  const pathname = usePathname();
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showOnHome, setShowOnHome] = useState(false);
  const [showOnProduct, setShowOnProduct] = useState(false);

  useEffect(() => {
    fetchSiteBanner()
      .then((b) => {
        setImageUrl(b.image_url || '');
        setLinkUrl(b.link_url || '');
        setShowOnHome(!!b.show_on_home);
        setShowOnProduct(!!b.show_on_product);
      })
      .catch(() => {});
  }, []);

  const isHome = pathname === '/';
  const isProduct = pathname?.startsWith('/product/');
  const allowedHere = (isHome && showOnHome) || (isProduct && showOnProduct);

  if (!imageUrl || !allowedHere) return null;

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
