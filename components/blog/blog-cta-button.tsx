'use client';

import Link from 'next/link';

// Same visual CTA as before, but now a client component so it can fire a
// GA4 event on click. Every click sends `blog_slug` as a standard event
// parameter — no custom-dimension registration needed in GA4 because
// `pagePath` (which the admin blog-performance report groups by) is
// automatically attached to every event GA4 collects, custom or not.
export default function BlogCtaButton({
  categorySlug,
  categoryName,
  blogSlug,
}: {
  categorySlug: string;
  categoryName: string;
  blogSlug: string;
}) {
  const handleClick = () => {
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'blog_cta_click', {
        blog_slug: blogSlug,
        cta_type: 'category',
        target: categorySlug,
      });
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-6 text-center">
      <p className="font-serif text-lg font-semibold text-foreground">
        Shop the {categoryName} collection
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Handpicked pieces, straight from the weavers.
      </p>
      <Link
        href={`/category/${categorySlug}`}
        onClick={handleClick}
        className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Browse {categoryName}
      </Link>
    </div>
  );
}
