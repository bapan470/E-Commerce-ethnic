'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

interface AnalyticsScriptsProps {
  gaId: string;
  gtmId: string;
  googleAdsId: string;
  pixelId: string;
}

/**
 * Loads GTM / GA4 (gtag.js) / Meta Pixel — but never on /admin/** routes.
 *
 * Previously these scripts lived directly in the root layout's <head>,
 * which meant every admin panel page load also fired a GA4 pageview,
 * a GTM container load, and a Meta Pixel PageView event. That polluted
 * analytics (e.g. "Admin Panel | AruhiHandlooms" showing up as a top
 * page in GA4 Realtime) and could double-count ad conversions.
 *
 * Gating on pathname here keeps the fix in one place and requires no
 * changes to middleware.ts or the existing admin-auth guard.
 */
export default function AnalyticsScripts({
  gaId,
  gtmId,
  googleAdsId,
  pixelId,
}: AnalyticsScriptsProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) return null;

  return (
    <>
      {/* Google Tag Manager — loads GTM container which manages GA4 +
          Google Ads + all other tags from the GTM dashboard.
          Set Container ID in Admin > Marketing > Analytics. */}
      {gtmId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
      )}

      {/* GA4 + Google Ads gtag.js — used when GTM is NOT configured.
          If GTM is set above, manage GA4 and Ads from GTM instead. */}
      {!gtmId && gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
              ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ''}
            `}
          </Script>
        </>
      )}

      {pixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {/* GTM noscript fallback — required by Google */}
      {gtmId && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      )}

      {pixelId && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}
    </>
  );
}
