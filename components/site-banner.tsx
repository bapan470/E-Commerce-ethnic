'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { fetchSiteBanner } from '@/lib/settings-api';

/**
 * Promotional banner (set from Admin > Store Settings). Shows on every
 * page EXCEPT checkout, same as the original storewide behavior — with
 * one carve-out: the home page and individual product pages are each
 * gated by their own toggle (Admin > Settings > Site Banner > "Show on
 * home page" / "Show on product page"), since those two pages often want
 * the banner turned off independently of everywhere else. Every other
 * page (shop, category, etc.) always shows the banner whenever one is
 * set, exactly like before these toggles existed.
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

  const isCheckout = pathname?.startsWith('/checkout');
  const isHome = pathname === '/';
  const isProduct = pathname?.startsWith('/product/');
  // Home/product are toggle-gated; every other non-checkout page keeps
  // the original always-on behavior.
  const allowedHere = isHome ? showOnHome : isProduct ? showOnProduct : !isCheckout;

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
